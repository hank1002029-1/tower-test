/**
 * 网格数据模型：对齐 Unity GridManager 的 InitCells 布局与查询方法。
 * 布局：7 列 × 7 行；路径行居中（索引 3）；初始 6 个 Open 格（路径行上下各一行）+ 4 个角上的荒地，其余 Locked。
 */
import { GridCoords, GridPos } from "./coords";
import { GRID } from "../config/gameConfig";

/** 格子类型。 */
export enum CellType {
  Open, // 已开启，可放塔
  Locked, // 未开启，需铲子
  Wasteland, // 荒地，农民可开垦
  Path, // 怪物路径
}

/** 单个格子数据（占用槽位由后续里程碑填充具体实体）。 */
export class Cell {
  tower: object | null = null;
  farmer: object | null = null;
  text: object | null = null;
  general: object | null = null;

  constructor(public readonly pos: GridPos, public type: CellType) {}
}

export class GridModel {
  private cells: Cell[][] = [];

  constructor(readonly coords: GridCoords) {
    this.initCells();
  }

  /** 与 Unity GridManager.InitCells 完全一致的初始布局。 */
  private initCells(): void {
    for (let c = 0; c < this.coords.cols; c++) {
      this.cells[c] = [];
      for (let r = 0; r < this.coords.rows; r++) {
        this.cells[c][r] = new Cell(new GridPos(c, r), CellType.Locked);
      }
    }

    // 路径行（居中）
    for (let c = 0; c < this.coords.cols; c++) {
      this.cells[c][GRID.PathRow].type = CellType.Path;
    }

    // 初始 6 个 Open 格：路径行上下各一行，隔列分布
    for (const c of [1, 3, 5]) {
      this.cells[c][GRID.PathRow - 1].type = CellType.Open;
      this.cells[c][GRID.PathRow + 1].type = CellType.Open;
    }

    // 4 个荒地（四角）
    const lastCol = this.coords.cols - 1;
    const lastRow = this.coords.rows - 1;
    const wastelands: [number, number][] = [
      [0, 0], [lastCol, 0], [0, lastRow], [lastCol, lastRow],
    ];
    for (const [c, r] of wastelands) this.cells[c][r].type = CellType.Wasteland;
  }

  getCell(p: GridPos): Cell | null {
    return this.coords.inBounds(p) ? this.cells[p.col][p.row] : null;
  }

  isType(p: GridPos, t: CellType): boolean {
    return this.getCell(p)?.type === t;
  }

  /** 可放塔：Open 且空。 */
  canPlaceTower(p: GridPos): boolean {
    const c = this.getCell(p);
    return !!c && c.type === CellType.Open && !c.tower && !c.text && !c.general;
  }

  /** 可放农民：Wasteland 且空。 */
  canPlaceFarmer(p: GridPos): boolean {
    const c = this.getCell(p);
    return !!c && c.type === CellType.Wasteland && !c.farmer;
  }

  /** 可放武将文字：Open 且空。 */
  canPlaceText(p: GridPos): boolean {
    return this.canPlaceTower(p);
  }

  setTower(p: GridPos, v: object | null): void { const c = this.getCell(p); if (c) c.tower = v; }
  setFarmer(p: GridPos, v: object | null): void { const c = this.getCell(p); if (c) c.farmer = v; }
  setText(p: GridPos, v: object | null): void { const c = this.getCell(p); if (c) c.text = v; }
  setGeneral(p: GridPos, v: object | null): void { const c = this.getCell(p); if (c) c.general = v; }

  getTower(p: GridPos): object | null { return this.getCell(p)?.tower ?? null; }
  getFarmer(p: GridPos): object | null { return this.getCell(p)?.farmer ?? null; }
  getText(p: GridPos): object | null { return this.getCell(p)?.text ?? null; }
  getGeneral(p: GridPos): object | null { return this.getCell(p)?.general ?? null; }

  /** 用铲子开启一个 Locked 格；返回是否成功。 */
  unlockCell(p: GridPos): boolean {
    const c = this.getCell(p);
    if (!c || c.type !== CellType.Locked) return false;
    c.type = CellType.Open;
    return true;
  }

  /** GM：一键解锁全部 Locked 格，返回被解锁的格子列表。 */
  unlockAll(): GridPos[] {
    const changed: GridPos[] = [];
    for (let c = 0; c < this.coords.cols; c++) {
      for (let r = 0; r < this.coords.rows; r++) {
        const cell = this.cells[c][r];
        if (cell.type !== CellType.Locked) continue;
        cell.type = CellType.Open;
        changed.push(cell.pos);
      }
    }
    return changed;
  }

  /** 遍历所有格子。 */
  forEach(fn: (cell: Cell) => void): void {
    for (let c = 0; c < this.coords.cols; c++) {
      for (let r = 0; r < this.coords.rows; r++) fn(this.cells[c][r]);
    }
  }
}
