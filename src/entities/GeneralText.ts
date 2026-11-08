/**
 * 武将文字块：对应 Unity GeneralTextItem —— 单个汉字平铺在格子上。
 * 未连线时为普通灰紫色；同一武将的名字按顺序相邻连成一排后，变武将色并发光（由 GeneralSystem 判定）。
 */
import * as THREE from "three";
import { GridCoords, GridPos } from "../grid/coords";
import { COLORS } from "../config/gameConfig";
import { COLOR_CONFIG, getGeneralColor, rgbToCss } from "../config/colors";
import { makeTextMesh } from "../utils/text3d";
import { Unit, UnitKind } from "./Unit";

export class GeneralText extends Unit {
  private textMesh: THREE.Mesh | null = null;
  private connectedFlag = false;

  constructor(
    readonly character: string,
    readonly generalName: string,
    pos: GridPos,
    coords: GridCoords
  ) {
    super(pos, 1, coords);
    this.build();
  }

  get kind(): UnitKind {
    return "text";
  }

  /** 是否已连成一体（属于某已激活武将）。 */
  get connected(): boolean {
    return this.connectedFlag;
  }

  refreshLabel(): void {
    this.build();
  }

  /** 设置连线状态：连线时用武将色 + 发光，否则为普通灰紫色（对应 Unity SetConnected）。 */
  setConnected(v: boolean): void {
    if (this.connectedFlag === v) return;
    this.connectedFlag = v;
    this.build();
  }

  private build(): void {
    this.clearLabel();
    const color = this.connectedFlag
      ? rgbToCss(getGeneralColor(this.generalName))
      : rgbToCss(COLOR_CONFIG.generalTextIdleColor);
    const mesh = makeTextMesh(this.character, {
      fontSize: 170,
      color,
      strokeColor: COLORS.textStroke,
      strokeWidth: 8,
      planeHeight: 0.85,
      glow: this.connectedFlag,
    });
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, 0.05, 0);
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
