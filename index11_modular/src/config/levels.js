export function createLevelData(deps) {
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

  const EXPLORE_MAPS = [
    {
      title: "沙地森林",
      buttonSubtitle: "沙丘、绿洲与耐旱植被",
      subtitle: "系统会自动铺出沙丘、地下湿土与绿洲，你可以继续引水、造林或改成完全不同的生态。",
      starterMaterial: "water",
      tags: ["探索模式", "干旱生态", "可自由改造"],
      cards: [
        { label: "环境结构", detail: "沙海、湿土、绿洲与零散树林", ratio: 0.82 },
        { label: "推荐玩法", detail: "扩张水源、增加植被、改造地形", ratio: 0.72 },
        { label: "可用材料", detail: "完整物质面板均可使用", ratio: 1 }
      ],
      buildScene: function () {
        fillRect(rectRatio(0, 0.94, 1, 0.06), "rock", 1);
        fillTerrainBand("soil", 0.80, 0.03, 0.86);
        fillTerrainBand("sand", 0.66, 0.08, 1);
        fillEllipse(cols * 0.48, rows * 0.75, Math.max(10, Math.floor(cols * 0.12)), Math.max(4, Math.floor(rows * 0.05)), "water", 0.98);
        fillEllipse(cols * 0.48, rows * 0.75, Math.max(5, Math.floor(cols * 0.055)), Math.max(2, Math.floor(rows * 0.02)), "algae", 0.22);
        scatterClusters(rectRatio(0.28, 0.62, 0.14, 0.12), "plant", 8, 2, 4, 0.72);
        scatterClusters(rectRatio(0.56, 0.61, 0.15, 0.13), "plant", 9, 2, 4, 0.74);
        scatterClusters(rectRatio(0.31, 0.73, 0.12, 0.08), "root", 5, 2, 3, 0.42);
        scatterClusters(rectRatio(0.57, 0.73, 0.12, 0.08), "root", 5, 2, 3, 0.42);
        scatterClusters(rectRatio(0.16, 0.58, 0.68, 0.18), "seed", 12, 1, 2, 0.46);
        scatterClusters(rectRatio(0.08, 0.58, 0.84, 0.16), "rock", 10, 2, 4, 0.65);
      }
    },
    {
      title: "极地冰原",
      buttonSubtitle: "冰层、裂海与寒冷海岸",
      subtitle: "厚冰会覆盖海面，裂隙间保留流动海水。你可以打通冰面、改变水系，或者直接重塑极地。",
      starterMaterial: "ice",
      tags: ["探索模式", "寒带环境", "冰水交错"],
      cards: [
        { label: "环境结构", detail: "海水、冰架、冻土地带与岩岸", ratio: 0.84 },
        { label: "推荐玩法", detail: "融冰引流、筑冰川、开辟水道", ratio: 0.68 },
        { label: "可用材料", detail: "完整物质面板均可使用", ratio: 1 }
      ],
      buildScene: function () {
        fillRect(rectRatio(0, 0.92, 1, 0.08), "rock", 1);
        fillRect(rectRatio(0, 0.78, 1, 0.14), "water", 0.95);
        fillTerrainBand("ice", 0.60, 0.05, 0.96);
        fillEllipse(cols * 0.18, rows * 0.66, Math.max(10, Math.floor(cols * 0.12)), Math.max(5, Math.floor(rows * 0.09)), "ice", 0.95);
        fillEllipse(cols * 0.79, rows * 0.63, Math.max(11, Math.floor(cols * 0.13)), Math.max(5, Math.floor(rows * 0.10)), "ice", 0.94);
        drawMaterialPath([
          { x: Math.floor(cols * 0.08), y: Math.floor(rows * 0.70) },
          { x: Math.floor(cols * 0.25), y: Math.floor(rows * 0.73) },
          { x: Math.floor(cols * 0.46), y: Math.floor(rows * 0.69) },
          { x: Math.floor(cols * 0.68), y: Math.floor(rows * 0.75) },
          { x: Math.floor(cols * 0.88), y: Math.floor(rows * 0.71) }
        ], Math.max(3, Math.floor(cols * 0.018)), "water", 0.98);
        scatterClusters(rectRatio(0.12, 0.80, 0.70, 0.08), "algae", 8, 1, 2, 0.34);
        scatterClusters(rectRatio(0.10, 0.56, 0.82, 0.18), "rock", 9, 2, 3, 0.62);
      }
    },
    {
      title: "火山裂谷",
      buttonSubtitle: "熔岩口、灰烬与岩石坡面",
      subtitle: "中心火山和流动熔岩已经成形，你可以继续引水降温、改造喷发路径，或者把它做成别的地貌。",
      starterMaterial: "rock",
      tags: ["探索模式", "火山地貌", "高温区域"],
      cards: [
        { label: "环境结构", detail: "火山锥、熔岩通道、灰烬和岩层", ratio: 0.88 },
        { label: "推荐玩法", detail: "引水冷却、堆墙导流、做新火山口", ratio: 0.74 },
        { label: "可用材料", detail: "完整物质面板均可使用", ratio: 1 }
      ],
      buildScene: function () {
        fillRect(rectRatio(0, 0.94, 1, 0.06), "rock", 1);
        fillTerrainBand("rock", 0.77, 0.06, 1);
        fillTerrainBand("ash", 0.70, 0.03, 0.52, 0.16, 0.84);
        fillCone(0.52, 0.88, 0.20, 0.30, "rock", 1);
        fillEllipse(cols * 0.52, rows * 0.35, Math.max(7, Math.floor(cols * 0.05)), Math.max(3, Math.floor(rows * 0.03)), "lava", 0.98);
        drawMaterialPath([
          { x: Math.floor(cols * 0.52), y: Math.floor(rows * 0.36) },
          { x: Math.floor(cols * 0.54), y: Math.floor(rows * 0.49) },
          { x: Math.floor(cols * 0.62), y: Math.floor(rows * 0.64) },
          { x: Math.floor(cols * 0.76), y: Math.floor(rows * 0.82) }
        ], Math.max(3, Math.floor(cols * 0.018)), "lava", 0.96);
        fillEllipse(cols * 0.52, rows * 0.28, Math.max(10, Math.floor(cols * 0.07)), Math.max(3, Math.floor(rows * 0.04)), "smoke", 0.34);
        scatterClusters(rectRatio(0.14, 0.60, 0.72, 0.18), "rock", 12, 2, 4, 0.7);
        scatterClusters(rectRatio(0.28, 0.68, 0.38, 0.12), "ash", 10, 2, 3, 0.48);
      }
    },
    {
      title: "湿地河湾",
      buttonSubtitle: "浅河、泥土与密集植被",
      subtitle: "这是一张水网和植物都更丰富的自然地图，适合做引流、扩林、造岛，或者测试生长反应。",
      starterMaterial: "plant",
      tags: ["探索模式", "湿地生态", "高可塑性"],
      cards: [
        { label: "环境结构", detail: "河道、滩地、藻层和湿土植被", ratio: 0.86 },
        { label: "推荐玩法", detail: "开新河、造岛、观察植物扩张", ratio: 0.7 },
        { label: "可用材料", detail: "完整物质面板均可使用", ratio: 1 }
      ],
      buildScene: function () {
        fillRect(rectRatio(0, 0.94, 1, 0.06), "rock", 1);
        fillTerrainBand("soil", 0.74, 0.06, 0.94);
        drawMaterialPath([
          { x: Math.floor(cols * 0.08), y: Math.floor(rows * 0.60) },
          { x: Math.floor(cols * 0.22), y: Math.floor(rows * 0.67) },
          { x: Math.floor(cols * 0.43), y: Math.floor(rows * 0.61) },
          { x: Math.floor(cols * 0.63), y: Math.floor(rows * 0.70) },
          { x: Math.floor(cols * 0.88), y: Math.floor(rows * 0.64) }
        ], Math.max(4, Math.floor(cols * 0.022)), "water", 0.96);
        drawMaterialPath([
          { x: Math.floor(cols * 0.34), y: Math.floor(rows * 0.58) },
          { x: Math.floor(cols * 0.40), y: Math.floor(rows * 0.70) },
          { x: Math.floor(cols * 0.48), y: Math.floor(rows * 0.82) }
        ], Math.max(3, Math.floor(cols * 0.016)), "water", 0.9);
        scatterClusters(rectRatio(0.10, 0.60, 0.76, 0.18), "plant", 15, 2, 4, 0.74);
        scatterClusters(rectRatio(0.14, 0.68, 0.70, 0.12), "root", 9, 2, 3, 0.44);
        scatterClusters(rectRatio(0.12, 0.60, 0.76, 0.18), "algae", 12, 1, 2, 0.32);
        scatterClusters(rectRatio(0.16, 0.64, 0.66, 0.12), "worm", 8, 1, 2, 0.36);
        scatterClusters(rectRatio(0.12, 0.58, 0.76, 0.14), "seed", 10, 1, 2, 0.4);
      }
    },
    {
      title: "海滩潮间带",
      buttonSubtitle: "海水、沙滩、沙丘与滨海植被",
      subtitle: "浅海从右侧推进，潮间带由湿沙和潮池组成，内陆侧有沙丘、少量土壤和耐盐植被，适合观察水沙交界与植物扩张。",
      starterMaterial: "sand",
      tags: ["探索模式", "海岸地貌", "水沙交界", "潮池生态"],
      cards: [
        { label: "现实分布", detail: "右侧浅海，中央潮间带，左侧沙丘和滨海植物", ratio: 0.88 },
        { label: "关键元素", detail: "水、沙、岩石潮池、藻类、少量土壤和植物", ratio: 0.78 },
        { label: "推荐玩法", detail: "筑堤、造潮池、观察水侵蚀沙丘与藻类扩散", ratio: 0.72 }
      ],
      buildScene: function () {
        fillRect(rectRatio(0, 0.94, 1, 0.06), "rock", 1);
        fillTerrainBand("sand", 0.66, 0.06, 1);
        fillTerrainBand("soil", 0.82, 0.025, 0.28, 0.02, 0.42);
        fillRect(rectRatio(0.55, 0.70, 0.45, 0.24), "water", 0.96);
        drawMaterialPath([
          { x: Math.floor(cols * 0.42), y: Math.floor(rows * 0.67) },
          { x: Math.floor(cols * 0.53), y: Math.floor(rows * 0.71) },
          { x: Math.floor(cols * 0.66), y: Math.floor(rows * 0.68) },
          { x: Math.floor(cols * 0.84), y: Math.floor(rows * 0.73) },
          { x: Math.floor(cols * 0.98), y: Math.floor(rows * 0.70) }
        ], Math.max(2, Math.floor(cols * 0.012)), "water", 0.72);
        fillEllipse(cols * 0.34, rows * 0.72, Math.max(5, Math.floor(cols * 0.045)), Math.max(2, Math.floor(rows * 0.018)), "water", 0.82);
        fillEllipse(cols * 0.34, rows * 0.72, Math.max(3, Math.floor(cols * 0.026)), Math.max(1, Math.floor(rows * 0.012)), "algae", 0.32);
        fillEllipse(cols * 0.18, rows * 0.61, Math.max(12, Math.floor(cols * 0.11)), Math.max(5, Math.floor(rows * 0.05)), "sand", 0.9);
        scatterClusters(rectRatio(0.06, 0.58, 0.26, 0.14), "plant", 8, 2, 4, 0.5);
        scatterClusters(rectRatio(0.06, 0.70, 0.34, 0.12), "root", 6, 1, 3, 0.34);
        scatterClusters(rectRatio(0.24, 0.63, 0.34, 0.13), "rock", 9, 1, 3, 0.58);
        scatterClusters(rectRatio(0.50, 0.70, 0.46, 0.16), "algae", 12, 1, 2, 0.26);
      }
    },
    {
      title: "热带雨林",
      buttonSubtitle: "密林、湿土、水网与活跃生物",
      subtitle: "厚土层和密集根系支撑高覆盖植物，蜿蜒溪流贯穿林地，藻类、种子和小型生物分布在湿润区域，呈现高水分高生物量环境。",
      starterMaterial: "rain",
      tags: ["探索模式", "热带生态", "高湿度", "高生物量"],
      cards: [
        { label: "现实分布", detail: "厚土层、树冠层、根系层、溪流和湿润生物带", ratio: 0.9 },
        { label: "关键元素", detail: "水、雨、土、植物、根系、种子、藻类、小型生物", ratio: 0.86 },
        { label: "推荐玩法", detail: "改变水路、制造林窗、观察植物和生物扩张", ratio: 0.76 }
      ],
      buildScene: function () {
        fillRect(rectRatio(0, 0.94, 1, 0.06), "rock", 1);
        fillTerrainBand("soil", 0.64, 0.05, 0.97);
        fillTerrainBand("root", 0.73, 0.035, 0.38, 0.08, 0.92);
        drawMaterialPath([
          { x: Math.floor(cols * 0.05), y: Math.floor(rows * 0.57) },
          { x: Math.floor(cols * 0.19), y: Math.floor(rows * 0.62) },
          { x: Math.floor(cols * 0.36), y: Math.floor(rows * 0.58) },
          { x: Math.floor(cols * 0.55), y: Math.floor(rows * 0.67) },
          { x: Math.floor(cols * 0.76), y: Math.floor(rows * 0.61) },
          { x: Math.floor(cols * 0.94), y: Math.floor(rows * 0.66) }
        ], Math.max(4, Math.floor(cols * 0.02)), "water", 0.88);
        scatterClusters(rectRatio(0.06, 0.38, 0.88, 0.24), "plant", 32, 2, 6, 0.78);
        scatterClusters(rectRatio(0.08, 0.56, 0.84, 0.20), "root", 18, 2, 4, 0.48);
        scatterClusters(rectRatio(0.10, 0.45, 0.80, 0.26), "seed", 22, 1, 2, 0.48);
        scatterClusters(rectRatio(0.08, 0.58, 0.84, 0.18), "algae", 18, 1, 2, 0.28);
        scatterClusters(rectRatio(0.12, 0.62, 0.76, 0.14), "worm", 12, 1, 2, 0.38);
        scatterClusters(rectRatio(0.16, 0.42, 0.68, 0.22), "bug", 14, 1, 2, 0.32);
        fillRect(rectRatio(0.10, 0.04, 0.80, 0.08), "rain", 0.05);
      }
    },
    {
      title: "山谷大坝",
      buttonSubtitle: "高水位水库、坝体与下游河道",
      subtitle: "左侧水库水位高，中央岩石与金属构成坝体，右侧下游河道较低并带有沉积沙土，适合测试放水、溃坝和沉积物迁移。",
      starterMaterial: "water",
      tags: ["探索模式", "工程地貌", "水位差", "沉积物"],
      cards: [
        { label: "现实分布", detail: "上游深水库、中央坝体、下游低水位河道", ratio: 0.88 },
        { label: "关键元素", detail: "岩石坝基、金属闸门、水库、沙土沉积和岸坡植物", ratio: 0.82 },
        { label: "推荐玩法", detail: "开闸引流、削弱坝体、观察冲刷与沉积", ratio: 0.76 }
      ],
      buildScene: function () {
        var dam = rectRatio(0.48, 0.42, 0.07, 0.42);
        fillRect(rectRatio(0, 0.94, 1, 0.06), "rock", 1);
        fillTerrainBand("rock", 0.82, 0.04, 1);
        fillTerrainBand("soil", 0.76, 0.035, 0.62);
        fillRect(rectRatio(0.06, 0.48, 0.42, 0.31), "water", 0.96);
        fillRect(rectRatio(0.08, 0.74, 0.35, 0.08), "sand", 0.35);
        fillRect(dam, "rock", 1);
        fillRect(rectRatio(0.505, 0.47, 0.018, 0.29), "metal", 0.95);
        drawMaterialPath([
          { x: Math.floor(cols * 0.54), y: Math.floor(rows * 0.78) },
          { x: Math.floor(cols * 0.64), y: Math.floor(rows * 0.82) },
          { x: Math.floor(cols * 0.78), y: Math.floor(rows * 0.80) },
          { x: Math.floor(cols * 0.94), y: Math.floor(rows * 0.84) }
        ], Math.max(3, Math.floor(cols * 0.016)), "water", 0.84);
        fillRect(rectRatio(0.55, 0.83, 0.40, 0.08), "sand", 0.36);
        scatterClusters(rectRatio(0.58, 0.68, 0.32, 0.13), "plant", 9, 1, 3, 0.46);
        scatterClusters(rectRatio(0.12, 0.42, 0.30, 0.08), "algae", 10, 1, 2, 0.24);
        scatterClusters(rectRatio(0.42, 0.55, 0.16, 0.24), "rock", 8, 2, 4, 0.72);
      }
    },
    {
      title: "冰蚀峡湾",
      buttonSubtitle: "深水峡湾、陡峭岩壁与冰雪坡面",
      subtitle: "中央是狭长深水海湾，两侧为陡峭岩壁和冰蚀山坡，高处有冰雪覆盖，低处只有少量耐寒植被，适合模拟崩塌、融冰和海水倒灌。",
      starterMaterial: "ice",
      tags: ["探索模式", "峡湾地貌", "冰水系统", "陡峭岩壁"],
      cards: [
        { label: "现实分布", detail: "中央深水，两侧高岩壁，山顶冰雪，低坡稀疏植被", ratio: 0.9 },
        { label: "关键元素", detail: "岩石、深水、冰块、少量土壤和寒带植物", ratio: 0.82 },
        { label: "推荐玩法", detail: "融冰造瀑布、削坡制造崩塌、改造峡湾水道", ratio: 0.74 }
      ],
      buildScene: function () {
        fillRect(rectRatio(0, 0.94, 1, 0.06), "rock", 1);
        fillCone(0.18, 0.94, 0.28, 0.18, "rock", 1);
        fillCone(0.82, 0.94, 0.30, 0.16, "rock", 1);
        fillRect(rectRatio(0.36, 0.56, 0.28, 0.38), "water", 0.98);
        drawMaterialPath([
          { x: Math.floor(cols * 0.42), y: Math.floor(rows * 0.34) },
          { x: Math.floor(cols * 0.45), y: Math.floor(rows * 0.48) },
          { x: Math.floor(cols * 0.49), y: Math.floor(rows * 0.58) }
        ], Math.max(2, Math.floor(cols * 0.012)), "water", 0.64);
        fillEllipse(cols * 0.18, rows * 0.22, Math.max(14, Math.floor(cols * 0.12)), Math.max(4, Math.floor(rows * 0.045)), "ice", 0.88);
        fillEllipse(cols * 0.82, rows * 0.20, Math.max(15, Math.floor(cols * 0.13)), Math.max(4, Math.floor(rows * 0.05)), "ice", 0.88);
        fillEllipse(cols * 0.50, rows * 0.51, Math.max(8, Math.floor(cols * 0.06)), Math.max(2, Math.floor(rows * 0.02)), "ice", 0.38);
        scatterClusters(rectRatio(0.20, 0.62, 0.16, 0.18), "soil", 5, 1, 3, 0.28);
        scatterClusters(rectRatio(0.64, 0.62, 0.16, 0.18), "soil", 5, 1, 3, 0.28);
        scatterClusters(rectRatio(0.18, 0.58, 0.20, 0.20), "plant", 6, 1, 2, 0.32);
        scatterClusters(rectRatio(0.62, 0.58, 0.20, 0.20), "plant", 6, 1, 2, 0.32);
        scatterClusters(rectRatio(0.08, 0.44, 0.84, 0.28), "rock", 16, 2, 4, 0.64);
      }
    }
  ];
  
  const LEVELS = [
    {
      title: "第 1 关 森林救火",
      subtitle: "草地覆盖画布约三分之二，土块以不规则条带分布（约占草地五分之一）。开局会随机点燃多处植物，用水/雨降温控火。",
      tags: ["灭火", "控火", "草地覆盖", "条带土块", "随机起火"],
      allowedMaterials: ["water", "rain", "soil"],
      starterMaterial: "water",
      materialBudget: {
        soil: { ratio: 0.009, min: 260, max: 1200 }
      },
      tuning: {
        fireSpreadMultiplier: 0.22,
        fireLifeMultiplier: 0.32,
        emberLifeMultiplier: 0.32,
        fireEmberMultiplier: 0.22,
        fireSmokeMultiplier: 0.34,
        emberSmokeMultiplier: 0.32,
        waterFlowMultiplier: 2.4,
        waterFallMultiplier: 1.8,
        disablePlantGravity: true,
        disableSoilGravity: true,
        initialIgnitionCount: 2,
        initialIgnitionMinDistance: 12,
        initialIgnitionAttempts: 1800
      },
      buildLayout: function () {
        return createLayout([
          // 草地区放在屏幕可用高度（去掉底部岩层）的中心位置
          { id: "grove", label: "草地区", color: "rgba(124, 220, 134, 0.9)", rect: rectRatio(0, 0.14, 1, 0.66) },
          { id: "waterline", label: "操作区", color: "rgba(88, 180, 255, 0.85)", rect: rectRatio(0, 0, 1, 0.94) }
        ]);
      },
      setup: function (layout, runtime) {
        var grove = layout.zoneMap.grove.rect;
        var tuning = getActiveLevelTuning() || {};
        var ignitionCount = Math.max(1, Math.round(tuning.initialIgnitionCount || 2));
        var minDist = Math.max(4, Math.round(tuning.initialIgnitionMinDistance || 10));
        var attempts = Math.max(200, Math.round(tuning.initialIgnitionAttempts || 1000));
        var chosen = [];
        var placed = 0;
        var i;
        var x;
        var y;
        var ok;
        var dx;
        var dy;
        var d2;
        var plantBeforeIgnition;
        var targetSoil;
        var soilCount;
        var stripAttempt;
  
        fillRect(rectRatio(0, 0.94, 1, 0.06), "rock", 1);
        fillTerrainBand("rock", 0.92, 0.02, 1);
  
        function countTypeInRect(rect, type) {
          var cx;
          var cy;
          var count = 0;
          var p;
          for (cy = rect.y; cy < rect.y + rect.h; cy += 1) {
            for (cx = rect.x; cx < rect.x + rect.w; cx += 1) {
              p = getCell(cx, cy);
              if (p && p.type === type) {
                count += 1;
              }
            }
          }
          return count;
        }
  
        // 草地覆盖画布约三分之二（草地用 plant 表示；本关植物不受重力）
        fillRect(grove, "plant", 1);
  
        // 土块总面积约为草地的五分之一，并呈不规则条带分布
        targetSoil = Math.max(1, Math.floor(grove.w * grove.h * 0.20));
        soilCount = 0;
        stripAttempt = 0;
        while (soilCount < targetSoil && stripAttempt < 36) {
          var points = [];
          var segments = randomRange(3, 6);
          var px = randomRange(grove.x + 2, grove.x + grove.w - 3);
          var py = randomRange(grove.y + 2, grove.y + grove.h - 3);
          var s;
          var stepX;
          var stepY;
          points.push({ x: px, y: py });
          for (s = 0; s < segments; s += 1) {
            stepX = randomRange(-Math.floor(grove.w * 0.16), Math.floor(grove.w * 0.16));
            stepY = randomRange(-Math.floor(grove.h * 0.10), Math.floor(grove.h * 0.10));
            px = clamp(px + stepX, grove.x + 1, grove.x + grove.w - 2);
            py = clamp(py + stepY, grove.y + 1, grove.y + grove.h - 2);
            points.push({ x: px, y: py });
          }
          drawMaterialPath(points, randomRange(2, 5), "soil", 1);
          soilCount = countTypeInRect(grove, "soil");
          stripAttempt += 1;
        }
  
        // 记录点火前草地（植物）数量，用于“保住一半植物”的胜利判定
        plantBeforeIgnition = countTypeInRect(grove, "plant");
  
        // 开局随机点燃多处植物（全图散点，避免过度聚集）
        for (i = 0; i < attempts && placed < ignitionCount; i += 1) {
          x = randomRange(grove.x, grove.x + grove.w - 1);
          y = randomRange(grove.y, grove.y + grove.h - 1);
          if (!inBounds(x, y)) {
            continue;
          }
          if (!getCell(x, y) || getCell(x, y).type !== "plant") {
            continue;
          }
          ok = true;
          for (var j = 0; j < chosen.length; j += 1) {
            dx = chosen[j].x - x;
            dy = chosen[j].y - y;
            d2 = (dx * dx) + (dy * dy);
            if (d2 < (minDist * minDist)) {
              ok = false;
              break;
            }
          }
          if (!ok) {
            continue;
          }
          chosen.push({ x: x, y: y });
          igniteCell(x, y, "normal");
          if (chance(0.35)) {
            spawnParticleNearby(x, y, "smoke", 3);
          }
          placed += 1;
        }
  
        // 过关要求：保住至少一半植物
        runtime.targets.plants = Math.max(1, Math.floor(plantBeforeIgnition * 0.5));
      },
      evaluate: function (stats, runtime) {
        var fireLeft = getGlobalTypeCount(stats, ["fire", "ember"]);
        var plantLeft = getZoneTypeCount(stats, "grove", "plant");
        var plantRatio = runtime.targets.plants > 0 ? plantLeft / runtime.targets.plants : 1;
        return {
          complete: fireLeft <= 1 && plantLeft >= runtime.targets.plants,
          bannerTitle: "林火扑灭",
          bannerBody: "树林已经稳住了，继续去做一次轻松的降温练习。",
          celebrationTitle: "灭火成功",
          celebrationBody: "第一关顺顺利利过了，保持这个节奏就很好。",
          objectives: [
            {
              done: fireLeft <= 1,
              label: "把火势压到几乎熄灭",
              detail: "剩余 " + fireLeft,
              ratio: fireLeft <= 1 ? 1 : clampRatio(1 - fireLeft / 64)
            },
            {
              done: plantLeft >= runtime.targets.plants,
              label: "保住至少一半植物",
              detail: plantLeft + " / " + runtime.targets.plants,
              ratio: clampRatio(plantRatio)
            }
          ]
        };
      }
    },
    {
      title: "第 2 关 冷却熔岩",
      subtitle: "把熔岩池慢慢冷却成岩石，留一点残余也没关系。",
      tags: ["冷却", "凝固", "火山盆地"],
      allowedMaterials: ["water", "ice", "rain"],
      starterMaterial: "water",
      tuning: {
        iceLavaReactionMultiplier: 10
      },
      buildLayout: function () {
        return createLayout([
          { id: "basin", label: "冷却池", color: "rgba(255, 160, 70, 0.9)", rect: rectRatio(0.31, 0.53, 0.34, 0.16) },
          { id: "spill", label: "高温区", color: "rgba(255, 220, 110, 0.75)", rect: rectRatio(0.18, 0.30, 0.56, 0.40) }
        ]);
      },
      setup: function (layout, runtime) {
        var basin = layout.zoneMap.basin.rect;
        var wall = expandRect(basin, 6, 5);
        fillRect(rectRatio(0, 0.92, 1, 0.08), "rock", 1);
        fillTerrainBand("rock", 0.79, 0.06, 1);
        fillTerrainBand("ash", 0.70, 0.04, 0.44, 0.12, 0.88);
        fillCone(0.50, 0.89, 0.22, 0.31, "rock", 1);
        outlineRect(wall, "rock", 3);
        clearRect(basin);
        fillRect(basin, "lava", 0.78);
        drawMaterialPath([
          { x: Math.floor(cols * 0.50), y: Math.floor(rows * 0.34) },
          { x: Math.floor(cols * 0.52), y: Math.floor(rows * 0.46) },
          { x: Math.floor(cols * 0.56), y: Math.floor(rows * 0.56) }
        ], Math.max(3, Math.floor(cols * 0.018)), "lava", 0.95);
        fillEllipse(cols * 0.50, rows * 0.29, Math.max(9, Math.floor(cols * 0.06)), Math.max(3, Math.floor(rows * 0.03)), "smoke", 0.34);
        fillEllipse(cols * 0.68, rows * 0.77, Math.max(8, Math.floor(cols * 0.08)), Math.max(4, Math.floor(rows * 0.05)), "ice", 0.95);
        fillEllipse(cols * 0.24, rows * 0.79, Math.max(7, Math.floor(cols * 0.07)), Math.max(4, Math.floor(rows * 0.05)), "ice", 0.92);
        fillRect(rectRatio(0.44, 0.77, 0.10, 0.05), "ice", 0.88);
        scatterClusters(rectRatio(0.16, 0.62, 0.70, 0.18), "rock", 12, 2, 4, 0.64);
        runtime.targets.rock = Math.max(72, Math.floor(basin.w * basin.h * 0.34));
        runtime.targets.lavaMax = Math.max(18, Math.floor(basin.w * basin.h * 0.18));
      },
      evaluate: function (stats, runtime) {
        var rockCount = getZoneTypeCount(stats, "basin", "rock");
        var lavaCount = getZoneTypeCount(stats, "basin", "lava");
        return {
          complete: rockCount >= runtime.targets.rock && lavaCount <= runtime.targets.lavaMax,
          bannerTitle: "熔岩已经凝固",
          bannerBody: "降温做得很稳，下一关只要把封堵区炸开一个缺口就行。",
          celebrationTitle: "冷却完成",
          celebrationBody: "温度控制得很好，这一关也拿下了。",
          objectives: [
            {
              done: rockCount >= runtime.targets.rock,
              label: "让冷却池生成足够岩石",
              detail: rockCount + " / " + runtime.targets.rock,
              ratio: clampRatio(rockCount / runtime.targets.rock)
            },
            {
              done: lavaCount <= runtime.targets.lavaMax,
              label: "控制残余熔岩数量",
              detail: lavaCount + " / " + runtime.targets.lavaMax,
              ratio: clampRatio(1 - lavaCount / Math.max(1, runtime.targets.lavaMax * 3))
            }
          ]
        };
      }
    },
    {
      title: "第 3 关 定向爆破",
      subtitle: "用火药或炸药炸开封堵区，打出一个明显缺口就能过关。",
      tags: ["爆破", "清障", "峡谷工地"],
      allowedMaterials: ["fire", "gunpowder", "explosive"],
      starterMaterial: "explosive",
      buildLayout: function () {
        return createLayout([
          { id: "breach", label: "爆破口", color: "rgba(255, 118, 84, 0.9)", rect: rectRatio(0.45, 0.30, 0.14, 0.30) },
          { id: "staging", label: "布药区", color: "rgba(255, 210, 120, 0.75)", rect: rectRatio(0.29, 0.22, 0.28, 0.46) }
        ]);
      },
      setup: function (layout, runtime) {
        var breach = layout.zoneMap.breach.rect;
        fillRect(rectRatio(0, 0.92, 1, 0.08), "rock", 1);
        fillTerrainBand("rock", 0.79, 0.05, 1);
        fillTerrainBand("soil", 0.71, 0.04, 0.36, 0.10, 0.90);
        outlineRect(rectRatio(0.22, 0.18, 0.52, 0.50), "rock", 3);
        fillRect(breach, "soil", 0.64);
        fillRect(expandRect(breach, 4, 3), "sand", 0.22);
        fillRect(rectRatio(0.22, 0.61, 0.14, 0.08), "rock", 0.96);
        fillRect(rectRatio(0.30, 0.50, 0.10, 0.06), "gunpowder", 0.36);
        fillRect(rectRatio(0.35, 0.43, 0.08, 0.05), "explosive", 0.18);
        scatterClusters(rectRatio(0.20, 0.60, 0.56, 0.18), "rock", 10, 2, 4, 0.58);
        scatterClusters(rectRatio(0.26, 0.36, 0.22, 0.18), "ash", 8, 2, 3, 0.28);
        runtime.targets.softLeft = Math.max(36, Math.floor(breach.w * breach.h * 0.28));
      },
      evaluate: function (stats, runtime) {
        var softLeft = getZoneTypeCount(stats, "breach", ["soil", "sand", "plant", "gunpowder", "explosive"]);
        var explosions = runtime.counters.explosions;
        return {
          complete: softLeft <= runtime.targets.softLeft && explosions >= 1,
          bannerTitle: "爆破任务完成",
          bannerBody: "缺口已经打开，最后只要轻松守住花园就能全部通关。",
          celebrationTitle: "爆破成功",
          celebrationBody: "开口打出来了，距离全通只差最后一步。",
          objectives: [
            {
              done: explosions >= 1,
              label: "至少触发一次有效爆炸",
              detail: explosions + " 次",
              ratio: clampRatio(explosions / 1)
            },
            {
              done: softLeft <= runtime.targets.softLeft,
              label: "清理爆破口中的软质阻挡",
              detail: "剩余 " + softLeft + " / " + runtime.targets.softLeft,
              ratio: clampRatio(1 - softLeft / Math.max(1, runtime.targets.softLeft * 5))
            }
          ]
        };
      }
    },
    {
      title: "第 4 关 酸蚀隔离",
      subtitle: "酸液会腐蚀薄弱区域，先封堵通道，再稳稳守住花园。",
      tags: ["防守", "隔离酸液", "山谷花园"],
      allowedMaterials: ["rock", "metal"],
      starterMaterial: "metal",
      buildLayout: function () {
        return createLayout([
          { id: "reservoir", label: "酸液池", color: "rgba(162, 255, 92, 0.9)", rect: rectRatio(0.08, 0.19, 0.22, 0.18) },
          { id: "choke", label: "封堵口", color: "rgba(255, 214, 120, 0.85)", rect: rectRatio(0.45, 0.49, 0.12, 0.10) },
          { id: "garden", label: "花园", color: "rgba(102, 226, 141, 0.9)", rect: rectRatio(0.64, 0.42, 0.24, 0.24) }
        ]);
      },
      setup: function (layout, runtime) {
        var reservoir = layout.zoneMap.reservoir.rect;
        var choke = layout.zoneMap.choke.rect;
        var garden = layout.zoneMap.garden.rect;
        var corridor = rectRatio(0.28, 0.50, 0.42, 0.10);
        fillRect(rectRatio(0, 0.92, 1, 0.08), "rock", 1);
        fillTerrainBand("soil", 0.75, 0.05, 0.94);
        fillTerrainBand("rock", 0.92, 0.02, 1);
        outlineRect(expandRect(reservoir, 4, 4), "rock", 3);
        outlineRect(expandRect(corridor, 2, 2), "rock", 2);
        clearRect(corridor);
        fillRect(reservoir, "acid", 0.82);
        fillRect(choke, "soil", 1);
        fillRect(expandRect(garden, 6, 2), "soil", 0.22);
        scatterClusters(garden, "plant", 15, 2, 4, 0.74);
        scatterClusters(expandRect(garden, 4, 2), "root", 10, 2, 3, 0.44);
        scatterClusters(expandRect(garden, 4, 2), "seed", 10, 1, 2, 0.28);
        fillEllipse(cols * 0.79, rows * 0.66, Math.max(8, Math.floor(cols * 0.08)), Math.max(4, Math.floor(rows * 0.05)), "water", 0.94);
        fillEllipse(cols * 0.79, rows * 0.65, Math.max(4, Math.floor(cols * 0.05)), Math.max(2, Math.floor(rows * 0.024)), "algae", 0.26);
        scatterClusters(rectRatio(0.64, 0.61, 0.22, 0.10), "worm", 7, 1, 2, 0.30);
        runtime.targets.gardenPlants = Math.max(90, Math.floor(garden.w * garden.h * 0.18));
        runtime.targets.safeHold = 7.5;
        runtime.safeHold = 0;
      },
      evaluate: function (stats, runtime) {
        var acidInGarden = getZoneTypeCount(stats, "garden", "acid");
        var plants = getZoneTypeCount(stats, "garden", "plant");
        if (acidInGarden === 0 && plants >= runtime.targets.gardenPlants) {
          runtime.safeHold += stats.deltaSeconds;
        } else {
          runtime.safeHold = 0;
        }
        return {
          complete: runtime.safeHold >= runtime.targets.safeHold,
          bannerTitle: "全任务完成",
          bannerBody: "你已经完成全部闯关目标。现在可以继续沙盒实验，或反复挑战任意关卡。",
          celebrationTitle: "全部通关",
          celebrationBody: "这次闯关很稳，四关都顺利拿下了。",
          objectives: [
            {
              done: acidInGarden === 0,
              label: "不让酸液进入花园",
              detail: acidInGarden === 0 ? "花园安全" : "侵入 " + acidInGarden,
              ratio: acidInGarden === 0 ? 1 : 0
            },
            {
              done: plants >= runtime.targets.gardenPlants,
              label: "保住足够多的植物",
              detail: plants + " / " + runtime.targets.gardenPlants,
              ratio: clampRatio(plants / runtime.targets.gardenPlants)
            },
            {
              done: runtime.safeHold >= runtime.targets.safeHold,
              label: "连续稳定防守一段时间",
              detail: runtime.safeHold.toFixed(1) + " / " + runtime.targets.safeHold + " 秒",
              ratio: clampRatio(runtime.safeHold / runtime.targets.safeHold)
            }
          ]
        };
      }
    }
  ];

  return {
    EXPLORE_MAPS,
    LEVELS,
    syncGeometry
  };
}
