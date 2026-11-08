/**
 * 全局游戏状态：对应 Unity GameManager（馒头资源、阿斗血量、召唤次数、游戏状态）。
 * 数值与 Unity 的 SerializeField 默认值保持一致。
 */

/** 游戏状态。 */
export enum GamePhase {
  Playing,
  Victory,
  Defeat,
}

/** 初始数值（对应 Unity GameManager 的默认值）。 */
export const GAME_RULES = {
  startingMantou: 50,
  ahDouMaxHp: 20,
  passiveMantouInterval: 4, // 被动产馒头间隔（秒）
  passiveMantouAmount: 3, // 每次产出的馒头数
} as const;

export class GameState {
  mantou: number = GAME_RULES.startingMantou;
  ahDouHp: number = GAME_RULES.ahDouMaxHp;
  readonly ahDouMaxHp: number = GAME_RULES.ahDouMaxHp;
  summonCount = 0;
  phase: GamePhase = GamePhase.Playing;

  onMantouChanged: (mantou: number) => void = () => {};
  onAhDouHpChanged: (cur: number, max: number) => void = () => {};
  onSummonCountChanged: (count: number) => void = () => {};
  onPhaseChanged: (phase: GamePhase) => void = () => {};
  onGameOver: (phase: GamePhase) => void = () => {};

  private passiveTimer = 0;

  /** 每帧更新：Playing 状态下累积被动产馒头计时。 */
  update(dt: number): void {
    if (this.phase !== GamePhase.Playing) return;
    this.passiveTimer += dt;
    if (this.passiveTimer >= GAME_RULES.passiveMantouInterval) {
      this.passiveTimer = 0;
      this.addMantou(GAME_RULES.passiveMantouAmount);
    }
  }

  /** 尝试消耗馒头；不足则返回 false。 */
  trySpendMantou(amount: number): boolean {
    if (amount <= 0) return true;
    if (this.mantou < amount) return false;
    this.mantou -= amount;
    this.onMantouChanged(this.mantou);
    return true;
  }

  addMantou(amount: number): void {
    if (amount <= 0) return;
    this.mantou += amount;
    this.onMantouChanged(this.mantou);
  }

  incrementSummonCount(): void {
    this.summonCount++;
    this.onSummonCountChanged(this.summonCount);
  }

  damageAhDou(dmg: number): void {
    if (this.phase !== GamePhase.Playing) return;
    this.ahDouHp = Math.max(0, this.ahDouHp - dmg);
    this.onAhDouHpChanged(this.ahDouHp, this.ahDouMaxHp);
    if (this.ahDouHp <= 0) this.setPhase(GamePhase.Defeat);
  }

  victory(): void {
    if (this.phase !== GamePhase.Playing) return;
    this.setPhase(GamePhase.Victory);
  }

  private setPhase(p: GamePhase): void {
    this.phase = p;
    this.onPhaseChanged(p);
    this.onGameOver(p);
  }

  reset(): void {
    this.mantou = GAME_RULES.startingMantou;
    this.ahDouHp = GAME_RULES.ahDouMaxHp;
    this.summonCount = 0;
    this.phase = GamePhase.Playing;
    this.passiveTimer = 0;
    this.onMantouChanged(this.mantou);
    this.onAhDouHpChanged(this.ahDouHp, this.ahDouMaxHp);
    this.onSummonCountChanged(this.summonCount);
    this.onPhaseChanged(this.phase);
  }
}
