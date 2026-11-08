/**
 * 召唤系统：对应 Unity SummonSystem。
 * 消耗馒头产出 5 个随机物品（刀/枪/骑/弓/铲/农民/武将文字），成本随召唤次数递增。
 */
import { GameState } from "../core/GameState";
import { getAllGenerals, getGeneralByName } from "../config/generals";
import { getItemLabel, getSummonCost, SUMMON_WEIGHTS, SummonItem } from "../config/summon";
import { ItemType, TowerType } from "../config/types";

/** GM 调试：强制下一次召唤的产出（对应 Unity SummonSystem.SummonForce）。 */
export enum SummonForce {
  None,
  GeneralText,
  NormalSoldier,
  Shovel,
}

/** 从数组中随机取一个元素。 */
function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export class SummonSystem {
  currentItems: SummonItem[] = [];

  onSummon: (items: SummonItem[]) => void = () => {};
  onItemTaken: (item: SummonItem) => void = () => {};
  onItemsCleared: () => void = () => {};

  private forceMode = SummonForce.None;
  private forceGeneralName: string | null = null;
  private forceTowerType: TowerType | null = null;

  constructor(private readonly game: GameState) {}

  /** 执行一次召唤，返回是否成功。 */
  trySummon(): boolean {
    const cost = getSummonCost(this.game.summonCount);
    if (!this.game.trySpendMantou(cost)) {
      console.warn(`[召唤] 馒头不足，需要 ${cost}，当前 ${this.game.mantou}`);
      return false;
    }
    this.currentItems = this.generateItems(5);
    this.game.incrementSummonCount();
    console.log(
      `[召唤] 第 ${this.game.summonCount} 次，花费 ${cost}，产出: ${this.currentItems
        .map(getItemLabel)
        .join(" ")}`
    );
    this.onSummon(this.currentItems);
    return true;
  }

  /** 玩家取走一个物品（放置成功后调用）。 */
  takeItem(item: SummonItem): void {
    const i = this.currentItems.indexOf(item);
    if (i >= 0) this.currentItems.splice(i, 1);
    this.onItemTaken(item);
    if (this.currentItems.length === 0) this.onItemsCleared();
  }

  clearItems(): void {
    this.currentItems = [];
    this.onItemsCleared();
  }

  // ===== GM 调试接口 =====
  forceGeneralText(name: string | null = null): void {
    this.forceMode = SummonForce.GeneralText;
    this.forceGeneralName = name;
    this.forceTowerType = null;
    console.log(`[GM] 下次召唤将产出武将文字（武将=${name ?? "随机"}）`);
  }

  forceNormalSoldier(type: TowerType | null = null): void {
    this.forceMode = SummonForce.NormalSoldier;
    this.forceTowerType = type;
    this.forceGeneralName = null;
    console.log(`[GM] 下次召唤将产出普通兵（兵种=${type ?? "随机"}）`);
  }

  forceShovel(): void {
    this.forceMode = SummonForce.Shovel;
    this.forceGeneralName = null;
    this.forceTowerType = null;
    console.log("[GM] 下次召唤将产出铲子");
  }

  clearForce(): void {
    this.forceMode = SummonForce.None;
    this.forceGeneralName = null;
    this.forceTowerType = null;
  }

  // ===== 内部实现 =====
  private generateItems(count: number): SummonItem[] {
    const forced = this.forceMode !== SummonForce.None;
    const items: SummonItem[] = [];
    for (let i = 0; i < count; i++) {
      items.push(forced ? this.buildForcedItem() : this.buildRandomItem());
    }
    if (forced) this.clearForce(); // GM 只作用于下一次召唤
    return items;
  }

  private buildRandomItem(): SummonItem {
    const type = this.weightedRandomType();
    const item: SummonItem = { type, towerType: null, level: 1, generalChar: "", generalName: "" };
    switch (type) {
      case ItemType.Blade:
        item.towerType = TowerType.Blade;
        break;
      case ItemType.Spear:
        item.towerType = TowerType.Spear;
        break;
      case ItemType.Cavalry:
        item.towerType = TowerType.Cavalry;
        break;
      case ItemType.Bow:
        item.towerType = TowerType.Bow;
        break;
      case ItemType.Shovel:
      case ItemType.Farmer:
        break;
      case ItemType.GeneralText: {
        const g = pickRandom(getAllGenerals());
        item.generalName = g.name;
        item.generalChar = pickRandom(g.characters);
        break;
      }
    }
    return item;
  }

  private buildForcedItem(): SummonItem {
    const item: SummonItem = {
      type: ItemType.Blade,
      towerType: null,
      level: 1,
      generalChar: "",
      generalName: "",
    };
    if (this.forceMode === SummonForce.GeneralText) {
      let g = this.forceGeneralName ? getGeneralByName(this.forceGeneralName) : null;
      if (!g) g = pickRandom(getAllGenerals());
      item.type = ItemType.GeneralText;
      item.generalName = g.name;
      item.generalChar = pickRandom(g.characters);
    } else if (this.forceMode === SummonForce.Shovel) {
      item.type = ItemType.Shovel;
    } else {
      const tt = this.forceTowerType ?? (Math.floor(Math.random() * 4) as TowerType);
      item.type = towerTypeToItemType(tt);
      item.towerType = tt;
    }
    return item;
  }

  /** 加权随机（对应 Unity WeightedRandomType）。 */
  private weightedRandomType(): ItemType {
    let total = 0;
    for (const w of Object.values(SUMMON_WEIGHTS)) total += w;
    let r = Math.floor(Math.random() * total);
    let acc = 0;
    for (const [k, w] of Object.entries(SUMMON_WEIGHTS)) {
      acc += w;
      if (r < acc) return Number(k) as ItemType;
    }
    return ItemType.Blade;
  }
}

function towerTypeToItemType(t: TowerType): ItemType {
  switch (t) {
    case TowerType.Spear:
      return ItemType.Spear;
    case TowerType.Cavalry:
      return ItemType.Cavalry;
    case TowerType.Bow:
      return ItemType.Bow;
    default:
      return ItemType.Blade;
  }
}
