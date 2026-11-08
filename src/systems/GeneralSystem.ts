/**
 * 武将系统：对应 Unity GeneralSystem。
 * 武将不是"合成"，而是把同一武将的名字【按顺序相邻摆放成一排】（横或竖、正反皆可），
 * 连成一排即激活该武将的战斗效果（表现由文字自身变色发光 + 光环体现）。
 * 拖走其中一个字即自动断开、退回普通文字；把同武将的【文字】拖到已形成的武将上可合成升级。
 */
import * as THREE from "three";
import { GridCoords, GridPos } from "../grid/coords";
import { GridModel } from "../grid/GridModel";
import { GeneralConfig, GeneralProgress, getAllGenerals, getGeneralByName } from "../config/generals";
import { GeneralText } from "../entities/GeneralText";
import { GeneralUnit } from "../entities/GeneralUnit";
import { CombatContext } from "./CombatContext";

/** 连线搜索方向：右、左、上、下（对应 Unity GeneralSystem.Dirs）。 */
const DIRS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export class GeneralSystem {
  /** 已连成的武将 → 战斗单位。 */
  private readonly activeUnits = new Map<string, GeneralUnit>();
  /** 已连成的武将 → 组成它的文字。 */
  private readonly activeGroups = new Map<string, GeneralText[]>();
  /** 武将等级（脱离连线也保留，对应 Unity generalLevels）。 */
  private readonly generalLevels = new Map<string, number>();

  /** 连线状态重算后回调（对应 Unity OnCollectionChanged），用于刷新 HUD。 */
  onCollectionChanged: () => void = () => {};

  constructor(
    private readonly scene: THREE.Scene,
    private readonly model: GridModel,
    private readonly coords: GridCoords
  ) {}

  /** 任何文字放置 / 移动 / 移除后都应调用，重新计算所有武将的连线状态。 */
  reevaluateAll(): void {
    for (const cfg of getAllGenerals()) {
      const chain = this.findOrderedLine(cfg);
      if (chain) this.activateGroup(cfg, chain);
      else this.deactivateGroup(cfg.name);
    }
    this.onCollectionChanged();
  }

  /** 各武将的收集进度与激活状态（供 HUD 展示，对应 Unity CountPlaced）。 */
  getProgressList(): GeneralProgress[] {
    const placed = this.enumerateTexts();
    return getAllGenerals().map((cfg) => ({
      name: cfg.name,
      cur: placed.filter((t) => t.generalName === cfg.name).length,
      total: cfg.characters.length,
      active: this.isActive(cfg.name),
      level: this.getLevel(cfg.name),
    }));
  }

  /** 该武将是否已形成（文字连成一排）。 */
  isActive(name: string): boolean {
    return this.activeUnits.has(name);
  }

  /** 获取已形成的武将战斗单位（未形成返回 null）。 */
  getActiveUnit(name: string): GeneralUnit | null {
    return this.activeUnits.get(name) ?? null;
  }

  /** 该武将当前等级（未升级过则为 1）。 */
  getLevel(name: string): number {
    return this.generalLevels.get(name) ?? 1;
  }

  /** 该武将是否还能继续升级（已形成且未满级）。 */
  canUpgrade(name: string): boolean {
    const cfg = getGeneralByName(name);
    if (!cfg || !this.isActive(name)) return false;
    return this.getLevel(name) < Math.max(1, cfg.maxLevel);
  }

  /** 用同武将的【文字】合成升级该武将（+1 级，最高 5 级）。返回是否成功。 */
  upgradeGeneral(name: string): boolean {
    const cfg = getGeneralByName(name);
    if (!cfg) return false;

    const cur = this.getLevel(name);
    const max = Math.max(1, cfg.maxLevel);
    if (cur >= max) {
      console.log(`[武将] ${name} 已是满级 Lv${cur}，无法继续合成`);
      return false;
    }

    const next = cur + 1;
    this.generalLevels.set(name, next);
    this.activeUnits.get(name)?.setLevel(next);
    console.log(`[武将] ${name} 合成升级 → Lv${next}`);
    return true;
  }

  /** 驱动所有已激活武将战斗。 */
  update(dt: number, ctx: CombatContext): void {
    for (const gu of this.activeUnits.values()) gu.update(dt, ctx);
  }

  // ===================== 内部实现 =====================

  /** 查找某武将的名字字符是否按顺序相邻连成一排（横或竖，允许正反方向）。 */
  private findOrderedLine(cfg: GeneralConfig): GeneralText[] | null {
    const chars = cfg.characters;
    if (chars.length === 0) return null;

    for (const first of this.enumerateTexts()) {
      if (first.character !== chars[0] || first.generalName !== cfg.name) continue;

      for (const [dc, dr] of DIRS) {
        const chain: GeneralText[] = [first];
        let p = first.pos;
        let ok = true;

        for (let i = 1; i < chars.length; i++) {
          p = new GridPos(p.col + dc, p.row + dr);
          const next = this.model.getText(p);
          if (
            !(next instanceof GeneralText) ||
            next.character !== chars[i] ||
            next.generalName !== cfg.name
          ) {
            ok = false;
            break;
          }
          chain.push(next);
        }

        if (ok) return chain;
      }
    }
    return null;
  }

  /** 遍历棋盘上所有武将文字（列优先，对应 Unity EnumerateTexts）。 */
  private enumerateTexts(): GeneralText[] {
    const out: GeneralText[] = [];
    this.model.forEach((cell) => {
      if (cell.text instanceof GeneralText) out.push(cell.text);
    });
    return out;
  }

  private activateGroup(cfg: GeneralConfig, chain: GeneralText[]): void {
    this.activeGroups.set(cfg.name, chain);
    for (const t of chain) t.setConnected(true);

    const center = this.groupCenter(chain);

    const existing = this.activeUnits.get(cfg.name);
    if (existing) {
      existing.setPosition(center.x, center.z); // 连线体整体移动后跟随
      return;
    }

    const gu = new GeneralUnit(cfg, this.getLevel(cfg.name), center.x, center.z);
    this.scene.add(gu.group);
    this.activeUnits.set(cfg.name, gu);
    console.log(`[武将] 文字按顺序连成一体，${cfg.name} 激活！（Lv${gu.level}）`);
  }

  private deactivateGroup(name: string): void {
    let changed = false;

    const gu = this.activeUnits.get(name);
    if (gu) {
      gu.dispose();
      this.activeUnits.delete(name);
      changed = true;
    }
    const chain = this.activeGroups.get(name);
    if (chain) {
      for (const t of chain) t.setConnected(false);
      this.activeGroups.delete(name);
    }

    if (changed) console.log(`[武将] ${name} 连线断开，恢复为普通文字`);
  }

  /** 连线体中心（各格世界坐标均值，对应 Unity GroupCenter）。 */
  private groupCenter(chain: GeneralText[]): THREE.Vector3 {
    const sum = new THREE.Vector3();
    for (const t of chain) {
      const w = this.coords.gridToWorld(t.pos);
      sum.x += w.x;
      sum.z += w.z;
    }
    const n = Math.max(1, chain.length);
    return new THREE.Vector3(sum.x / n, 0, sum.z / n);
  }
}
