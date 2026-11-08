/**
 * 防御塔：对应 Unity Tower —— 四种类型（刀/枪/骑/弓）的攻击逻辑与命中特效。
 * 目标选择：射程内「路径进度最靠前」的怪物；最高 5 级，同型同级可合成升级。
 */
import * as THREE from "three";
import { GridCoords, GridPos } from "../grid/coords";
import { COLORS } from "../config/gameConfig";
import { getTowerColor } from "../config/colors";
import { getTowerConfig, TowerConfig, TowerLevelConfig } from "../config/towers";
import { TowerType } from "../config/types";
import { makeTextMesh } from "../utils/text3d";
import { Unit, UnitKind } from "./Unit";
import { Monster } from "./Monster";
import { CombatContext } from "../systems/CombatContext";

/** 群伤（骑）判定半径（对应 Unity 的 2f）。 */
const SPLASH_RADIUS = 2;
/** 穿透（枪）方向点积阈值（对应 Unity 的 0.8f）。 */
const PIERCE_DOT = 0.8;
/** 散射（弓）伤害系数（对应 Unity 的 0.8f）。 */
const SCATTER_DAMAGE_SCALE = Math.fround(0.8);

export class Tower extends Unit {
  readonly displayName: string;
  private readonly config: TowerConfig;
  private textMesh: THREE.Mesh | null = null;
  private fireCooldown = 0;

  constructor(
    readonly towerType: TowerType,
    level: number,
    pos: GridPos,
    coords: GridCoords
  ) {
    super(pos, level, coords);
    this.config = getTowerConfig(towerType);
    this.displayName = this.config.displayName;
    this.build();
  }

  get kind(): UnitKind {
    return "tower";
  }

  /** 当前等级属性（对应 Unity Tower.CurrentLevelConfig）。 */
  get levelConfig(): TowerLevelConfig {
    const levels = this.config.levels;
    return levels[Math.min(Math.max(this.level - 1, 0), levels.length - 1)];
  }

  refreshLabel(): void {
    this.buildLabel();
  }

  /** 每帧战斗：冷却递减 → 找目标 → 开火（对应 Unity Tower.Update）。 */
  update(dt: number, ctx: CombatContext): void {
    this.fireCooldown -= dt;
    if (this.fireCooldown > 0) return;
    const target = this.findTarget(ctx.monsters);
    if (!target) return;
    this.fire(target, ctx);
    this.fireCooldown = 1 / this.levelConfig.fireRate;
  }

  /** 选取射程内「路径进度最靠前」的怪物。 */
  private findTarget(monsters: readonly Monster[]): Monster | null {
    const pos = this.group.position;
    const range = this.levelConfig.range;
    let best: Monster | null = null;
    let bestProgress = -1;
    for (const m of monsters) {
      if (!m.alive) continue;
      if (pos.distanceTo(m.worldPosition) > range) continue;
      if (m.progress > bestProgress) {
        bestProgress = m.progress;
        best = m;
      }
    }
    return best;
  }

  private fire(target: Monster, ctx: CombatContext): void {
    const dmg = this.levelConfig.damage;
    switch (this.towerType) {
      case TowerType.Blade:
        // 刀：近战高伤单体
        target.takeDamage(dmg);
        ctx.effects.slash(target.worldPosition);
        break;
      case TowerType.Spear:
        // 枪：线性穿透
        this.pierce(target, dmg, ctx);
        break;
      case TowerType.Cavalry:
        // 骑：冲锋群伤
        this.splash(target, dmg, ctx);
        break;
      case TowerType.Bow:
        // 弓：远程散射
        this.scatter(target, dmg, ctx);
        break;
    }
  }

  /** 枪：沿「塔→目标」方向穿透同方向的多个怪物（点积 > 0.8）。 */
  private pierce(first: Monster, dmg: number, ctx: CombatContext): void {
    const pos = this.group.position;
    const range = this.levelConfig.range;
    const dir = new THREE.Vector3().subVectors(first.worldPosition, pos);
    dir.y = 0;
    if (dir.lengthSq() > 0) dir.normalize();

    // 副本排序，避免击杀怪物时修改原列表
    const all = [...ctx.monsters].sort(
      (a, b) => pos.distanceTo(a.worldPosition) - pos.distanceTo(b.worldPosition)
    );
    let hit = 0;
    const limit = this.levelConfig.splashCount + 1;
    for (const m of all) {
      if (!m.alive) continue;
      const toM = new THREE.Vector3().subVectors(m.worldPosition, pos);
      toM.y = 0;
      const len = toM.length();
      if (len > range) continue;
      const dot = len === 0 ? 1 : toM.divideScalar(len).dot(dir);
      if (dot > PIERCE_DOT) {
        m.takeDamage(dmg);
        hit++;
        if (hit >= limit) break;
      }
    }
    ctx.effects.line(pos, first.worldPosition);
  }

  /** 骑：以目标为中心、半径 2 内最多 splashCount+1 个怪物受伤。 */
  private splash(center: Monster, dmg: number, ctx: CombatContext): void {
    const c = center.worldPosition.clone();
    const all = [...ctx.monsters].sort(
      (a, b) => c.distanceTo(a.worldPosition) - c.distanceTo(b.worldPosition)
    );
    let hit = 0;
    const limit = this.levelConfig.splashCount + 1;
    for (const m of all) {
      if (!m.alive) continue;
      if (c.distanceTo(m.worldPosition) > SPLASH_RADIUS) continue;
      m.takeDamage(dmg);
      hit++;
      if (hit >= limit) break;
    }
    ctx.effects.circle(c);
  }

  /** 弓：射程内最多 splashCount+1 个怪物受伤，伤害 ×0.8。 */
  private scatter(main: Monster, dmg: number, ctx: CombatContext): void {
    const pos = this.group.position;
    const range = this.levelConfig.range;
    const all = [...ctx.monsters].sort(
      (a, b) => pos.distanceTo(a.worldPosition) - pos.distanceTo(b.worldPosition)
    );
    let hit = 0;
    const limit = this.levelConfig.splashCount + 1;
    const scatterDmg = Math.fround(dmg * SCATTER_DAMAGE_SCALE);
    for (const m of all) {
      if (!m.alive) continue;
      if (pos.distanceTo(m.worldPosition) > range) continue;
      m.takeDamage(scatterDmg);
      hit++;
      if (hit >= limit) break;
    }
    ctx.effects.arrow(main.worldPosition);
  }

  private build(): void {
    const c = getTowerColor(this.towerType);
    const geo = new THREE.BoxGeometry(1.3, 0.5, 1.3);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(c[0], c[1], c[2]),
      roughness: 0.6,
      metalness: 0.05,
    });
    const cube = new THREE.Mesh(geo, mat);
    this.group.add(cube);
    this.disposables.push(geo);
    this.buildLabel();
  }

  /** 塔身顶部平铺显示「刀1」等文字。 */
  private buildLabel(): void {
    this.clearLabel();
    const mesh = makeTextMesh(`${this.displayName}${this.level}`, {
      fontSize: 140,
      color: COLORS.textDefault,
      strokeColor: COLORS.textStroke,
      strokeWidth: 8,
      planeHeight: 0.62,
    });
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, 0.55, 0);
    this.textMesh = mesh;
    this.group.add(mesh);
  }

  private clearLabel(): void {
    if (!this.textMesh) return;
    this.textMesh.geometry.dispose();
    (this.textMesh.material as THREE.Material).dispose();
    this.group.remove(this.textMesh);
    this.textMesh = null;
  }

  dispose(): void {
    this.clearLabel();
    super.dispose();
  }
}
