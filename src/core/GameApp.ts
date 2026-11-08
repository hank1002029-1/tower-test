/**
 * 游戏主入口：装配网格、状态、召唤、棋盘、合成、输入与 HUD。
 * M3 目标：花馒头召唤 → 拖到格子放置 → 同型同级拖一起升级到 5 级（满级封顶）。
 */
import * as THREE from "three";
import { CAMERA, COLORS, GRID, VICTORY_WAVE } from "../config/gameConfig";
import { GridCoords, GridPos } from "../grid/coords";
import { CellType, GridModel } from "../grid/GridModel";
import { GridView } from "../grid/GridView";
import { GamePhase, GameState } from "./GameState";
import { Loop } from "./Loop";
import { BoardSystem } from "../systems/BoardSystem";
import { MergeSystem } from "../systems/MergeSystem";
import { SummonSystem } from "../systems/SummonSystem";
import { MonsterSystem } from "../systems/MonsterSystem";
import { EffectSystem } from "../systems/EffectSystem";
import { GeneralSystem } from "../systems/GeneralSystem";
import { CombatContext } from "../systems/CombatContext";
import { RangeIndicator } from "../systems/RangeIndicator";
import { BoardInput } from "../input/BoardInput";
import { Hud } from "../ui/Hud";
import { Tower } from "../entities/Tower";
import { Farmer } from "../entities/Farmer";
import { GeneralText } from "../entities/GeneralText";
import { Unit } from "../entities/Unit";
import { makeTextMesh } from "../utils/text3d";
import { MAX_TOWER_LEVEL, getTowerLevel } from "../config/towers";
import { MAX_FARMER_LEVEL } from "../config/farmer";
import { getItemLabel, SummonItem } from "../config/summon";
import { ItemType } from "../config/types";
import { getGeneralByName } from "../config/generals";

/** 首波等待时间（对应 Unity WaveStarter 的 8f）。 */
const WAVE_START_DELAY = 8;

/** 触摸设备（手机/平板）：fill-rate 是主要瓶颈，需要更激进的降级策略。 */
const IS_TOUCH =
  typeof window !== "undefined" &&
  (window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window);

/** 像素比上限：桌面 2；触摸设备 1.5（DPR 过高时像素量翻倍，帧率骤降）。 */
const MAX_PIXEL_RATIO = IS_TOUCH ? 1.5 : 2;

export class GameApp {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly loop = new Loop();
  private readonly coords: GridCoords;
  private readonly model: GridModel;
  private readonly gridView: GridView;
  private readonly highlight: THREE.Mesh;
  private readonly resizeHandler = () => this.onResize();
  /** 标签页切到后台时暂停主循环，省电并避免切回时的巨大 dt。 */
  private readonly visibilityHandler = () => {
    if (document.hidden) this.loop.stop();
    else this.loop.start();
  };

  readonly game = new GameState();
  readonly summon = new SummonSystem(this.game);
  readonly board: BoardSystem;
  readonly merge: MergeSystem;
  readonly monsters: MonsterSystem;
  readonly generals: GeneralSystem;
  private readonly effects: EffectSystem;
  private readonly rangeIndicator: RangeIndicator;
  /** 战斗上下文（存活怪物 + 特效），供塔与武将共用。 */
  private readonly combatCtx: CombatContext;
  private readonly input: BoardInput;
  private readonly hud: Hud;

  /** 正在拖拽且可显示射程的单位射程（塔 / 已激活武将）；否则为 null。 */
  private draggingRange: number | null = null;
  /** 正在从召唤栏拖拽的塔的射程（用于显示攻击范围圈）；非塔为 null。 */
  private placingTowerRange: number | null = null;
  /** 点击通道选中的召唤物（再点棋盘格放置）；无选中为 null。 */
  private selectedItem: SummonItem | null = null;
  /** 波次自动启动计时（对应 Unity WaveStarter）。 */
  private waveTimer = 0;
  /** 是否已点「开始迎战」：未开始前不派出任何怪物，玩家可安心布阵。 */
  private started = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !IS_TOUCH, // 移动端关 MSAA：用像素比上限换帧率，水墨块面边缘仍够平滑
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.background = new THREE.Color(COLORS.ground);
    this.scene.fog = new THREE.Fog(COLORS.ground, 18, 34);

    const [cx, cy, cz] = CAMERA.position;
    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far);
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(new THREE.Vector3(...CAMERA.lookAt));

    this.setupLights();

    this.coords = new GridCoords();
    this.model = new GridModel(this.coords);
    this.gridView = new GridView(this.scene, this.model, this.coords);
    this.highlight = this.buildHighlight();

    this.effects = new EffectSystem(this.scene);
    this.monsters = new MonsterSystem(this.scene, this.coords, this.game);
    this.combatCtx = { monsters: this.monsters.alive, effects: this.effects };
    this.board = new BoardSystem(this.scene, this.model, this.coords);
    this.board.setCombat(this.combatCtx);
    this.board.setFarmerProduction((amount) => this.game.addMantou(amount));
    this.generals = new GeneralSystem(this.scene, this.model, this.coords);
    this.merge = new MergeSystem(this.board);
    this.rangeIndicator = new RangeIndicator(this.scene);
    this.setupAhDou();

    this.input = new BoardInput(this.canvas, this.camera, this.coords, this.board, this.scene);
    this.hud = new Hud(this.game, {
      onSummon: () => this.onSummon(),
      onStart: () => this.onStart(),
      onSlotDragStart: (item, el, ev) => {
        ev.preventDefault();
        this.input.beginPlaceDrag(item, el, ev);
      },
      onRestart: () => this.onRestart(),
      gmUnlockAll: () => this.gmUnlockAll(),
      gmStartWave: () => this.gmStartWave(),
      gmAddMantou: () => this.game.addMantou(100),
      gmDamageAhDou: () => this.game.damageAhDou(5),
      gmVictory: () => this.game.victory(),
      gmPlaceGeneral: (name) => this.gmPlaceGeneral(name),
    });
    // 连线重算后刷新武将收集面板
    this.generals.onCollectionChanged = () => this.hud.refreshGenerals(this.generals.getProgressList());

    this.wireEvents();

    this.loop.onUpdate = (dt) => this.update(dt);
    this.loop.onFps = (fps) => this.hud.setFps(fps);

    window.addEventListener("resize", this.resizeHandler);
    window.addEventListener("orientationchange", this.resizeHandler);
    document.addEventListener("visibilitychange", this.visibilityHandler);
    this.onResize();
  }

  start(): void {
    this.loop.start();
    console.log(
      "[M10] 已启动（移动端自适应）。顶栏：阿斗血心/波次/馒头/召唤；右侧：武将收集；GM 面板。" +
        "召唤栏可拖拽或点击选中后放置；棋盘单位可拖拽换位/互换/合成；拖到垃圾桶丢弃。清完第 " +
        VICTORY_WAVE +
        " 波获胜。"
    );
  }

  /** GM：一键解锁全部未开启格。 */
  gmUnlockAll(): void {
    this.model.unlockAll();
    this.gridView.refreshAll();
    console.log("[GM] 已解锁全部格子");
  }

  /** GM：立即开始下一波（跳过 8s 等待）。 */
  gmStartWave(): void {
    this.markStarted();
    if (this.monsters.startNextWave()) {
      this.waveTimer = 0;
      console.log("[GM] 立即开始一波");
    }
  }

  /** GM：在棋盘某行按序放置某武将的全部文字（自动跳过被占格），便于快速验证连线激活。 */
  gmPlaceGeneral(name: string, row = GRID.PathRow - 1, startCol = 1): void {
    const cfg = getGeneralByName(name);
    if (!cfg) {
      console.warn(`[GM] 未知武将：${name}`);
      return;
    }
    let col = startCol;
    for (const ch of cfg.characters) {
      while (col < GRID.Cols && !this.model.canPlaceText(new GridPos(col, row))) col++;
      if (col >= GRID.Cols) {
        console.warn("[GM] 该行已无空位，放置中断");
        return;
      }
      this.board.placeText(ch, name, new GridPos(col, row));
      col++;
    }
    this.generals.reevaluateAll();
    console.log(`[GM] 已放置 ${name} 文字，连线激活=${this.generals.isActive(name)}`);
  }

  /** 灯光：环境光 + 主方向光。 */
  private setupLights(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const dir = new THREE.DirectionalLight(0xffffff, 1.6);
    dir.position.set(8, 16, 10);
    this.scene.add(dir);
  }

  /** 阿斗：金色球 + 名字标签 + 点光源，位于路径终点（最右列）。 */
  private setupAhDou(): void {
    const w = this.coords.gridToWorld(new GridPos(GRID.Cols - 1, GRID.PathRow));

    const ballGeo = new THREE.SphereGeometry(0.45, 20, 16);
    const ballMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.95, 0.8, 0.2),
      roughness: 0.4,
      metalness: 0.1,
    });
    const ball = new THREE.Mesh(ballGeo, ballMat);
    ball.position.set(w.x, 0.5, w.z);
    this.scene.add(ball);

    const label = makeTextMesh("阿斗", {
      fontSize: 120,
      color: COLORS.textDefault,
      strokeColor: COLORS.textStroke,
      strokeWidth: 6,
      planeHeight: 0.6,
    });
    label.rotation.x = -Math.PI / 2;
    label.position.set(w.x, 1.1, w.z);
    this.scene.add(label);

    const light = new THREE.PointLight(new THREE.Color(0.9, 0.8, 0.3), 1.5, 5);
    light.position.set(w.x, 1.2, w.z);
    this.scene.add(light);
  }

  private wireEvents(): void {
    this.game.onMantouChanged = () => this.hud.refreshMantou();
    this.game.onSummonCountChanged = () => this.hud.refreshSummon();
    this.game.onAhDouHpChanged = (cur, max) => this.hud.setAhDou(cur, max);
    this.game.onGameOver = (phase) => this.onGameOver(phase);

    this.summon.onSummon = () => {
      this.setSelected(null); // 新一批召唤物，清除旧选中
      this.hud.renderBar(this.summon.currentItems);
    };
    this.summon.onItemTaken = () => this.hud.renderBar(this.summon.currentItems);
    this.summon.onItemsCleared = () => this.hud.renderBar([]);

    this.input.onPlaceItem = (item, pos) => this.tryPlaceItem(item, pos);
    this.input.onUnitDrop = (unit, pos) => this.tryDropUnit(unit, pos);
    this.input.onDiscardUnit = (unit) => this.onDiscardUnit(unit);
    this.input.onDiscardItem = (item) => this.onDiscardItem(item);
    this.input.onSlotClick = (item) => this.toggleSelected(item);
    this.input.onPlaceSelectedAt = (pos) => {
      if (this.selectedItem) this.tryPlaceItem(this.selectedItem, pos);
    };
    this.input.onUnitDragStart = (unit) => {
      if (unit instanceof Tower) this.draggingRange = unit.levelConfig.range;
      else if (unit instanceof GeneralText && unit.connected) {
        this.draggingRange = this.generals.getActiveUnit(unit.generalName)?.config.baseRange ?? null;
      } else this.draggingRange = null;
    };
    this.input.onUnitDragEnd = () => {
      this.draggingRange = null;
      this.rangeIndicator.hide();
    };
    this.input.onPlaceDragStart = (item) => {
      switch (item.type) {
        case ItemType.Blade:
        case ItemType.Spear:
        case ItemType.Cavalry:
        case ItemType.Bow:
          this.placingTowerRange =
            item.towerType !== null ? getTowerLevel(item.towerType, item.level).range : null;
          break;
        default:
          this.placingTowerRange = null;
      }
    };
    this.input.onPlaceDragEnd = () => {
      this.placingTowerRange = null;
      this.rangeIndicator.hide();
    };
    this.input.onHover = (pos, valid) => this.updateHighlight(pos, valid);
    this.input.canDropItemAt = (item, pos) => this.canPlaceItem(item, pos);
    this.input.canDropUnitAt = (unit, pos) => this.canDropUnit(unit, pos);

    this.monsters.onWaveStarted = (wave) => {
      this.hud.setWave(wave);
      this.hud.setStatus(`第 ${wave} 波来袭`);
    };
    this.monsters.onWaveCleared = (wave) => {
      this.hud.setStatus(`第 ${wave} 波已清`);
      if (wave >= VICTORY_WAVE) this.game.victory();
    };
  }

  private update(dt: number): void {
    this.game.update(dt);
    this.updateWaveStarter(dt);
    // 非 Playing（胜利/失败）时冻结怪物与塔，仅保留渲染与特效收尾
    if (this.game.phase === GamePhase.Playing) {
      this.monsters.update(dt);
      this.board.update(dt);
      this.generals.update(dt, this.combatCtx);
    }
    this.effects.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  /** 波次自动启动：非战斗期累积计时，满 8s 开始下一波（对应 Unity WaveStarter）。 */
  private updateWaveStarter(dt: number): void {
    if (!this.started) return;
    if (this.game.phase !== GamePhase.Playing) return;
    if (this.monsters.waveActive) return;
    this.waveTimer += dt;
    if (this.waveTimer >= WAVE_START_DELAY) {
      this.waveTimer = 0;
      this.monsters.startNextWave();
    }
  }

  /** 一局结束：显示结束面板（文案/配色对齐 Unity UIManager.OnGameOver）。 */
  private onGameOver(phase: GamePhase): void {
    const win = phase === GamePhase.Victory;
    this.setSelected(null);
    this.hud.setStatus(win ? "胜利" : "失败");
    this.hud.showGameOver(win);
    console.log(win ? "[M5] 胜利！阿斗保住了！" : "[M5] 兵败...阿斗被掳走了");
  }

  /** 再战一场：对应 Unity UIManager.OnRestart 的整场重载（Web 端直接刷新页面）。 */
  private onRestart(): void {
    location.reload();
  }

  /** 点击「开始迎战」：正式开局并立刻派出第一波（玩家可先布阵），之后的波次沿用自动计时。 */
  private onStart(): void {
    if (this.started) return;
    this.markStarted();
    this.monsters.startNextWave();
    console.log("[M11] 开始迎战：第一波出动");
  }

  /** 标记已开局并隐藏开始按钮（手动开始与 GM 立即出怪共用）。 */
  private markStarted(): void {
    if (this.started) return;
    this.started = true;
    this.hud.hideStart();
  }

  private onSummon(): void {
    if (this.game.phase !== GamePhase.Playing) return;
    this.summon.trySummon();
  }

  // ===================== 召唤栏选中（点击通道） / 丢弃 =====================

  /** 设置当前选中的召唤物（同步输入控制器与 HUD 高亮）。 */
  private setSelected(item: SummonItem | null): void {
    this.selectedItem = item;
    this.input.selectedItem = item;
    this.hud.setSelected(item);
    if (item) console.log(`[选中] ${getItemLabel(item)}（再点棋盘格放置）`);
  }

  /** 点击召唤栏格子：点同一个即取消选中，否则切换选中（对应 Unity SelectItem）。 */
  private toggleSelected(item: SummonItem): void {
    this.setSelected(this.selectedItem === item ? null : item);
  }

  /** 把棋盘上的单位拖到垃圾桶丢弃（武将文字会触发连线重算）。 */
  private onDiscardUnit(unit: Unit): void {
    this.board.remove(unit);
    if (unit instanceof GeneralText) this.generals.reevaluateAll();
    console.log(`[丢弃] 已丢弃棋盘单位 kind=${unit.kind}`);
  }

  /** 把召唤栏物品拖到垃圾桶丢弃。 */
  private onDiscardItem(item: SummonItem): void {
    this.summon.takeItem(item);
    if (this.selectedItem === item) this.setSelected(null);
    console.log(`[丢弃] 已丢弃召唤物 ${getItemLabel(item)}`);
  }

  // ===================== 召唤物放置 =====================

  /** 召唤物在该格是否可放置（含"直接拖到同型同级单位上合成"）。 */
  private canPlaceItem(item: SummonItem, pos: GridPos): boolean {
    const cell = this.model.getCell(pos);
    if (!cell) return false;
    switch (item.type) {
      case ItemType.Blade:
      case ItemType.Spear:
      case ItemType.Cavalry:
      case ItemType.Bow:
        return this.model.canPlaceTower(pos) || this.canMergeIntoTower(cell.tower, item);
      case ItemType.Farmer:
        return this.model.canPlaceFarmer(pos) || this.canMergeIntoFarmer(cell.farmer, item);
      case ItemType.Shovel:
        return cell.type === CellType.Locked;
      case ItemType.GeneralText:
        return this.model.canPlaceText(pos) || this.canUpgradeGeneralAt(pos, item);
      default:
        return false;
    }
  }

  /** 落点是否为某已形成武将的连线文字块，且可用当前召唤文字合成升级（对应 Unity CanUpgradeGeneralAt）。 */
  private canUpgradeGeneralAt(pos: GridPos, item: SummonItem): boolean {
    if (!item.generalName) return false;
    const t = this.model.getText(pos);
    return (
      t instanceof GeneralText &&
      t.connected &&
      t.generalName === item.generalName &&
      this.generals.canUpgrade(t.generalName)
    );
  }

  private canMergeIntoTower(tower: object | null, item: SummonItem): boolean {
    return (
      tower instanceof Tower &&
      item.towerType !== null &&
      tower.towerType === item.towerType &&
      tower.level === item.level &&
      tower.level < MAX_TOWER_LEVEL
    );
  }

  private canMergeIntoFarmer(farmer: object | null, item: SummonItem): boolean {
    return (
      farmer instanceof Farmer && farmer.level === item.level && farmer.level < MAX_FARMER_LEVEL
    );
  }

  private tryPlaceItem(item: SummonItem, pos: GridPos): void {
    const cell = this.model.getCell(pos);
    if (!cell) return;
    let placed = false;
    let tower: Tower | null = null;
    let farmer: Farmer | null = null;

    switch (item.type) {
      case ItemType.Blade:
      case ItemType.Spear:
      case ItemType.Cavalry:
      case ItemType.Bow:
        if (this.model.canPlaceTower(pos) && item.towerType !== null) {
          tower = this.board.placeTower(item.towerType, item.level, pos);
          placed = !!tower;
        } else if (this.canMergeIntoTower(cell.tower, item) && cell.tower instanceof Tower) {
          this.board.upgrade(cell.tower);
          placed = true;
        }
        break;

      case ItemType.Farmer:
        if (this.model.canPlaceFarmer(pos)) {
          farmer = this.board.placeFarmer(item.level, pos);
          placed = !!farmer;
        } else if (this.canMergeIntoFarmer(cell.farmer, item) && cell.farmer instanceof Farmer) {
          this.board.upgrade(cell.farmer);
          placed = true;
        }
        break;

      case ItemType.Shovel:
        placed = this.model.unlockCell(pos);
        if (placed) this.gridView.refreshCell(pos);
        break;

      case ItemType.GeneralText:
        if (this.canUpgradeGeneralAt(pos, item)) {
          // 拖到已形成武将的文字块上 —— 用该文字合成升级该武将，文字被消耗
          this.generals.upgradeGeneral(item.generalName);
          placed = true;
        } else {
          placed = !!this.board.placeText(item.generalChar, item.generalName, pos);
        }
        break;
    }

    if (placed) {
      // 文字放置 / 升级都会影响连线，重算所有武将状态
      if (item.type === ItemType.GeneralText) this.generals.reevaluateAll();
      console.log(`[放置] 成功: ${getItemLabel(item)} -> ${pos.toString()}`);
      const wasSelected = this.selectedItem === item;
      this.summon.takeItem(item);
      if (wasSelected) this.setSelected(null);
    } else {
      console.warn(`[放置] 失败: ${getItemLabel(item)} -> ${pos.toString()}（格子类型=${CellType[cell.type]}）`);
    }
  }

  // ===================== 棋盘单位落格 =====================

  /** 棋盘单位在该格是否可落（可合成 / 可交换 / 可移动）。 */
  private canDropUnit(unit: Unit, pos: GridPos): boolean {
    const cell = this.model.getCell(pos);
    if (!cell) return false;
    if (unit.kind === "tower") {
      if (cell.tower && cell.tower !== unit) return true;
      if (cell.text) return true; // 与文字互换
      return this.model.canPlaceTower(pos);
    }
    if (unit.kind === "farmer") {
      if (cell.farmer && cell.farmer !== unit) return true;
      return this.model.canPlaceFarmer(pos);
    }
    // text
    if (cell.text && cell.text !== unit) return true;
    if (cell.tower) return true; // 与塔互换
    return this.model.canPlaceText(pos);
  }

  private tryDropUnit(unit: Unit, pos: GridPos): void {
    const cell = this.model.getCell(pos);
    if (!cell || unit.pos.equals(pos)) {
      unit.moveTo(unit.pos);
      return;
    }
    if (unit.kind === "tower") this.dropTower(unit as Tower, cell, pos);
    else if (unit.kind === "farmer") this.dropFarmer(unit as Farmer, cell, pos);
    else this.dropText(unit as GeneralText, cell, pos);
  }

  private dropTower(unit: Tower, cell: ReturnType<GridModel["getCell"]>, pos: GridPos): void {
    if (!cell) return;
    const target = cell.tower;
    if (target instanceof Tower && target !== unit) {
      if (this.merge.tryMergeTowers(unit, target)) return;
      this.board.swap(unit, target); // 无法合成则交换位置
      return;
    }
    if (cell.text instanceof GeneralText) {
      this.board.swap(unit, cell.text);
      this.generals.reevaluateAll();
      return;
    }
    if (this.model.canPlaceTower(pos)) this.board.move(unit, pos);
    else unit.moveTo(unit.pos);
  }

  private dropFarmer(unit: Farmer, cell: ReturnType<GridModel["getCell"]>, pos: GridPos): void {
    if (!cell) return;
    const target = cell.farmer;
    if (target instanceof Farmer && target !== unit) {
      if (this.merge.tryMergeFarmers(unit, target)) return;
      this.board.swap(unit, target);
      return;
    }
    if (this.model.canPlaceFarmer(pos)) this.board.move(unit, pos);
    else unit.moveTo(unit.pos);
  }

  private dropText(unit: GeneralText, cell: ReturnType<GridModel["getCell"]>, pos: GridPos): void {
    if (!cell) return;
    const target = cell.text;
    // 拖到已形成武将的连线文字块上 —— 用该文字合成升级该武将（文字被消耗，对应 Unity OnPointerUp）
    if (
      target instanceof GeneralText &&
      target !== unit &&
      !unit.connected &&
      target.connected &&
      target.generalName === unit.generalName &&
      this.generals.canUpgrade(target.generalName)
    ) {
      this.generals.upgradeGeneral(target.generalName);
      this.board.remove(unit);
      this.generals.reevaluateAll();
      return;
    }
    // 与另一个文字互换位置
    if (target instanceof GeneralText && target !== unit) {
      this.board.swap(unit, target);
      this.generals.reevaluateAll();
      return;
    }
    // 与塔互换位置（文字 ↔ 塔）
    if (cell.tower instanceof Tower) {
      this.board.swap(unit, cell.tower);
      this.generals.reevaluateAll();
      return;
    }
    if (this.model.canPlaceText(pos)) {
      this.board.move(unit, pos);
      this.generals.reevaluateAll(); // 重新判断连线（可能剥离或重新连成）
    } else unit.moveTo(unit.pos);
  }

  // ===================== 高亮 =====================

  private buildHighlight(): THREE.Mesh {
    const size = GRID.CellSize * 0.94;
    const geo = new THREE.PlaneGeometry(size, size);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: COLORS.rangeRing,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.025;
    mesh.visible = false;
    mesh.name = "CellHighlight";
    this.scene.add(mesh);
    return mesh;
  }

  private updateHighlight(pos: GridPos | null, valid: boolean): void {
    if (!pos) {
      this.highlight.visible = false;
      this.rangeIndicator.hide();
      return;
    }
    const world = this.coords.gridToWorld(pos);
    this.highlight.position.set(world.x, 0.025, world.z);
    (this.highlight.material as THREE.MeshBasicMaterial).color.setHex(valid ? COLORS.rangeRing : 0xff5555);
    this.highlight.visible = true;

    // 拖拽塔 / 已激活武将（含从召唤栏拖入的塔）时显示其攻击范围圈
    const range = this.draggingRange ?? this.placingTowerRange;
    if (range !== null) {
      this.rangeIndicator.show(world.x, world.z, range);
    } else {
      this.rangeIndicator.hide();
    }
  }

  private onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // 每次 resize 重设像素比：应对 DPR 变化（外接屏、浏览器缩放等）
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fitCamera();
  }

  /**
   * 自适应取景：保持相机方向不变，仅按当前宽高比调整距离，保证 7×7 棋盘完整可见。
   * 原理：对棋盘四角（含单位高度）做视锥约束求解所需距离——
   * 竖屏时水平 FOV 很窄，必须把相机后退；横屏/桌面维持在基准距离，不改变原有观感。
   */
  private fitCamera(): void {
    const aspect = this.camera.aspect;
    const tanV = Math.tan(THREE.MathUtils.degToRad(CAMERA.fov) / 2);
    const tanH = tanV * aspect;

    const target = new THREE.Vector3(...CAMERA.lookAt);
    const dir = new THREE.Vector3(...CAMERA.position).sub(target);
    const baseDist = dir.length();
    dir.normalize();

    // 相机基向量（lookAt 固定、up=世界+Y，故可由方向唯一确定）
    const forward = dir.clone().negate();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();

    const half = (GRID.Cols * GRID.CellSize) / 2 + 0.4; // 棋盘半宽 + 边距
    const p = new THREE.Vector3();
    let dist = baseDist; // 基准距离为下限：宽屏保持原取景，仅窄屏才后退

    for (const hgt of [0, 1.2]) {
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          p.set(sx * half, hgt, sz * half).sub(target);
          const along = p.dot(dir);
          const x = p.dot(right);
          const y = p.dot(up);
          // |x| ≤ depth·tanH、|y| ≤ depth·tanV，depth = dist - along
          dist = Math.max(dist, along + Math.abs(x) / tanH, along + Math.abs(y) / tanV);
        }
      }
    }

    this.camera.position.copy(dir.multiplyScalar(dist).add(target));
    this.camera.lookAt(target);

    // 雾随距离等比缩放，避免竖屏后退后棋盘被雾吞掉（保持与桌面一致的层次观感）
    const fog = this.scene.fog as THREE.Fog;
    fog.near = dist * 1.12;
    fog.far = dist * 2.11;
  }

  dispose(): void {
    this.loop.stop();
    this.input.dispose();
    window.removeEventListener("resize", this.resizeHandler);
    window.removeEventListener("orientationchange", this.resizeHandler);
    document.removeEventListener("visibilitychange", this.visibilityHandler);
    this.renderer.dispose();
  }
}
