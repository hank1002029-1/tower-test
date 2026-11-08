/**
 * 命中特效：对应 Unity Tower 的四种攻击特效（斩击 / 穿透线 / 群伤圈 / 箭）+ 武将爆裂。
 * 使用简单对象池复用网格，避免每次攻击都创建销毁对象。
 */
import * as THREE from "three";

type EffectKind = "slash" | "line" | "circle" | "arrow" | "burst";
/** 需要固定共用材质的特效（burst 的颜色随武将变化，故单独处理）。 */
type SharedKind = Exclude<EffectKind, "burst">;

interface ActiveEffect {
  mesh: THREE.Mesh;
  kind: EffectKind;
  t: number;
  life: number;
}

/** 各类特效存活时长（秒），对齐 Unity 的 Destroy 延时。 */
const LIFE: Record<EffectKind, number> = {
  slash: 0.15,
  line: 0.15,
  circle: 0.25,
  arrow: 0.2,
  burst: 0.2,
};

export class EffectSystem {
  private readonly active: ActiveEffect[] = [];
  private readonly pools: Record<EffectKind, THREE.Mesh[]> = {
    slash: [],
    line: [],
    circle: [],
    arrow: [],
    burst: [],
  };
  private readonly geos: Record<EffectKind, THREE.BufferGeometry>;
  private readonly mats: Record<SharedKind, THREE.Material>;
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(private readonly scene: THREE.Scene) {
    // 斩击：平铺四边面（预旋转贴地，仅需绕 Y 随机自转）
    const slashGeo = new THREE.PlaneGeometry(0.6, 0.6);
    slashGeo.rotateX(-Math.PI / 2);
    this.geos = {
      slash: slashGeo,
      line: new THREE.CylinderGeometry(0.1, 0.1, 1, 8),
      circle: new THREE.CylinderGeometry(1, 1, 0.05, 24),
      arrow: new THREE.SphereGeometry(0.1, 12, 8),
      // 武将爆裂：Unity 球体 localScale 0.8 → 半径 0.4
      burst: new THREE.SphereGeometry(0.4, 16, 12),
    };
    this.mats = {
      slash: new THREE.MeshBasicMaterial({
        color: 0xffffff,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      line: new THREE.MeshBasicMaterial({
        color: new THREE.Color(1, 0.9, 0.5),
        depthWrite: false,
      }),
      circle: new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.8, 0.3, 0.8),
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
      arrow: new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.3, 0.7, 0.3),
        depthWrite: false,
      }),
    };
  }

  /** 刀：目标处白斩击（平铺、随机角度）。 */
  slash(pos: THREE.Vector3): void {
    const mesh = this.acquire("slash");
    mesh.scale.setScalar(1);
    mesh.rotation.set(0, Math.random() * Math.PI * 2, 0);
    mesh.position.set(pos.x, pos.y + 0.5, pos.z);
    this.activate(mesh, "slash");
  }

  /** 枪：从塔到目标的金色穿透线。 */
  line(from: THREE.Vector3, to: THREE.Vector3): void {
    const mesh = this.acquire("line");
    const mid = from.clone().add(to).multiplyScalar(0.5);
    mid.y += 0.5;
    const len = from.distanceTo(to);
    mesh.position.copy(mid);
    mesh.scale.set(0.1, Math.max(len, 0.001), 0.1);
    const dir = to.clone().sub(from);
    if (dir.lengthSq() > 0) mesh.quaternion.setFromUnitVectors(this.up, dir.normalize());
    this.activate(mesh, "line");
  }

  /** 骑：命中点周围的紫色群伤圈。 */
  circle(pos: THREE.Vector3): void {
    const mesh = this.acquire("circle");
    mesh.scale.set(2, 1, 2);
    mesh.rotation.set(0, 0, 0);
    mesh.position.set(pos.x, pos.y + 0.1, pos.z);
    this.activate(mesh, "circle");
  }

  /** 弓：目标处的绿色箭弹。 */
  arrow(pos: THREE.Vector3): void {
    const mesh = this.acquire("arrow");
    mesh.scale.setScalar(1);
    mesh.position.set(pos.x, pos.y + 0.5, pos.z);
    this.activate(mesh, "arrow");
  }

  /** 武将：命中点处的武将色球状爆裂（对应 Unity GeneralUnit.SpawnEffect）。 */
  burst(pos: THREE.Vector3, color: THREE.Color): void {
    const mesh = this.acquire("burst");
    (mesh.material as THREE.MeshBasicMaterial).color.copy(color);
    mesh.scale.setScalar(1);
    mesh.position.set(pos.x, pos.y + 0.5, pos.z);
    this.activate(mesh, "burst");
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      e.t += dt;
      if (e.t < e.life) continue;
      this.scene.remove(e.mesh);
      this.pools[e.kind].push(e.mesh);
      this.active.splice(i, 1);
    }
  }

  private activate(mesh: THREE.Mesh, kind: EffectKind): void {
    this.scene.add(mesh);
    this.active.push({ mesh, kind, t: 0, life: LIFE[kind] });
  }

  private acquire(kind: EffectKind): THREE.Mesh {
    const pooled = this.pools[kind].pop();
    if (pooled) return pooled;
    if (kind === "burst") {
      // burst 颜色随武将变化，需为每个网格单独准备材质
      return new THREE.Mesh(this.geos.burst, new THREE.MeshBasicMaterial({ depthWrite: false }));
    }
    return new THREE.Mesh(this.geos[kind], this.mats[kind]);
  }
}
