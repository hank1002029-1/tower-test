/**
 * 共享枚举：对齐 Unity GameConfigs.cs 中的 enum 定义。
 * 单独成文件以避免 colors / towers / generals / summon 之间循环引用。
 */

/** 阵营：玩家 / 敌方。 */
export enum Faction {
  Player,
  Enemy,
}

/** 召唤产出物类型。 */
export enum ItemType {
  Blade, // 刀塔
  Spear, // 枪塔
  Cavalry, // 骑塔
  Bow, // 弓塔
  Shovel, // 铲子（开格子）
  Farmer, // 农民
  GeneralText, // 武将文字
}

/** 塔类型（四种兵种）。 */
export enum TowerType {
  Blade, // 刀兵：近战高攻
  Spear, // 枪兵：线性穿透
  Cavalry, // 骑兵：冲锋群伤
  Bow, // 弓兵：远程散射
}

/** 武将品质。 */
export enum GeneralQuality {
  Purple, // 紫色
  Orange, // 橙色
}
