export class CanvasRenderer {
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
