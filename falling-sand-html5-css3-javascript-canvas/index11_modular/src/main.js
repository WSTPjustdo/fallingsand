import {
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

var requestFrame = window.requestAnimationFrame ||
  window.webkitRequestAnimationFrame ||
  window.mozRequestAnimationFrame ||
  function (callback) {
    return window.setTimeout(function () {
      callback(Date.now());
    }, 16);
  };

function getNowMs() {
  return window.performance && window.performance.now ? window.performance.now() : Date.now();
}

function isFiniteNumber(value) {
  return typeof value === "number" && isFinite(value);
}

function sign(value) {
  if (value > 0) {
    return 1;
  }
  if (value < 0) {
    return -1;
  }
  return 0;
}

var uiManager = new UIManager(document, window);
var ui = uiManager.elements;

var ctx = ui.canvas && ui.canvas.getContext ? ui.canvas.getContext("2d") : null;
var renderer = null;
if (!ctx) {
  alert("当前浏览器无法初始化 Canvas 2D，建议换用 Chrome、Edge 或 Firefox 打开 index.html。");
  throw new Error("Canvas 2D context unavailable");
}
renderer = new CanvasRenderer(ctx, MATERIALS, { clamp: clamp, mix: mix });

var cols = 0;
var rows = 0;
var cellSize = 4;
var grid = new ParticleBuffer(0, MATERIAL_IDS, MATERIAL_TYPES);
var imageData = null;
var pixelBuffer = null;
var frameId = 0;
var particleCount = 0;
var paused = false;
var brushRadius = 12;
var selectedType = "sand";
var MODE_PHYSICS_DEFAULTS = {
  sandbox: { gravity: 1, reaction: 1 },
  explore: { gravity: 1, reaction: 1 },
  challenge: { gravity: 0.1, reaction: 0.1 }
};
var modePhysics = {
  sandbox: { gravity: MODE_PHYSICS_DEFAULTS.sandbox.gravity, reaction: MODE_PHYSICS_DEFAULTS.sandbox.reaction },
  explore: { gravity: MODE_PHYSICS_DEFAULTS.explore.gravity, reaction: MODE_PHYSICS_DEFAULTS.explore.reaction },
  challenge: { gravity: MODE_PHYSICS_DEFAULTS.challenge.gravity, reaction: MODE_PHYSICS_DEFAULTS.challenge.reaction }
};
var smoothedFps = 0;
var lastTime = getNowMs();
var effects = [];
var hintCollapsed = false;
var mode = "sandbox";
var activeLevelIndex = -1;
var activeLevel = null;
var activeExploreIndex = -1;
var activeExploreMap = null;
var activeObjectives = [];
var activeLayout = null;
var levelRuntime = null;
var lastStatsFrame = -1;
var currentNow = getNowMs();
var celebrationTimer = 0;

var mouse = {
  inside: false,
  down: false,
  erase: false,
  pointerId: null,
  lastGridX: null,
  lastGridY: null
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomRange(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function chance(rate) {
  return Math.random() < rate;
}

function getActiveLevelTuning() {
  return mode === "challenge" && activeLevel && activeLevel.tuning ? activeLevel.tuning : null;
}

function getLevelRate(base, key) {
  var tuning = getActiveLevelTuning();
  var multiplier = tuning && isFiniteNumber(tuning[key]) ? tuning[key] : 1;
  multiplier *= getReactionScale();
  return clamp(base * multiplier, 0, 1);
}

function getLevelScaledValue(base, key) {
  var tuning = getActiveLevelTuning();
  var multiplier = tuning && isFiniteNumber(tuning[key]) ? tuning[key] : 1;
  return base * multiplier;
}

function getCurrentPhysicsState() {
  return modePhysics[mode] || modePhysics.sandbox;
}

function getGravityScale() {
  return clamp(getCurrentPhysicsState().gravity, 0, 3);
}

function getReactionScale() {
  return clamp(getCurrentPhysicsState().reaction, 0, 3);
}

function getGravityRate(base) {
  return clamp(base * getGravityScale(), 0, 1);
}

function getScaledStepCount(base, scale) {
  var scaled = Math.max(0, base * scale);
  var whole = Math.floor(scaled);
  if (chance(scaled - whole)) {
    whole += 1;
  }
  return whole;
}

function formatScaleValue(value) {
  return (value < 1 ? value.toFixed(2) : value.toFixed(1)) + "x";
}

function updatePhysicsUI() {
  var state = getCurrentPhysicsState();
  ui.gravitySlider.value = String(Math.round(state.gravity * 100));
  ui.reactionSlider.value = String(Math.round(state.reaction * 100));
  ui.gravityValue.innerHTML = formatScaleValue(state.gravity);
  ui.reactionValue.innerHTML = formatScaleValue(state.reaction);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function parseColor(hex) {
  var clean = hex.replace("#", "");
  var normalized;
  var value;
  if (clean.length === 3) {
    normalized = clean.charAt(0) + clean.charAt(0) + clean.charAt(1) + clean.charAt(1) + clean.charAt(2) + clean.charAt(2);
  } else {
    normalized = clean;
  }
  value = parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function forEachMaterial(callback) {
  var keys = Object.keys(MATERIALS);
  var i;
  for (i = 0; i < keys.length; i += 1) {
    callback(keys[i], MATERIALS[keys[i]]);
  }
}

forEachMaterial(function (key, material) {
  material.rgb = parseColor(material.color);
  material.accentRgb = parseColor(material.accent || material.color);
});

function rectRatio(left, top, width, height) {
  var x = clamp(Math.floor(cols * left), 0, Math.max(0, cols - 1));
  var y = clamp(Math.floor(rows * top), 0, Math.max(0, rows - 1));
  var w = clamp(Math.floor(cols * width), 2, Math.max(2, cols - x));
  var h = clamp(Math.floor(rows * height), 2, Math.max(2, rows - y));
  if (x + w > cols) {
    w = cols - x;
  }
  if (y + h > rows) {
    h = rows - y;
  }
  return { x: x, y: y, w: w, h: h };
}

function expandRect(rect, paddingX, paddingY) {
  var x = clamp(rect.x - paddingX, 0, cols - 1);
  var y = clamp(rect.y - paddingY, 0, rows - 1);
  var right = clamp(rect.x + rect.w + paddingX, 0, cols);
  var bottom = clamp(rect.y + rect.h + paddingY, 0, rows);
  return {
    x: x,
    y: y,
    w: Math.max(1, right - x),
    h: Math.max(1, bottom - y)
  };
}

function createLayout(zoneList) {
  var i;
  var map = {};
  for (i = 0; i < zoneList.length; i += 1) {
    map[zoneList[i].id] = zoneList[i];
  }
  return {
    zones: zoneList,
    zoneMap: map
  };
}

function fillRect(rect, type, density) {
  var y;
  var x;
  density = density === undefined ? 1 : density;
  for (y = rect.y; y < rect.y + rect.h; y += 1) {
    for (x = rect.x; x < rect.x + rect.w; x += 1) {
      if (density >= 1 || chance(density)) {
        setCell(x, y, createParticle(type));
      }
    }
  }
}

function clearRect(rect) {
  var y;
  var x;
  for (y = rect.y; y < rect.y + rect.h; y += 1) {
    for (x = rect.x; x < rect.x + rect.w; x += 1) {
      clearCell(x, y);
    }
  }
}

function outlineRect(rect, type, thickness) {
  var layer;
  var x;
  var y;
  thickness = thickness || 1;
  for (layer = 0; layer < thickness; layer += 1) {
    for (x = rect.x + layer; x < rect.x + rect.w - layer; x += 1) {
      setCell(x, rect.y + layer, createParticle(type));
      setCell(x, rect.y + rect.h - 1 - layer, createParticle(type));
    }
    for (y = rect.y + layer; y < rect.y + rect.h - layer; y += 1) {
      setCell(rect.x + layer, y, createParticle(type));
      setCell(rect.x + rect.w - 1 - layer, y, createParticle(type));
    }
  }
}

function fillCircle(cx, cy, radius, type, density) {
  var x;
  var y;
  var dx;
  var dy;
  density = density === undefined ? 1 : density;
  for (y = cy - radius; y <= cy + radius; y += 1) {
    for (x = cx - radius; x <= cx + radius; x += 1) {
      dx = x - cx;
      dy = y - cy;
      if ((dx * dx) + (dy * dy) > radius * radius || !inBounds(x, y)) {
        continue;
      }
      if (density >= 1 || chance(density)) {
        setCell(x, y, createParticle(type));
      }
    }
  }
}

function sumCounts(map, types) {
  var total = 0;
  var i;
  for (i = 0; i < types.length; i += 1) {
    total += map[types[i]] || 0;
  }
  return total;
}

function getZoneStats(stats, zoneId) {
  return stats.zones[zoneId] || { total: 0, occupied: 0, empty: 0, types: {} };
}

function getZoneTypeCount(stats, zoneId, types) {
  var zone = getZoneStats(stats, zoneId);
  return sumCounts(zone.types, typeof types === "string" ? [types] : types);
}

function getGlobalTypeCount(stats, types) {
  return sumCounts(stats.global, typeof types === "string" ? [types] : types);
}

function clampRatio(value) {
  return clamp(value, 0, 1);
}

function formatAllowedMaterials(list) {
  var names = [];
  var i;
  for (i = 0; i < list.length; i += 1) {
    names.push(MATERIALS[list[i]].name);
  }
  return names.join(" / ");
}

function fillEllipse(cx, cy, radiusX, radiusY, type, density) {
  var x;
  var y;
  var dx;
  var dy;
  density = density === undefined ? 1 : density;
  radiusX = Math.max(1, radiusX);
  radiusY = Math.max(1, radiusY);
  for (y = Math.floor(cy - radiusY); y <= Math.ceil(cy + radiusY); y += 1) {
    for (x = Math.floor(cx - radiusX); x <= Math.ceil(cx + radiusX); x += 1) {
      if (!inBounds(x, y)) {
        continue;
      }
      dx = (x - cx) / radiusX;
      dy = (y - cy) / radiusY;
      if ((dx * dx) + (dy * dy) > 1) {
        continue;
      }
      if (density >= 1 || chance(density)) {
        setCell(x, y, createParticle(type));
      }
    }
  }
}

function fillTerrainBand(type, baseTopRatio, amplitudeRatio, density, leftRatio, rightRatio) {
  var left = clamp(Math.floor(cols * (leftRatio === undefined ? 0 : leftRatio)), 0, cols - 1);
  var right = clamp(Math.floor(cols * (rightRatio === undefined ? 1 : rightRatio)), left, cols - 1);
  var width = Math.max(1, right - left);
  var amplitude = Math.max(1, Math.floor(rows * amplitudeRatio));
  var baseTop = Math.floor(rows * baseTopRatio);
  var phaseA = Math.random() * Math.PI * 2;
  var phaseB = Math.random() * Math.PI * 2;
  var x;
  var y;
  var t;
  var wave;
  var top;
  density = density === undefined ? 1 : density;
  for (x = left; x <= right; x += 1) {
    t = (x - left) / width;
    wave =
      Math.sin((t * 6.1) + phaseA) * amplitude * 0.68 +
      Math.sin((t * 12.7) + phaseB) * amplitude * 0.32;
    top = clamp(Math.floor(baseTop + wave), 0, rows - 1);
    for (y = top; y < rows; y += 1) {
      if (density >= 1 || chance(density)) {
        setCell(x, y, createParticle(type));
      }
    }
  }
}

function drawMaterialPath(points, radius, type, density) {
  var i;
  var steps;
  var step;
  var x;
  var y;
  density = density === undefined ? 1 : density;
  radius = Math.max(1, radius);
  for (i = 0; i < points.length - 1; i += 1) {
    steps = Math.max(Math.abs(points[i + 1].x - points[i].x), Math.abs(points[i + 1].y - points[i].y), 1);
    for (step = 0; step <= steps; step += 1) {
      x = Math.round(points[i].x + ((points[i + 1].x - points[i].x) * step) / steps);
      y = Math.round(points[i].y + ((points[i + 1].y - points[i].y) * step) / steps);
      fillCircle(x, y, radius, type, density);
    }
  }
}

function scatterClusters(areaRect, type, count, minRadius, maxRadius, density) {
  var i;
  var cx;
  var cy;
  for (i = 0; i < count; i += 1) {
    cx = randomRange(areaRect.x, Math.max(areaRect.x, areaRect.x + areaRect.w - 1));
    cy = randomRange(areaRect.y, Math.max(areaRect.y, areaRect.y + areaRect.h - 1));
    fillCircle(cx, cy, randomRange(minRadius, maxRadius), type, density);
  }
}

function fillCone(centerXRatio, baseYRatio, halfWidthRatio, peakYRatio, type, density) {
  var cx = Math.floor(cols * centerXRatio);
  var baseY = clamp(Math.floor(rows * baseYRatio), 0, rows - 1);
  var peakY = clamp(Math.floor(rows * peakYRatio), 0, rows - 1);
  var halfWidth = Math.max(4, Math.floor(cols * halfWidthRatio));
  var x;
  var y;
  var slope;
  var top;
  density = density === undefined ? 1 : density;
  for (x = cx - halfWidth; x <= cx + halfWidth; x += 1) {
    if (!inBounds(x, baseY)) {
      continue;
    }
    slope = Math.abs(x - cx) / halfWidth;
    if (slope > 1) {
      continue;
    }
    top = clamp(Math.floor(mix(peakY, baseY, slope)), 0, rows - 1);
    for (y = top; y < rows; y += 1) {
      if (density >= 1 || chance(density)) {
        setCell(x, y, createParticle(type));
      }
    }
  }
}

var levelData = createLevelData({
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
}

function idx(x, y) {
  return y * cols + x;
}

function inBounds(x, y) {
  return x >= 0 && x < cols && y >= 0 && y < rows;
}

function getCell(x, y) {
  if (!inBounds(x, y)) {
    return null;
  }
  return grid.get(idx(x, y));
}

function setCell(x, y, particle) {
  var index;
  var previous;
  if (!inBounds(x, y)) {
    return;
  }
  index = idx(x, y);
  previous = grid.get(index);
  if (!previous && particle) {
    particleCount += 1;
  } else if (previous && !particle) {
    particleCount -= 1;
  }
  grid.set(index, particle);
}

function clearCell(x, y) {
  setCell(x, y, null);
}

function createParticle(type, overrides) {
  var mat = MATERIALS[type];
  var baseLife;
  var baseTemp;
  overrides = overrides || {};
  baseLife = overrides.life !== undefined ? overrides.life : (mat.life ? randomRange(mat.life[0], mat.life[1]) : Infinity);
  baseTemp = overrides.temp !== undefined ? overrides.temp : (mat.temp || 0);
  if (type === "fire" && overrides.life === undefined && isFiniteNumber(baseLife)) {
    baseLife = Math.max(6, Math.round(getLevelScaledValue(baseLife, "fireLifeMultiplier")));
  } else if (type === "ember" && overrides.life === undefined && isFiniteNumber(baseLife)) {
    baseLife = Math.max(8, Math.round(getLevelScaledValue(baseLife, "emberLifeMultiplier")));
  }
  return {
    type: type,
    updated: -1,
    age: 0,
    seed: Math.random(),
    life: baseLife,
    maxLife: isFiniteNumber(baseLife) ? baseLife : 1,
    temp: baseTemp,
    maxTemp: baseTemp || 1
  };
}

function chooseCellSize(width, height) {
  var area = width * height;
  if (area > 1900000) {
    return 5;
  }
  if (area > 1200000) {
    return 4;
  }
  return 3;
}

function allocateBuffer() {
  renderer.resize(cols, rows);
  imageData = renderer.imageData;
  pixelBuffer = renderer.pixelBuffer;
}

function resizeSimulation() {
  var paneWidth = ui.pane.clientWidth;
  var paneHeight = ui.pane.clientHeight;
  var oldGrid = grid;
  var oldCols = cols;
  var oldRows = rows;
  var x;
  var y;
  var particle;
  var nx;
  var ny;

  cellSize = chooseCellSize(paneWidth, paneHeight);
  cols = Math.max(100, Math.floor(paneWidth / cellSize));
  rows = Math.max(80, Math.floor(paneHeight / cellSize));

  ui.canvas.width = cols;
  ui.canvas.height = rows;
  grid = new ParticleBuffer(cols * rows, MATERIAL_IDS, MATERIAL_TYPES);
  particleCount = 0;
  allocateBuffer();

  if (oldGrid && oldGrid.length) {
    for (y = 0; y < oldRows; y += 1) {
      for (x = 0; x < oldCols; x += 1) {
        particle = oldGrid.get(y * oldCols + x);
        if (!particle) {
          continue;
        }
        nx = clamp(Math.floor((x / Math.max(1, oldCols)) * cols), 0, cols - 1);
        ny = clamp(Math.floor((y / Math.max(1, oldRows)) * rows), 0, rows - 1);
        if (!getCell(nx, ny)) {
          setCell(nx, ny, particle);
        }
      }
    }
  }

  if (mode === "challenge" && activeLevel) {
    syncLevelGeometry();
    activeLayout = activeLevel.buildLayout();
    lastStatsFrame = -1;
  }
}

function buildMaterialButtons() {
  var i;
  ui.materialGrid.innerHTML = "";
  for (i = 0; i < MATERIAL_ORDER.length; i += 1) {
    (function (type) {
      var mat = MATERIALS[type];
      var button = document.createElement("button");
      button.type = "button";
      button.className = "material-btn";
      button.setAttribute("data-type", type);
      button.innerHTML =
        '<span class="swatch" style="background:linear-gradient(135deg,' + mat.color + "," + (mat.accent || mat.color) + ');"></span>' +
        '<span class="material-meta">' +
        '<span class="material-name">' + mat.name + '</span>' +
        '<span class="material-kind">' + mat.state + "</span>" +
        "</span>";
      button.onclick = function () {
        if (!materialAllowed(type)) {
          return;
        }
        selectedType = type;
        updateSelectedMaterialUI();
      };
      ui.materialGrid.appendChild(button);
    })(MATERIAL_ORDER[i]);
  }
  updateSelectedMaterialUI();
}

function buildExploreMapButtons() {
  var i;
  var button;
  ui.exploreGrid.innerHTML = "";
  for (i = 0; i < EXPLORE_MAPS.length; i += 1) {
    button = document.createElement("button");
    button.type = "button";
    button.className = "explore-map-btn";
    button.setAttribute("data-index", String(i));
    button.innerHTML =
      "<strong>" + EXPLORE_MAPS[i].title + "</strong>" +
      "<span>" + EXPLORE_MAPS[i].buttonSubtitle + "</span>";
    button.onclick = (function (index) {
      return function () {
        startExploreMap(index);
      };
    })(i);
    ui.exploreGrid.appendChild(button);
  }
  updateExploreMapButtons();
}

function updateExploreMapButtons() {
  var children = ui.exploreGrid.children;
  var i;
  var index;
  for (i = 0; i < children.length; i += 1) {
    index = parseInt(children[i].getAttribute("data-index"), 10);
    children[i].className = mode === "explore" && index === activeExploreIndex ? "explore-map-btn active" : "explore-map-btn";
  }
}

function updateSelectedMaterialUI() {
  var mat;
  var children = ui.materialGrid.children;
  var i;
  var type;
  if (!materialAllowed(selectedType)) {
    selectedType = firstAllowedMaterial();
  }
  mat = MATERIALS[selectedType];
  ui.materialLabel.innerHTML =
    mat.name +
    (mode === "challenge" && levelRuntime && levelRuntime.materialBudgetRemaining && levelRuntime.materialBudgetRemaining[selectedType] !== undefined
      ? "（剩余 " + levelRuntime.materialBudgetRemaining[selectedType] + "）"
      : "");
  for (i = 0; i < children.length; i += 1) {
    type = children[i].getAttribute("data-type");
    if (!materialAllowed(type)) {
      children[i].className = "material-btn disabled";
    } else {
      children[i].className = type === selectedType ? "material-btn active" : "material-btn";
    }
  }
  ui.brushPreview.style.borderColor = mat.accent || mat.color;
}

function updateBrushUI() {
  var label = brushRadius + " px";
  ui.brushValue.innerHTML = label;
  ui.brushLabel.innerHTML = label;
  ui.brushSlider.value = String(brushRadius);
  ui.brushPreview.style.width = (brushRadius * 2) + "px";
  ui.brushPreview.style.height = (brushRadius * 2) + "px";
}

function updateHintUI() {
  if (hintCollapsed) {
    ui.hintCard.className = "hint-card collapsed";
    ui.hintTitle.innerHTML = "操作说明已隐藏";
    ui.hintToggle.innerHTML = "显示说明";
  } else {
    ui.hintCard.className = "hint-card";
    ui.hintTitle.innerHTML = "操作说明";
    ui.hintToggle.innerHTML = "隐藏说明";
  }
}

function materialAllowed(type) {
  if (mode !== "challenge" || !activeLevel) {
    return true;
  }
  if (activeLevel.allowedMaterials.indexOf(type) === -1) {
    return false;
  }
  if (levelRuntime && levelRuntime.materialBudgetRemaining && levelRuntime.materialBudgetRemaining[type] !== undefined) {
    return levelRuntime.materialBudgetRemaining[type] > 0;
  }
  return true;
}

function firstAllowedMaterial() {
  var list = activeLevel && activeLevel.allowedMaterials ? activeLevel.allowedMaterials : MATERIAL_ORDER;
  return list[0];
}

function hideMissionBanner() {
  ui.missionBanner.className = "banner";
}

function hideCelebration() {
  var sparks;
  var i;
  if (celebrationTimer) {
    window.clearTimeout(celebrationTimer);
    celebrationTimer = 0;
  }
  ui.celebrationBurst.className = "celebration-burst";
  sparks = ui.celebrationBurst.querySelectorAll(".celebration-spark");
  for (i = 0; i < sparks.length; i += 1) {
    sparks[i].remove();
  }
}

function showCelebration(title, body) {
  var i;
  var count = 12;
  var angle;
  var distance;
  var spark;
  hideCelebration();
  ui.celebrationTitle.innerHTML = title;
  ui.celebrationText.innerHTML = body;
  for (i = 0; i < count; i += 1) {
    angle = (Math.PI * 2 * i) / count;
    distance = 56 + (i % 3) * 14;
    spark = document.createElement("span");
    spark.className = "celebration-spark";
    spark.style.setProperty("--dx", Math.round(Math.cos(angle) * distance) + "px");
    spark.style.setProperty("--dy", Math.round(Math.sin(angle) * distance) + "px");
    spark.style.setProperty("--spark-delay", (i % 4) * 30 + "ms");
    spark.style.setProperty("--spark-size", (i % 3 === 0 ? 12 : 9) + "px");
    ui.celebrationBurst.appendChild(spark);
  }
  ui.celebrationBurst.offsetWidth;
  ui.celebrationBurst.className = "celebration-burst show";
  celebrationTimer = window.setTimeout(hideCelebration, 1650);
}

function showMissionBanner(title, body) {
  ui.bannerTitle.innerHTML = title;
  ui.bannerBody.innerHTML = body;
  ui.bannerNextBtn.disabled = activeLevelIndex >= LEVELS.length - 1;
  ui.bannerNextBtn.innerHTML = activeLevelIndex >= LEVELS.length - 1 ? "全部完成" : "进入下一关";
  ui.missionBanner.className = "banner show";
}

function renderMissionTags(tags) {
  var html = "";
  var i;
  for (i = 0; i < tags.length; i += 1) {
    html += '<span class="mission-tag">' + tags[i] + "</span>";
  }
  ui.missionTags.innerHTML = html;
}

function renderObjectives(objectives) {
  var html = "";
  var i;
  var objective;
  for (i = 0; i < objectives.length; i += 1) {
    objective = objectives[i];
    html +=
      '<div class="objective-item' + (objective.done ? " done" : "") + '">' +
        '<div class="objective-line">' +
          "<strong>" + objective.label + "</strong>" +
          "<span>" + objective.detail + "</span>" +
        "</div>" +
        '<div class="objective-track"><div class="objective-fill" style="width:' + Math.round(clampRatio(objective.ratio) * 100) + '%;"></div></div>' +
      "</div>";
  }
  ui.objectiveList.innerHTML = html;
}

function updateMissionUI() {
  var tags;
  var exploreCards;
  updatePhysicsUI();
  ui.sandboxModeBtn.className = mode === "sandbox" ? "mode-btn active" : "mode-btn";
  ui.exploreModeBtn.className = mode === "explore" ? "mode-btn active" : "mode-btn";
  ui.challengeModeBtn.className = mode === "challenge" ? "mode-btn active" : "mode-btn";
  ui.clearBtn.innerHTML = mode === "challenge" ? "重置场景" : mode === "explore" ? "重置地图" : "清空画布";
  ui.explorePanel.className = mode === "explore" ? "explore-panel" : "explore-panel hidden";
  ui.restartLevelBtn.innerHTML = mode === "explore" ? "重新生成地图" : "重新开始本关";
  ui.nextLevelBtn.innerHTML = mode === "explore" ? "下一张地图" : "下一关";
  updateExploreMapButtons();

  if (mode === "sandbox") {
    ui.missionTitle.innerHTML = "自由沙盒";
    ui.missionSubtitle.innerHTML = "自由组合材质与反应。准备好后可切换到任务模式挑战预设关卡。";
    ui.missionMeta.innerHTML = "Sandbox";
    ui.levelLabel.innerHTML = "沙盒";
    renderMissionTags(["无限材料", "自由实验", "重力 " + formatScaleValue(getGravityScale()), "反应 " + formatScaleValue(getReactionScale())]);
    renderObjectives([
      {
        done: false,
        label: "在这里自由实验材质反应",
        detail: "未启用任务",
        ratio: 0
      }
    ]);
    ui.restartLevelBtn.disabled = true;
    ui.nextLevelBtn.disabled = true;
    return;
  }

  if (mode === "explore" && activeExploreMap) {
    exploreCards = activeExploreMap.cards || [];
    tags = [
      "全材料开放",
      "地图可重置",
      "重力 " + formatScaleValue(getGravityScale()),
      "反应 " + formatScaleValue(getReactionScale())
    ].concat(activeExploreMap.tags || []);
    ui.missionTitle.innerHTML = activeExploreMap.title;
    ui.missionSubtitle.innerHTML = activeExploreMap.subtitle;
    ui.missionMeta.innerHTML = "Explore " + (activeExploreIndex + 1) + " / " + EXPLORE_MAPS.length;
    ui.levelLabel.innerHTML = "探索";
    renderMissionTags(tags);
    renderObjectives(exploreCards);
    ui.restartLevelBtn.disabled = false;
    ui.nextLevelBtn.disabled = EXPLORE_MAPS.length < 2;
    return;
  }

  if (!activeLevel) {
    ui.missionTitle.innerHTML = "自由沙盒";
    ui.missionSubtitle.innerHTML = "自由组合材质与反应。准备好后可切换到任务模式挑战预设关卡。";
    ui.missionMeta.innerHTML = "Sandbox";
    ui.levelLabel.innerHTML = "沙盒";
    renderMissionTags(["无限材料", "自由实验", "重力 " + formatScaleValue(getGravityScale()), "反应 " + formatScaleValue(getReactionScale())]);
    renderObjectives([
      {
        done: false,
        label: "在这里自由实验材质反应",
        detail: "未启用任务",
        ratio: 0
      }
    ]);
    ui.restartLevelBtn.disabled = true;
    ui.nextLevelBtn.disabled = true;
    return;
  }

  tags = [
    "允许材料：" + formatAllowedMaterials(activeLevel.allowedMaterials),
    "重力 " + formatScaleValue(getGravityScale()),
    "反应 " + formatScaleValue(getReactionScale())
  ].concat(activeLevel.tags);
  ui.missionTitle.innerHTML = activeLevel.title;
  ui.missionSubtitle.innerHTML = activeLevel.subtitle;
  ui.missionMeta.innerHTML = "Level " + (activeLevelIndex + 1) + " / " + LEVELS.length;
  ui.levelLabel.innerHTML = "第 " + (activeLevelIndex + 1) + " 关";
  renderMissionTags(tags);
  renderObjectives(activeObjectives);
  ui.restartLevelBtn.disabled = false;
  ui.nextLevelBtn.disabled = !(levelRuntime && levelRuntime.completed) || activeLevelIndex >= LEVELS.length - 1;
}

function collectLevelStats() {
  var zones = activeLayout ? activeLayout.zones : [];
  var stats = { global: {}, zones: {}, deltaSeconds: 0 };
  var i;
  var x;
  var y;
  var particle;
  var zone;
  var zoneData;

  for (i = 0; i < zones.length; i += 1) {
    zone = zones[i];
    stats.zones[zone.id] = {
      total: zone.rect.w * zone.rect.h,
      occupied: 0,
      empty: zone.rect.w * zone.rect.h,
      types: {}
    };
  }

  for (y = 0; y < rows; y += 1) {
    for (x = 0; x < cols; x += 1) {
      particle = getCell(x, y);
      if (!particle) {
        continue;
      }
      stats.global[particle.type] = (stats.global[particle.type] || 0) + 1;
      for (i = 0; i < zones.length; i += 1) {
        zone = zones[i];
        if (x >= zone.rect.x && x < zone.rect.x + zone.rect.w && y >= zone.rect.y && y < zone.rect.y + zone.rect.h) {
          zoneData = stats.zones[zone.id];
          zoneData.occupied += 1;
          zoneData.empty -= 1;
          zoneData.types[particle.type] = (zoneData.types[particle.type] || 0) + 1;
        }
      }
    }
  }

  stats.deltaSeconds = levelRuntime ? (currentNow - levelRuntime.lastEvalAt) / 1000 : 0;
  if (levelRuntime) {
    levelRuntime.lastEvalAt = currentNow;
  }
  return stats;
}

function syncMissionProgress(force) {
  var evaluation;
  if (mode !== "challenge" || !activeLevel || !levelRuntime) {
    return;
  }
  if (!force && frameId - lastStatsFrame < 6) {
    return;
  }
  evaluation = activeLevel.evaluate(collectLevelStats(), levelRuntime, activeLayout);
  activeObjectives = evaluation.objectives;
  if (evaluation.complete && !levelRuntime.completed) {
    levelRuntime.completed = true;
    showCelebration(
      evaluation.celebrationTitle || "过关啦",
      evaluation.celebrationBody || "稳稳完成这一关，继续向前。"
    );
    showMissionBanner(evaluation.bannerTitle, evaluation.bannerBody);
  }
  lastStatsFrame = frameId;
  updateMissionUI();
}

function enterSandboxMode() {
  mode = "sandbox";
  activeLevelIndex = -1;
  activeLevel = null;
  activeExploreMap = null;
  activeLayout = null;
  activeObjectives = [];
  levelRuntime = null;
  hideMissionBanner();
  hideCelebration();
  clearAll();
  if (!materialAllowed(selectedType)) {
    selectedType = "sand";
  }
  updateMissionUI();
  updateSelectedMaterialUI();
}

function startExploreMap(index) {
  if (index < 0 || index >= EXPLORE_MAPS.length) {
    return;
  }
  mode = "explore";
  activeExploreIndex = index;
  activeExploreMap = EXPLORE_MAPS[index];
  activeLevelIndex = -1;
  activeLevel = null;
  activeLayout = null;
  activeObjectives = activeExploreMap.cards || [];
  levelRuntime = null;
  paused = false;
  ui.pauseBtn.innerHTML = "暂停模拟";
  hideMissionBanner();
  hideCelebration();
  clearAll();
  syncLevelGeometry();
  activeExploreMap.buildScene();
  selectedType = activeExploreMap.starterMaterial || selectedType;
  lastStatsFrame = -1;
  updateMissionUI();
  updateSelectedMaterialUI();
}

function startLevel(index) {
  if (index < 0 || index >= LEVELS.length) {
    return;
  }
  mode = "challenge";
  activeLevelIndex = index;
  activeLevel = LEVELS[index];
  activeExploreMap = null;
  syncLevelGeometry();
    activeLayout = activeLevel.buildLayout();
  activeObjectives = [];
  levelRuntime = {
    startedAt: currentNow,
    lastEvalAt: currentNow,
    completed: false,
    counters: { explosions: 0 },
    targets: {},
    safeHold: 0
  };
  paused = false;
  ui.pauseBtn.innerHTML = "暂停模拟";
  hideMissionBanner();
  hideCelebration();
  clearAll();
  activeLevel.setup(activeLayout, levelRuntime);

  // 初始化关卡材料配额（用于“保留少量土块”等限制）
  if (activeLevel.materialBudget) {
    levelRuntime.materialBudgetRemaining = {};
    Object.keys(activeLevel.materialBudget).forEach(function (key) {
      var spec = activeLevel.materialBudget[key];
      var amount = 0;
      if (typeof spec === "number") {
        amount = Math.max(0, Math.floor(spec));
      } else if (spec && typeof spec === "object") {
        if (typeof spec.fixed === "number") {
          amount = Math.max(0, Math.floor(spec.fixed));
        } else if (typeof spec.ratio === "number") {
          amount = Math.floor(cols * rows * Math.max(0, spec.ratio));
        }
        if (typeof spec.min === "number") {
          amount = Math.max(amount, Math.floor(spec.min));
        }
        if (typeof spec.max === "number") {
          amount = Math.min(amount, Math.floor(spec.max));
        }
      }
      levelRuntime.materialBudgetRemaining[key] = amount;
    });
  } else {
    levelRuntime.materialBudgetRemaining = null;
  }

  selectedType = activeLevel.starterMaterial || firstAllowedMaterial();
  lastStatsFrame = -1;
  syncMissionProgress(true);
  updateSelectedMaterialUI();
}

function restartCurrentLevel() {
  if (mode === "challenge" && activeLevelIndex >= 0) {
    startLevel(activeLevelIndex);
  } else if (mode === "explore" && activeExploreIndex >= 0) {
    startExploreMap(activeExploreIndex);
  }
}

function nextLevel() {
  if (mode === "challenge" && activeLevelIndex < LEVELS.length - 1) {
    startLevel(activeLevelIndex + 1);
  } else if (mode === "explore" && EXPLORE_MAPS.length) {
    startExploreMap((activeExploreIndex + 1) % EXPLORE_MAPS.length);
  }
}

function screenToGrid(clientX, clientY) {
  var rect = ui.canvas.getBoundingClientRect();
  var x = Math.floor(((clientX - rect.left) / rect.width) * cols);
  var y = Math.floor(((clientY - rect.top) / rect.height) * rows);
  return {
    x: clamp(x, 0, cols - 1),
    y: clamp(y, 0, rows - 1)
  };
}

function moveBrushPreview(clientX, clientY) {
  var rect = ui.pane.getBoundingClientRect();
  ui.brushPreview.style.left = (clientX - rect.left) + "px";
  ui.brushPreview.style.top = (clientY - rect.top) + "px";
}

function getEventClientPoint(event) {
  var source = null;
  if (event.touches && event.touches.length) {
    source = event.touches[0];
  } else if (event.changedTouches && event.changedTouches.length) {
    source = event.changedTouches[0];
  } else if (typeof event.clientX === "number" && typeof event.clientY === "number") {
    source = event;
  }
  if (!source) {
    return null;
  }
  return {
    clientX: source.clientX,
    clientY: source.clientY
  };
}

function isTouchLikeEvent(event) {
  return !!(event.touches || event.changedTouches || event.pointerType === "touch");
}

function stampBrush(cx, cy, erase) {
  var radiusCells = Math.max(1, Math.ceil(brushRadius / cellSize));
  var radiusSquared = radiusCells * radiusCells;
  var dx;
  var dy;
  var x;
  var y;
  var remaining = null;
  erase = !!erase;

  if (!erase && mode === "challenge" && levelRuntime && levelRuntime.materialBudgetRemaining && levelRuntime.materialBudgetRemaining[selectedType] !== undefined) {
    remaining = levelRuntime.materialBudgetRemaining[selectedType];
    if (remaining <= 0) {
      return;
    }
  }

  for (dy = -radiusCells; dy <= radiusCells; dy += 1) {
    for (dx = -radiusCells; dx <= radiusCells; dx += 1) {
      if ((dx * dx) + (dy * dy) > radiusSquared) {
        continue;
      }
      x = cx + dx;
      y = cy + dy;
      if (!inBounds(x, y)) {
        continue;
      }
      if (erase) {
        clearCell(x, y);
      } else if (chance(0.9)) {
        if (remaining !== null && remaining <= 0) {
          continue;
        }
        var existing = getCell(x, y);
        if (existing && existing.type === selectedType) {
          continue;
        }
        // 第 1 关：水/雨“碰到草地”不应让草地消失（避免用笔刷把 plant 直接覆盖掉，保持草地总量更稳定）
        if (
          mode === "challenge" &&
          activeLevelIndex === 0 &&
          (selectedType === "water" || selectedType === "rain") &&
          existing &&
          existing.type === "plant"
        ) {
          continue;
        }
        setCell(x, y, createParticle(selectedType));
        if (remaining !== null) {
          remaining -= 1;
          levelRuntime.materialBudgetRemaining[selectedType] = remaining;
        }
      }
    }
  }

  if (remaining !== null) {
    updateSelectedMaterialUI();
  }
}

function drawLine(x0, y0, x1, y1, erase) {
  var dx = x1 - x0;
  var dy = y1 - y0;
  var steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  var i;
  var x;
  var y;
  erase = !!erase;
  for (i = 0; i <= steps; i += 1) {
    x = Math.round(x0 + (dx * i) / steps);
    y = Math.round(y0 + (dy * i) / steps);
    stampBrush(x, y, erase);
  }
}

function canDisplace(mover, target) {
  var moverMat;
  var targetMat;
  if (!target) {
    return true;
  }
  if (target.updated === frameId) {
    return false;
  }
  moverMat = MATERIALS[mover.type];
  targetMat = MATERIALS[target.type];
  if (targetMat.behavior === "gas" || targetMat.behavior === "fire" || targetMat.behavior === "ember") {
    return true;
  }
  if (moverMat.behavior === "powder" && targetMat.behavior === "liquid") {
    return moverMat.density > targetMat.density;
  }
  if (moverMat.behavior === "liquid" && targetMat.behavior === "liquid") {
    return moverMat.density > targetMat.density + 0.25;
  }
  return false;
}

function tryMove(x, y, nx, ny) {
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
}

function tryMoveCustom(x, y, nx, ny, predicate) {
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
}

function nudgeParticle(x, y, dx, dy) {
  var order = [
    [dx, dy],
    [dx, 0],
    [0, dy],
    [dx * 2, dy * 2]
  ];
  var i;
  for (i = 0; i < order.length; i += 1) {
    if ((order[i][0] === 0 && order[i][1] === 0) || !inBounds(x + order[i][0], y + order[i][1])) {
      continue;
    }
    if (tryMove(x, y, x + order[i][0], y + order[i][1])) {
      return true;
    }
  }
  return false;
}

function addEffect(x, y, radius, life, inner, outer) {
  effects.push({
    x: x,
    y: y,
    radius: radius,
    life: life,
    maxLife: life,
    inner: inner || "rgba(255, 200, 90, 0.55)",
    outer: outer || "rgba(255, 80, 0, 0)"
  });
}

function updateEffects() {
  var nextEffects = [];
  var i;
  for (i = 0; i < effects.length; i += 1) {
    effects[i].life -= 1;
    if (effects[i].life > 0) {
      nextEffects.push(effects[i]);
    }
  }
  effects = nextEffects;
}

function findNeighbor(x, y, predicate) {
  var i;
  var nx;
  var ny;
  var particle;
  for (i = 0; i < NEIGHBORS_8.length; i += 1) {
    nx = x + NEIGHBORS_8[i][0];
    ny = y + NEIGHBORS_8[i][1];
    if (!inBounds(nx, ny)) {
      continue;
    }
    particle = getCell(nx, ny);
    if (particle && predicate(particle, nx, ny)) {
      return { x: nx, y: ny, particle: particle };
    }
  }
  return null;
}

function countAdjacentOfType(x, y, type) {
  var i;
  var particle;
  var count = 0;
  for (i = 0; i < NEIGHBORS_8.length; i += 1) {
    particle = getCell(x + NEIGHBORS_8[i][0], y + NEIGHBORS_8[i][1]);
    if (particle && particle.type === type) {
      count += 1;
    }
  }
  return count;
}

function countAdjacentMatching(x, y, predicate) {
  var i;
  var particle;
  var count = 0;
  for (i = 0; i < NEIGHBORS_8.length; i += 1) {
    particle = getCell(x + NEIGHBORS_8[i][0], y + NEIGHBORS_8[i][1]);
    if (particle && predicate(particle, x + NEIGHBORS_8[i][0], y + NEIGHBORS_8[i][1])) {
      count += 1;
    }
  }
  return count;
}

function hasWaterNearby(x, y) {
  return !!findNeighbor(x, y, function (particle) {
    return !!WATER_TYPES[particle.type];
  });
}

function countWaterNearby(x, y) {
  return countAdjacentMatching(x, y, function (particle) {
    return !!WATER_TYPES[particle.type];
  });
}

function isWaterType(type) {
  return !!WATER_TYPES[type];
}

function isSoilGrowthType(type) {
  return type === "soil" || type === "sand" || type === "ash";
}

function isNaturalGravityType(type) {
  return type === "plant" || type === "algae" || type === "worm" || type === "bug";
}

function getParticleFlowValue(particle) {
  var flow = MATERIALS[particle.type].flow;
  if ((particle.type === "water" || particle.type === "rain") && isFiniteNumber(flow)) {
    flow = Math.max(1, Math.round(getLevelScaledValue(flow, "waterFlowMultiplier")));
  }
  return Math.max(1, Math.round(flow || 1));
}

function getParticleFallSpeedValue(particle) {
  var fallSpeed = MATERIALS[particle.type].fallSpeed;
  if ((particle.type === "water" || particle.type === "rain") && isFiniteNumber(fallSpeed)) {
    fallSpeed = Math.max(0, getLevelScaledValue(fallSpeed, "waterFallMultiplier"));
  } else if (isNaturalGravityType(particle.type)) {
    fallSpeed = Math.max(1, fallSpeed || 1);
  }
  if (MATERIALS[particle.type].behavior === "powder" || MATERIALS[particle.type].behavior === "liquid" || isNaturalGravityType(particle.type)) {
    return getScaledStepCount(fallSpeed || 0, getGravityScale());
  }
  return Math.max(0, Math.round(fallSpeed || 0));
}

function levelFlagEnabled(key) {
  var tuning = getActiveLevelTuning();
  return !!(tuning && tuning[key]);
}

function isPlantSupportType(type) {
  return type === "soil" || type === "root" || type === "plant" || type === "rock" || type === "metal";
}

function hasSoilContact(x, y) {
  var below = getCell(x, y + 1);
  if (below && isSoilGrowthType(below.type)) {
    return true;
  }
  return !!findNeighbor(x, y, function (particle) {
    return isSoilGrowthType(particle.type);
  });
}

function isAirLikeParticle(particle) {
  return !particle || MATERIALS[particle.type].behavior === "gas" || particle.type === "fire" || particle.type === "ember";
}

function isExposedToEnvironment(x, y) {
  var offsets = [[0, -1], [-1, -1], [1, -1]];
  var i;
  var nx;
  var ny;
  var target;
  if (y <= 1) {
    return true;
  }
  for (i = 0; i < offsets.length; i += 1) {
    nx = x + offsets[i][0];
    ny = y + offsets[i][1];
    if (!inBounds(nx, ny)) {
      return true;
    }
    target = getCell(nx, ny);
    if (isAirLikeParticle(target)) {
      return true;
    }
  }
  return false;
}

function tryLiftAlgaeAboveWater(x, y) {
  var candidates = [
    [0, 1], [-1, 1], [1, 1],
    [0, 0], [-1, 0], [1, 0]
  ];
  var below = getCell(x, y + 1);
  var above = getCell(x, y - 1);
  var i;
  var j;
  var temp;
  var wx;
  var wy;
  var surfaceY;
  var waterCell;
  var surfaceCell;

  if (below && isWaterType(below.type) && isAirLikeParticle(above)) {
    return false;
  }

  for (i = candidates.length - 1; i > 0; i -= 1) {
    j = Math.floor(Math.random() * (i + 1));
    temp = candidates[i];
    candidates[i] = candidates[j];
    candidates[j] = temp;
  }

  for (i = 0; i < candidates.length; i += 1) {
    wx = x + candidates[i][0];
    wy = y + candidates[i][1];
    surfaceY = wy - 1;
    if (!inBounds(wx, wy) || !inBounds(wx, surfaceY)) {
      continue;
    }
    waterCell = getCell(wx, wy);
    surfaceCell = getCell(wx, surfaceY);
    if (!waterCell || !isWaterType(waterCell.type) || !isAirLikeParticle(surfaceCell)) {
      continue;
    }
    if (wx === x && surfaceY === y) {
      return false;
    }
    clearCell(x, y);
    setCell(wx, surfaceY, createParticle("algae"));
    return true;
  }
  return false;
}

function tryBurrowThroughSoil(x, y) {
  var offsets = [
    [0, -1], [-1, 0], [1, 0], [0, 1],
    [-1, -1], [1, -1], [-1, 1], [1, 1]
  ];
  var i;
  var j;
  var temp;
  var nx;
  var ny;
  var target;

  for (i = offsets.length - 1; i > 0; i -= 1) {
    j = Math.floor(Math.random() * (i + 1));
    temp = offsets[i];
    offsets[i] = offsets[j];
    offsets[j] = temp;
  }

  for (i = 0; i < offsets.length; i += 1) {
    nx = x + offsets[i][0];
    ny = y + offsets[i][1];
    if (!inBounds(nx, ny)) {
      continue;
    }
    target = getCell(nx, ny);
    if (target && isSoilGrowthType(target.type) && tryMoveCustom(x, y, nx, ny, function (other) {
      return isSoilGrowthType(other.type);
    })) {
      return true;
    }
  }
  return false;
}

function tryConvertNeighborType(x, y, offsets, predicate, type, validator, overrides) {
  var order = offsets.slice();
  var i;
  var j;
  var temp;
  var nx;
  var ny;
  var target;
  for (i = order.length - 1; i > 0; i -= 1) {
    j = Math.floor(Math.random() * (i + 1));
    temp = order[i];
    order[i] = order[j];
    order[j] = temp;
  }
  for (i = 0; i < order.length; i += 1) {
    nx = x + order[i][0];
    ny = y + order[i][1];
    if (!inBounds(nx, ny)) {
      continue;
    }
    target = getCell(nx, ny);
    if (!target || !predicate(target, nx, ny)) {
      continue;
    }
    if (validator && !validator(nx, ny, target)) {
      continue;
    }
    setCell(nx, ny, createParticle(type, overrides));
    return true;
  }
  return false;
}

function tryNaturalFall(x, y, particle) {
  var px = x;
  var py = y;
  var step;
  var dirs;
  var d;
  var moved;
  var fallSpeed = getParticleFallSpeedValue(particle);

  function canSinkInto(target) {
    return isWaterType(target.type) || target.type === "steam" || target.type === "smoke" || target.type === "fire" || target.type === "ember";
  }

  if (fallSpeed <= 0) {
    return false;
  }

  for (step = 0; step < fallSpeed; step += 1) {
    if (tryMoveCustom(px, py, px, py + 1, canSinkInto)) {
      py += 1;
      continue;
    }
    dirs = chance(0.5) ? [-1, 1] : [1, -1];
    moved = false;
    for (d = 0; d < dirs.length; d += 1) {
      if (tryMoveCustom(px, py, px + dirs[d], py + 1, canSinkInto)) {
        px += dirs[d];
        py += 1;
        moved = true;
        break;
      }
    }
    if (!moved) {
      break;
    }
  }

  return px !== x || py !== y;
}

function placeParticleIfEmpty(x, y, type, overrides) {
  if (!inBounds(x, y) || getCell(x, y)) {
    return false;
  }
  setCell(x, y, createParticle(type, overrides));
  return true;
}

function trySpreadToEmpty(x, y, offsets, type, validator, overrides) {
  var order = offsets.slice();
  var i;
  var j;
  var temp;
  var nx;
  var ny;
  for (i = order.length - 1; i > 0; i -= 1) {
    j = Math.floor(Math.random() * (i + 1));
    temp = order[i];
    order[i] = order[j];
    order[j] = temp;
  }
  for (i = 0; i < order.length; i += 1) {
    nx = x + order[i][0];
    ny = y + order[i][1];
    if (!inBounds(nx, ny) || getCell(nx, ny)) {
      continue;
    }
    if (!validator || validator(nx, ny)) {
      setCell(nx, ny, createParticle(type, overrides));
      return true;
    }
  }
  return false;
}

function hasHotNeighbor(x, y) {
  return !!findNeighbor(x, y, function (particle) {
    return !!HOT_TYPES[particle.type];
  });
}

function germinateSeedAt(x, y) {
  var below = getCell(x, y + 1);
  setCell(x, y, createParticle("plant"));
  if (below && below.type === "soil" && chance(0.65)) {
    setCell(x, y + 1, createParticle("root"));
  } else if (!below && inBounds(x, y + 1)) {
    setCell(x, y + 1, createParticle("root"));
  }
  trySpreadToEmpty(x, y, [[0, -1], [-1, -1], [1, -1]], "plant", function (nx, ny) {
    var support = getCell(nx, ny + 1);
    return !!support && isPlantSupportType(support.type);
  });
}

function encouragePlantGrowth(x, y, strength) {
  var growChance = strength || 0.03;
  if (chance(growChance)) {
    trySpreadToEmpty(x, y, [[0, -1], [-1, -1], [1, -1]], "plant", function (nx, ny) {
      var support = getCell(nx, ny + 1);
      return !!support && isPlantSupportType(support.type);
    });
  }
  if (chance(growChance * 0.8)) {
    trySpreadToEmpty(x, y, [[-1, 0], [1, 0]], "plant", function (nx, ny) {
      var support = getCell(nx, ny + 1);
      return !!support && isPlantSupportType(support.type);
    });
  }
  if (chance(growChance * 0.75)) {
    trySpreadToEmpty(x, y, [[0, 1], [-1, 1], [1, 1]], "root", function (nx, ny) {
      var support = getCell(nx, ny);
      return !support || support.type === "soil" || support.type === "sand" || support.type === "ash";
    });
  }
}

function spawnParticleNearby(x, y, type, attempts) {
  var i;
  var nx;
  var ny;
  var occupant;
  attempts = attempts || 4;
  for (i = 0; i < attempts; i += 1) {
    nx = x + randomRange(-1, 1);
    ny = y + randomRange(-1, 1);
    if (!inBounds(nx, ny)) {
      continue;
    }
    occupant = getCell(nx, ny);
    if (!occupant || MATERIALS[occupant.type].behavior === "gas") {
      setCell(nx, ny, createParticle(type));
      return true;
    }
  }
  return false;
}

function blastRadiusForType(type) {
  return type === "explosive" ? 10 : 6;
}

function igniteCell(x, y, intensity) {
  var target;
  intensity = intensity || "normal";
  if (!inBounds(x, y)) {
    return;
  }
  target = getCell(x, y);
  if (!target) {
    setCell(x, y, createParticle("fire"));
    return;
  }
  if (target.type === "plant" || target.type === "oil") {
    setCell(x, y, createParticle("fire", {
      life: intensity === "strong" ? randomRange(16, 24) : randomRange(12, 18)
    }));
    if (chance(0.7)) {
      spawnParticleNearby(x, y, "smoke", 2);
    }
    if (chance(0.55)) {
      spawnParticleNearby(x, y, "ember", 2);
    }
  } else if (target.type === "gunpowder" || target.type === "explosive") {
    triggerExplosion(x, y, target.type === "explosive" ? 10 : 6, 0);
  }
}

function triggerExplosion(x, y, radius, depth) {
  var ny;
  var nx;
  var dx;
  var dy;
  var dist;
  var force;
  var target;
  var i;

  if (!inBounds(x, y) || depth > 2) {
    return;
  }

  if (depth === 0 && levelRuntime) {
    levelRuntime.counters.explosions += 1;
  }

  clearCell(x, y);
  addEffect(x, y, radius * 1.5, 18, "rgba(255, 226, 124, 0.65)", "rgba(255, 84, 0, 0)");

  for (ny = Math.max(0, y - radius); ny <= Math.min(rows - 1, y + radius); ny += 1) {
    for (nx = Math.max(0, x - radius); nx <= Math.min(cols - 1, x + radius); nx += 1) {
      dx = nx - x;
      dy = ny - y;
      dist = Math.sqrt((dx * dx) + (dy * dy));
      if (dist > radius) {
        continue;
      }
      force = 1 - dist / Math.max(1, radius);
      target = getCell(nx, ny);

      if (!target) {
        if (force > 0.7 && chance(0.25)) {
          setCell(nx, ny, createParticle("fire"));
        } else if (force > 0.45 && chance(0.18)) {
          setCell(nx, ny, createParticle("smoke"));
        }
        continue;
      }

      if ((target.type === "gunpowder" || target.type === "explosive") && !(nx === x && ny === y)) {
        clearCell(nx, ny);
        triggerExplosion(nx, ny, blastRadiusForType(target.type), depth + 1);
        continue;
      }

      if (target.type === "rock") {
        if (force > 0.7) {
          nudgeParticle(nx, ny, sign(dx || (Math.random() - 0.5)), sign(dy || (Math.random() - 0.5)));
        }
        continue;
      }

      if (target.type === "metal") {
        if (force > 0.8 && chance(0.2)) {
          spawnParticleNearby(nx, ny, "ember", 3);
        }
        continue;
      }

      if (force > 0.82) {
        clearCell(nx, ny);
        if (chance(0.5)) {
          setCell(nx, ny, createParticle("fire"));
        }
      } else if (force > 0.45) {
        if (SOFT_TYPES[target.type]) {
          clearCell(nx, ny);
          if (chance(0.45)) {
            setCell(nx, ny, createParticle("smoke"));
          }
        } else if (target.type === "water" || target.type === "rain") {
          setCell(nx, ny, createParticle("steam"));
        } else if (target.type === "ice") {
          setCell(nx, ny, chance(0.55) ? createParticle("steam") : createParticle("water"));
        } else {
          nudgeParticle(nx, ny, sign(dx), sign(dy));
        }
      }
    }
  }

  for (i = 0; i < radius * 2; i += 1) {
    spawnParticleNearby(x, y, "fire", 6);
    spawnParticleNearby(x, y, "smoke", 6);
    if (chance(0.75)) {
      spawnParticleNearby(x, y, "ember", 6);
    }
  }
}

function extinguishFireReaction(x, y, fast) {
  var fireNeighbor = findNeighbor(x, y, function (other) {
    return other.type === "fire" || other.type === "ember";
  });

  if (!fireNeighbor || !chance(getLevelRate(fast ? 0.32 : 0.24))) {
    return false;
  }

  clearCell(fireNeighbor.x, fireNeighbor.y);
  addEffect(x, y, 3.5, 10, "rgba(215, 244, 255, 0.45)", "rgba(150, 220, 255, 0)");

  if (fast) {
    if (chance(0.6)) {
      setCell(fireNeighbor.x, fireNeighbor.y, createParticle("steam", { life: randomRange(16, 32) }));
    }
    if (chance(0.55)) {
      clearCell(x, y);
    }
  } else {
    setCell(x, y, createParticle("steam", { life: randomRange(20, 48) }));
    if (chance(0.5)) {
      setCell(fireNeighbor.x, fireNeighbor.y, createParticle("steam", { life: randomRange(18, 40) }));
    }
  }
  return true;
}

function createReactionParticle(spec) {
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

function reactWaterLike(x, y, type) {
  var lavaNeighbor;
  var iceNeighbor;
  if (extinguishFireReaction(x, y, type === "rain")) {
    return true;
  }
  lavaNeighbor = findNeighbor(x, y, function (other) {
    return other.type === "lava";
  });
  if (lavaNeighbor && applyReactionRule(x, y, lavaNeighbor.x, lavaNeighbor.y, getReactionRule(type, "lava"))) {
    return true;
  }
  iceNeighbor = findNeighbor(x, y, function (other) {
    return other.type === "ice";
  });
  if (iceNeighbor && chance(getLevelRate(0.012))) {
    setCell(iceNeighbor.x, iceNeighbor.y, createParticle("water"));
    addEffect(iceNeighbor.x, iceNeighbor.y, 2.8, 10, "rgba(190, 238, 255, 0.32)", "rgba(190, 238, 255, 0)");
  }
  return false;
}

function coolNearbyLava(cx, cy, extraCount) {
  var offsets = [
    [0, 0],
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [2, 0], [-2, 0], [0, 2], [0, -2],
    [2, 1], [-2, 1], [2, -1], [-2, -1],
    [1, 2], [-1, 2], [1, -2], [-1, -2]
  ];
  var cooled = 0;
  var i;
  var nx;
  var ny;
  var target;
  extraCount = Math.max(0, extraCount || 0);
  for (i = 0; i < offsets.length && cooled < extraCount; i += 1) {
    nx = cx + offsets[i][0];
    ny = cy + offsets[i][1];
    if (!inBounds(nx, ny)) {
      continue;
    }
    target = getCell(nx, ny);
    if (target && target.type === "lava") {
      setCell(nx, ny, createParticle("rock"));
      cooled += 1;
    } else if (target && target.type === "ice" && chance(getLevelRate(0.75))) {
      setCell(nx, ny, chance(0.6) ? createParticle("steam") : createParticle("water"));
    }
  }
  return cooled;
}

function tryPowderMove(x, y, particle) {
  var mat = MATERIALS[particle.type];
  var px = x;
  var py = y;
  var step;
  var dirs;
  var moved;
  var d;
  var fallSpeed = getParticleFallSpeedValue(particle);

  for (step = 0; step < fallSpeed; step += 1) {
    if (tryMove(px, py, px, py + 1)) {
      py += 1;
      continue;
    }
    dirs = chance(0.5) ? [-1, 1] : [1, -1];
    moved = false;
    for (d = 0; d < dirs.length; d += 1) {
      if (tryMove(px, py, px + dirs[d], py + 1)) {
        px += dirs[d];
        py += 1;
        moved = true;
        break;
      }
    }
    if (!moved) {
      break;
    }
  }
}

function tryLiquidMove(x, y, particle) {
  var px = x;
  var py = y;
  var movedDown = false;
  var step;
  var diagDirs;
  var moved;
  var d;
  var sideDir;
  var spread;
  var dirList;
  var tx;
  var fallSpeed = getParticleFallSpeedValue(particle);

  for (step = 0; step < fallSpeed; step += 1) {
    if (tryMove(px, py, px, py + 1)) {
      py += 1;
      movedDown = true;
      continue;
    }
    diagDirs = chance(0.5) ? [-1, 1] : [1, -1];
    moved = false;
    for (d = 0; d < diagDirs.length; d += 1) {
      if (tryMove(px, py, px + diagDirs[d], py + 1)) {
        px += diagDirs[d];
        py += 1;
        moved = true;
        movedDown = true;
        break;
      }
    }
    if (!moved) {
      break;
    }
  }

  if (movedDown) {
    return;
  }

  sideDir = chance(0.5) ? -1 : 1;
  spread = getScaledStepCount(getParticleFlowValue(particle), getGravityScale());
  if (spread <= 0) {
    return;
  }
  dirList = [sideDir, -sideDir];
  for (d = 0; d < dirList.length; d += 1) {
    tx = px;
    for (step = 0; step < spread; step += 1) {
      if (tryMove(tx, py, tx + dirList[d], py)) {
        tx += dirList[d];
      } else {
        break;
      }
    }
    if (tx !== px) {
      return;
    }
  }
}

function tryGasMove(x, y, particle) {
  var mat = MATERIALS[particle.type];
  var px = x;
  var py = y;
  var upwardFirst = [
    [0, -1],
    [chance(0.5) ? -1 : 1, -1],
    [chance(0.5) ? 1 : -1, -1]
  ];
  var i;
  var sideSpread;
  var dir;
  var tx;

  for (i = 0; i < upwardFirst.length; i += 1) {
    if (tryMove(px, py, px + upwardFirst[i][0], py + upwardFirst[i][1])) {
      return;
    }
  }

  sideSpread = randomRange(1, Math.max(1, mat.flow));
  dir = chance(0.5) ? -1 : 1;
  for (i = 0; i < 2; i += 1) {
    tx = px;
    while (sideSpread > 0) {
      if (tryMove(tx, py, tx + dir, py)) {
        tx += dir;
      } else {
        break;
      }
      sideSpread -= 1;
    }
    if (tx !== px) {
      return;
    }
    dir = -dir;
    sideSpread = randomRange(1, Math.max(1, mat.flow));
  }

  if (chance(0.18)) {
    tryMove(px, py, px, py + 1);
  }
}

function expireParticle(x, y, particle) {
  if (particle.type === "fire") {
    if (chance(0.45)) {
      setCell(x, y, createParticle("smoke"));
    } else if (chance(0.35)) {
      setCell(x, y, createParticle("ash"));
    } else {
      clearCell(x, y);
    }
  } else if (particle.type === "ember") {
    if (chance(0.55)) {
      setCell(x, y, createParticle("smoke"));
    } else if (chance(0.25)) {
      setCell(x, y, createParticle("ash"));
    } else {
      clearCell(x, y);
    }
  } else if (particle.type === "steam") {
    setCell(x, y, createParticle("rain", { life: randomRange(48, 96) }));
  } else if (particle.type === "rain") {
    setCell(x, y, createParticle("water"));
  } else if (particle.type === "acid") {
    if (chance(0.45)) {
      setCell(x, y, createParticle("smoke", { life: randomRange(20, 50) }));
    } else {
      clearCell(x, y);
    }
  } else {
    clearCell(x, y);
  }
}

function updateStaticParticle(x, y, particle) {
  var hotNeighbor;
  var waterNeighbor;
  var reactionBoost;

  if (particle.type === "plant") {
    if (hasHotNeighbor(x, y) && chance(getLevelRate(0.22))) {
      igniteCell(x, y, "normal");
      return;
    }
    waterNeighbor = findNeighbor(x, y, function (other) {
      return isWaterType(other.type);
    });
    if (waterNeighbor && chance(getLevelRate(0.012))) {
      if (tryConvertNeighborType(x, y, NEIGHBORS_8, function (other) {
        return isWaterType(other.type);
      }, "plant", function (nx, ny) {
        var below = getCell(nx, ny + 1);
        return !!below && isPlantSupportType(below.type);
      })) {
        addEffect(x, y, 2.6, 9, "rgba(112, 220, 132, 0.30)", "rgba(112, 220, 132, 0)");
      } else {
        encouragePlantGrowth(x, y, getLevelRate(0.035));
      }
    }
    if (!levelFlagEnabled("disablePlantGravity") && tryNaturalFall(x, y, particle)) {
      return;
    }
    return;
  }

  if (particle.type === "root") {
    if (hasHotNeighbor(x, y) && chance(getLevelRate(0.18))) {
      igniteCell(x, y, "normal");
      return;
    }
    if (hasSoilContact(x, y) && chance(getLevelRate(0.03))) {
      setCell(x, y, createParticle("plant"));
      addEffect(x, y, 2.3, 8, "rgba(120, 214, 112, 0.28)", "rgba(120, 214, 112, 0)");
      return;
    }
    return;
  }

  if (particle.type === "algae") {
    if (hasHotNeighbor(x, y) && chance(getLevelRate(0.18))) {
      igniteCell(x, y, "normal");
      return;
    }
    waterNeighbor = findNeighbor(x, y, function (other) {
      return isWaterType(other.type);
    });
    if (waterNeighbor && chance(getGravityRate(0.4)) && tryLiftAlgaeAboveWater(x, y)) {
      addEffect(x, y, 2.5, 8, "rgba(96, 214, 168, 0.26)", "rgba(96, 214, 168, 0)");
      return;
    }
    if (waterNeighbor && chance(getLevelRate(0.014)) && tryConvertNeighborType(x, y, NEIGHBORS_8, function (other) {
      return isWaterType(other.type);
    }, "algae")) {
      addEffect(x, y, 2.4, 8, "rgba(82, 220, 162, 0.28)", "rgba(82, 220, 162, 0)");
    }
    if (tryNaturalFall(x, y, particle)) {
      return;
    }
    return;
  }

  if (particle.type === "ice") {
    hotNeighbor = findNeighbor(x, y, function (other) {
      return !!HOT_TYPES[other.type];
    });
    if (hotNeighbor && chance(getLevelRate(0.22))) {
      reactionBoost = Math.max(1, Math.round(getLevelScaledValue(1, "iceLavaReactionMultiplier")));
      setCell(x, y, createParticle(hotNeighbor.particle.type === "lava" ? "steam" : "water"));
      if (hotNeighbor.particle.type === "lava" && reactionBoost > 1) {
        coolNearbyLava(hotNeighbor.x, hotNeighbor.y, reactionBoost - 1);
      }
      addEffect(x, y, 3.2, 10, "rgba(200, 244, 255, 0.42)", "rgba(200, 244, 255, 0)");
      return;
    }
    waterNeighbor = findNeighbor(x, y, function (other) {
      return other.type === "water";
    });
    if (waterNeighbor && chance(getLevelRate(0.008))) {
      setCell(x, y, createParticle("water"));
    }
  }
}

function updatePowderParticle(x, y, particle) {
  if (particle.type === "soil" && levelFlagEnabled("disableSoilGravity")) {
    return;
  }
  if (particle.type === "seed" && hasSoilContact(x, y) && chance(getLevelRate(countWaterNearby(x, y) > 0 ? 0.065 : 0.03))) {
    germinateSeedAt(x, y);
    addEffect(x, y, 2.4, 8, "rgba(108, 214, 110, 0.28)", "rgba(108, 214, 110, 0)");
    return;
  }
  if ((particle.type === "gunpowder" || particle.type === "explosive") && hasHotNeighbor(x, y) && chance(getLevelRate(0.35))) {
    triggerExplosion(x, y, blastRadiusForType(particle.type), 0);
    return;
  }
  tryPowderMove(x, y, particle);
}

function updateWaterParticle(x, y, particle) {
  if (reactWaterLike(x, y, particle.type)) {
    return;
  }
  if (particle.type === "water" && particle.age > 24 && isExposedToEnvironment(x, y) && chance(getLevelRate(0.0042))) {
    setCell(x, y, createParticle("steam", { life: randomRange(72, 140) }));
    addEffect(x, y, 2.3, 8, "rgba(214, 240, 255, 0.26)", "rgba(214, 240, 255, 0)");
    return;
  }
  tryLiquidMove(x, y, particle);
}

function updateOilParticle(x, y, particle) {
  if (hasHotNeighbor(x, y) && chance(getLevelRate(0.28))) {
    igniteCell(x, y, "strong");
    if (chance(0.65)) {
      spawnParticleNearby(x, y, "smoke", 5);
    }
    return;
  }
  tryLiquidMove(x, y, particle);
}

function updateAcidParticle(x, y, particle) {
  var i;
  var nx;
  var ny;
  var target;
  var targetMat;
  var corroded = false;
  for (i = 0; i < NEIGHBORS_8.length; i += 1) {
    nx = x + NEIGHBORS_8[i][0];
    ny = y + NEIGHBORS_8[i][1];
    target = getCell(nx, ny);
    if (!target) {
      continue;
    }
    targetMat = MATERIALS[target.type];
    var corrosionRule = getCorrosionRule("acid", target.type, targetMat);
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
    }
  }
  if (corroded) {
    addEffect(x, y, 2.8, 8, "rgba(180, 255, 120, 0.3)", "rgba(130, 255, 90, 0)");
  }
  tryLiquidMove(x, y, particle);
}

function updateLavaParticle(x, y, particle) {
  var waterNeighbor;
  var iceNeighbor;
  var rockNeighbor;
  var flammableNeighbor;
  var exposure;
  var reactionBoost;

  waterNeighbor = findNeighbor(x, y, function (other) {
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
  }

  rockNeighbor = findNeighbor(x, y, function (other) {
    return other.type === "rock";
  });
  if (rockNeighbor && chance(getLevelRate(0.04))) {
    setCell(rockNeighbor.x, rockNeighbor.y, createParticle("lava", { temp: 18 }));
  }

  flammableNeighbor = findNeighbor(x, y, function (other) {
    return other.type === "plant" || other.type === "oil" || other.type === "gunpowder" || other.type === "explosive";
  });
  if (flammableNeighbor && chance(getLevelRate(0.24))) {
    igniteCell(flammableNeighbor.x, flammableNeighbor.y, "strong");
  }

  exposure = countAdjacentOfType(x, y, "lava");
  particle.temp -= exposure <= 1 ? 0.24 : 0.07;
  if (findNeighbor(x, y, function (other) {
    return other.type === "water" || other.type === "steam";
  })) {
    particle.temp -= 0.3;
  }
  if (particle.temp <= 0) {
    setCell(x, y, createParticle("rock"));
    return;
  }

  tryLiquidMove(x, y, particle);
}

function spreadFireToNeighbors(x, y) {
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
}

function updateFireParticle(x, y) {
  var waterNeighbor = findNeighbor(x, y, function (other) {
    return !!EXTINGUISH_TYPES[other.type];
  });
  if (waterNeighbor && chance(getLevelRate(0.3))) {
    clearCell(x, y);
    if (waterNeighbor.particle.type === "rain" || chance(0.65)) {
      setCell(waterNeighbor.x, waterNeighbor.y, createParticle("steam", { life: randomRange(16, 36) }));
    }
    addEffect(x, y, 3.2, 10, "rgba(225, 242, 255, 0.4)", "rgba(160, 225, 255, 0)");
    return;
  }
  spreadFireToNeighbors(x, y);
  if (chance(getLevelRate(0.38, "fireSmokeMultiplier"))) {
    spawnParticleNearby(x, y, "smoke", 4);
  }
  if (chance(getLevelRate(0.28, "fireEmberMultiplier"))) {
    spawnParticleNearby(x, y, "ember", 4);
  }
  tryGasMove(x, y, getCell(x, y));
}

function updateEmberParticle(x, y) {
  spreadFireToNeighbors(x, y);
  if (chance(getLevelRate(0.22, "emberSmokeMultiplier"))) {
    spawnParticleNearby(x, y, "smoke", 3);
  }
  tryGasMove(x, y, getCell(x, y));
}

function updateSteamParticle(x, y, particle) {
  var iceNeighbor = findNeighbor(x, y, function (other) {
    return other.type === "ice";
  });
  var attachedSurface = findNeighbor(x, y, function (other) {
    return MATERIALS[other.type].behavior === "static" || MATERIALS[other.type].behavior === "powder";
  });
  if ((iceNeighbor && chance(getLevelRate(0.2))) || (y < rows * 0.18 && chance(getLevelRate(0.09))) || (attachedSurface && particle.age > 18 && chance(getLevelRate(0.05)))) {
    setCell(x, y, createParticle("rain", { life: randomRange(56, 110) }));
    return;
  }
  tryGasMove(x, y, getCell(x, y));
}

function updateSmokeParticle(x, y) {
  tryGasMove(x, y, getCell(x, y));
}

function updateCreatureParticle(x, y, particle) {
  var meal;
  var dirs;
  var d;
  var dir;
  var support;
  if (hasHotNeighbor(x, y) && chance(getLevelRate(0.2))) {
    igniteCell(x, y, "normal");
    return;
  }
  if (particle.type === "bug") {
    meal = findNeighbor(x, y, function (other) {
      return other.type === "plant" || other.type === "algae";
    });
    if (meal && chance(getLevelRate(0.14))) {
      setCell(meal.x, meal.y, createParticle("bug", { life: randomRange(260, 460) }));
      particle.life = isFiniteNumber(particle.life) ? particle.life + 18 : particle.life;
      particle.maxLife = isFiniteNumber(particle.maxLife) ? Math.max(particle.maxLife, particle.life) : particle.maxLife;
      addEffect(meal.x, meal.y, 2.2, 7, "rgba(176, 238, 110, 0.24)", "rgba(176, 238, 110, 0)");
      return;
    }
  }
  if (hasSoilContact(x, y) && chance(getGravityRate(0.28)) && tryBurrowThroughSoil(x, y)) {
    addEffect(x, y, 2.0, 6, particle.type === "worm" ? "rgba(214, 161, 131, 0.22)" : "rgba(176, 228, 122, 0.22)", "rgba(255, 255, 255, 0)");
    return;
  }
  if (tryNaturalFall(x, y, particle)) {
    return;
  }
  if (particle.type === "worm" && hasSoilContact(x, y) && chance(getLevelRate(0.012))) {
    if (trySpreadToEmpty(x, y, [[-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1]], "worm", function (nx, ny) {
      support = getCell(nx, ny + 1);
      return !!support && isSoilGrowthType(support.type);
    })) {
      addEffect(x, y, 2.2, 7, "rgba(214, 161, 131, 0.25)", "rgba(214, 161, 131, 0)");
      return;
    }
  }
  dirs = chance(0.5) ? [-1, 1] : [1, -1];
  for (d = 0; d < dirs.length; d += 1) {
    dir = dirs[d];
    support = getCell(x + dir, y + 1);
    if (particle.type === "worm" && support && isSoilGrowthType(support.type) && tryMoveCustom(x, y, x + dir, y, function (target) {
      return MATERIALS[target.type].behavior === "gas" || target.type === "steam" || target.type === "smoke";
    })) {
      return;
    }
    if (particle.type === "bug" && tryMoveCustom(x, y, x + dir, y, function (target) {
      return MATERIALS[target.type].behavior === "gas" || target.type === "steam" || target.type === "smoke";
    })) {
      return;
    }
  }
}

function updateParticle(x, y, particle) {
  var behavior;
  if (!particle || particle.updated === frameId) {
    return;
  }
  particle.updated = frameId;
  particle.age += 1;
  if (isFiniteNumber(particle.life)) {
    particle.life -= 1;
    if (particle.life <= 0) {
      expireParticle(x, y, particle);
      return;
    }
  }
  behavior = MATERIALS[particle.type].behavior;
  if (behavior === "static") {
    updateStaticParticle(x, y, particle);
  } else if (behavior === "powder") {
    updatePowderParticle(x, y, particle);
  } else if (behavior === "liquid") {
    if (particle.type === "water" || particle.type === "rain") {
      updateWaterParticle(x, y, particle);
    } else if (particle.type === "lava") {
      updateLavaParticle(x, y, particle);
    } else if (particle.type === "oil") {
      updateOilParticle(x, y, particle);
    } else if (particle.type === "acid") {
      updateAcidParticle(x, y, particle);
    } else {
      tryLiquidMove(x, y, particle);
    }
  } else if (behavior === "gas") {
    if (particle.type === "steam") {
      updateSteamParticle(x, y, particle);
    } else {
      updateSmokeParticle(x, y, particle);
    }
  } else if (behavior === "fire") {
    updateFireParticle(x, y, particle);
  } else if (behavior === "ember") {
    updateEmberParticle(x, y, particle);
  } else if (behavior === "creature") {
    updateCreatureParticle(x, y, particle);
  }
}

function simulateFrame() {
  var maxUpdates = clamp(Math.floor(cols * rows * 0.32), 12000, 65000);
  var bandHeight = 18;
  var bandCount = Math.max(1, Math.ceil(rows / bandHeight));
  var startBand = frameId % bandCount;
  var updates = 0;
  var band;
  var bandIndex;
  var yMax;
  var yMin;
  var y;
  var x;
  var leftToRight;
  var particle;

  for (band = 0; band < bandCount; band += 1) {
    bandIndex = (startBand + band) % bandCount;
    yMax = rows - 1 - (bandIndex * bandHeight);
    yMin = Math.max(0, yMax - bandHeight + 1);

    for (y = yMax; y >= yMin; y -= 1) {
      if (y < 0 || y >= rows) {
        continue;
      }
      leftToRight = ((y + frameId) & 1) === 0;
      if (leftToRight) {
        for (x = 0; x < cols; x += 1) {
          particle = getCell(x, y);
          if (!particle) {
            continue;
          }
          updateParticle(x, y, particle);
          updates += 1;
          if (updates >= maxUpdates) {
            return;
          }
        }
      } else {
        for (x = cols - 1; x >= 0; x -= 1) {
          particle = getCell(x, y);
          if (!particle) {
            continue;
          }
          updateParticle(x, y, particle);
          updates += 1;
          if (updates >= maxUpdates) {
            return;
          }
        }
      }
    }
  }
}

function render() {
  renderer.render({
    cols: cols,
    rows: rows,
    frameId: frameId,
    getCell: getCell,
    effects: effects,
    mode: mode,
    activeLayout: activeLayout
  });
}

function updateStatus(now) {
  var fps = 1000 / Math.max(1, now - lastTime);
  smoothedFps = smoothedFps === 0 ? fps : mix(smoothedFps, fps, 0.12);
  ui.fpsLabel.innerHTML = String(Math.round(smoothedFps));
  ui.particleLabel.innerHTML = String(particleCount);
  lastTime = now;
}

function tick(now) {
  currentNow = isFiniteNumber(now) ? now : getNowMs();
  frameId += 1;
  if (!paused) {
    simulateFrame();
    updateEffects();
    syncMissionProgress(false);
  }
  render();
  updateStatus(currentNow);
  requestFrame(tick);
}

function clearAll() {
  grid.clearAll();
  particleCount = 0;
  effects = [];
}

function onPointerDown(event) {
  var pointData;
  var point;
  var isTouchLike = isTouchLikeEvent(event);
  if (!isTouchLike && event.button !== 0 && event.button !== 2) {
    return;
  }
  pointData = getEventClientPoint(event);
  if (!pointData) {
    return;
  }
  if (event.cancelable) {
    event.preventDefault();
  }
  mouse.down = true;
  mouse.erase = !isTouchLike && event.button === 2;
  mouse.pointerId = event.pointerId !== undefined ? event.pointerId : null;
  mouse.inside = true;
  moveBrushPreview(pointData.clientX, pointData.clientY);
  ui.brushPreview.style.display = "block";
  if (mouse.pointerId !== null && ui.canvas.setPointerCapture) {
    try {
      ui.canvas.setPointerCapture(mouse.pointerId);
    } catch (captureError) {}
  }
  point = screenToGrid(pointData.clientX, pointData.clientY);
  mouse.lastGridX = point.x;
  mouse.lastGridY = point.y;
  drawLine(point.x, point.y, point.x, point.y, mouse.erase);
}

function onPointerMove(event) {
  var pointData;
  var point;
  if (mouse.pointerId !== null && event.pointerId !== undefined && event.pointerId !== mouse.pointerId) {
    return;
  }
  pointData = getEventClientPoint(event);
  if (!pointData) {
    return;
  }
  if (mouse.down && event.cancelable) {
    event.preventDefault();
  }
  point = screenToGrid(pointData.clientX, pointData.clientY);
  moveBrushPreview(pointData.clientX, pointData.clientY);
  if (mouse.down && mouse.lastGridX !== null && mouse.lastGridY !== null) {
    drawLine(mouse.lastGridX, mouse.lastGridY, point.x, point.y, mouse.erase);
  }
  mouse.lastGridX = point.x;
  mouse.lastGridY = point.y;
}

function onPointerUp(event) {
  if (mouse.pointerId !== null && event && event.pointerId !== undefined && event.pointerId !== mouse.pointerId) {
    return;
  }
  if (event && event.cancelable) {
    event.preventDefault();
  }
  if (mouse.pointerId !== null && ui.canvas.releasePointerCapture) {
    try {
      ui.canvas.releasePointerCapture(mouse.pointerId);
    } catch (releaseError) {}
  }
  mouse.down = false;
  mouse.erase = false;
  mouse.pointerId = null;
  mouse.lastGridX = null;
  mouse.lastGridY = null;
  if (isTouchLikeEvent(event || {})) {
    mouse.inside = false;
    ui.brushPreview.style.display = "none";
  }
}

function bindEvents() {
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
}

function init() {
  buildMaterialButtons();
  buildExploreMapButtons();
  updateBrushUI();
  updatePhysicsUI();
  updateHintUI();
  updateMissionUI();
  resizeSimulation();
  bindEvents();
  requestFrame(function (time) {
    lastTime = isFiniteNumber(time) ? time : getNowMs();
    requestFrame(tick);
  });
}

init();