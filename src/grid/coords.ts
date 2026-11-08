/**
 * 坐标换算：对齐 Unity GridManager 的 GridToWorld / WorldToGrid。
 *
 * 注意左右手系差异：Unity 为左手系（屏幕 +X 向右、+Z 向上），three.js 为右手系。
 * 因此这里对 Z 轴做镜像（row 增大 → z 减小），使屏幕观感与 Unity 一致：
 *   - col 增大 → 屏幕向右（+X）
 *   - row 增大 → 屏幕向上（远离位于 +Z 的相机）
 * 于是 row0 在下方、row5 在上方，路径行(row2)上方是 row3/4/5 共 3 行。
 */
import * as THREE from "three";
import { GRID } from "../config/gameConfig";

/** 格子坐标。 */
export class GridPos {
  constructor(public col: number, public row: number) {}

  equals(o: GridPos): boolean {
    return this.col === o.col && this.row === o.row;
  }

  /** 作为 Map 的 key 使用。 */
  key(): string {
    return `${this.col},${this.row}`;
  }

  toString(): string {
    return `(${this.col},${this.row})`;
  }
}

export class GridCoords {
  readonly cols = GRID.Cols;
  readonly rows = GRID.Rows;
  readonly cellSize = GRID.CellSize;

  /** 原点：col0 位于最左侧，row0 位于最靠近相机的一侧（屏幕下方）。 */
  readonly origin = new THREE.Vector3(
    -((GRID.Cols - 1) * GRID.CellSize) / 2,
    0,
    ((GRID.Rows - 1) * GRID.CellSize) / 2
  );

  gridToWorld(p: GridPos): THREE.Vector3 {
    return new THREE.Vector3(
      this.origin.x + p.col * this.cellSize,
      0,
      this.origin.z - p.row * this.cellSize
    );
  }

  worldToGrid(world: THREE.Vector3): GridPos {
    return new GridPos(
      Math.round((world.x - this.origin.x) / this.cellSize),
      Math.round((this.origin.z - world.z) / this.cellSize)
    );
  }

  inBounds(p: GridPos): boolean {
    return p.col >= 0 && p.col < this.cols && p.row >= 0 && p.row < this.rows;
  }

  get width(): number {
    return this.cols * this.cellSize;
  }

  get depth(): number {
    return this.rows * this.cellSize;
  }
}
