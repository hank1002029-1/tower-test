/**
 * 棋盘系统：负责单位的创建 / 放置 / 移动 / 交换 / 销毁，并保持 GridModel 与场景同步。
 * 是 M3 放置与合成的核心装配点。
 */
import * as THREE from "three";
import { GridCoords, GridPos } from "../grid/coords";
import { GridModel } from "../grid/GridModel";
import { TowerType } from "../config/types";
import { MAX_TOWER_LEVEL } from "../config/towers";
import { MAX_FARMER_LEVEL } from "../config/farmer";
import { Unit } from "../entities/Unit";
import { Tower } from "../entities/Tower";
import { Farmer } from "../entities/Farmer";
import { GeneralText } from "../entities/GeneralText";
import { CombatContext } from "./CombatContext";

interface MergeEffect {
  mesh: THREE.Mesh;
  t: number;
}

export class BoardSystem {
  readonly units: Unit[] = [];
  private readonly root = new THREE.Group();
  private readonly effects: MergeEffect[] = [];
  /** 战斗上下文（由 GameApp 注入），用于驱动塔攻击。 */
  private combat: CombatContext | null = null;
  /** 农民产出回调（由 GameApp 注入），产出馒头。 */
  private farmerProduce: ((amount: number) => void) | null = null;

  constructor(
    scene: THREE.Scene,
    private readonly model: GridModel,
    private readonly coords: GridCoords
  ) {
    this.root.name = "Units";
    scene.add(this.root);
  }

  /** 注入战斗上下文（存活怪物 + 命中特效）。 */
  setCombat(ctx: CombatContext): void {
    this.combat = ctx;
  }

  /** 注入农民产出回调（产出馒头）。 */
  setFarmerProduction(onProduce: (amount: number) => void): void {
    this.farmerProduce = onProduce;
  }

  /** 在指定格建造塔（要求格可放塔）。 */
  placeTower(type: TowerType, level: number, pos: GridPos): Tower | null {
    if (!this.model.canPlaceTower(pos)) return null;
    const t = new Tower(type, level, pos, this.coords);
    this.model.setTower(pos, t);
    this.add(t);
    return t;
  }

  /** 在指定格放置农民（要求为空的荒地格）。 */
  placeFarmer(level: number, pos: GridPos): Farmer | null {
    if (!this.model.canPlaceFarmer(pos)) return null;
    const f = new Farmer(level, pos, this.coords);
    this.model.setFarmer(pos, f);
    this.add(f);
    return f;
  }

  /** 在指定格放置武将文字（要求为空的可放格）。 */
  placeText(character: string, name: string, pos: GridPos): GeneralText | null {
    if (!this.model.canPlaceText(pos)) return null;
    const t = new GeneralText(character, name, pos, this.coords);
    this.model.setText(pos, t);
    this.add(t);
    return t;
  }

  /** 升级单位（合成或召唤物直接合成时调用），自动夹取到上限。 */
  upgrade(u: Unit): void {
    if (u.kind === "tower") u.level = Math.min(u.level + 1, MAX_TOWER_LEVEL);
    else if (u.kind === "farmer") u.level = Math.min(u.level + 1, MAX_FARMER_LEVEL);
    else return;
    u.refreshLabel();
  }

  /** 移除并销毁单位。 */
  remove(u: Unit): void {
    const i = this.units.indexOf(u);
    if (i >= 0) this.units.splice(i, 1);
    this.clearSlot(u);
    u.dispose();
  }

  /** 把单位移动到新格（要求目标格可放置）。 */
  move(u: Unit, to: GridPos): void {
    this.clearSlot(u);
    u.moveTo(to);
    this.setSlot(u);
  }

  /** 交换两个单位占用的槽位与位置。 */
  swap(a: Unit, b: Unit): void {
    const pa = a.pos;
    const pb = b.pos;
    // 必须先清空两者原槽位：跨类型交换（如塔↔文字）时槽位字段不同，
    // 若直接覆盖会让原格残留对已移走单位的引用，形成"看着空但放不下"的幽灵格。
    this.clearSlot(a);
    this.clearSlot(b);
    this.setSlotAt(a, pb);
    this.setSlotAt(b, pa);
    a.moveTo(pb);
    b.moveTo(pa);
  }

  /** 合成特效：金色球体放大并淡出。 */
  spawnMergeEffect(pos: GridPos): void {
    const geo = new THREE.SphereGeometry(0.75, 16, 12);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffe64d,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const w = this.coords.gridToWorld(pos);
    mesh.position.set(w.x, 1.0, w.z);
    mesh.renderOrder = 3;
    this.root.add(mesh);
    this.effects.push({ mesh, t: 0 });
  }

  update(dt: number): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.t += dt;
      const k = Math.min(e.t / 0.4, 1);
      const mat = e.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.7 * (1 - k);
      e.mesh.scale.setScalar(1 + k * 1.5);
      if (e.t >= 0.4) {
        this.root.remove(e.mesh);
        e.mesh.geometry.dispose();
        mat.dispose();
        this.effects.splice(i, 1);
      }
    }

    // 驱动所有塔攻击（塔的攻击不会增删单位，可直接遍历）
    if (this.combat) {
      const ctx = this.combat;
      for (const u of this.units) {
        if (u instanceof Tower) u.update(dt, ctx);
      }
    }

    // 驱动所有农民产出（产馒头不会增删单位，可直接遍历）
    if (this.farmerProduce) {
      const produce = this.farmerProduce;
      for (const u of this.units) {
        if (u instanceof Farmer) u.update(dt, produce);
      }
    }
  }

  /** 由射线命中对象向上查找所属单位。 */
  findUnit(obj: THREE.Object3D | null): Unit | null {
    let o: THREE.Object3D | null = obj;
    while (o) {
      const u = o.userData.unit as Unit | undefined;
      if (u) return u;
      o = o.parent;
    }
    return null;
  }

  private add(u: Unit): void {
    this.units.push(u);
    this.root.add(u.group);
  }

  private setSlot(u: Unit): void {
    this.setSlotAt(u, u.pos);
  }

  private setSlotAt(u: Unit, pos: GridPos): void {
    if (u.kind === "tower") this.model.setTower(pos, u);
    else if (u.kind === "farmer") this.model.setFarmer(pos, u);
    else this.model.setText(pos, u);
  }

  private clearSlot(u: Unit): void {
    if (u.kind === "tower") this.model.setTower(u.pos, null);
    else if (u.kind === "farmer") this.model.setFarmer(u.pos, null);
    else this.model.setText(u.pos, null);
  }
}
