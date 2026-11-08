/**
 * 全局配置：与 Unity 版 GameConfigs / GridManager 保持一致的常量，
 * 抽离出来方便后续里程碑逐项补齐。
 */

/** 网格尺寸：7 列 × 7 行，路径行居中（索引 3 → 上下各 3 行）。 */
export const GRID = {
  Cols: 7,
  Rows: 7,
  PathRow: 3,
  CellSize: 1.5,
} as const;

/** 配色（对齐 Unity GameColorConfig 的水墨风基调）。 */
export const COLORS = {
  ground: 0x2b2620,
  gridLine: 0x6b5f45,
  pathCell: 0x3a3428,
  openCell: 0x4a4131,
  wasteland: 0x5a4a33,
  textDefault: '#f2e6c8',
  textStroke: '#1a1408',
  textActive: '#ffd24a',
  rangeRing: 0xffe659,
} as const;

/** 相机。位于 +Z 侧俯视，使 +X 朝向屏幕右侧（col0 在左、阿斗在右）。 */
export const CAMERA = {
  position: [0, 14, 8] as [number, number, number],
  lookAt: [0, 0, 0] as [number, number, number],
  fov: 50,
  near: 0.1,
  far: 200,
} as const;

/**
 * 胜利条件：清完第 N 波即获胜。
 * 注：Unity 版 GameManager.Victory() 已定义但无调用方（未接入触发），
 * 此值仅为 Web 版补齐的一局闭环条件。
 */
export const VICTORY_WAVE = 10;
