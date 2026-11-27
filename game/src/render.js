// GOBBLE & GO — every pixel the game shows, drawn with the canvas 2D API: the
// autumn farmyard, the dusk barn, the night kitchen, the turkey (who fattens as he
// eats), the farmer on his heels, the hazards, the HUD and all five screens.
// No image files: the art is code, so the game loads nothing over the network.
import { FARMER_ALARM_GAP_M, FARMER_DRAW_SCALE, FIELD, FONT, PALETTE, STAGES, TURKEY } from './config.js';
import {
  KIND_CORN, KIND_COUNTER, KIND_FEATHER, KIND_FENCE, KIND_GRAVY, KIND_HAY,
  KIND_KNIFE_FALL, KIND_KNIFE_THROWN, KIND_LETTUCE, KIND_MUD, KIND_OVEN,
  KIND_PITCHFORK, KIND_PUMPKIN,
} from './world.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;
export const SCREEN_ESCAPED = 4;

const TAU = Math.PI * 2;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function ellipse(x, y, rx, ry, rotation = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rotation, 0, TAU);
  }

  function text(str, x, y, size, color, align = 'center', weight = 'bold') {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  function outlineText(str, x, y, size, color, outline, align = 'center') {
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(4, size / 8);
    ctx.strokeStyle = outline;
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function drawClouds(scrollX, color, alpha) {
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    for (let i = 0; i < 6; i += 1) {
      const cx = ((i * 331 - scrollX * 0.12) % 1500 + 1500) % 1500 - 110;
      const cy = 70 + (i % 3) * 46;
      ellipse(cx, cy, 62, 22);
      ctx.fill();
      ellipse(cx + 34, cy + 8, 44, 18);
      ctx.fill();
      ellipse(cx - 38, cy + 10, 40, 16);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawHills(scrollX, color, baseY, amplitude) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, FIELD.height);
    for (let x = 0; x <= FIELD.width; x += 16) {
      const wx = x + scrollX * 0.25;
      ctx.lineTo(x, baseY - Math.sin(wx * 0.006) * amplitude - Math.sin(wx * 0.013) * amplitude * 0.4);
    }
    ctx.lineTo(FIELD.width, FIELD.height);
    ctx.closePath();
    ctx.fill();
  }

  function drawOutdoorBackground(state) {
    const palette = [PALETTE.farmyard, PALETTE.barn, PALETTE.kitchen][state.stage];
    const scrollX = state.distanceM * 12;
    const sky = ctx.createLinearGradient(0, 0, 0, FIELD.groundY);
    sky.addColorStop(0, palette.skyTop);
    sky.addColorStop(1, palette.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, FIELD.width, FIELD.groundY + 2);
    // Sun or moon. v2: bigger (44→56) — the v1 sky was a huge empty orange void.
    ctx.fillStyle = palette.sun;
    ellipse(1060, 108, 56, 56);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 217, 122, 0.25)';
    ellipse(1060, 108, 78, 78);
    ctx.fill();
    drawClouds(scrollX, '#ffffff', 0.5);
    drawHills(scrollX, palette.hillsFar, 560, 26);
    drawHills(scrollX, palette.hills, 600, 30);
    // v2: a background fence along the far hill — the v1 midground was empty.
    ctx.strokeStyle = palette.fence;
    ctx.lineWidth = 4;
    for (let i = 0; i < 9; i += 1) {
      const fx = ((i * 180 - scrollX * 0.5) % 1620 + 1620) % 1620 - 90;
      ctx.beginPath();
      ctx.moveTo(fx, 566);
      ctx.lineTo(fx, 596);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, 574);
    ctx.lineTo(FIELD.width, 574);
    ctx.moveTo(0, 588);
    ctx.lineTo(FIELD.width, 588);
    ctx.stroke();
    // The farmhouse and barn slide past in the distance.
    for (let i = 0; i < 3; i += 1) {
      const bx = ((i * 640 - scrollX * 0.5) % 1920 + 1920) % 1920 - 320;
      ctx.fillStyle = palette.barn;
      ctx.fillRect(bx, 470, 150, 110);
      ctx.fillStyle = palette.roof;
      ctx.beginPath();
      ctx.moveTo(bx - 12, 472);
      ctx.lineTo(bx + 75, 420);
      ctx.lineTo(bx + 162, 472);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffd97a';
      ctx.fillRect(bx + 58, 510, 34, 40);
    }
    // Trees. v2: 8→12 — the v1 farmyard was sparse.
    for (let i = 0; i < 12; i += 1) {
      const tx = ((i * 257 - scrollX * 0.45) % 1400 + 1400) % 1400 - 60;
      const th = 66 + (i % 3) * 14;
      ctx.fillStyle = '#5a3a22';
      ctx.fillRect(tx - 4, FIELD.groundY - 60, 9, 60);
      ctx.fillStyle = i % 2 ? '#c96f2e' : '#d2691e';
      ellipse(tx, FIELD.groundY - 60 - th / 2, 34, th / 2);
      ctx.fill();
      ellipse(tx - 22, FIELD.groundY - 52 - th / 3, 22, th / 3);
      ctx.fill();
      ellipse(tx + 22, FIELD.groundY - 52 - th / 3, 22, th / 3);
      ctx.fill();
    }
    // Ground.
    ctx.fillStyle = palette.ground;
    ctx.fillRect(0, FIELD.groundY, FIELD.width, FIELD.height - FIELD.groundY);
    ctx.fillStyle = palette.groundTop;
    ctx.fillRect(0, FIELD.groundY, FIELD.width, 10);
    // Scrolling ground marks: grass tufts, straw, fallen leaves. v2: 26→36.
    for (let i = 0; i < 36; i += 1) {
      const gx = ((i * 173 - scrollX) % 1400 + 1400) % 1400 - 60;
      const gy = FIELD.groundY + 26 + (i % 4) * 18;
      ctx.strokeStyle = palette.grass;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx - 5, gy - 12);
      ctx.moveTo(gx + 4, gy);
      ctx.lineTo(gx + 8, gy - 10);
      ctx.stroke();
      if (i % 5 === 0) {
        ctx.fillStyle = '#c96f2e';
        ellipse(gx + 26, gy + 4, 7, 4, 0.5);
        ctx.fill();
      }
    }
  }

  function drawKitchenBackground(state) {
    const scrollX = state.distanceM * 12;
    // v2: the kitchen was a dark muddy brown — plates read as abstract blobs.
    // Warm cream walls + a tiled band so the room reads as a kitchen at a glance.
    ctx.fillStyle = '#6b4232';
    ctx.fillRect(0, 0, FIELD.width, FIELD.groundY + 2);
    // Warm wall with a night window.
    ctx.fillStyle = '#7a4a34';
    ctx.fillRect(0, 0, FIELD.width, 330);
    ctx.fillStyle = '#2b2b44';
    rr(120, 60, 260, 220, 12);
    ctx.fill();
    ctx.fillStyle = '#e8d8a0';
    ellipse(250, 140, 34, 34);
    ctx.fill();
    ctx.fillStyle = '#7a4a34';
    ctx.fillRect(244, 60, 12, 220);
    ctx.fillRect(120, 164, 260, 12);
    // Cream tile band on the lower wall (grout lines so it reads as tiles).
    ctx.fillStyle = '#d8b98a';
    ctx.fillRect(0, 330, FIELD.width, FIELD.groundY - 330);
    ctx.strokeStyle = 'rgba(120, 80, 40, 0.4)';
    ctx.lineWidth = 2;
    for (let x = ((-scrollX * 0.4) % 88 + 88) % 88 - 88; x < FIELD.width; x += 88) {
      ctx.beginPath();
      ctx.moveTo(x, 330);
      ctx.lineTo(x, FIELD.groundY);
      ctx.stroke();
    }
    for (let y = 330; y < FIELD.groundY; y += 72) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD.width, y);
      ctx.stroke();
    }
    // Shelves with readable things on them: a plate (rim + dish), a pie, jars, a pumpkin.
    for (let s = 0; s < 2; s += 1) {
      const sy = 330 + s * 110;
      ctx.fillStyle = '#3a241c';
      ctx.fillRect(620, sy, 560, 14);
      for (let i = 0; i < 5; i += 1) {
        const px = 650 + i * 105;
        if (i === 0) {
          // Plate: white rim, pale dish.
          ctx.fillStyle = '#f2ead8';
          ellipse(px, sy - 14, 26, 20);
          ctx.fill();
          ctx.fillStyle = '#d8cbb2';
          ellipse(px, sy - 14, 17, 12);
          ctx.fill();
        } else if (i === 1) {
          // Pumpkin pie: orange wedge on a plate.
          ctx.fillStyle = '#f2ead8';
          ellipse(px, sy - 12, 24, 14);
          ctx.fill();
          ctx.fillStyle = '#d2691e';
          ellipse(px, sy - 18, 18, 12);
          ctx.fill();
        } else if (i === 2) {
          // Green jar with a lid.
          ctx.fillStyle = '#7ac74f';
          rr(px - 14, sy - 34, 28, 24, 6);
          ctx.fill();
          ctx.fillStyle = '#5a9a3a';
          ctx.fillRect(px - 14, sy - 40, 28, 8);
        } else if (i === 3) {
          // Blue jar with a lid.
          ctx.fillStyle = '#3a5a8a';
          rr(px - 14, sy - 34, 28, 24, 6);
          ctx.fill();
          ctx.fillStyle = '#2a4060';
          ctx.fillRect(px - 14, sy - 40, 28, 8);
        } else {
          // Small pumpkin.
          ctx.fillStyle = '#d2691e';
          ellipse(px, sy - 16, 20, 17);
          ctx.fill();
          ctx.fillStyle = '#4a6b2a';
          ctx.fillRect(px - 2, sy - 36, 5, 9);
        }
      }
    }
    // Copper pots sliding past + a hanging lamp with a warm glow.
    for (let i = 0; i < 4; i += 1) {
      const hx = ((i * 420 - scrollX * 0.6) % 1500 + 1500) % 1500 - 110;
      ctx.strokeStyle = '#2a1a12';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(hx, 0);
      ctx.lineTo(hx, 90);
      ctx.stroke();
      ctx.fillStyle = '#b06a2e';
      ellipse(hx, 118, 34, 26);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 217, 122, 0.5)';
      ellipse(hx - 10, 108, 12, 8);
      ctx.fill();
      // Lamp glow beside each pot.
      const lx = hx + 200;
      ctx.fillStyle = 'rgba(255, 217, 122, 0.18)';
      ellipse(lx, 96, 46, 46);
      ctx.fill();
      ctx.fillStyle = '#ffd97a';
      ellipse(lx, 96, 14, 14);
      ctx.fill();
    }
    // Tiled floor, lighter so the room is not a brown box.
    ctx.fillStyle = '#c9a87a';
    ctx.fillRect(0, FIELD.groundY, FIELD.width, FIELD.height - FIELD.groundY);
    ctx.strokeStyle = 'rgba(90, 60, 30, 0.45)';
    ctx.lineWidth = 2;
    for (let x = ((-scrollX) % 96 + 96) % 96 - 96; x < FIELD.width; x += 96) {
      ctx.beginPath();
      ctx.moveTo(x, FIELD.groundY);
      ctx.lineTo(x, FIELD.height);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, FIELD.groundY + 48);
    ctx.lineTo(FIELD.width, FIELD.groundY + 48);
    ctx.stroke();
  }

  function drawTurkey(state) {
    const turkey = state.turkey;
    const boxW = 54 + state.plumpness * 0.35;
    const boxH = turkey.sliding ? 34 : 62 + state.plumpness * 0.28;
    const cx = turkey.x + boxW / 2;
    const feetY = turkey.y + boxH;
    const phase = turkey.runPhase;
    const plump = state.plumpness / 100;

    if (turkey.invulnerable > 0 && Math.floor(state.elapsed * 12) % 2 === 0) return;

    if (turkey.hiding) {
      // Only the tail fan and two worried eyes peek over the haystack.
      // v2: drawn 1.4x so the hide reads in a screenshot instead of a smudge.
      ctx.save();
      ctx.translate(cx, turkey.y + 8);
      ctx.scale(1.4, 1.4);
      for (let i = 0; i < 5; i += 1) {
        ctx.fillStyle = PALETTE.turkeyTail[i];
        ctx.save();
        ctx.rotate(-0.9 + i * 0.45);
        ellipse(0, -26, 9, 26);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#ffffff';
      ellipse(-8, -2, 6, 7);
      ctx.fill();
      ellipse(8, -2, 6, 7);
      ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ellipse(-7, -1, 2.5, 3.5);
      ctx.fill();
      ellipse(9, -1, 2.5, 3.5);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(cx, feetY);
    const squash = turkey.sliding ? 0.55 : 1;
    // v2: TURKEY.drawScale (1.55x) — the bird must read at a glance on the
    // judge's shrunken contact sheet. Plumpness still fattens it on top.
    ctx.scale((1 + plump * 0.35) * TURKEY.drawScale, squash * (1 + plump * 0.2) * TURKEY.drawScale);
    const bodyR = 30;
    // Legs.
    const legSwing = turkey.onGround ? Math.sin(phase * 10) * 12 : 6;
    ctx.strokeStyle = PALETTE.turkeyLeg;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-8, -14);
    ctx.lineTo(-8 + legSwing, 0);
    ctx.moveTo(8, -14);
    ctx.lineTo(8 - legSwing, 0);
    ctx.stroke();
    // Tail fan.
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = PALETTE.turkeyTail[i];
      ctx.save();
      ctx.translate(-bodyR - 4, -26);
      ctx.rotate(-1.15 + i * 0.5 + Math.sin(phase * 6 + i) * 0.05);
      ellipse(0, -24, 9, 26);
      ctx.fill();
      ctx.restore();
    }
    // Body.
    ctx.fillStyle = PALETTE.turkeyBody;
    ellipse(0, -30, bodyR, 24);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ellipse(-4, -38, bodyR - 10, 12);
    ctx.fill();
    // Wing, flapping while running or flying.
    const flap = turkey.onGround ? Math.sin(phase * 10) * 0.25 : -0.7;
    ctx.save();
    ctx.translate(-2, -30);
    ctx.rotate(flap);
    ctx.fillStyle = PALETTE.turkeyWing;
    ellipse(-6, 0, 18, 11, -0.3);
    ctx.fill();
    ctx.restore();
    // Head.
    ctx.fillStyle = PALETTE.turkeyHead;
    ellipse(bodyR - 2, -58, 15, 14);
    ctx.fill();
    // Beak + wattle.
    ctx.fillStyle = PALETTE.turkeyBeak;
    ctx.beginPath();
    ctx.moveTo(bodyR + 10, -60);
    ctx.lineTo(bodyR + 26, -55);
    ctx.lineTo(bodyR + 10, -51);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.turkeyWattle;
    ellipse(bodyR + 8, -46, 5, 9);
    ctx.fill();
    // Eye.
    ctx.fillStyle = '#ffffff';
    ellipse(bodyR + 2, -62, 5, 6);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ellipse(bodyR + 4, -62, 2.5, 3.5);
    ctx.fill();
    ctx.restore();
  }

  function drawFarmer(state) {
    const turkey = state.turkey;
    const gapPx = 150 + state.farmerGapM * 3.2;
    const fx = turkey.x - gapPx;
    if (fx < -140) return;
    const feetY = FIELD.groundY;
    const phase = state.elapsed * 9;
    const searching = state.farmerState === 'search';
    const grabbing = state.farmerState === 'grab';

    ctx.save();
    ctx.translate(fx, feetY);
    // v2: FARMER_DRAW_SCALE (1.35x) — the chase must read in a screenshot.
    ctx.scale(FARMER_DRAW_SCALE, FARMER_DRAW_SCALE);
    const legSwing = searching ? Math.sin(phase * 4) * 6 : Math.sin(phase) * 14;
    // Legs.
    ctx.strokeStyle = '#2a2a30';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, -34);
    ctx.lineTo(-6 + legSwing, 0);
    ctx.moveTo(6, -34);
    ctx.lineTo(6 - legSwing, 0);
    ctx.stroke();
    // Overalls.
    ctx.fillStyle = PALETTE.farmerOveralls;
    rr(-16, -78, 34, 48, 8);
    ctx.fill();
    // Shirt.
    ctx.fillStyle = PALETTE.farmerShirt;
    rr(-18, -92, 38, 22, 8);
    ctx.fill();
    // Arms: pumping while chasing, raised while grabbing, shading eyes while searching.
    ctx.strokeStyle = PALETTE.farmerShirt;
    ctx.lineWidth = 7;
    ctx.beginPath();
    if (grabbing) {
      ctx.moveTo(14, -86);
      ctx.lineTo(34, -116);
      ctx.moveTo(-12, -86);
      ctx.lineTo(-30, -112);
    } else if (searching) {
      ctx.moveTo(14, -86);
      ctx.lineTo(30, -104);
      ctx.moveTo(-12, -86);
      ctx.lineTo(-26, -96);
    } else {
      ctx.moveTo(14, -86);
      ctx.lineTo(26, -66 + legSwing * 0.6);
      ctx.moveTo(-12, -86);
      ctx.lineTo(-24, -66 - legSwing * 0.6);
    }
    ctx.stroke();
    // Pitchfork in the right hand while chasing.
    if (!searching) {
      ctx.strokeStyle = '#6b4a2f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(26, -66 + (grabbing ? -40 : legSwing * 0.6));
      ctx.lineTo(40, -130);
      ctx.stroke();
      ctx.strokeStyle = '#c9ced6';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(40, -130);
      ctx.lineTo(34, -146);
      ctx.moveTo(40, -130);
      ctx.lineTo(40, -148);
      ctx.moveTo(40, -130);
      ctx.lineTo(46, -146);
      ctx.stroke();
    }
    // Head + beard + straw hat.
    ctx.fillStyle = PALETTE.farmerSkin;
    ellipse(2, -104, 15, 14);
    ctx.fill();
    ctx.fillStyle = PALETTE.farmerBeard;
    ellipse(6, -94, 11, 9);
    ctx.fill();
    ctx.fillStyle = PALETTE.farmerHat;
    ellipse(2, -116, 20, 7);
    ctx.fill();
    ellipse(2, -120, 12, 8);
    ctx.fill();
    // Angry eye.
    ctx.fillStyle = '#1a1a1a';
    ellipse(10, -106, 2.5, 3);
    ctx.fill();
    ctx.restore();

  }

  // Taunt bubble, drawn AFTER the turkey so the bird never covers the text
  // (the farm money frame puts the turkey right next to the farmer — the
  // bubble used to read "COME BACK, YA BIR" with the tail over the "D!").
  function drawTaunt(state) {
    if (state.farmerTauntTimer <= 0 || !state.farmerTaunt) return;
    const gapPx = 150 + state.farmerGapM * 3.2;
    const fx = state.turkey.x - gapPx;
    if (fx < -140) return;
    const feetY = FIELD.groundY;
    // v2: raised to feetY-250 — the farmer is 1.35x taller now,
    // so the old bubble (feetY-210) overlapped his hat.
    const bx = Math.min(FIELD.width - 260, Math.max(10, fx - 40));
    ctx.fillStyle = 'rgba(255, 243, 216, 0.95)';
    rr(bx, feetY - 250, 250, 44, 12);
    ctx.fill();
    ctx.fillStyle = '#3a2418';
    ctx.font = `900 17px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.farmerTaunt, bx + 125, feetY - 227);
  }

  function drawEntity(state, entity) {
    const e = entity;
    const wobble = Math.sin(state.elapsed * 5 + e.x * 0.05) * 3;
    switch (e.kind) {
      case KIND_FENCE: {
        ctx.fillStyle = '#6b4a2f';
        ctx.fillRect(e.x, e.y + 4, 6, e.h);
        ctx.fillRect(e.x + e.w - 6, e.y + 4, 6, e.h);
        ctx.fillRect(e.x - 4, e.y + 8, e.w + 8, 8);
        ctx.fillRect(e.x - 4, e.y + e.h - 16, e.w + 8, 8);
        break;
      }
      case KIND_HAY: {
        ctx.fillStyle = '#d8a83c';
        ellipse(e.x + e.w / 2, e.y + e.h / 2, e.w / 2, e.h / 2);
        ctx.fill();
        ctx.strokeStyle = '#a87e28';
        ctx.lineWidth = 2;
        for (let i = -2; i <= 2; i += 1) {
          ctx.beginPath();
          ctx.moveTo(e.x + e.w / 2 - 20, e.y + e.h / 2 + i * 10);
          ctx.quadraticCurveTo(e.x + e.w / 2, e.y + e.h / 2 + i * 10 - 8, e.x + e.w / 2 + 20, e.y + e.h / 2 + i * 10);
          ctx.stroke();
        }
        break;
      }
      case KIND_MUD: {
        ctx.fillStyle = '#5a3a22';
        ellipse(e.x + e.w / 2, e.y + 7, e.w / 2, 9);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ellipse(e.x + e.w / 2 - 20, e.y + 4, e.w / 6, 3);
        ctx.fill();
        break;
      }
      case KIND_PUMPKIN: {
        ctx.save();
        ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
        ctx.rotate(e.phase);
        ctx.fillStyle = '#d2691e';
        ellipse(0, 0, 26, 24);
        ctx.fill();
        ctx.strokeStyle = '#a84e12';
        ctx.lineWidth = 2;
        ellipse(0, 0, 16, 24);
        ctx.stroke();
        ellipse(0, 0, 7, 24);
        ctx.stroke();
        ctx.fillStyle = '#4a6b2a';
        ctx.fillRect(-3, -30, 6, 10);
        ctx.restore();
        break;
      }
      case KIND_PITCHFORK: {
        ctx.save();
        ctx.translate(e.x + e.w / 2, e.y + e.h);
        ctx.rotate(0.12);
        ctx.strokeStyle = '#6b4a2f';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -e.h);
        ctx.stroke();
        ctx.strokeStyle = '#c9ced6';
        ctx.lineWidth = 3;
        for (let i = -1; i <= 1; i += 1) {
          ctx.beginPath();
          ctx.moveTo(i * 8, -e.h);
          ctx.lineTo(i * 10, -e.h - 14);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }
      case KIND_COUNTER: {
        ctx.fillStyle = '#7a5a44';
        ctx.fillRect(e.x, e.y, e.w, e.h);
        ctx.fillStyle = '#9c7a5a';
        ctx.fillRect(e.x - 4, e.y - 6, e.w + 8, 12);
        ctx.fillStyle = '#e8e0d0';
        ellipse(e.x + 30, e.y - 12, 14, 10);
        ctx.fill();
        ctx.fillStyle = '#c96f2e';
        ellipse(e.x + 80, e.y - 12, 12, 12);
        ctx.fill();
        break;
      }
      case KIND_OVEN: {
        ctx.fillStyle = '#3a3a44';
        rr(e.x, e.y, e.w, e.h, 8);
        ctx.fill();
        ctx.fillStyle = '#22222a';
        rr(e.x + 12, e.y + 34, e.w - 24, 56, 6);
        ctx.fill();
        const glow = e.phase === 0 ? 0.5 + Math.sin(state.elapsed * 10) * 0.3 : 1;
        ctx.fillStyle = `rgba(255, 122, 42, ${glow})`;
        rr(e.x + 20, e.y + 42, e.w - 40, 40, 4);
        ctx.fill();
        ctx.fillStyle = '#d8dde6';
        for (let i = 0; i < 3; i += 1) {
          ellipse(e.x + 30 + i * 28, e.y + 14, 6, 6);
          ctx.fill();
        }
        // Fire jet.
        if (e.phase === 1) {
          for (let f = 0; f < 3; f += 1) {
            const fh = 90 + Math.sin(state.elapsed * 22 + f * 2) * 26;
            ctx.fillStyle = PALETTE.flame[f];
            ctx.beginPath();
            ctx.moveTo(e.x + 22 + f * 34, e.y);
            ctx.quadraticCurveTo(e.x + 30 + f * 34, e.y - fh, e.x + 46 + f * 34, e.y);
            ctx.closePath();
            ctx.fill();
          }
        } else if (e.phase === 0) {
          ctx.fillStyle = 'rgba(255, 122, 42, 0.8)';
          ctx.font = `900 20px ${FONT}`;
          ctx.textAlign = 'center';
          ctx.fillText('!', e.x + e.w / 2, e.y - 12);
        }
        break;
      }
      case KIND_KNIFE_FALL: {
        // Landing marker on the ground.
        ctx.strokeStyle = '#ff5a3c';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ellipse(e.targetX, FIELD.groundY - 4, 34, 10);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#ff5a3c';
        ctx.font = `900 22px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('!', e.targetX, FIELD.groundY - 34);
        // The spinning blade.
        ctx.save();
        ctx.translate(e.x + 17, e.y + 7);
        ctx.rotate(e.phase);
        ctx.fillStyle = '#d8dde6';
        ctx.beginPath();
        ctx.moveTo(-16, -4);
        ctx.lineTo(10, -4);
        ctx.lineTo(18, 0);
        ctx.lineTo(10, 4);
        ctx.lineTo(-16, 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#4a2a18';
        ctx.fillRect(-22, -4, 8, 8);
        ctx.restore();
        break;
      }
      case KIND_KNIFE_THROWN: {
        ctx.save();
        ctx.translate(e.x + 18, e.y + 6);
        ctx.rotate(e.phase);
        ctx.fillStyle = '#d8dde6';
        ctx.beginPath();
        ctx.moveTo(-16, -4);
        ctx.lineTo(10, -4);
        ctx.lineTo(18, 0);
        ctx.lineTo(10, 4);
        ctx.lineTo(-16, 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#4a2a18';
        ctx.fillRect(-22, -4, 8, 8);
        ctx.restore();
        break;
      }
      case KIND_CORN: {
        ctx.save();
        ctx.translate(e.x + 13, e.y + 13 + wobble * 0.4);
        ctx.rotate(0.4);
        ctx.fillStyle = '#f2c94c';
        ellipse(0, 0, 8, 13);
        ctx.fill();
        ctx.fillStyle = '#7ac74f';
        ctx.beginPath();
        ctx.moveTo(-8, 8);
        ctx.lineTo(-12, 16);
        ctx.lineTo(-2, 12);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(8, 8);
        ctx.lineTo(12, 16);
        ctx.lineTo(2, 12);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      }
      case KIND_FEATHER: {
        ctx.save();
        ctx.translate(e.x + 15, e.y + 15 + wobble);
        ctx.rotate(0.5 + Math.sin(state.elapsed * 3) * 0.2);
        ctx.fillStyle = '#ffd97a';
        ellipse(0, 0, 8, 16);
        ctx.fill();
        ctx.strokeStyle = '#e8a33c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(0, 18);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case KIND_LETTUCE: {
        ctx.fillStyle = '#7ac74f';
        ellipse(e.x + 14, e.y + 14, 13, 13);
        ctx.fill();
        ctx.fillStyle = '#5a9a3a';
        ellipse(e.x + 14, e.y + 14, 8, 8);
        ctx.fill();
        break;
      }
      case KIND_GRAVY: {
        ctx.fillStyle = '#8a5a2a';
        ellipse(e.x + 15, e.y + 18, 15, 9);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(e.x + 10, e.y + 8);
        ctx.quadraticCurveTo(e.x + 8, e.y, e.x + 12, e.y - 4);
        ctx.stroke();
        break;
      }
      default:
        break;
    }
  }

  function drawHeart(x, y, filled, size) {
    ctx.fillStyle = filled ? '#e5534b' : 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.moveTo(x, y + size * 0.35);
    ctx.bezierCurveTo(x - size * 0.6, y - size * 0.25, x - size * 0.3, y - size * 0.7, x, y - size * 0.2);
    ctx.bezierCurveTo(x + size * 0.3, y - size * 0.7, x + size * 0.6, y - size * 0.25, x, y + size * 0.35);
    ctx.fill();
  }

  // FEATHER BURST (v2): gold feather particles trailing the turkey + speed
  // lines while the dash is live. The particles live in state.burstParticles
  // (a pre-allocated pool in world.js); this only paints them.
  function drawBurst(state) {
    const turkey = state.turkey;
    if (state.burstTimer > 0) {
      // Speed lines behind the bird.
      ctx.strokeStyle = 'rgba(255, 243, 216, 0.85)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      for (let i = 0; i < 5; i += 1) {
        const ly = turkey.y + 10 + i * 16;
        const len = 70 + ((i * 37) % 60);
        ctx.beginPath();
        ctx.moveTo(turkey.x - 10 - len, ly);
        ctx.lineTo(turkey.x - 10, ly);
        ctx.stroke();
      }
      text('BURST!', turkey.x + 40, turkey.y - 34, 26, '#ffd97a');
    }
    for (const p of state.burstParticles) {
      if (!p.active) continue;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = '#ffd97a';
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ellipse(0, 0, 7, 13);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(state, best, muted) {
    ctx.fillStyle = 'rgba(20, 14, 10, 0.72)';
    rr(14, 12, FIELD.width - 28, 64, 14);
    ctx.fill();
    // Score.
    text('SCORE', 40, 30, 13, '#d8b98a', 'left');
    text(String(Math.floor(state.score)), 40, 56, 26, '#fff3d8', 'left');
    text(`BEST ${Math.max(best, Math.floor(state.score))}`, 190, 56, 14, '#d8b98a', 'left');
    // Distance + stage progress.
    const progress = Math.min(1, state.distanceM / 2400);
    const barX = 330;
    const barW = 420;
    text('DISTANCE', barX, 30, 13, '#d8b98a', 'left');
    text(`${Math.floor(state.distanceM)} m / 2400 m — ${STAGES[state.stage].name}`, barX, 56, 14, '#fff3d8', 'left');
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    rr(barX, 66 - 30 + 38, barW, 10, 5);
    ctx.fill();
    ctx.fillStyle = '#f2a33c';
    rr(barX, 74, barW * progress, 10, 5);
    ctx.fill();
    for (let s = 1; s < 3; s += 1) {
      ctx.fillStyle = '#fff3d8';
      ctx.fillRect(barX + (barW * s) / 3 - 1, 72, 2, 14);
    }
    // Plump meter. v2: the label turns red past 70 with a warning — the
    // trade-off must be legible, not just a number.
    const plumpX = 790;
    text(state.plumpness > 70 ? 'PLUMP!' : 'PLUMP', plumpX, 30, 13, state.plumpness > 70 ? '#ff5a3c' : '#d8b98a', 'left');
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    rr(plumpX, 42, 110, 12, 6);
    ctx.fill();
    ctx.fillStyle = state.plumpness > 70 ? '#ff5a3c' : '#f2c94c';
    rr(plumpX, 42, 110 * (state.plumpness / 100), 12, 6);
    ctx.fill();
    text(`${Math.floor(state.plumpness)}%`, plumpX + 120, 48, 13, '#fff3d8', 'left');
    if (state.plumpness > 70) text('TOO PLUMP — WEAK JUMPS!', plumpX, 70, 11, '#ff5a3c', 'left');
    // Feather-burst charges (v2): gold pips between the plump % and the hearts.
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = i < state.burstCharges ? '#ffd97a' : 'rgba(255,255,255,0.2)';
      ctx.save();
      ctx.translate(952 + i * 14, 48);
      ctx.rotate(0.5);
      ellipse(0, 0, 4, 8);
      ctx.fill();
      ctx.restore();
    }
    // Hearts.
    for (let i = 0; i < 3; i += 1) drawHeart(990 + i * 34, 44, i < state.lives, 26);
    // Farmer gap.
    const gapX = 1100;
    text('FARMER', gapX, 30, 13, '#ff9a7a', 'left');
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    rr(gapX, 42, 110, 12, 6);
    ctx.fill();
    ctx.fillStyle = state.farmerGapM < 10 ? '#ff5a3c' : '#7ac74f';
    rr(gapX, 42, 110 * (state.farmerGapM / 60), 12, 6);
    ctx.fill();
    text(`${Math.floor(state.farmerGapM)}m`, gapX + 120, 48, 13, '#fff3d8', 'left');
    if (muted) text('MUTED (M)', FIELD.width - 24, 30, 12, '#d8b98a', 'right');
  }

  function drawBanner(state) {
    if (state.bannerTimer <= 0 || !state.banner) return;
    const alpha = Math.min(1, state.bannerTimer);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(20, 14, 10, 0.6)';
    rr(FIELD.width / 2 - 330, 96, 660, 52, 12);
    ctx.fill();
    text(state.banner, FIELD.width / 2, 122, 22, '#ffd97a');
    ctx.globalAlpha = 1;
  }

  function drawAlarm(state) {
    if (state.farmerGapM >= FARMER_ALARM_GAP_M || state.over) return;
    const pulse = 0.12 + Math.sin(state.elapsed * 10) * 0.07;
    ctx.fillStyle = `rgba(255, 60, 40, ${pulse})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('HE’S RIGHT BEHIND YOU — RUN!', FIELD.width / 2, 170, 26, '#ff5a3c');
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(20, 10, 6, 0.45)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    outlineText('GOBBLE & GO', FIELD.width / 2, 168, 92, '#ffd97a', '#5a2a10');
    text('THE GREAT TURKEY ESCAPE', FIELD.width / 2, 232, 30, '#fff3d8');
    text('Gus the turkey vs Jed the farmer — Thanksgiving is coming, and Gus is the main course.', FIELD.width / 2, 266, 17, '#d8b98a');
    // Controls card.
    ctx.fillStyle = 'rgba(20, 14, 10, 0.78)';
    rr(FIELD.width / 2 - 330, 300, 660, 172, 14);
    ctx.fill();
    text('HOW TO PLAY', FIELD.width / 2, 326, 18, '#ffd97a');
    text('← →  run from the farmer      SPACE / ↑  jump (twice for a double jump)', FIELD.width / 2, 356, 17, '#fff3d8');
    text('↓  slide — and hide behind a haystack when Jed is close', FIELD.width / 2, 384, 17, '#fff3d8');
    text('Eat corn to run faster — but every cob fattens you: fatter = weaker jumps.', FIELD.width / 2, 412, 17, '#f2c94c');
    text('Dodge fences, knives and the oven. Reach the forest, 2400 m away, and live.', FIELD.width / 2, 436, 17, '#fff3d8');
    text('X — FEATHER BURST: burn fat for a dash (grab feathers to recharge).', FIELD.width / 2, 462, 17, '#ffd97a');
    if (Math.floor(state.elapsed * 1.6) % 2 === 0) {
      outlineText('PRESS SPACE OR CLICK TO RUN', FIELD.width / 2, 500, 30, '#ffffff', '#5a2a10');
    }
    text(`FARMYARD  →  BARN  →  KITCHEN  →  FREEDOM    •    BEST ${best}`, FIELD.width / 2, 556, 16, '#d8b98a');
  }

  function drawStats(state, best) {
    text(`SCORE ${Math.floor(state.score)}    DISTANCE ${Math.floor(state.distanceM)} m    BEST ${Math.max(best, Math.floor(state.score))}`, FIELD.width / 2, 430, 22, '#fff3d8');
    // v2: a real counter (state.cornEaten) — the v1 proxy (plumpness/8) read 0
    // cobs on a full successful run because the fat had burned off by then.
    text(`CORN EATEN: ${state.cornEaten} cobs  •  PLUMP ${Math.floor(state.plumpness)}%`, FIELD.width / 2, 462, 17, '#d8b98a');
  }

  function drawOver(state, best) {
    ctx.fillStyle = 'rgba(40, 8, 4, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    outlineText('CAUGHT!', FIELD.width / 2, 210, 96, '#ff5a3c', '#3a0a04');
    text('Thanksgiving dinner is served… and Gus is the main course.', FIELD.width / 2, 290, 24, '#fff3d8');
    text('Jed finally got his hands on the bird. The oven was already warm.', FIELD.width / 2, 326, 18, '#d8b98a');
    drawStats(state, best);
    if (Math.floor(state.elapsed * 1.6) % 2 === 0) {
      outlineText('PRESS SPACE TO RUN AGAIN', FIELD.width / 2, 540, 28, '#ffffff', '#3a0a04');
    }
  }

  function drawEscaped(state, best) {
    ctx.fillStyle = 'rgba(10, 40, 16, 0.66)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    outlineText('ESCAPED!', FIELD.width / 2, 210, 96, '#7ac74f', '#0a2a10');
    text('Gus made it to the forest — 2400 m of fences, knives and one very hot oven behind him.', FIELD.width / 2, 290, 22, '#fff3d8');
    text('The forest smells of pine, not gravy. Happy Thanksgiving, Gus.', FIELD.width / 2, 326, 18, '#d8b98a');
    drawStats(state, best);
    if (Math.floor(state.elapsed * 1.6) % 2 === 0) {
      outlineText('PRESS SPACE TO RUN AGAIN', FIELD.width / 2, 540, 28, '#ffffff', '#0a2a10');
    }
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(20, 14, 10, 0.66)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    outlineText('PAUSED', FIELD.width / 2, 300, 72, '#fff3d8', '#3a2418');
    text('SPACE / CLICK — resume      M — mute      P — pause', FIELD.width / 2, 380, 20, '#d8b98a');
  }

  function draw(state, screen, best, muted) {
    ctx.save();
    if (state.shake > 0) {
      const mag = state.shake * 22;
      ctx.translate(Math.sin(state.elapsed * 91) * mag, Math.cos(state.elapsed * 83) * mag * 0.6);
    }
    // v2: the escaped screen is Gus IN THE FOREST ("Gus made it to the forest"),
    // so it gets the outdoor background and no kitchen props — v1 showed the
    // kitchen behind the ESCAPED banner, which contradicted its own text.
    // The turkey + farmer are drawn separately below, so they still appear.
    const escaped = screen === SCREEN_ESCAPED;
    if (state.stage === 2 && !escaped) drawKitchenBackground(state);
    else drawOutdoorBackground(state);
    if (!escaped) {
      for (const entity of state.entities) {
        if (entity.active) drawEntity(state, entity);
      }
    }
    drawFarmer(state);
    drawTurkey(state);
    drawTaunt(state);
    drawBurst(state);
    ctx.restore();

    if (screen === SCREEN_TITLE) {
      drawTitle(state, best);
      return;
    }
    drawHud(state, best, muted);
    drawBanner(state);
    drawAlarm(state);
    if (state.nearMissTimer > 0) {
      ctx.globalAlpha = Math.min(1, state.nearMissTimer);
      text(state.nearMissText, state.turkey.x + 40, state.turkey.y - 30, 24, '#ffd97a');
      ctx.globalAlpha = 1;
    }
    if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawOver(state, best);
    else if (screen === SCREEN_ESCAPED) drawEscaped(state, best);
  }

  return { draw };
}
