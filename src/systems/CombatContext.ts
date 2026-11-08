/**
 * 战斗上下文：塔攻击所需的外部依赖（存活怪物列表 + 命中特效）。
 * 由 GameApp 装配并注入 BoardSystem，再传给各塔，避免使用单例。
 */
import { Monster } from "../entities/Monster";
import { EffectSystem } from "./EffectSystem";

export interface CombatContext {
  /** 存活怪物列表；持有 MonsterSystem 内部同一数组引用（原地增删，故引用稳定）。 */
  readonly monsters: Monster[];
  readonly effects: EffectSystem;
}
