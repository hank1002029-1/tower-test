/**
 * 棋盘单位基类：统一管理根节点、格子位置、等级与文字标签。
 * 放置高度对齐 Unity（GridToWorld + up*0.4）。
 */
import * as THREE from "three";
import { GridCoords, GridPos } from "../grid/coords";

/** 单位根节点的世界高度（对应 Unity 的 GridToWorld + Vector3.up * 0.4）。 */
export const UNIT_Y = 0.4;

export type UnitKind = "tower" | "farmer" | "text";

export abstract class Unit {
  readonly group = new THREE.Group();
  /** 需要随单位一起销毁的几何体。 */
  protected readonly disposables: THREE.BufferGeometry[] = [];

  constructor(public pos: GridPos, public level: number, protected readonly coords: GridCoords) {
    this.group.userData.unit = this;
    this.snapTo(pos);
  }

  abstract get kind(): UnitKind;

  /** 刷新文字标签（升级后调用）。 */
  abstract refreshLabel(): void;

  /** 移动到新格子：更新数据与根节点位置。 */
  moveTo(pos: GridPos): void {
    this.pos = pos;
    this.snapTo(pos);
  }

  /** 把根节点对齐到某格中心（高度 = UNIT_Y）。 */
  snapTo(pos: GridPos): void {
    const w = this.coords.gridToWorld(pos);
    this.group.position.set(w.x, UNIT_Y, w.z);
  }

  dispose(): void {
    for (const g of this.disposables) g.dispose();
    this.disposables.length = 0;
    this.group.removeFromParent();
  }
}
