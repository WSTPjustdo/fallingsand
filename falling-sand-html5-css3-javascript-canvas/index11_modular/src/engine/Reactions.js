export const REACTION_RULES = {
  "water+lava": {
    chance: 0.26,
    self: { type: "steam", life: [28, 60] },
    other: "rock",
    effect: { radius: 4.5, life: 12, inner: "rgba(255, 244, 214, 0.5)", outer: "rgba(255, 120, 0, 0)" }
  },
  "rain+lava": {
    chance: 0.26,
    self: { type: "steam", life: [28, 60] },
    other: "rock",
    effect: { radius: 4.5, life: 12, inner: "rgba(255, 244, 214, 0.5)", outer: "rgba(255, 120, 0, 0)" }
  },
  "lava+water": {
    chance: 0.26,
    self: "rock",
    other: "steam",
    effect: { radius: 5.4, life: 14, inner: "rgba(255, 227, 150, 0.45)", outer: "rgba(255, 96, 0, 0)" }
  },
  "lava+rain": {
    chance: 0.26,
    self: "rock",
    other: "steam",
    effect: { radius: 5.4, life: 14, inner: "rgba(255, 227, 150, 0.45)", outer: "rgba(255, 96, 0, 0)" }
  },
  "lava+ice": {
    chance: 0.22,
    self: "rock",
    other: { oneOf: ["steam", "water"], weights: [0.6, 0.4] },
    effect: { radius: 4.8, life: 12, inner: "rgba(232, 249, 255, 0.42)", outer: "rgba(255, 100, 0, 0)" },
    coolNearbyLava: true,
    coolingExtraKey: "iceLavaReactionMultiplier"
  },
  "fire+plant": { chance: 0.26, tuningKey: "fireSpreadMultiplier", action: "ignite", intensity: "normal" },
  "fire+oil": { chance: 0.38, tuningKey: "fireSpreadMultiplier", action: "ignite", intensity: "strong" },
  "fire+gunpowder": { chance: 0.35, tuningKey: "fireSpreadMultiplier", action: "explode" },
  "fire+explosive": { chance: 0.35, tuningKey: "fireSpreadMultiplier", action: "explode" },
  "fire+ice": { chance: 0.22, tuningKey: "fireSpreadMultiplier", other: "water" },
  "acid+*": { chance: 0.22, other: "empty", spawn: { type: "smoke", chance: 0.65, attempts: 4 }, selfLifeDelta: -5 }
};

export function getReactionRule(sourceType, targetType) {
  return REACTION_RULES[sourceType + "+" + targetType] || null;
}

export function getCorrosionRule(sourceType, targetType, targetMaterial) {
  if (sourceType !== "acid") {
    return null;
  }
  if (!targetMaterial || targetMaterial.acidImmune || targetType === "acid" || targetType === "steam" || targetType === "smoke" || targetType === "fire") {
    return null;
  }
  return REACTION_RULES["acid+*"];
}
