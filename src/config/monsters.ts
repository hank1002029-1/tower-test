/**
 * 怪物配置：对应 Unity Monster.cs 中 MonsterManager.GetMonsterConfig。
 * 随波次增强：血量按 scale = 1 + (wave-1)*0.2 放大；
 * 第 5 波起每 5 只出一只「贼将」（更高血、更高奖励）。
 */
import { RGB } from "./colors";

export interface MonsterConfig {
  name: string;
  maxHp: number;
  speed: number;
  reward: number; // 击杀馒头奖励
  damageToAhDou: number; // 到达终点扣血
  color: RGB;
  scale: number;
}

/**
 * 按波次与当前波已出怪数生成怪物配置。
 * @param wave 当前波次（从 1 开始）
 * @param spawnedThisWave 当前波已生成的数量
 */
export function getMonsterConfig(wave: number, spawnedThisWave: number): MonsterConfig {
  const scale = 1 + (wave - 1) * 0.2;

  // 随波次出现不同怪物
  if (wave >= 5 && spawnedThisWave % 5 === 4) {
    return {
      name: "贼将",
      maxHp: Math.trunc(180 * scale),
      speed: 1.2,
      reward: 25,
      damageToAhDou: 3,
      color: [0.5, 0.1, 0.1],
      scale: 1.3,
    };
  }

  return {
    name: "贼",
    maxHp: Math.trunc(50 * scale),
    speed: 2,
    reward: 8,
    damageToAhDou: 1,
    color: [0.4, 0.25, 0.15],
    scale: 0.9,
  };
}
