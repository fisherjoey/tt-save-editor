/** Island code → display name (top region in hub tags: `.Hub.<ISLAND>.<DISTRICT>`). */
export const ISLANDS: Record<string, string> = {
  TC: "Tri-Corner", SI: "South Island", NI: "North Island", CI: "Central Island",
};

/** Sub-district code → display name (from the game's UI_HUB_DISTRICT string table). */
export const DISTRICTS: Record<string, string> = {
  TC01: "Tricorner",
  OG01: "Old Gotham North", OG02: "Old Gotham South", OG03: "Old Gotham West",
  CA01: "The Cauldron Central", CA02: "The Cauldron South", CAAC: "The Cauldron North - ACE Chemicals",
  NT01: "Newtown", GVRP: "Gotham Village - Robinson Park", EEAM: "East End - Amusement Mile",
  OT01: "Otisburg", BC: "The Batcave",
};

/** How each in-game counter maps to gameplay-tag families.
 *  `include`/`exclude` are prefix tests against the full tag.
 *  `stateCategory` is the `GameProgress.Definitions.<X>` whose canonical "collected"
 *  state is used as the insert value (derived from the 100% save at build time).
 *  `counter` is the known in-game /N — the build asserts selected tags === counter. */
export interface CounterMapping {
  key: string;
  label: string;
  counter: number;
  verified: boolean;
  stateCategory: string;
  include: string[];
  exclude?: string[];
}

/** DLC `Characters.*` tags excluded from the base-game Costumes (101) counter.
 *  Filled in by the costumes DLC-split resolution task. */
export const DLC_COSTUMES: string[] = [];

export const COUNTER_MAPPINGS: CounterMapping[] = [
  { key: "GoldBricks", label: "Gold bricks", counter: 30, verified: true, stateCategory: "GoldBricks",
    include: ["GameProgress.Definitions.GoldBricks."] },
  { key: "RedBricks", label: "Red bricks", counter: 23, verified: false, stateCategory: "RedBricks",
    include: ["GameProgress.Definitions.RedBricks."] },
  { key: "Minikits", label: "Minikits", counter: 121, verified: false, stateCategory: "RiddlerTrophies",
    include: ["GameProgress.Definitions.RiddlerTrophies."] },
  { key: "WayneTechChips", label: "Wayne Tech chips", counter: 200, verified: false, stateCategory: "WayneTechChips",
    include: ["GameProgress.Definitions.WayneTechChips."] },
  { key: "Vehicles", label: "Vehicles", counter: 30, verified: false, stateCategory: "ShopItems",
    include: ["GameProgress.Definitions.ShopItems.Vehicles."] },
  { key: "StudCaches", label: "Stud caches", counter: 100, verified: false, stateCategory: "StudCaches",
    include: ["GameProgress.Definitions.StudCaches."] },
  { key: "BatTokens", label: "Bat tokens", counter: 65, verified: false, stateCategory: "BatTokens",
    include: ["GameProgress.Definitions.BatTokens."] },
  { key: "Trophies", label: "Trophies", counter: 170, verified: false, stateCategory: "MicroBuilds",
    include: ["GameProgress.Definitions.MicroBuilds.", "GameProgress.Definitions.Microbuilds."] },
  // Costumes: `counter` = all insertable Characters.* tags (125). The in-game base-game
  // counter shows /101; DLC character variants inflate the tag count. Unverified category —
  // refine the base/DLC split (DLC assets live under AdditionalContent/DLC_*) if costume
  // insertion is ever confirmed in-game.
  { key: "Costumes", label: "Costumes", counter: 125, verified: false, stateCategory: "Characters",
    include: ["GameProgress.Definitions.Characters."], exclude: DLC_COSTUMES },
];
