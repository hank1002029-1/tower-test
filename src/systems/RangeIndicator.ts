/**
 * 攻击范围圆环：拖拽塔时在地面显示其射程（对应 Unity RangeIndicator）。
 */
import * as THREE from "three";
import { COLORS } from "../config/gameConfig";

export class RangeIndicator {
  private readonly mesh: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.RingGeometry(1, 1.08, 64);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: COLORS.rangeRing,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = 0.03;
    this.mesh.visible = false;
    this.mesh.renderOrder = 2;
    this.mesh.name = "RangeIndicator";
    scene.add(this.mesh);
  }

  show(x: number, z: number, radius: number): void {
    this.mesh.position.set(x, 0.03, z);
    this.mesh.scale.setScalar(radius);
    this.mesh.visible = true;
  }

  hide(): void {
    this.mesh.visible = false;
  }
}
