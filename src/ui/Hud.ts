/**
 * HUD：水墨风 DOM 覆盖层，对应 Unity UIManager。
 * 顶栏（阿斗血心 / 标题 / 波次 / 馒头 / 召唤按钮）、底部召唤结果栏、
 * 右侧武将收集面板、GM 调试面板、结束面板。
 * 所有面板信息与游戏状态实时联动。
 */
import { GameState } from "../core/GameState";
import { getItemLabel, getSummonCost, SummonItem } from "../config/summon";
import { GeneralProgress, getAllGenerals } from "../config/generals";
import { rgbToCss } from "../config/colors";

export interface HudHandlers {
  onSummon: () => void;
  /** 点击「开始迎战」：正式开局，第一波怪物出动。 */
  onStart: () => void;
  onSlotDragStart: (item: SummonItem, el: HTMLElement, ev: PointerEvent) => void;
  onRestart: () => void;
  /** GM：一键解锁全部未开启格。 */
  gmUnlockAll: () => void;
  /** GM：立即开始下一波。 */
  gmStartWave: () => void;
  /** GM：加 100 馒头。 */
  gmAddMantou: () => void;
  /** GM：阿斗 -5。 */
  gmDamageAhDou: () => void;
  /** GM：强制胜利。 */
  gmVictory: () => void;
  /** GM：在棋盘上摆好某武将的全部文字。 */
  gmPlaceGeneral: (name: string) => void;
}

export class Hud {
  private readonly hpBarEl = document.getElementById("hp-bar")!;
  private readonly hpLabelEl = document.getElementById("hp-label")!;
  private readonly waveEl = document.getElementById("hud-wave")!;
  private readonly mantouEl = document.getElementById("hud-mantou")!;
  private readonly costEl = document.getElementById("hud-cost")!;
  private readonly fpsEl = document.getElementById("hud-fps")!;
  private readonly statusEl = document.getElementById("hud-status")!;
  private readonly barEl = document.getElementById("summon-bar")!;
  private readonly summonBtn = document.getElementById("btn-summon") as HTMLButtonElement;
  private readonly startBtn = document.getElementById("btn-start") as HTMLButtonElement;
  private readonly generalListEl = document.getElementById("general-list")!;
  private readonly gmBodyEl = document.getElementById("gm-body")!;
  private readonly gmPanelEl = document.getElementById("gm-panel")!;
  private readonly gmHeadEl = document.getElementById("gm-head")!;
  private readonly gmTitleEl = document.getElementById("gm-title")!;
  private readonly gmToggleBtn = document.getElementById("gm-toggle") as HTMLButtonElement;
  private readonly howToEl = document.getElementById("how-to")!;
  private readonly howToHeadEl = document.getElementById("how-to-head")!;
  private readonly gameOverEl = document.getElementById("game-over")!;
  private readonly gameOverTextEl = document.getElementById("game-over-text")!;
  private readonly restartBtn = document.getElementById("btn-restart") as HTMLButtonElement;

  /** 当前选中的召唤物（用于召唤栏选中态高亮）。 */
  private selected: SummonItem | null = null;
  /** 最近一次渲染的召唤结果，供仅刷新选中态时复用。 */
  private lastItems: readonly SummonItem[] = [];

  constructor(private readonly game: GameState, private readonly handlers: HudHandlers) {
    this.summonBtn.addEventListener("click", () => this.handlers.onSummon());
    this.startBtn.addEventListener("click", () => this.handlers.onStart());
    this.restartBtn.addEventListener("click", () => this.handlers.onRestart());

    this.buildGmPanel();
    this.buildHowTo();

    this.refreshMantou();
    this.setAhDou(game.ahDouHp, game.ahDouMaxHp);
    this.renderBar([]);
    this.refreshGenerals([]);
  }

  /** 馒头变化时刷新（同时刷新召唤按钮可用状态）。 */
  refreshMantou(): void {
    this.mantouEl.textContent = String(this.game.mantou);
    this.refreshSummon();
  }

  /** 召唤次数变化时刷新成本与按钮。 */
  refreshSummon(): void {
    const cost = getSummonCost(this.game.summonCount);
    this.costEl.textContent = String(cost);
    this.summonBtn.disabled = this.game.mantou < cost;
  }

  /** 阿斗血量：渲染 max 颗心，前 cur 颗为红（对应 Unity RefreshHp）。 */
  setAhDou(cur: number, max: number): void {
    this.hpBarEl.innerHTML = "";
    for (let i = 0; i < max; i++) {
      const heart = document.createElement("span");
      heart.className = i < cur ? "heart" : "heart lost";
      heart.textContent = "♥";
      this.hpBarEl.appendChild(heart);
    }
    this.hpLabelEl.textContent = `阿斗 ${cur}/${max}`;
  }

  setWave(wave: number): void {
    this.waveEl.textContent = String(wave);
  }

  setFps(fps: number): void {
    this.fpsEl.textContent = `FPS: ${fps.toFixed(0)}`;
  }

  setStatus(text: string): void {
    this.statusEl.textContent = text;
  }

  /** 显示结束面板（文案/配色对齐 Unity UIManager.OnGameOver）。 */
  showGameOver(win: boolean): void {
    this.gameOverTextEl.textContent = win ? "胜利！阿斗保住了！" : "兵败...阿斗被掳走了";
    this.gameOverTextEl.style.color = win ? "#6bbf5a" : "#d94033";
    this.gameOverEl.classList.add("show");
    this.hideStart();
  }

  /** 开局后隐藏「开始迎战」按钮。 */
  hideStart(): void {
    this.startBtn.classList.add("hidden");
  }

  /** 刷新武将收集面板（名字 + 已摆字数 + 激活等级）。 */
  refreshGenerals(list: readonly GeneralProgress[]): void {
    this.generalListEl.innerHTML = "";
    for (const g of list) {
      const row = document.createElement("div");
      row.className = g.active ? "gen-row active" : "gen-row";

      const nameEl = document.createElement("span");
      nameEl.className = "gen-name";
      nameEl.textContent = g.name;
      const cfg = getAllGenerals().find((c) => c.name === g.name);
      if (cfg) nameEl.style.color = rgbToCss(cfg.nameColor);

      const progEl = document.createElement("span");
      progEl.className = "gen-prog";
      progEl.textContent = g.active ? `已激活 Lv${g.level}` : `${g.cur}/${g.total}`;

      row.appendChild(nameEl);
      row.appendChild(progEl);
      this.generalListEl.appendChild(row);
    }
  }

  /** 设置召唤栏选中态（点击通道）；会高亮对应格。 */
  setSelected(item: SummonItem | null): void {
    this.selected = item;
    this.renderBar(this.lastItems);
  }

  /** 渲染召唤结果栏。 */
  renderBar(items: readonly SummonItem[]): void {
    this.lastItems = items;
    // 选中物已不在本次结果中则清除选中态
    if (this.selected && !items.includes(this.selected)) this.selected = null;

    this.barEl.innerHTML = "";
    for (const item of items) {
      const slot = document.createElement("div");
      slot.className = "slot";
      if (item === this.selected) slot.classList.add("selected");
      slot.textContent = getItemLabel(item);
      slot.title = "点击选中后再点棋盘放置；或直接拖到棋盘放置";
      slot.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        this.handlers.onSlotDragStart(item, slot, ev);
      });
      this.barEl.appendChild(slot);
    }
  }

  /** 构建 GM 面板：固定按钮 + 每个武将的「摆好」按钮。 */
  private buildGmPanel(): void {
    const actions: Record<string, () => void> = {
      unlock: () => this.handlers.gmUnlockAll(),
      wave: () => this.handlers.gmStartWave(),
      mantou: () => this.handlers.gmAddMantou(),
      damage: () => this.handlers.gmDamageAhDou(),
      victory: () => this.handlers.gmVictory(),
    };
    for (const btn of Array.from(this.gmBodyEl.querySelectorAll<HTMLButtonElement>("button[data-gm]"))) {
      const key = btn.dataset.gm!;
      if (actions[key]) btn.addEventListener("click", actions[key]);
    }

    const genWrap = document.getElementById("gm-generals")!;
    for (const g of getAllGenerals()) {
      const btn = document.createElement("button");
      btn.className = "ink-btn ghost";
      btn.textContent = g.name;
      btn.title = `在棋盘上摆好「${g.name}」的全部文字`;
      btn.addEventListener("click", () => this.handlers.gmPlaceGeneral(g.name));
      genWrap.appendChild(btn);
    }

    this.gmToggleBtn.addEventListener("click", () => this.setGmCollapsed(true));

    // 标题栏：轻点切换收起/展开，按住拖动移动面板（位移超过阈值才算拖拽）
    this.makeDraggable(this.gmPanelEl, this.gmHeadEl, () =>
      this.setGmCollapsed(!this.gmPanelEl.classList.contains("collapsed"))
    );
  }

  /** 收起时整块只留一个 "GM" 小标签；展开时恢复完整标题与按钮。 */
  private setGmCollapsed(collapsed: boolean): void {
    this.gmPanelEl.classList.toggle("collapsed", collapsed);
    this.gmBodyEl.classList.toggle("collapsed", collapsed);
    this.gmTitleEl.textContent = collapsed ? "GM" : "GM 调试";
  }

  /**
   * 玩法说明：点击标题栏展开/收起。
   * 窄屏（手机）默认收起，避免与左右两侧面板 / 棋盘重叠；桌面默认展开。
   */
  private buildHowTo(): void {
    if (window.innerWidth < 900) this.howToEl.classList.add("collapsed");
    this.howToHeadEl.addEventListener("click", () =>
      this.howToEl.classList.toggle("collapsed")
    );
  }

  /**
   * 让 GM 面板可通过标题栏拖拽移动（鼠标 / 触摸通用）。
   * 拖动时把定位从 CSS 的 left/top 固定下来，避免与后续计算叠加；
   * 并把面板限制在视口内，防止拖出屏幕找不回来。
   * 位移小于阈值的按下-抬起视为「轻点」，触发 onTap（用于收起/展开）。
   */
  private makeDraggable(
    panel: HTMLElement,
    handle: HTMLElement,
    onTap?: () => void
  ): void {
    /** 判定轻点的位移阈值（px）。 */
    const TAP_THRESHOLD = 5;
    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const onDown = (e: PointerEvent): void => {
      // 标题栏里的按钮（收起/展开）保持正常点击，不触发拖拽
      if ((e.target as HTMLElement).closest("button")) return;
      const rect = panel.getBoundingClientRect();
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      dragging = true;
      moved = false;
      handle.classList.add("dragging");
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    };

    const onMove = (e: PointerEvent): void => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.hypot(dx, dy) > TAP_THRESHOLD) moved = true;
      const maxX = Math.max(0, window.innerWidth - panel.offsetWidth);
      const maxY = Math.max(0, window.innerHeight - panel.offsetHeight);
      const x = Math.min(Math.max(0, startLeft + dx), maxX);
      const y = Math.min(Math.max(0, startTop + dy), maxY);
      panel.style.left = `${x}px`;
      panel.style.top = `${y}px`;
    };

    const onUp = (e: PointerEvent): void => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove("dragging");
      handle.releasePointerCapture?.(e.pointerId);
      if (!moved) onTap?.();
    };

    const onCancel = (e: PointerEvent): void => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove("dragging");
      handle.releasePointerCapture?.(e.pointerId);
    };

    handle.addEventListener("pointerdown", onDown);
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onCancel);
  }
}
