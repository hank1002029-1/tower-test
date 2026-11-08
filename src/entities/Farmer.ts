/**
 * 农民：对应 Unity Farmer —— 放置在荒地格上，按等级周期性产馒头，最高 5 级。
 */
import * as THREE from "three";
import { GridCoords, GridPos } from "../grid/coords";
import { COLORS } from "../config/gameConfig";
import { COLOR_CONFIG } from "../config/colors";
import { getFarmerInterval, getFarmerProduction } from "../config/farmer";
import { makeTextMesh } from "../utils/text3d";
import { Unit, UnitKind } from "./Unit";

export class Farmer extends Unit {
  private textMesh: THREE.Mesh | null = null;
  private produceTimer = 0;

  constructor(level: number, pos: GridPos, coords: GridCoords) {
    super(pos, level, coords);
    this.build();
  }

  get kind(): UnitKind {
    return "farmer";
  }

  refreshLabel(): void {
    this.buildLabel();
  }

  /** 每帧产馒头：计时达到当前等级间隔即产出一次（对应 Unity Farmer.Update）。 */
  update(dt: number, onProduce: (amount: number) => void): void {
    this.produceTimer += dt;
    if (this.produceTimer >= getFarmerInterval(this.level)) {
      this.produceTimer = 0;
      onProduce(getFarmerProduction(this.level));
    }
  }

  private build(): void {
    const c = COLOR_CONFIG.farmerColor;
    const geo = new THREE.BoxGeometry(1.2, 0.5, 1.2);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(c[0], c[1], c[2]),
      roughness: 0.75,
    });
    const cube = new THREE.Mesh(geo, mat);
    this.group.add(cube);
    this.disposables.push(geo);
    this.buildLabel();
  }

  private buildLabel(): void {
    this.clearLabel();
    const mesh = makeTextMesh(`农${this.level}`, {
      fontSize: 140,
      color: COLORS.textDefault,
      strokeColor: COLORS.textStroke,
      strokeWidth: 8,
      planeHeight: 0.6,
    });
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, 0.55, 0);
    this.textMesh = mesh;
    this.group.add(mesh);
  }

  private clearLabel(): void {
    if (!this.textMesh) return;
    this.textMesh.geometry.dispose();
    (this.textMesh.material as THREE.Material).dispose();
    this.group.remove(this.textMesh);
    this.textMesh = null;
  }

  dispose(): void {
    this.clearLabel();
    super.dispose();
  }
}
