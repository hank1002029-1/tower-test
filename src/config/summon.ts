/**
 * 召唤配置：对应 Unity GameConfigs.SummonWeights / GetSummonCost 及 SummonItem。
 */
import { ItemType, TowerType } from "./types";

/** 召唤产出物数据（对应 Unity SummonItem）。 */
export interface SummonItem {
  type: ItemType;
  towerType: TowerType | null; // 当 type 为塔时有效
  level: number; // 塔/农民等级
  generalChar: string; // 当 type 为 GeneralText 时的单个字
  generalName: string; // 所属武将名
}

/** 召唤权重：刀枪骑弓占大头，铲子/农民/文字较少。 */
export const SUMMON_WEIGHTS: Record<ItemType, number> = {
  [ItemType.Blade]: 22,
  [ItemType.Spear]: 22,
  [ItemType.Cavalry]: 18,
  [ItemType.Bow]: 18,
  [ItemType.Shovel]: 6,
  [ItemType.Farmer]: 8,
  [ItemType.GeneralText]: 6,
};

/** 召唤成本（随次数递增）：第 1 次 10，之后每次 +3，上限 50。 */
export function getSummonCost(summonCount: number): number {
  return Math.min(50, 10 + summonCount * 3);
}

/** 召唤物的显示文字（对应 Unity SummonSystem.ItemLabel）。 */
export function getItemLabel(item: SummonItem): string {
  switch (item.type) {
    case ItemType.Blade:
      return "刀";
    case ItemType.Spear:
      return "枪";
    case ItemType.Cavalry:
      return "骑";
    case ItemType.Bow:
      return "弓";
    case ItemType.Shovel:
      return "铲";
    case ItemType.Farmer:
      return "农";
    case ItemType.GeneralText:
      return item.generalChar;
    default:
      return "?";
  }
}
