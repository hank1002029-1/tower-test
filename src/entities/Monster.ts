/**
 * 怪物实体：对应 Unity Monster.cs —— 沿路径点行进、受击闪白、死亡结算。
 * 视觉：方块（按配置缩放着色）+ 头顶名字标签（TextMesh → Canvas 贴图）。
 * 行进规则：每帧朝当前路径点 MoveTowards，抵达（<0.1）后切下一个点；走完路径则扣阿斗血并消失。
 */
import * as THREE from "three";
import { MonsterConfig } from "../config/monsters";
import { makeTextMesh } from "../utils/text3d";

/** 怪物中心高度（对应 Unity path[i] + Vector3.up * 0.5）。 */
const MONSTER_Y = 0.5;
/** 名字标签相对高度（对应 Unity localPosition.y = 0.8）。 */
const NAME_Y = 0.8;
/** 抵达路径点的判定距离（对应 Unity 的 0.1f）。 */
const ARRIVE_EPS = 0.1;
/** 受击闪白时长（对应 Unity 的 0.1f）。 */
const FLASH_TIME = 0.1;

export interface MonsterCallbacks {
  /** 被击杀时结算（发放馒头奖励）。 */
  onKilled: (reward: number) => void;
  /** 抵达终点时结算（扣阿斗血量）。 */
  onReachTarget: (damage: number) => void;
  /** 从怪物管理器中移除自身。 */
  onRemoved: (m: Monster) => void;
}

export class Monster {
  readonly group = new THREE.Group();
  private readonly bodyGeo: THREE.BoxGeometry;
  private readonly bodyMat: THREE.MeshStandardMaterial;
  private label: THREE.Mesh | null = null;

  private currentHp: number;
  private pathIndex = 0;
  private aliveFlag = true;
  private progressValue = 0;
  private flashTimer = 0;

  constructor(
    readonly config: MonsterConfig,
    private readonly path: readonly THREE.Vector3[],
    private readonly callbacks: MonsterCallbacks
  ) {
    this.currentHp = config.maxHp;

    // 方块身体：Unity 为 1×1×1 立方体，localScale = Vector3.one * config.scale
    this.bodyGeo = new THREE.BoxGeometry(1, 1, 1);
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(config.color[0], config.color[1], config.color[2]),
      roughness: 0.85,
      metalness: 0,
    });
    const body = new THREE.Mesh(this.bodyGeo, this.bodyMat);
    body.scale.setScalar(config.scale);
    this.group.add(body);
    this.buildLabel();

    const start = path[0];
    this.group.position.set(start.x, MONSTER_Y, start.z);
  }

  get alive(): boolean {
    return this.aliveFlag;
  }

  /** 路径进度 0~1（对应 Unity Monster.Progress，供塔选取「最靠前」目标）。 */
  get progress(): number {
    return this.progressValue;
  }

  get worldPosition(): THREE.Vector3 {
    return this.group.position;
  }

  get reward(): number {
    return this.config.reward;
  }

  update(dt: number): void {
    if (!this.aliveFlag) return;
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        const c = this.config.color;
        this.bodyMat.color.setRGB(c[0], c[1], c[2]);
      }
    }
    this.move(dt);
  }

  /** 受击：Unity 中 currentHp -= (int)dmg，并闪白 0.1s。 */
  takeDamage(dmg: number): void {
    if (!this.aliveFlag) return;
    this.currentHp -= Math.trunc(dmg);
    this.flashTimer = FLASH_TIME;
    this.bodyMat.color.setRGB(1, 1, 1);
    if (this.currentHp <= 0) this.die(true);
  }

  private move(dt: number): void {
    if (this.pathIndex >= this.path.length) return;
    const pos = this.group.position;
    const target = this.path[this.pathIndex];
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const dist = Math.hypot(dx, dz);
    const step = this.config.speed * dt;

    if (dist <= step || dist === 0) {
      pos.x = target.x;
      pos.z = target.z;
    } else {
      pos.x += (dx / dist) * step;
      pos.z += (dz / dist) * step;
    }

    if (Math.hypot(target.x - pos.x, target.z - pos.z) < ARRIVE_EPS) {
      this.pathIndex++;
      if (this.pathIndex >= this.path.length) {
        // 走完全程：攻击阿斗后消失
        this.callbacks.onReachTarget(this.config.damageToAhDou);
        this.die(false);
        return;
      }
    }
    this.progressValue = this.pathIndex / this.path.length;
  }

  private die(killed: boolean): void {
    if (!this.aliveFlag) return;
    this.aliveFlag = false;
    if (killed) this.callbacks.onKilled(this.config.reward);
    this.callbacks.onRemoved(this);
  }

  private buildLabel(): void {
    const mesh = makeTextMesh(this.config.name, {
      fontSize: 96,
      color: "#000000",
      strokeColor: "#000000",
      strokeWidth: 0,
      planeHeight: 0.55,
    });
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, NAME_Y, 0);
    this.label = mesh;
    this.group.add(mesh);
  }

  dispose(): void {
    if (this.label) {
      this.label.geometry.dispose();
      (this.label.material as THREE.Material).dispose();
      this.label = null;
    }
    this.bodyGeo.dispose();
    this.bodyMat.dispose();
    this.group.removeFromParent();
  }
}
