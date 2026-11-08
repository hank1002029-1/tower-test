/**
 * 网格视图：为每个格子生成一块半透明薄板（按类型配色），并绘制网格线。
 * 配色取自 Unity GridManager.GetCellColor。
 */
import * as THREE from "three";
import { GridCoords, GridPos } from "./coords";
import { CellType, GridModel } from "./GridModel";
import { COLORS } from "../config/gameConfig";

interface CellStyle {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** 与 Unity GetCellColor 一致的每类格子样式。 */
const CELL_STYLES: Record<CellType, CellStyle> = {
  [CellType.Open]: { r: 0.35, g: 0.62, b: 0.5, a: 0.55 },
  [CellType.Locked]: { r: 0.14, g: 0.12, b: 0.1, a: 0.7 },
  [CellType.Wasteland]: { r: 0.55, g: 0.45, b: 0.3, a: 0.5 },
  [CellType.Path]: { r: 0.5, g: 0.35, b: 0.2, a: 0.5 },
};

export class GridView {
  private cellMeshes = new Map<string, THREE.Mesh>();
  private group = new THREE.Group();

  constructor(
    private scene: THREE.Scene,
    private model: GridModel,
    private coords: GridCoords
  ) {
    this.group.name = "GridView";
    this.scene.add(this.group);
    this.buildGround();
    this.buildCells();
    this.buildGridLines();
  }

  /** 地面底板。 */
  private buildGround(): void {
    const geo = new THREE.PlaneGeometry(this.coords.width, this.coords.depth);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: COLORS.ground, roughness: 1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = "Ground";
    this.group.add(mesh);
  }

  /** 每格一块薄板。 */
  private buildCells(): void {
    const size = this.coords.cellSize;
    const geo = new THREE.PlaneGeometry(size, size);
    geo.rotateX(-Math.PI / 2);

    this.model.forEach((cell) => {
      const style = CELL_STYLES[cell.type];
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(style.r, style.g, style.b),
        transparent: true,
        opacity: style.a,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      const world = this.coords.gridToWorld(cell.pos);
      mesh.position.set(world.x, 0.02, world.z);
      this.group.add(mesh);
      this.cellMeshes.set(cell.pos.key(), mesh);
    });
  }

  /** 网格线。 */
  private buildGridLines(): void {
    const pts: number[] = [];
    const halfW = this.coords.width / 2;
    const halfD = this.coords.depth / 2;
    const y = 0.03;

    for (let c = 0; c <= this.coords.cols; c++) {
      const x = -halfW + c * this.coords.cellSize;
      pts.push(x, y, -halfD, x, y, halfD);
    }
    for (let r = 0; r <= this.coords.rows; r++) {
      const z = -halfD + r * this.coords.cellSize;
      pts.push(-halfW, y, z, halfW, y, z);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({
      color: COLORS.gridLine,
      transparent: true,
      opacity: 0.55,
    });
    const lines = new THREE.LineSegments(geo, mat);
    lines.name = "GridLines";
    this.group.add(lines);
  }

  /** 按格子当前类型刷新薄板颜色（供铲子开格 / 改类型后调用）。 */
  refreshCell(p: GridPos): void {
    const mesh = this.cellMeshes.get(p.key());
    const cell = this.model.getCell(p);
    if (!mesh || !cell) return;
    const style = CELL_STYLES[cell.type];
    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.color.setRGB(style.r, style.g, style.b);
    mat.opacity = style.a;
  }

  /** 刷新全部格子（如 GM 一键解锁）。 */
  refreshAll(): void {
    this.model.forEach((cell) => this.refreshCell(cell.pos));
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.cellMeshes.clear();
  }
}
