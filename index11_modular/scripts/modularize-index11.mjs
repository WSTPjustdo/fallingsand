import fs from "node:fs";
import path from "node:path";

const sourcePath = "C:/Users/35834/Documents/Codex/2026-04-24/falling-sand-html5-css3-javascript-canvas/index11_mobile_ready.html";
const outDir = "C:/Users/35834/Documents/Codex/2026-05-23/files-mentioned-by-the-user-index11";
const srcDir = path.join(outDir, "src");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

function assertIncludes(text, needle, label) {
  if (!text.includes(needle)) {
    throw new Error(`Missing marker for ${label}`);
  }
}

function findFunctionBlock(text, name) {
  const start = text.indexOf(`function ${name}(`);
  if (start === -1) {
    throw new Error(`Function not found: ${name}`);
  }
  const brace = text.indexOf("{", start);
  const end = findMatching(text, brace, "{", "}");
  return { start, end: end + 1 };
}

function replaceFunction(text, name, replacement) {
  const block = findFunctionBlock(text, name);
  return text.slice(0, block.start) + replacement + text.slice(block.end);
}

function findMatching(text, openIndex, openChar, closeChar) {
  let depth = 0;
  let quote = null;
  let escape = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (lineComment) {
      if (ch === "\n") {
        lineComment = false;
      }
      continue;
    }

    if (blockComment) {
      if (ch === "*" && next === "/") {
        blockComment = false;
        i += 1;
      }
      continue;
    }

    if (quote) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === "/" && next === "/") {
      lineComment = true;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      blockComment = true;
      i += 1;
      continue;
    }
    if (ch === "\"" || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === openChar) {
      depth += 1;
    } else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }

  throw new Error(`No match for ${openChar} at ${openIndex}`);
}

function dedentScript(text) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.startsWith("      ") ? line.slice(6) : line)
    .join("\n")
    .trimStart();
}

function extractInlineScript(html) {
  const startPattern = /  <script>\r?\n    \(function \(\) \{\r?\n      "use strict";\r?\n\r?\n/;
  const startMatch = html.match(startPattern);
  if (!startMatch || startMatch.index === undefined) {
    throw new Error("Inline script wrapper start not found");
  }
  const bodyStart = startMatch.index + startMatch[0].length;
  const endPattern = /\r?\n    \}\)\(\);\r?\n  <\/script>/;
  const tail = html.slice(bodyStart);
  const endMatch = tail.match(endPattern);
  if (!endMatch || endMatch.index === undefined) {
    throw new Error("Inline script wrapper end not found");
  }
  const bodyEnd = bodyStart + endMatch.index;
  const scriptTagStart = startMatch.index;
  const scriptTagEnd = bodyStart + endMatch.index + endMatch[0].length;
  return {
    body: dedentScript(html.slice(bodyStart, bodyEnd)),
    htmlBefore: html.slice(0, scriptTagStart),
    htmlAfter: html.slice(scriptTagEnd)
  };
}

function makeMaterialsModule(materialBlock) {
  const constants = materialBlock.replace(/^var\s+(\w+)\s+=/gm, "const $1 =");
  return `${constants}

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
`;
}

function makeLevelsModule(levelBlock) {
  const normalized = levelBlock
    .replace(/^var EXPLORE_MAPS =/m, "const EXPLORE_MAPS =")
    .replace(/^var LEVELS =/m, "const LEVELS =");
  return `export function createLevelData(deps) {
  const {
    rectRatio,
    expandRect,
    createLayout,
    fillRect,
    clearRect,
    outlineRect,
    fillCircle,
    fillEllipse,
    fillTerrainBand,
    drawMaterialPath,
    scatterClusters,
    fillCone,
    randomRange,
    clamp,
    chance,
    getActiveLevelTuning,
    inBounds,
    getCell,
    setCell,
    clearCell,
    createParticle,
    igniteCell,
    spawnParticleNearby,
    getGlobalTypeCount,
    getZoneTypeCount,
    clampRatio
  } = deps;

  let cols = 0;
  let rows = 0;

  function syncGeometry() {
    cols = deps.getCols();
    rows = deps.getRows();
  }

  syncGeometry();

${normalized
  .split("\n")
  .map((line) => `  ${line}`)
  .join("\n")}

  return {
    EXPLORE_MAPS,
    LEVELS,
    syncGeometry
  };
}
`;
}

function makeSimulationModule() {
  return `export class ParticleBuffer {
  constructor(length, materialIds, materialTypes) {
    this.materialIds = materialIds;
    this.materialTypes = materialTypes;
    this.refs = [];
    this.resize(length || 0);
  }

  get length() {
    return this.typeId.length;
  }

  resize(length) {
    this.typeId = new Uint8Array(length);
    this.updated = new Uint32Array(length);
    this.age = new Uint32Array(length);
    this.seed = new Float32Array(length);
    this.life = new Float32Array(length);
    this.maxLife = new Float32Array(length);
    this.temp = new Float32Array(length);
    this.maxTemp = new Float32Array(length);
    this.refs = new Array(length);
  }

  get(index) {
    if (index < 0 || index >= this.length || this.typeId[index] === 0) {
      return null;
    }
    if (!this.refs[index]) {
      this.refs[index] = this.createRef(index);
    }
    return this.refs[index];
  }

  set(index, particle) {
    if (index < 0 || index >= this.length) {
      return;
    }
    if (!particle) {
      this.clear(index);
      return;
    }
    const id = this.materialIds[particle.type] || 0;
    if (!id) {
      this.clear(index);
      return;
    }
    this.typeId[index] = id;
    this.updated[index] = Number.isFinite(particle.updated) ? particle.updated >>> 0 : 0;
    this.age[index] = Number.isFinite(particle.age) ? Math.max(0, Math.floor(particle.age)) : 0;
    this.seed[index] = Number.isFinite(particle.seed) ? particle.seed : Math.random();
    this.life[index] = typeof particle.life === "number" ? particle.life : Infinity;
    this.maxLife[index] = typeof particle.maxLife === "number" ? particle.maxLife : 1;
    this.temp[index] = typeof particle.temp === "number" ? particle.temp : 0;
    this.maxTemp[index] = typeof particle.maxTemp === "number" ? particle.maxTemp : 1;
  }

  clear(index) {
    if (index < 0 || index >= this.length) {
      return;
    }
    this.typeId[index] = 0;
  }

  clearAll() {
    this.typeId.fill(0);
  }

  move(fromIndex, toIndex) {
    if (fromIndex === toIndex || this.typeId[fromIndex] === 0) {
      return;
    }
    this.copyCell(fromIndex, toIndex);
    this.clear(fromIndex);
  }

  swap(aIndex, bIndex) {
    if (aIndex === bIndex) {
      return;
    }
    const typeId = this.typeId[aIndex];
    const updated = this.updated[aIndex];
    const age = this.age[aIndex];
    const seed = this.seed[aIndex];
    const life = this.life[aIndex];
    const maxLife = this.maxLife[aIndex];
    const temp = this.temp[aIndex];
    const maxTemp = this.maxTemp[aIndex];

    this.copyCell(bIndex, aIndex);
    this.typeId[bIndex] = typeId;
    this.updated[bIndex] = updated;
    this.age[bIndex] = age;
    this.seed[bIndex] = seed;
    this.life[bIndex] = life;
    this.maxLife[bIndex] = maxLife;
    this.temp[bIndex] = temp;
    this.maxTemp[bIndex] = maxTemp;
  }

  copyCell(fromIndex, toIndex) {
    this.typeId[toIndex] = this.typeId[fromIndex];
    this.updated[toIndex] = this.updated[fromIndex];
    this.age[toIndex] = this.age[fromIndex];
    this.seed[toIndex] = this.seed[fromIndex];
    this.life[toIndex] = this.life[fromIndex];
    this.maxLife[toIndex] = this.maxLife[fromIndex];
    this.temp[toIndex] = this.temp[fromIndex];
    this.maxTemp[toIndex] = this.maxTemp[fromIndex];
  }

  createRef(index) {
    const store = this;
    return {
      get type() {
        return store.materialTypes[store.typeId[index]];
      },
      set type(value) {
        store.typeId[index] = store.materialIds[value] || 0;
      },
      get updated() {
        return store.updated[index];
      },
      set updated(value) {
        store.updated[index] = value >>> 0;
      },
      get age() {
        return store.age[index];
      },
      set age(value) {
        store.age[index] = Math.max(0, Math.floor(value || 0));
      },
      get seed() {
        return store.seed[index];
      },
      set seed(value) {
        store.seed[index] = Number.isFinite(value) ? value : Math.random();
      },
      get life() {
        return store.life[index];
      },
      set life(value) {
        store.life[index] = typeof value === "number" ? value : Infinity;
      },
      get maxLife() {
        return store.maxLife[index];
      },
      set maxLife(value) {
        store.maxLife[index] = typeof value === "number" ? value : 1;
      },
      get temp() {
        return store.temp[index];
      },
      set temp(value) {
        store.temp[index] = typeof value === "number" ? value : 0;
      },
      get maxTemp() {
        return store.maxTemp[index];
      },
      set maxTemp(value) {
        store.maxTemp[index] = typeof value === "number" ? value : 1;
      }
    };
  }
}
`;
}

function makeReactionsModule() {
  return `export const REACTION_RULES = {
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
`;
}

function makeRendererModule() {
  return `export class CanvasRenderer {
  constructor(ctx, materials, math) {
    this.ctx = ctx;
    this.materials = materials;
    this.clamp = math.clamp;
    this.mix = math.mix;
    this.imageData = null;
    this.pixelBuffer = null;
  }

  resize(cols, rows) {
    this.imageData = this.ctx.createImageData(cols, rows);
    this.pixelBuffer = this.imageData.data;
  }

  renderParticleColor(particle, frameId) {
    const mat = this.materials[particle.type];
    const base = mat.rgb;
    const accent = mat.accentRgb;
    const pulse = (Math.sin((frameId + particle.seed * 18) * 0.18) + 1) * 0.5;
    let lifeT;
    let heat;
    let fade;
    let variation;

    if (particle.type === "fire") {
      lifeT = this.clamp(particle.life / particle.maxLife, 0, 1);
      return {
        r: this.clamp(Math.round(this.mix(255, 255, lifeT)), 0, 255),
        g: this.clamp(Math.round(this.mix(90, 232, lifeT) + pulse * 18), 0, 255),
        b: this.clamp(Math.round(this.mix(18, 88, lifeT)), 0, 255),
        a: 255
      };
    }

    if (particle.type === "ember") {
      lifeT = this.clamp(particle.life / particle.maxLife, 0, 1);
      return {
        r: 255,
        g: this.clamp(Math.round(this.mix(100, 200, lifeT) + pulse * 10), 0, 255),
        b: this.clamp(Math.round(this.mix(20, 70, lifeT)), 0, 255),
        a: 255
      };
    }

    if (particle.type === "lava") {
      heat = this.clamp(particle.temp / Math.max(1, particle.maxTemp), 0, 1);
      return {
        r: this.clamp(Math.round(this.mix(base.r, accent.r, heat * 0.7 + pulse * 0.08)), 0, 255),
        g: this.clamp(Math.round(this.mix(base.g, accent.g, heat)), 0, 255),
        b: this.clamp(Math.round(this.mix(base.b, accent.b, heat * 0.35)), 0, 255),
        a: 255
      };
    }

    if (particle.type === "steam" || particle.type === "smoke") {
      fade = this.clamp(particle.life / particle.maxLife, 0, 1);
      return {
        r: this.clamp(Math.round(this.mix(base.r, accent.r, pulse * 0.2)), 0, 255),
        g: this.clamp(Math.round(this.mix(base.g, accent.g, pulse * 0.2)), 0, 255),
        b: this.clamp(Math.round(this.mix(base.b, accent.b, pulse * 0.2)), 0, 255),
        a: this.clamp(Math.round(255 * (mat.alpha || 0.35) * fade), 18, 180)
      };
    }

    variation = Math.round((particle.seed - 0.5) * 28);
    return {
      r: this.clamp(base.r + variation, 0, 255),
      g: this.clamp(base.g + variation, 0, 255),
      b: this.clamp(base.b + variation, 0, 255),
      a: 255
    };
  }

  render(state) {
    const { cols, rows, frameId, getCell, effects, mode, activeLayout } = state;
    const ctx = this.ctx;
    const pixelBuffer = this.pixelBuffer;
    let i;
    let y;
    let x;
    let particle;
    let color;
    let offset;
    let effect;
    let progress;
    let radius;
    let gradient;

    if (!pixelBuffer) {
      return;
    }

    for (i = 0; i < pixelBuffer.length; i += 4) {
      pixelBuffer[i] = 10;
      pixelBuffer[i + 1] = 15;
      pixelBuffer[i + 2] = 20;
      pixelBuffer[i + 3] = 255;
    }

    for (y = 0; y < rows; y += 1) {
      for (x = 0; x < cols; x += 1) {
        particle = getCell(x, y);
        if (!particle) {
          continue;
        }
        color = this.renderParticleColor(particle, frameId);
        offset = ((y * cols) + x) * 4;
        pixelBuffer[offset] = color.r;
        pixelBuffer[offset + 1] = color.g;
        pixelBuffer[offset + 2] = color.b;
        pixelBuffer[offset + 3] = color.a;
      }
    }

    ctx.putImageData(this.imageData, 0, 0);

    if (effects.length) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (i = 0; i < effects.length; i += 1) {
        effect = effects[i];
        progress = 1 - effect.life / effect.maxLife;
        radius = effect.radius * (0.35 + progress * 0.9);
        gradient = ctx.createRadialGradient(effect.x, effect.y, 0, effect.x, effect.y, radius);
        gradient.addColorStop(0, effect.inner);
        gradient.addColorStop(1, effect.outer);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    this.renderMissionOverlay(mode, activeLayout);
  }

  renderMissionOverlay(mode, activeLayout) {
    const ctx = this.ctx;
    let i;
    let zone;
    if (mode !== "challenge" || !activeLayout) {
      return;
    }
    ctx.save();
    ctx.lineWidth = 1;
    if (ctx.setLineDash) {
      ctx.setLineDash([4, 3]);
    }
    ctx.font = "8px sans-serif";
    for (i = 0; i < activeLayout.zones.length; i += 1) {
      zone = activeLayout.zones[i];
      ctx.strokeStyle = zone.color;
      ctx.strokeRect(zone.rect.x + 0.5, zone.rect.y + 0.5, zone.rect.w, zone.rect.h);
      ctx.fillStyle = "rgba(7, 12, 18, 0.78)";
      ctx.fillRect(zone.rect.x, Math.max(0, zone.rect.y - 10), Math.min(zone.rect.w, 58), 10);
      ctx.fillStyle = "#eef5ff";
      ctx.fillText(zone.label, zone.rect.x + 3, Math.max(7, zone.rect.y - 3));
    }
    ctx.restore();
  }
}
`;
}

function makeUIManagerModule() {
  return `export class UIManager {
  constructor(rootDocument, hostWindow) {
    this.document = rootDocument;
    this.window = hostWindow;
    this.elements = this.collectElements();
  }

  byId(id) {
    return this.document.getElementById(id);
  }

  collectElements() {
    return {
      canvas: this.byId("simCanvas"),
      pane: this.byId("canvasPane"),
      materialGrid: this.byId("materialGrid"),
      clearBtn: this.byId("clearBtn"),
      pauseBtn: this.byId("pauseBtn"),
      fpsLabel: this.byId("fpsLabel"),
      materialLabel: this.byId("materialLabel"),
      brushLabel: this.byId("brushLabel"),
      particleLabel: this.byId("particleLabel"),
      brushSlider: this.byId("brushSlider"),
      brushValue: this.byId("brushValue"),
      gravitySlider: this.byId("gravitySlider"),
      gravityValue: this.byId("gravityValue"),
      reactionSlider: this.byId("reactionSlider"),
      reactionValue: this.byId("reactionValue"),
      brushPreview: this.byId("brushPreview"),
      hintCard: this.byId("hintCard"),
      hintToggle: this.byId("hintToggle"),
      hintTitle: this.byId("hintTitle"),
      sandboxModeBtn: this.byId("sandboxModeBtn"),
      exploreModeBtn: this.byId("exploreModeBtn"),
      challengeModeBtn: this.byId("challengeModeBtn"),
      missionTitle: this.byId("missionTitle"),
      missionSubtitle: this.byId("missionSubtitle"),
      missionMeta: this.byId("missionMeta"),
      missionTags: this.byId("missionTags"),
      objectiveList: this.byId("objectiveList"),
      explorePanel: this.byId("explorePanel"),
      exploreGrid: this.byId("exploreGrid"),
      restartLevelBtn: this.byId("restartLevelBtn"),
      nextLevelBtn: this.byId("nextLevelBtn"),
      levelLabel: this.byId("levelLabel"),
      missionBanner: this.byId("missionBanner"),
      bannerTitle: this.byId("bannerTitle"),
      bannerBody: this.byId("bannerBody"),
      bannerRestartBtn: this.byId("bannerRestartBtn"),
      bannerNextBtn: this.byId("bannerNextBtn"),
      celebrationBurst: this.byId("celebrationBurst"),
      celebrationTitle: this.byId("celebrationTitle"),
      celebrationText: this.byId("celebrationText")
    };
  }

  bindEvents(callbacks) {
    const ui = this.elements;
    const win = this.window;

    win.addEventListener("resize", callbacks.resize);
    ui.canvas.addEventListener("contextmenu", callbacks.contextMenu);
    ui.canvas.addEventListener("mouseenter", callbacks.canvasEnter);
    ui.canvas.addEventListener("mouseleave", callbacks.canvasLeave);

    if (win.PointerEvent) {
      ui.canvas.addEventListener("pointerdown", callbacks.pointerDown);
      win.addEventListener("pointermove", callbacks.pointerMove);
      win.addEventListener("pointerup", callbacks.pointerUp);
      win.addEventListener("pointercancel", callbacks.pointerUp);
    } else {
      ui.canvas.addEventListener("mousedown", callbacks.pointerDown);
      win.addEventListener("mousemove", callbacks.pointerMove);
      win.addEventListener("mouseup", callbacks.pointerUp);
      ui.canvas.addEventListener("touchstart", callbacks.pointerDown, { passive: false });
      win.addEventListener("touchmove", callbacks.pointerMove, { passive: false });
      win.addEventListener("touchend", callbacks.pointerUp);
      win.addEventListener("touchcancel", callbacks.pointerUp);
    }

    ui.canvas.addEventListener("wheel", callbacks.wheel, { passive: false });
    ui.brushSlider.addEventListener("input", callbacks.brushInput);
    ui.gravitySlider.addEventListener("input", callbacks.gravityInput);
    ui.reactionSlider.addEventListener("input", callbacks.reactionInput);
    ui.clearBtn.addEventListener("click", callbacks.clear);
    ui.pauseBtn.addEventListener("click", callbacks.pause);
    ui.hintToggle.addEventListener("click", callbacks.hintToggle);
    ui.sandboxModeBtn.addEventListener("click", callbacks.sandboxMode);
    ui.exploreModeBtn.addEventListener("click", callbacks.exploreMode);
    ui.challengeModeBtn.addEventListener("click", callbacks.challengeMode);
    ui.restartLevelBtn.addEventListener("click", callbacks.restart);
    ui.nextLevelBtn.addEventListener("click", callbacks.next);
    ui.bannerRestartBtn.addEventListener("click", callbacks.restart);
    ui.bannerNextBtn.addEventListener("click", callbacks.next);
  }
}
`;
}

const html = fs.readFileSync(sourcePath, "utf8");
const extracted = extractInlineScript(html);
let main = extracted.body;

const materialStart = main.indexOf("var MATERIALS = {");
const materialEnd = main.indexOf("\n\nvar ui = {", materialStart);
if (materialStart === -1 || materialEnd === -1) {
  throw new Error("Could not locate materials block");
}
const materialBlock = main.slice(materialStart, materialEnd);
main = main.slice(0, materialStart) + main.slice(materialEnd + 2);

const uiStart = main.indexOf("var ui = {");
const uiEnd = main.indexOf("\n\nvar ctx =", uiStart);
if (uiStart === -1 || uiEnd === -1) {
  throw new Error("Could not locate UI block");
}
main = main.slice(0, uiStart) +
  'var uiManager = new UIManager(document, window);\nvar ui = uiManager.elements;' +
  main.slice(uiEnd);

const levelStart = main.indexOf("var EXPLORE_MAPS = [");
const levelEnd = main.indexOf("\n\nfunction idx", levelStart);
if (levelStart === -1 || levelEnd === -1) {
  throw new Error("Could not locate levels block");
}
const levelBlock = main.slice(levelStart, levelEnd);
const levelInit = `var levelData = createLevelData({
  getCols: function () { return cols; },
  getRows: function () { return rows; },
  rectRatio: rectRatio,
  expandRect: expandRect,
  createLayout: createLayout,
  fillRect: fillRect,
  clearRect: clearRect,
  outlineRect: outlineRect,
  fillCircle: fillCircle,
  fillEllipse: fillEllipse,
  fillTerrainBand: fillTerrainBand,
  drawMaterialPath: drawMaterialPath,
  scatterClusters: scatterClusters,
  fillCone: fillCone,
  randomRange: randomRange,
  clamp: clamp,
  chance: chance,
  getActiveLevelTuning: getActiveLevelTuning,
  inBounds: inBounds,
  getCell: getCell,
  setCell: setCell,
  clearCell: clearCell,
  createParticle: createParticle,
  igniteCell: igniteCell,
  spawnParticleNearby: spawnParticleNearby,
  getGlobalTypeCount: getGlobalTypeCount,
  getZoneTypeCount: getZoneTypeCount,
  clampRatio: clampRatio
});
var EXPLORE_MAPS = levelData.EXPLORE_MAPS;
var LEVELS = levelData.LEVELS;

function syncLevelGeometry() {
  levelData.syncGeometry();
}`;
main = main.slice(0, levelStart) + levelInit + main.slice(levelEnd);

main = main.replace("var grid = [];", "var grid = new ParticleBuffer(0, MATERIAL_IDS, MATERIAL_TYPES);");
main = main.replace("return grid[idx(x, y)];", "return grid.get(idx(x, y));");
main = main.replace("previous = grid[index];", "previous = grid.get(index);");
main = main.replace("grid[index] = particle;", "grid.set(index, particle);");
main = main.replace("particle = oldGrid[y * oldCols + x];", "particle = oldGrid.get(y * oldCols + x);");
main = main.replace(`grid = [];
  particleCount = 0;

  for (y = 0; y < cols * rows; y += 1) {
    grid.push(null);
  }
  allocateBuffer();`, `grid = new ParticleBuffer(cols * rows, MATERIAL_IDS, MATERIAL_TYPES);
  particleCount = 0;
  allocateBuffer();`);

main = main.replaceAll("activeLayout = activeLevel.buildLayout();", "syncLevelGeometry();\n    activeLayout = activeLevel.buildLayout();");
main = main.replace("activeExploreMap.buildScene();", "syncLevelGeometry();\n  activeExploreMap.buildScene();");

main = main.replace("function allocateBuffer() {\n  imageData = ctx.createImageData(cols, rows);\n  pixelBuffer = imageData.data;\n}", "function allocateBuffer() {\n  renderer.resize(cols, rows);\n  imageData = renderer.imageData;\n  pixelBuffer = renderer.pixelBuffer;\n}");

main = replaceFunction(main, "tryMove", `function tryMove(x, y, nx, ny) {
  var fromIndex;
  var toIndex;
  var particle;
  var target;
  if (!inBounds(nx, ny)) {
    return false;
  }
  fromIndex = idx(x, y);
  toIndex = idx(nx, ny);
  particle = grid.get(fromIndex);
  target = grid.get(toIndex);
  if (!particle) {
    return false;
  }
  if (!target) {
    grid.move(fromIndex, toIndex);
    grid.get(toIndex).updated = frameId;
    return true;
  }
  if (!canDisplace(particle, target)) {
    return false;
  }
  grid.swap(fromIndex, toIndex);
  grid.get(toIndex).updated = frameId;
  grid.get(fromIndex).updated = frameId;
  return true;
}`);

main = replaceFunction(main, "tryMoveCustom", `function tryMoveCustom(x, y, nx, ny, predicate) {
  var fromIndex;
  var toIndex;
  var particle;
  var target;
  if (!inBounds(nx, ny)) {
    return false;
  }
  fromIndex = idx(x, y);
  toIndex = idx(nx, ny);
  particle = grid.get(fromIndex);
  target = grid.get(toIndex);
  if (!particle) {
    return false;
  }
  if (!target) {
    grid.move(fromIndex, toIndex);
    grid.get(toIndex).updated = frameId;
    return true;
  }
  if (!predicate || !predicate(target, nx, ny)) {
    return false;
  }
  grid.swap(fromIndex, toIndex);
  grid.get(toIndex).updated = frameId;
  grid.get(fromIndex).updated = frameId;
  return true;
}`);

main = replaceFunction(main, "clearAll", `function clearAll() {
  grid.clearAll();
  particleCount = 0;
  effects = [];
}`);

const renderStart = main.indexOf("function renderParticleColor(");
const renderEnd = main.indexOf("\n\nfunction updateStatus(", renderStart);
if (renderStart === -1 || renderEnd === -1) {
  throw new Error("Could not locate renderer block");
}
main = main.slice(0, renderStart) + `function render() {
  renderer.render({
    cols: cols,
    rows: rows,
    frameId: frameId,
    getCell: getCell,
    effects: effects,
    mode: mode,
    activeLayout: activeLayout
  });
}` + main.slice(renderEnd);

main = replaceFunction(main, "bindEvents", `function bindEvents() {
  uiManager.bindEvents({
    resize: resizeSimulation,
    contextMenu: function (event) {
      event.preventDefault();
    },
    canvasEnter: function () {
      mouse.inside = true;
      ui.brushPreview.style.display = "block";
    },
    canvasLeave: function () {
      mouse.inside = false;
      ui.brushPreview.style.display = "none";
    },
    pointerDown: onPointerDown,
    pointerMove: onPointerMove,
    pointerUp: onPointerUp,
    wheel: function (event) {
      var delta = event.deltaY > 0 ? -1 : 1;
      event.preventDefault();
      brushRadius = clamp(brushRadius + delta, 1, 50);
      updateBrushUI();
    },
    brushInput: function (event) {
      brushRadius = clamp(parseInt(event.target.value, 10), 1, 50);
      updateBrushUI();
    },
    gravityInput: function (event) {
      getCurrentPhysicsState().gravity = clamp(parseInt(event.target.value, 10) / 100, 0, 3);
      updatePhysicsUI();
      updateMissionUI();
    },
    reactionInput: function (event) {
      getCurrentPhysicsState().reaction = clamp(parseInt(event.target.value, 10) / 100, 0, 3);
      updatePhysicsUI();
      updateMissionUI();
    },
    clear: function () {
      if (mode === "challenge" || mode === "explore") {
        restartCurrentLevel();
      } else {
        clearAll();
      }
    },
    pause: function () {
      paused = !paused;
      ui.pauseBtn.innerHTML = paused ? "缁х画妯℃嫙" : "鏆傚仠妯℃嫙";
    },
    hintToggle: function () {
      hintCollapsed = !hintCollapsed;
      updateHintUI();
    },
    sandboxMode: function () {
      enterSandboxMode();
    },
    exploreMode: function () {
      startExploreMap(activeExploreIndex >= 0 ? activeExploreIndex : 0);
    },
    challengeMode: function () {
      startLevel(activeLevelIndex >= 0 ? activeLevelIndex : 0);
    },
    restart: restartCurrentLevel,
    next: nextLevel
  });
}`);

const reactionHelperMarker = "function reactWaterLike(x, y, type) {";
assertIncludes(main, reactionHelperMarker, "reaction helper insertion");
const reactionHelpers = `function createReactionParticle(spec) {
  var type;
  var roll;
  var i;
  var acc;
  if (!spec || spec === "empty") {
    return null;
  }
  if (typeof spec === "string") {
    return createParticle(spec);
  }
  if (spec.oneOf && spec.oneOf.length) {
    roll = Math.random();
    acc = 0;
    for (i = 0; i < spec.oneOf.length; i += 1) {
      acc += spec.weights && spec.weights[i] !== undefined ? spec.weights[i] : 1 / spec.oneOf.length;
      if (roll <= acc) {
        type = spec.oneOf[i];
        break;
      }
    }
    return createParticle(type || spec.oneOf[spec.oneOf.length - 1]);
  }
  type = spec.type;
  return createParticle(type, {
    life: spec.life ? randomRange(spec.life[0], spec.life[1]) : spec.life,
    temp: spec.temp
  });
}

function applyReactionCell(x, y, spec) {
  if (!spec || spec === "empty") {
    clearCell(x, y);
    return;
  }
  setCell(x, y, createReactionParticle(spec));
}

function applyReactionRule(x, y, nx, ny, rule) {
  var reactionBoost;
  var target = getCell(nx, ny);
  if (!rule || !chance(getLevelRate(rule.chance, rule.tuningKey))) {
    return false;
  }
  if (rule.action === "ignite") {
    igniteCell(nx, ny, rule.intensity || "normal");
  } else if (rule.action === "explode") {
    triggerExplosion(nx, ny, blastRadiusForType(target ? target.type : "gunpowder"), 0);
  } else {
    if (rule.self !== undefined) {
      applyReactionCell(x, y, rule.self);
    }
    if (rule.other !== undefined) {
      applyReactionCell(nx, ny, rule.other);
    }
  }
  if (rule.effect) {
    addEffect(x, y, rule.effect.radius, rule.effect.life, rule.effect.inner, rule.effect.outer);
  }
  if (rule.coolNearbyLava) {
    reactionBoost = Math.max(1, Math.round(getLevelScaledValue(1, rule.coolingExtraKey || "iceLavaReactionMultiplier")));
    if (reactionBoost > 1) {
      coolNearbyLava(x, y, reactionBoost - 1);
    }
  }
  return true;
}

`;
main = main.replace(reactionHelperMarker, reactionHelpers + reactionHelperMarker);

main = main.replace(`lavaNeighbor = findNeighbor(x, y, function (other) {
    return other.type === "lava";
  });
  if (lavaNeighbor && chance(getLevelRate(0.26))) {
    setCell(x, y, createParticle("steam", { life: randomRange(28, 60) }));
    setCell(lavaNeighbor.x, lavaNeighbor.y, createParticle("rock"));
    addEffect(x, y, 4.5, 12, "rgba(255, 244, 214, 0.5)", "rgba(255, 120, 0, 0)");
    return true;
  }`, `lavaNeighbor = findNeighbor(x, y, function (other) {
    return other.type === "lava";
  });
  if (lavaNeighbor && applyReactionRule(x, y, lavaNeighbor.x, lavaNeighbor.y, getReactionRule(type, "lava"))) {
    return true;
  }`);

main = main.replace(`waterNeighbor = findNeighbor(x, y, function (other) {
    return other.type === "water" || other.type === "rain";
  });
  if (waterNeighbor && chance(getLevelRate(0.26))) {
    setCell(waterNeighbor.x, waterNeighbor.y, createParticle("steam"));
    setCell(x, y, createParticle("rock"));
    addEffect(x, y, 5.4, 14, "rgba(255, 227, 150, 0.45)", "rgba(255, 96, 0, 0)");
    return;
  }

  iceNeighbor = findNeighbor(x, y, function (other) {
    return other.type === "ice";
  });
  if (iceNeighbor && chance(getLevelRate(0.22))) {
    reactionBoost = Math.max(1, Math.round(getLevelScaledValue(1, "iceLavaReactionMultiplier")));
    setCell(iceNeighbor.x, iceNeighbor.y, chance(0.6) ? createParticle("steam") : createParticle("water"));
    setCell(x, y, createParticle("rock"));
    if (reactionBoost > 1) {
      coolNearbyLava(x, y, reactionBoost - 1);
    }
    addEffect(x, y, 4.8, 12, "rgba(232, 249, 255, 0.42)", "rgba(255, 100, 0, 0)");
    return;
  }`, `waterNeighbor = findNeighbor(x, y, function (other) {
    return other.type === "water" || other.type === "rain";
  });
  if (waterNeighbor && applyReactionRule(x, y, waterNeighbor.x, waterNeighbor.y, getReactionRule("lava", waterNeighbor.particle.type))) {
    return;
  }

  iceNeighbor = findNeighbor(x, y, function (other) {
    return other.type === "ice";
  });
  if (iceNeighbor && applyReactionRule(x, y, iceNeighbor.x, iceNeighbor.y, getReactionRule("lava", "ice"))) {
    return;
  }`);

main = main.replace(`if (targetMat.acidImmune || target.type === "acid" || target.type === "steam" || target.type === "smoke" || target.type === "fire") {
      continue;
    }
    if (chance(getLevelRate(0.22))) {
      clearCell(nx, ny);
      if (isFiniteNumber(particle.life)) {
        particle.life -= 5;
      }
      corroded = true;
      if (chance(0.65)) {
        spawnParticleNearby(nx, ny, "smoke", 4);
      }
    }`, `var corrosionRule = getCorrosionRule("acid", target.type, targetMat);
    if (!corrosionRule) {
      continue;
    }
    if (chance(getLevelRate(corrosionRule.chance))) {
      applyReactionCell(nx, ny, corrosionRule.other);
      if (isFiniteNumber(particle.life)) {
        particle.life += corrosionRule.selfLifeDelta || 0;
      }
      corroded = true;
      if (corrosionRule.spawn && chance(corrosionRule.spawn.chance)) {
        spawnParticleNearby(nx, ny, corrosionRule.spawn.type, corrosionRule.spawn.attempts);
      }
    }`);

main = replaceFunction(main, "spreadFireToNeighbors", `function spreadFireToNeighbors(x, y) {
  var i;
  var nx;
  var ny;
  var target;
  var rule;
  for (i = 0; i < NEIGHBORS_8.length; i += 1) {
    nx = x + NEIGHBORS_8[i][0];
    ny = y + NEIGHBORS_8[i][1];
    target = getCell(nx, ny);
    if (!target) {
      continue;
    }
    rule = getReactionRule("fire", target.type);
    if (rule) {
      applyReactionRule(x, y, nx, ny, rule);
    }
  }
}`);

main = main.replace(`var renderer = new CanvasRenderer(ctx, MATERIALS, { clamp: clamp, mix: mix });\n`, "");
const ctxMarker = `var ctx = ui.canvas && ui.canvas.getContext ? ui.canvas.getContext("2d") : null;
if (!ctx) {`;
assertIncludes(main, ctxMarker, "renderer insertion");
main = main.replace(ctxMarker, `var ctx = ui.canvas && ui.canvas.getContext ? ui.canvas.getContext("2d") : null;
var renderer = null;
if (!ctx) {`);
main = main.replace(`  return;
}

var cols = 0;`, `  throw new Error("Canvas 2D context unavailable");
}
renderer = new CanvasRenderer(ctx, MATERIALS, { clamp: clamp, mix: mix });

var cols = 0;`);

const importHeader = `import {
  MATERIALS,
  MATERIAL_ORDER,
  MATERIAL_IDS,
  MATERIAL_TYPES,
  HOT_TYPES,
  EXTINGUISH_TYPES,
  WATER_TYPES,
  SOIL_TYPES,
  PLANT_TYPES,
  LIVING_TYPES,
  SOFT_TYPES,
  NEIGHBORS_8
} from "./config/materials.js";
import { createLevelData } from "./config/levels.js";
import { ParticleBuffer } from "./engine/Simulation.js";
import { getReactionRule, getCorrosionRule } from "./engine/Reactions.js";
import { CanvasRenderer } from "./renderer/CanvasRenderer.js";
import { UIManager } from "./ui/UIManager.js";

`;
main = importHeader + main;

const indexHtml = extracted.htmlBefore +
  '  <script type="module" src="./src/main.js"></script>' +
  extracted.htmlAfter;

writeFile(path.join(outDir, "index.html"), indexHtml);
writeFile(path.join(srcDir, "main.js"), main);
writeFile(path.join(srcDir, "config", "materials.js"), makeMaterialsModule(materialBlock));
writeFile(path.join(srcDir, "config", "levels.js"), makeLevelsModule(levelBlock));
writeFile(path.join(srcDir, "engine", "Simulation.js"), makeSimulationModule());
writeFile(path.join(srcDir, "engine", "Reactions.js"), makeReactionsModule());
writeFile(path.join(srcDir, "renderer", "CanvasRenderer.js"), makeRendererModule());
writeFile(path.join(srcDir, "ui", "UIManager.js"), makeUIManagerModule());

console.log("Generated modular project:");
console.log(path.join(outDir, "index.html"));
