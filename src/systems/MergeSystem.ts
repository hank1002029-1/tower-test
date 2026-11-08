/**
 * 合成系统：对应 Unity MergeSystem。
 * 两个同类型、同等级的单位合并为更高一级（不限相邻），塔最高 5 级、农民最高 5 级。
 */
import { MAX_TOWER_LEVEL } from "../config/towers";
import { MAX_FARMER_LEVEL } from "../config/farmer";
import { Tower } from "../entities/Tower";
import { Farmer } from "../entities/Farmer";
import { BoardSystem } from "./BoardSystem";

export class MergeSystem {
  constructor(private readonly board: BoardSystem) {}

  /** 尝试将 source 合并到 target（需同型、同级、未达上限）。 */
  tryMergeTowers(source: Tower, target: Tower): boolean {
    if (source === target) return false;
    if (source.towerType !== target.towerType) return false;
    if (source.level !== target.level) return false;
    if (source.level >= MAX_TOWER_LEVEL) return false;

    const type = source.towerType;
    const newLevel = source.level + 1;
    const targetPos = target.pos;
    const sourcePos = source.pos;

    this.board.remove(source);
    this.board.remove(target);
    const merged = this.board.placeTower(type, newLevel, targetPos);
    if (!merged) {
      // 兜底：目标格异常无法建造时恢复原状，避免两个单位凭空消失。
      console.warn(`[合成] 目标格 ${targetPos.toString()} 无法建造，取消合成并还原`);
      this.board.placeTower(target.towerType, target.level, targetPos);
      this.board.placeTower(source.towerType, source.level, sourcePos);
      return true; // 视为已处理，禁止调用方再做交换
    }
    this.board.spawnMergeEffect(targetPos);
    console.log(`[合成] ${type} 升级到 ${newLevel} @ ${targetPos.toString()}`);
    return true;
  }

  /** 尝试合成农民。 */
  tryMergeFarmers(source: Farmer, target: Farmer): boolean {
    if (source === target) return false;
    if (source.level !== target.level) return false;
    if (source.level >= MAX_FARMER_LEVEL) return false;

    const newLevel = source.level + 1;
    const targetPos = target.pos;
    const sourcePos = source.pos;

    this.board.remove(source);
    this.board.remove(target);
    const merged = this.board.placeFarmer(newLevel, targetPos);
    if (!merged) {
      console.warn(`[合成] 目标荒地 ${targetPos.toString()} 无法建造，取消合成并还原`);
      this.board.placeFarmer(target.level, targetPos);
      this.board.placeFarmer(source.level, sourcePos);
      return true;
    }
    this.board.spawnMergeEffect(targetPos);
    console.log(`[合成] 农民升级到 ${newLevel} @ ${targetPos.toString()}`);
    return true;
  }
}
