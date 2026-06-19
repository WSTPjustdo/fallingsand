const MATERIALS = {
  rock: { name: "岩石", state: "固态", behavior: "static", density: 100, flow: 0, fallSpeed: 0, color: "#525761", accent: "#6d7482", acidImmune: true },
  sand: { name: "沙子", state: "固态", behavior: "powder", density: 7, flow: 1, fallSpeed: 2, color: "#dfc96d", accent: "#f2dd8b" },
  soil: { name: "土", state: "固态", behavior: "powder", density: 6, flow: 1, fallSpeed: 2, color: "#8a5a3c", accent: "#a9714d" },
  seed: { name: "种子", state: "生物态", behavior: "powder", density: 5, flow: 1, fallSpeed: 2, color: "#b68654", accent: "#e0b77c", flammable: true },
  plant: { name: "植物", state: "固态", behavior: "static", density: 6, flow: 0, fallSpeed: 0, color: "#4caf50", accent: "#8bcf6a", flammable: true },
  root: { name: "根系", state: "生物态", behavior: "static", density: 7, flow: 0, fallSpeed: 0, color: "#6d4a2f", accent: "#a1704c", flammable: true },
  algae: { name: "藻类", state: "生物态", behavior: "static", density: 3, flow: 0, fallSpeed: 0, color: "#2d9c74", accent: "#69d6a4", flammable: true },
  ice: { name: "冰块", state: "固态", behavior: "static", density: 8, flow: 0, fallSpeed: 0, color: "#a8ddff", accent: "#d8f2ff", cold: true },
  ash: { name: "灰烬", state: "固态", behavior: "powder", density: 3, flow: 1, fallSpeed: 1, color: "#bec4cc", accent: "#dce1e8" },
  metal: { name: "金属", state: "固态", behavior: "static", density: 120, flow: 0, fallSpeed: 0, color: "#9aa2b3", accent: "#c7cedb", acidImmune: true },
  water: { name: "水", state: "液态", behavior: "liquid", density: 4, flow: 5, fallSpeed: 2, color: "#4ea6ff", accent: "#88d6ff" },
  rain: { name: "雨", state: "液态", behavior: "liquid", density: 4.5, flow: 2, fallSpeed: 3, life: [80, 150], color: "#255ad5", accent: "#58a2ff" },
  lava: { name: "岩浆", state: "液态", behavior: "liquid", density: 9, flow: 2, fallSpeed: 2, temp: 26, color: "#ff6326", accent: "#ffcf56", hot: true },
  oil: { name: "油", state: "液态", behavior: "liquid", density: 2, flow: 4, fallSpeed: 2, color: "#4c2d1f", accent: "#7d4f34", flammable: true },
  acid: { name: "酸", state: "液态", behavior: "liquid", density: 5, flow: 4, fallSpeed: 2, life: [240, 420], color: "#86ff46", accent: "#dbff55", corrosive: true },
  fire: { name: "火", state: "等离子态", behavior: "fire", density: -1, flow: 2, fallSpeed: 0, life: [12, 22], temp: 12, color: "#ff6d1f", accent: "#ffe264", hot: true },
  steam: { name: "水蒸气", state: "气态", behavior: "gas", density: -3, flow: 3, fallSpeed: 0, life: [55, 120], color: "#f4f8ff", accent: "#ffffff", alpha: 0.45 },
  smoke: { name: "烟雾", state: "气态", behavior: "gas", density: -2, flow: 3, fallSpeed: 0, life: [70, 160], color: "#7f858f", accent: "#b0b6be", alpha: 0.38 },
  ember: { name: "火星", state: "特殊态", behavior: "ember", density: -0.5, flow: 2, fallSpeed: 0, life: [20, 40], temp: 9, color: "#ff9a2b", accent: "#ffd36b", hot: true },
  worm: { name: "蚯蚓", state: "生物态", behavior: "creature", density: 5, flow: 1, fallSpeed: 0, life: [260, 520], color: "#b16f57", accent: "#d6a183", flammable: true },
  bug: { name: "小虫", state: "生物态", behavior: "creature", density: 4, flow: 1, fallSpeed: 0, life: [220, 420], color: "#8fd163", accent: "#d7f18c", flammable: true },
  gunpowder: { name: "火药", state: "固态", behavior: "powder", density: 7, flow: 1, fallSpeed: 2, color: "#191a1d", accent: "#393b40", explosive: "small", flammable: true },
  explosive: { name: "炸药", state: "固态", behavior: "powder", density: 8, flow: 1, fallSpeed: 2, color: "#7d3030", accent: "#b54a3f", explosive: "large", flammable: true }
};

const MATERIAL_ORDER = [
  "sand", "water", "rock", "soil", "seed", "plant", "root", "algae", "worm", "bug",
  "ice", "ash", "metal", "rain", "lava", "oil", "acid", "fire", "steam", "smoke", "ember", "gunpowder", "explosive"
];

const HOT_TYPES = { fire: true, ember: true, lava: true };
const EXTINGUISH_TYPES = { water: true, rain: true };
const WATER_TYPES = { water: true, rain: true };
const SOIL_TYPES = { soil: true, sand: true, ash: true };
const PLANT_TYPES = { seed: true, plant: true, root: true, algae: true };
const LIVING_TYPES = { seed: true, plant: true, root: true, algae: true, worm: true, bug: true };
const SOFT_TYPES = { sand: true, soil: true, seed: true, plant: true, root: true, algae: true, worm: true, bug: true, ash: true, oil: true, gunpowder: true, explosive: true };
const NEIGHBORS_8 = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1]
];

export const EMPTY_TYPE_ID = 0;
export const MATERIAL_TYPES = [null].concat(Object.keys(MATERIALS));
export const MATERIAL_IDS = MATERIAL_TYPES.reduce(function (map, type, index) {
  if (type) {
    map[type] = index;
  }
  return map;
}, {});

export {
  MATERIALS,
  MATERIAL_ORDER,
  HOT_TYPES,
  EXTINGUISH_TYPES,
  WATER_TYPES,
  SOIL_TYPES,
  PLANT_TYPES,
  LIVING_TYPES,
  SOFT_TYPES,
  NEIGHBORS_8
};
