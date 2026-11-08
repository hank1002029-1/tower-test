/**
 * 输入控制器：对齐 Unity InputHandler 的交互主线（M3 拖拽 + M8 补全）。
 * 1) 从召唤栏【拖拽】物品 → 落到棋盘格放置（主流程）。
 * 2) 从召唤栏【点击】物品选中 → 再点棋盘格放置（备用流程）。
 * 3) 拖拽棋盘上已放置的单位 → 落格合成 / 交换 / 移动。
 * 4) 任意拖拽（召唤物或棋盘单位）拖到右下角垃圾桶 → 丢弃。
 * 所有关键步骤打印日志。
 */
import * as THREE from "three";
import { GridCoords, GridPos } from "../grid/coords";
import { BoardSystem } from "../systems/BoardSystem";
import { Unit } from "../entities/Unit";
import { SummonItem } from "../config/summon";

/** 拖拽时单位抬升的高度（对应 Unity OnDrag 的 p.y = 0.9f）。 */
const DRAG_Y = 0.9;
/** 放置预览幽灵的高度。 */
const GHOST_Y = 0.5;
/** 按下后移动超过该像素才判定为「拖拽」，否则视为「点击选中」。 */
const DRAG_THRESHOLD = 5;

export class BoardInput {
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly hit = new THREE.Vector3();

  private draggingUnit: Unit | null = null;
  private readonly dragOffset = new THREE.Vector3();

  private placingItem: SummonItem | null = null;
  private captureEl: HTMLElement | null = null;
  private placeMoved = false;
  private placeStartX = 0;
  private placeStartY = 0;

  private readonly ghost: THREE.Mesh;
  private readonly trashEl: HTMLElement | null;

  /** 当前选中的召唤物（点击通道）；由 GameApp 维护。 */
  selectedItem: SummonItem | null = null;

  /** 棋盘单位落格回调（GameApp 实现合成/交换/移动）。 */
  onUnitDrop: (unit: Unit, pos: GridPos) => void = () => {};
  /** 抓起棋盘单位时回调（用于显示攻击范围圈）。 */
  onUnitDragStart: (unit: Unit) => void = () => {};
  /** 放下（或取消）棋盘单位拖拽时回调。 */
  onUnitDragEnd: () => void = () => {};
  /** 把棋盘单位拖到垃圾桶丢弃时回调。 */
  onDiscardUnit: (unit: Unit) => void = () => {};
  /** 召唤物放置回调。 */
  onPlaceItem: (item: SummonItem, pos: GridPos) => void = () => {};
  /** 把召唤物拖到垃圾桶丢弃时回调。 */
  onDiscardItem: (item: SummonItem) => void = () => {};
  /** 开始放置拖拽（从召唤栏抓起物品并真正移动）时回调。 */
  onPlaceDragStart: (item: SummonItem) => void = () => {};
  /** 结束放置拖拽时回调。 */
  onPlaceDragEnd: () => void = () => {};
  /** 点击召唤栏物品（未拖拽）时回调：选中/取消选中。 */
  onSlotClick: (item: SummonItem) => void = () => {};
  /** 已选中物品时点击棋盘格放置的回调。 */
  onPlaceSelectedAt: (pos: GridPos) => void = () => {};
  /** 悬停高亮回调；pos 为 null 表示移出棋盘。 */
  onHover: (pos: GridPos | null, valid: boolean) => void = () => {};
  /** 召唤物在某格是否可放置（用于预览着色）。 */
  canDropItemAt: (item: SummonItem, pos: GridPos) => boolean = () => false;
  /** 棋盘单位在某格是否可落（用于预览着色）。 */
  canDropUnitAt: (unit: Unit, pos: GridPos) => boolean = () => false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: THREE.Camera,
    private readonly coords: GridCoords,
    private readonly board: BoardSystem,
    scene: THREE.Scene
  ) {
    this.ghost = this.buildGhost();
    scene.add(this.ghost);
    this.trashEl = document.getElementById("trash-bin");

    canvas.addEventListener("pointerdown", this.onCanvasDown);
    canvas.addEventListener("pointermove", this.onCanvasMove);
    canvas.addEventListener("pointerup", this.onCanvasUp);
    canvas.addEventListener("pointercancel", this.onCanvasUp);
  }

  dispose(): void {
    this.canvas.removeEventListener("pointerdown", this.onCanvasDown);
    this.canvas.removeEventListener("pointermove", this.onCanvasMove);
    this.canvas.removeEventListener("pointerup", this.onCanvasUp);
    this.canvas.removeEventListener("pointercancel", this.onCanvasUp);
  }

  // ===================== 召唤栏：拖拽放置 / 点击选中 =====================

  /** 由召唤栏格子调用：按住物品，移动超过阈值后才算拖拽，否则松手即选中。 */
  beginPlaceDrag(item: SummonItem, el: HTMLElement, ev: PointerEvent): void {
    this.placingItem = item;
    this.captureEl = el;
    this.placeMoved = false;
    this.placeStartX = ev.clientX;
    this.placeStartY = ev.clientY;
    el.setPointerCapture?.(ev.pointerId);
    el.addEventListener("pointermove", this.onPlaceMove);
    el.addEventListener("pointerup", this.onPlaceUp);
    el.addEventListener("pointercancel", this.onPlaceUp);
  }

  private onPlaceMove = (e: PointerEvent): void => {
    if (!this.placeMoved) {
      const moved =
        Math.abs(e.clientX - this.placeStartX) + Math.abs(e.clientY - this.placeStartY) >=
        DRAG_THRESHOLD;
      if (!moved) return;
      this.placeMoved = true;
      this.ghost.visible = true;
      this.onPlaceDragStart(this.placingItem!);
      console.log(
        `[拖拽] 开始放置: type=${this.placingItem?.type} tower=${this.placingItem?.towerType} char=${this.placingItem?.generalChar}`
      );
    }
    if (this.isOverTrash(e.clientX, e.clientY)) {
      this.setTrashHighlight(true);
      this.ghost.visible = false;
      this.onHover(null, false);
      return;
    }
    this.setTrashHighlight(false);
    this.updateGhostAt(e.clientX, e.clientY);
  };

  private onPlaceUp = (e: PointerEvent): void => {
    const el = this.captureEl;
    if (el) {
      el.releasePointerCapture?.(e.pointerId);
      el.removeEventListener("pointermove", this.onPlaceMove);
      el.removeEventListener("pointerup", this.onPlaceUp);
      el.removeEventListener("pointercancel", this.onPlaceUp);
    }
    this.captureEl = null;
    this.ghost.visible = false;
    this.setTrashHighlight(false);

    const item = this.placingItem;
    const moved = this.placeMoved;
    this.placingItem = null;
    this.placeMoved = false;
    this.onHover(null, false);
    if (!item) return;

    // 未移动 = 点击选中（备用通道）
    if (!moved) {
      this.onSlotClick(item);
      return;
    }

    this.onPlaceDragEnd();

    // 拖到垃圾桶：丢弃该召唤物
    if (this.isOverTrash(e.clientX, e.clientY)) {
      console.log(`[丢弃] 召唤物 ${item.type} 拖入垃圾桶`);
      this.onDiscardItem(item);
      return;
    }

    const pos = this.pickGrid(e.clientX, e.clientY);
    if (pos) this.onPlaceItem(item, pos);
    else console.log("[拖拽] 落点不在棋盘上，物品保留");
  };

  private updateGhostAt(clientX: number, clientY: number): void {
    const item = this.placingItem;
    if (!item) return;
    const pos = this.pickGrid(clientX, clientY);
    if (!pos) {
      this.ghost.visible = false;
      this.onHover(null, false);
      return;
    }
    this.ghost.visible = true;
    const w = this.coords.gridToWorld(pos);
    this.ghost.position.set(w.x, GHOST_Y, w.z);
    const ok = this.canDropItemAt(item, pos);
    (this.ghost.material as THREE.MeshBasicMaterial).color.setHex(ok ? 0x66ff66 : 0xff5555);
    this.onHover(pos, ok);
  }

  // ===================== 棋盘单位拖拽 / 点击放置 =====================

  private onCanvasDown = (e: PointerEvent): void => {
    if (this.placingItem) return;

    // 已选中召唤物：点击棋盘格放置（备用流程，对齐 Unity OnPointerDown）
    if (this.selectedItem) {
      const pos = this.pickGrid(e.clientX, e.clientY);
      if (pos) this.onPlaceSelectedAt(pos);
      return;
    }

    this.updateNdc(e.clientX, e.clientY);
    this.raycaster.setFromCamera(this.ndc, this.camera);

    const targets = this.board.units.map((u) => u.group);
    const hits = this.raycaster.intersectObjects(targets, true);
    if (hits.length === 0) return;
    const unit = this.board.findUnit(hits[0].object);
    if (!unit) return;

    this.draggingUnit = unit;
    this.canvas.setPointerCapture(e.pointerId);
    if (this.raycaster.ray.intersectPlane(this.groundPlane, this.hit)) {
      this.dragOffset.set(
        unit.group.position.x - this.hit.x,
        0,
        unit.group.position.z - this.hit.z
      );
    } else {
      this.dragOffset.set(0, 0, 0);
    }
    unit.group.position.y = DRAG_Y;
    this.onUnitDragStart(unit);
    console.log(`[拖拽] 抓起单位 kind=${unit.kind} lv=${unit.level} @ ${unit.pos.toString()}`);
  };

  private onCanvasMove = (e: PointerEvent): void => {
    if (this.draggingUnit) {
      this.updateNdc(e.clientX, e.clientY);
      this.raycaster.setFromCamera(this.ndc, this.camera);
      if (!this.raycaster.ray.intersectPlane(this.groundPlane, this.hit)) return;

      const p = this.hit.clone().add(this.dragOffset);
      this.draggingUnit.group.position.set(p.x, DRAG_Y, p.z);

      if (this.isOverTrash(e.clientX, e.clientY)) {
        this.setTrashHighlight(true);
        this.ghost.visible = false;
        this.onHover(null, false);
        return;
      }
      this.setTrashHighlight(false);

      const pos = this.coords.worldToGrid(this.draggingUnit.group.position);
      const inBounds = this.coords.inBounds(pos);
      const ok = inBounds && this.canDropUnitAt(this.draggingUnit, pos);
      this.onHover(inBounds ? pos : null, ok);
      return;
    }

    // 已选中召唤物：悬停棋盘时预览放置合法性
    if (this.selectedItem) {
      if (this.isOverTrash(e.clientX, e.clientY)) {
        this.setTrashHighlight(true);
        this.ghost.visible = false;
        this.onHover(null, false);
        return;
      }
      this.setTrashHighlight(false);
      this.ghost.visible = true;
      this.updateGhostAt(e.clientX, e.clientY);
    }
  };

  private onCanvasUp = (e: PointerEvent): void => {
    if (!this.draggingUnit) return;
    const unit = this.draggingUnit;
    this.draggingUnit = null;
    this.canvas.releasePointerCapture?.(e.pointerId);
    this.onHover(null, false);
    this.onUnitDragEnd();

    // 拖到垃圾桶：丢弃单位
    if (this.isOverTrash(e.clientX, e.clientY)) {
      this.setTrashHighlight(false);
      console.log(`[丢弃] 棋盘单位 kind=${unit.kind} 拖入垃圾桶`);
      this.onDiscardUnit(unit);
      return;
    }

    const pos = this.coords.worldToGrid(unit.group.position);
    if (this.coords.inBounds(pos)) this.onUnitDrop(unit, pos);
    else unit.moveTo(unit.pos); // 越界：归位
  };

  // ===================== 垃圾桶 =====================

  /** 屏幕坐标是否落在垃圾桶上（对应 Unity TrashBin.IsOver）。 */
  private isOverTrash(clientX: number, clientY: number): boolean {
    if (!this.trashEl) return false;
    const r = this.trashEl.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  }

  private setTrashHighlight(on: boolean): void {
    this.trashEl?.classList.toggle("hot", on);
  }

  // ===================== 工具 =====================

  private updateNdc(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  /** 把屏幕坐标投到地面并换算为格子坐标；越界返回 null。 */
  private pickGrid(clientX: number, clientY: number): GridPos | null {
    this.updateNdc(clientX, clientY);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, this.hit)) return null;
    const p = this.coords.worldToGrid(this.hit);
    return this.coords.inBounds(p) ? p : null;
  }

  private buildGhost(): THREE.Mesh {
    const geo = new THREE.BoxGeometry(1.3, 0.5, 1.3);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x66ff66,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.renderOrder = 4;
    mesh.name = "PlaceGhost";
    return mesh;
  }
}
