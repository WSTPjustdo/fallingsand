export class UIManager {
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
