/**
 * 武将配置：对应 Unity GameConfigs.GetAllGenerals / GetGeneralByName。
 * 武将文字按顺序相邻连成一排即激活；等级最高 maxLevel，伤害随等级 base × (1 + 0.5 × (lv-1))。
 */
import { GeneralQuality } from "./types";
import { getGeneralColor, RGB } from "./colors";

export interface GeneralConfig {
  name: string; // 武将全名，如 "赵云"
  characters: string[]; // 名字拆分，如 ["赵","云"]
  quality: GeneralQuality;
  maxLevel: number; // 紫3 橙5
  baseDamage: number;
  baseRange: number;
  baseFireRate: number;
  skillName: string;
  skillDesc: string;
  nameColor: RGB;
}

const GENERALS: GeneralConfig[] = [
  {
    name: "赵云",
    characters: ["赵", "云"],
    quality: GeneralQuality.Orange,
    maxLevel: 5,
    baseDamage: 60,
    baseRange: 4.5,
    baseFireRate: 1.5,
    skillName: "龙胆",
    skillDesc: "攻击附带范围溅射",
    nameColor: getGeneralColor("赵云"),
  },
  {
    name: "关羽",
    characters: ["关", "羽"],
    quality: GeneralQuality.Orange,
    maxLevel: 5,
    baseDamage: 80,
    baseRange: 3.5,
    baseFireRate: 0.8,
    skillName: "青龙偃月",
    skillDesc: "高伤重击",
    nameColor: getGeneralColor("关羽"),
  },
  {
    name: "张飞",
    characters: ["张", "飞"],
    quality: GeneralQuality.Purple,
    maxLevel: 5,
    baseDamage: 50,
    baseRange: 3,
    baseFireRate: 1.2,
    skillName: "燕人咆哮",
    skillDesc: "短距高攻",
    nameColor: getGeneralColor("张飞"),
  },
  {
    name: "刘备",
    characters: ["刘", "备"],
    quality: GeneralQuality.Purple,
    maxLevel: 5,
    baseDamage: 35,
    baseRange: 4,
    baseFireRate: 1,
    skillName: "仁德",
    skillDesc: "范围增益",
    nameColor: getGeneralColor("刘备"),
  },
  {
    name: "黄忠",
    characters: ["黄", "忠"],
    quality: GeneralQuality.Purple,
    maxLevel: 5,
    baseDamage: 55,
    baseRange: 6,
    baseFireRate: 0.9,
    skillName: "百步穿杨",
    skillDesc: "超远程狙击",
    nameColor: getGeneralColor("黄忠"),
  },
];

/** 单个武将的收集进度（供 HUD 展示）。 */
export interface GeneralProgress {
  name: string;
  /** 棋盘上已摆放的字数。 */
  cur: number;
  /** 名字总字数。 */
  total: number;
  /** 是否已连成一体（激活）。 */
  active: boolean;
  /** 当前等级（未升级为 1）。 */
  level: number;
}

/** 全部武将配置。 */
export function getAllGenerals(): readonly GeneralConfig[] {
  return GENERALS;
}

/** 按名字取武将配置。 */
export function getGeneralByName(name: string): GeneralConfig | null {
  return GENERALS.find((g) => g.name === name) ?? null;
}
