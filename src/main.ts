/** 应用入口：挂载 GameApp 到 canvas，并打印配置表用于与 Unity 校对。 */
import { GameApp } from "./core/GameApp";
import { getAllGenerals } from "./config/generals";
import { getTowerConfig } from "./config/towers";
import { getItemLabel, getSummonCost, SUMMON_WEIGHTS } from "./config/summon";
import { GeneralQuality, ItemType, TowerType } from "./config/types";

const canvas = document.getElementById("app") as HTMLCanvasElement;
if (!canvas) throw new Error("找不到 #app canvas");

const app = new GameApp(canvas);
app.start();

// 便于在控制台调试（如 app.summon.forceGeneralText("赵云")、app.gmUnlockAll()）
(window as unknown as { app: GameApp }).app = app;

/**
 * 打印全部配置，供与 Unity 版逐项核对（M2 验收）。
 */
function logConfigs(): void {
  console.group("[M2] 配置校验（应与 Unity 一致）");

  const towerRows: object[] = [];
  for (const t of [TowerType.Blade, TowerType.Spear, TowerType.Cavalry, TowerType.Bow]) {
    const cfg = getTowerConfig(t);
    for (const lv of cfg.levels) {
      towerRows.push({
        塔: cfg.displayName,
        等级: lv.level,
        伤害: lv.damage,
        射程: lv.range,
        频率: lv.fireRate,
        附加目标数: lv.splashCount,
      });
    }
  }
  console.table(towerRows);

  console.table(
    getAllGenerals().map((g) => ({
      武将: g.name,
      字符: g.characters.join(""),
      品质: GeneralQuality[g.quality],
      最高等级: g.maxLevel,
      伤害: g.baseDamage,
      射程: g.baseRange,
      频率: g.baseFireRate,
      颜色: g.nameColor.join(","),
      技能: g.skillName,
    }))
  );

  console.log(
    "召唤权重:",
    Object.entries(SUMMON_WEIGHTS)
      .map(([k, v]) => `${ItemType[Number(k)]}=${v}`)
      .join(", ")
  );
  console.log(
    "召唤成本(第1~16次):",
    Array.from({ length: 16 }, (_, i) => getSummonCost(i)).join(", ")
  );
  const itemTypes: ItemType[] = [
    ItemType.Blade,
    ItemType.Spear,
    ItemType.Cavalry,
    ItemType.Bow,
    ItemType.Shovel,
    ItemType.Farmer,
    ItemType.GeneralText,
  ];
  console.log(
    "召唤物显示文字:",
    itemTypes
      .map(
        (t) =>
          `${ItemType[t]}=${getItemLabel({
            type: t,
            towerType: null,
            level: 1,
            generalChar: "赵",
            generalName: "赵云",
          })}`
      )
      .join(", ")
  );

  console.groupEnd();
}

logConfigs();
