/**
 * 怪物管理器：对应 Unity MonsterManager —— 波次生成、怪物行进调度、清波判定。
 * 复用 config/monsters.getMonsterConfig 生成「贼 / 贼将」。
 * 路径：col0 → col6 位于 PathRow（怪物从最左侧生成，向右推进到阿斗）。
 */
import * as THREE from "three";
import { GridCoords, GridPos } from "../grid/coords";
import { GRID } from "../config/gameConfig";
import { getMonsterConfig } from "../config/monsters";
import { Monster } from "../entities/Monster";
import { GameState } from "../core/GameState";

/** 同波内出怪间隔（对应 Unity 的 1.2f）。 */
const SPAWN_INTERVAL = 1.2;

export class MonsterSystem {
  /** 存活怪物列表；引用保持稳定（原地增删），可直接交给塔做目标查找。 */
  private readonly monsters: Monster[] = [];
  private readonly path: THREE.Vector3[] = [];
  private readonly root = new THREE.Group();

  waveIndex = 0;
  waveActive = false;
  /** GM：暂停生成新怪（已存在的怪物仍继续行动）。 */
  spawningPaused = false;

  onWaveStarted: (wave: number) => void = () => {};
  onWaveCleared: (wave: number) => void = () => {};

  private spawnTimer = 0;
  private spawnedThisWave = 0;
  private totalThisWave = 0;

  constructor(scene: THREE.Scene, coords: GridCoords, private readonly game: GameState) {
    this.root.name = "Monsters";
    scene.add(this.root);

    for (let c = 0; c < coords.cols; c++) {
      this.path.push(coords.gridToWorld(new GridPos(c, GRID.PathRow)));
    }
  }

  /** 存活怪物（稳定引用）。 */
  get alive(): Monster[] {
    return this.monsters;
  }

  /** 开始下一波；本波怪物数 = 5 + 波次 × 2（对应 Unity）。 */
  startNextWave(): boolean {
    if (this.waveActive) return false;
    this.waveIndex++;
    this.waveActive = true;
    this.spawnedThisWave = 0;
    this.totalThisWave = 5 + this.waveIndex * 2;
    this.spawnTimer = 0;
    this.onWaveStarted(this.waveIndex);
    return true;
  }

  update(dt: number): void {
    // 先推进已有怪物（用副本遍历，怪物抵达/死亡会从列表移除）
    for (const m of [...this.monsters]) m.update(dt);

    if (!this.waveActive) return;

    this.spawnTimer -= dt;
    if (!this.spawningPaused && this.spawnTimer <= 0 && this.spawnedThisWave < this.totalThisWave) {
      this.spawnMonster();
      this.spawnedThisWave++;
      this.spawnTimer = SPAWN_INTERVAL;
    }

    if (this.spawnedThisWave >= this.totalThisWave && this.monsters.length === 0) {
      this.waveActive = false;
      this.onWaveCleared(this.waveIndex);
    }
  }

  private spawnMonster(): void {
    const cfg = getMonsterConfig(this.waveIndex, this.spawnedThisWave);
    const m = new Monster(cfg, this.path, {
      onKilled: (reward) => this.game.addMantou(reward),
      onReachTarget: (dmg) => this.game.damageAhDou(dmg),
      onRemoved: (mon) => this.removeMonster(mon),
    });
    this.monsters.push(m);
    this.root.add(m.group);
  }

  private removeMonster(m: Monster): void {
    const i = this.monsters.indexOf(m);
    if (i >= 0) this.monsters.splice(i, 1);
    this.root.remove(m.group);
    m.dispose();
  }
}
