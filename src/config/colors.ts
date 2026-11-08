/**
 * 颜色配置：数值一一对应 Unity GameColorConfig（ScriptableObject）的默认值。
 * Unity 的 Color 为 0~1 的浮点 RGBA；这里用 [r, g, b] 三元组保存以保持数值完全一致。
 */
import { TowerType } from "./types";

/** 0~1 的浮点 RGB 三元组，对应 Unity Color 的 r/g/b。 */
export type RGB = readonly [number, number, number];

export interface GameColorConfigData {
  // 兵种（塔）颜色
  bladeColor: RGB;
  spearColor: RGB;
  cavalryColor: RGB;
  bowColor: RGB;
  // 农民颜色
  farmerColor: RGB;
  // 武将文字颜色（未激活时的单个字）
  generalTextIdleColor: RGB;
  // 武将激活颜色
  zhaoYunColor: RGB;
  guanYuColor: RGB;
  zhangFeiColor: RGB;
  liuBeiColor: RGB;
  huangZhongColor: RGB;
}

export const COLOR_CONFIG: GameColorConfigData = {
  bladeColor: [0.75, 0.2, 0.2],
  spearColor: [0.6, 0.5, 0.3],
  cavalryColor: [0.45, 0.3, 0.6],
  bowColor: [0.3, 0.55, 0.3],

  farmerColor: [0.45, 0.6, 0.3],

  generalTextIdleColor: [0.42, 0.38, 0.5],

  zhaoYunColor: [1, 0.5, 0],
  guanYuColor: [0.9, 0.2, 0.1],
  zhangFeiColor: [0.6, 0.2, 0.7],
  liuBeiColor: [0.6, 0.2, 0.7],
  huangZhongColor: [0.6, 0.2, 0.7],
};

const WHITE: RGB = [1, 1, 1];

/** 按兵种取对应颜色（对应 GameColorConfig.GetTowerColor）。 */
export function getTowerColor(type: TowerType): RGB {
  switch (type) {
    case TowerType.Blade:
      return COLOR_CONFIG.bladeColor;
    case TowerType.Spear:
      return COLOR_CONFIG.spearColor;
    case TowerType.Cavalry:
      return COLOR_CONFIG.cavalryColor;
    case TowerType.Bow:
      return COLOR_CONFIG.bowColor;
    default:
      return WHITE;
  }
}

/** 按武将名取对应颜色（对应 GameColorConfig.GetGeneralColor）。 */
export function getGeneralColor(name: string): RGB {
  switch (name) {
    case "赵云":
      return COLOR_CONFIG.zhaoYunColor;
    case "关羽":
      return COLOR_CONFIG.guanYuColor;
    case "张飞":
      return COLOR_CONFIG.zhangFeiColor;
    case "刘备":
      return COLOR_CONFIG.liuBeiColor;
    case "黄忠":
      return COLOR_CONFIG.huangZhongColor;
    default:
      return WHITE;
  }
}

/** 把 0~1 的 RGB 三元组转成 CSS 颜色字符串（供 Canvas 文字绘制使用）。 */
export function rgbToCss(c: RGB): string {
  return `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;
}
