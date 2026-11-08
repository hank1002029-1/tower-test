/**
 * 武将战斗单位：对应 Unity GeneralUnit —— 文字按顺序连成一排后生成，跟随连线体中心，
 * 自动攻击射程内「路径进度最靠前」的怪物，造成高伤 + 半径 1.5 的溅射（伤害减半）。
 * 战斗形象由连成一体的文字表现，这里只加一圈武将色光环 + 等级标签。
 */
import * as THREE from "three";
import { GeneralConfig } from "../config/generals";
import { rgbToCss } from "../config/colors";
import { makeTextMesh } from "../utils/text3d";
import { Monster } from "./Monster";
import { CombatContext } from "../systems/CombatContext";

/** 连线体中心高度（对应 Unity GroupCenter 的 y=0.5）。 */
const UNIT_Y = 0.5;
/** 溅射判定半径（对应 Unity 的 1.5f）。 */
const SPLASH_RADIUS = 1.5;
/** 溅射伤害系数（对应 Unity 的 0.5f）。 */
const SPLASH_SCALE = Math.fround(0.5);
/** 每级伤害增幅（对应 Unity 的 0.5f）。 */
const LEVEL_DAMAGE_GROWTH = Math.fround(0.5);
/** 光环基础强度（对应 Unity 的 2.2f，每级 +0.4）。 */
const AURA_BASE = 2.2;
const AURA_PER_LEVEL = 0.4;

export class GeneralUnit {
  readonly group = new THREE.Group();
  private readonly color: THREE.Color;
  private readonly aura: THREE.PointLight;
  private levelValue: number;
  private fireCooldown = 0;
  private levelMesh: THREE.Mesh | null = null;

  constructor(readonly config: GeneralConfig, level: number, x: number, z: number) {
    this.levelValue = level;
    this.group.name = `General_${config.name}`;
    this.group.position.set(x, UNIT_Y, z);

    const c = config.nameColor;
    this.color = new THREE.Color(c[0], c[1], c[2]);
    this.aura = new THREE.PointLight(this.color, 0, 5.5);
    this.aura.position.set(0, 0.8, 0);
    this.group.add(this.aura);
    this.applyAura();
    this.buildLevelLabel();
  }

  get level(): number {
    return this.levelValue;
  }

  /** 连线体整体移动后跟随新位置。 */
  setPosition(x: number, z: number): void {
    this.group.position.set(x, UNIT_Y, z);
  }

  /** 合成升级后设置新等级。 */
  setLevel(lv: number): void {
    this.levelValue = lv;
    this.buildLevelLabel();
    this.applyAura();
  }

  /** 每帧战斗：冷却递减 → 找目标 → 开火（对应 Unity GeneralUnit.Update）。 */
  update(dt: number, ctx: CombatContext): void {
    this.fireCooldown -= dt;
    if (this.fireCooldown > 0) return;
    const target = this.findTarget(ctx.monsters);
    if (!target) return;
    this.fire(target, ctx);
    this.fireCooldown = 1 / this.config.baseFireRate;
  }

  /** 选取射程内「路径进度最靠前」的怪物。 */
  private findTarget(monsters: readonly Monster[]): Monster | null {
    const pos = this.group.position;
    let best: Monster | null = null;
    let bestProgress = -1;
    for (const m of monsters) {
      if (!m.alive) continue;
      if (pos.distanceTo(m.worldPosition) > this.config.baseRange) continue;
      if (m.progress > bestProgress) {
        bestProgress = m.progress;
        best = m;
      }
    }
    return best;
  }

  /** 高伤单体 + 半径 1.5 内减半溅射（对应 Unity GeneralUnit.Fire）。 */
  private fire(target: Monster, ctx: CombatContext): void {
    const dmg = Math.fround(this.config.baseDamage * (1 + (this.levelValue - 1) * LEVEL_DAMAGE_GROWTH));
    target.takeDamage(dmg);

    const splashDmg = Math.fround(dmg * SPLASH_SCALE);
    for (const m of [...ctx.monsters]) {
      if (m === target || !m.alive) continue;
      if (target.worldPosition.distanceTo(m.worldPosition) < SPLASH_RADIUS) m.takeDamage(splashDmg);
    }

    ctx.effects.burst(target.worldPosition, this.color);
  }

  private applyAura(): void {
    this.aura.intensity = AURA_BASE + (this.levelValue - 1) * AURA_PER_LEVEL;
  }

  private buildLevelLabel(): void {
    this.clearLevelLabel();
    const mesh = makeTextMesh(`Lv${this.levelValue}`, {
      fontSize: 110,
      color: rgbToCss(this.config.nameColor),
      strokeColor: "#1a1408",
      strokeWidth: 6,
      planeHeight: 0.5,
    });
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, 1.05, 0);
    this.levelMesh = mesh;
    this.group.add(mesh);
  }

  private clearLevelLabel(): void {
    if (!this.levelMesh) return;
    this.levelMesh.geometry.dispose();
    (this.levelMesh.material as THREE.Material).dispose();
    this.group.remove(this.levelMesh);
    this.levelMesh = null;
  }

  dispose(): void {
    this.clearLevelLabel();
    this.group.removeFromParent();
  }
}
