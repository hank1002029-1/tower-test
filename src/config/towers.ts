/**
 * 塔配置：对应 Unity GameConfigs.GetTowerConfig / BuildLevels。
 * 每种塔 5 级，每级伤害 = 上一级 × growth，四舍五入到 1 位小数。
 */
import { TowerType } from "./types";
import { getTowerColor, RGB } from "./colors";

/** 最高塔等级（对应 GameConfigs.MaxTowerLevel）。 */
export const MAX_TOWER_LEVEL = 5;

export interface TowerLevelConfig {
  level: number;
  damage: number;
  range: number;
  fireRate: number; // 每秒攻击次数
  splashCount: number; // 群伤(骑)/穿透(枪)/散射(弓) 目标数
}

export interface TowerConfig {
  type: TowerType;
  displayName: string; // 刀 / 枪 / 骑 / 弓
  color: RGB;
  levels: TowerLevelConfig[];
}

/**
 * 四舍五入到整数，采用「四舍六入五成双」（banker's rounding），
 * 与 Unity Mathf.Round 行为一致（例如 472.5 → 472，而非 473）。
 */
function roundHalfToEven(x: number): number {
  const f = Math.floor(x);
  const diff = x - f;
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

/** 构建 5 级属性，每级伤害 × growth（对应 GameConfigs.BuildLevels）。 */
function buildLevels(
  baseDmg: number,
  range: number,
  fireRate: number,
  splash: number,
  growth: number
): TowerLevelConfig[] {
  const list: TowerLevelConfig[] = [];
  // Unity 使用 32 位 float，这里用 Math.fround 逐步模拟，保证伤害数值与 Unity 完全一致
  let dmg = Math.fround(baseDmg);
  const g = Math.fround(growth);
  for (let i = 1; i <= MAX_TOWER_LEVEL; i++) {
    list.push({
      level: i,
      damage: roundHalfToEven(Math.fround(dmg * 10)) / 10,
      range,
      fireRate,
      splashCount: splash,
    });
    dmg = Math.fround(dmg * g);
  }
  return list;
}

interface TowerDef {
  displayName: string;
  baseDamage: number;
  range: number;
  fireRate: number;
  splashCount: number;
  growth: number;
}

const TOWER_DEFS: Record<TowerType, TowerDef> = {
  [TowerType.Blade]: { displayName: "刀", baseDamage: 8, range: 2.5, fireRate: 1.2, splashCount: 0, growth: 1.55 },
  [TowerType.Spear]: { displayName: "枪", baseDamage: 10, range: 4, fireRate: 0.9, splashCount: 2, growth: 1.5 },
  [TowerType.Cavalry]: { displayName: "骑", baseDamage: 14, range: 3, fireRate: 0.7, splashCount: 3, growth: 1.5 },
  [TowerType.Bow]: { displayName: "弓", baseDamage: 7, range: 5.5, fireRate: 1.0, splashCount: 2, growth: 1.45 },
};

/** 取某种塔的完整配置。 */
export function getTowerConfig(type: TowerType): TowerConfig {
  const d = TOWER_DEFS[type];
  return {
    type,
    displayName: d.displayName,
    color: getTowerColor(type),
    levels: buildLevels(d.baseDamage, d.range, d.fireRate, d.splashCount, d.growth),
  };
}

/** 取得该塔指定等级的属性（越界时夹取到有效范围，对应 TowerConfig.GetLevel）。 */
export function getTowerLevel(type: TowerType, level: number): TowerLevelConfig {
  const levels = getTowerConfig(type).levels;
  const idx = Math.min(Math.max(level - 1, 0), levels.length - 1);
  return levels[idx];
}
