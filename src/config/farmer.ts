/**
 * 农民配置：对应 Unity GameConfigs.GetFarmerProduction / GetFarmerInterval。
 */

/** 最高农民等级（对应 GameConfigs.MaxFarmerLevel）。 */
export const MAX_FARMER_LEVEL = 5;

/** 周期产出的馒头数量：等级1产3，每级 +2。 */
export function getFarmerProduction(level: number): number {
  return 3 + (level - 1) * 2;
}

/** 产出间隔（秒）：等级越高间隔越短，下限 1.5s。 */
export function getFarmerInterval(level: number): number {
  return Math.max(1.5, 4 - (level - 1) * 0.5);
}
