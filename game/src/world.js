// GOBBLE & GO — the game's rules and state, with no drawing and no browser in it:
// the turkey (run, jump, double jump, slide, hide, plumpness), the farmer who chases,
// herds and searches, the obstacles and pickups of three stages, collisions, score,
// lives and the escape. step() advances one fixed step and returns what happened as
// bit flags, so the caller can react without the world knowing about screens or sound.
// Nothing here allocates after createWorld returns, and every random choice comes from
// the seeded generator, so one seed always plays the same run.
//
// The farmer's gap is the turkey's screen position: the turkey runs left and right
// between x=140 (the farmer's hands) and x=620 (a safe lead), while the farmer's
// pressure drifts it back. Eating corn fattens the bird — faster scroll, weaker jump,
// slower turns, a bigger target — so every corn is a choice.
import {
  BURST, ESCAPE_DISTANCE_M, FARMER_MAX_GAP_M, FARMER_TAUNTS,
  FIELD, HIDE, KNIFE, LIVES, OBSTACLE, OVEN_JET, PLUMP, PX_PER_M, SCORE,
  STAGE_LENGTH_M, STAGES, TURKEY,
} from './config.js';

export const KIND_FENCE = 0;
export const KIND_HAY = 1;
export const KIND_MUD = 2;
export const KIND_PUMPKIN = 3;
export const KIND_PITCHFORK = 4;
export const KIND_COUNTER = 5;
export const KIND_OVEN = 6;
export const KIND_KNIFE_FALL = 7;
export const KIND_KNIFE_THROWN = 8;
export const KIND_CORN = 9;
export const KIND_FEATHER = 10;
export const KIND_LETTUCE = 11;
export const KIND_GRAVY = 12;

export const EVENT_HIT = 1;
export const EVENT_CORN = 2;
export const EVENT_OVER = 4;
export const EVENT_ESCAPED = 8;
export const EVENT_HIDE = 16;
export const EVENT_STAGE = 32;
export const EVENT_NEAR = 64;
export const EVENT_FOUND = 128;
export const EVENT_FEATHER = 256;
export const EVENT_BURST = 512;

const POOL_SIZE = 96;
const BURST_PARTICLES = 24;

/** Metres of farmer gap per pixel of screen lead. */
const GAP_PX_PER_M = 8;

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function createWorld(random) {
  const turkey = {
    x: 300, y: 0, vx: 0, vy: 0, jumps: 0, onGround: true,
    sliding: false, slideTimer: 0, hiding: false, hideTimer: 0,
    invulnerable: 0, runPhase: 0, inMud: false,
  };
  const entities = [];
  for (let index = 0; index < POOL_SIZE; index += 1) {
    entities.push({
      active: false, kind: KIND_FENCE, x: 0, y: 0, w: 0, h: 0,
      vx: 0, vy: 0, t: 0, phase: 0, scored: false, targetX: 0, startX: 0, startY: 0,
    });
  }
  const burstParticles = [];
  for (let index = 0; index < BURST_PARTICLES; index += 1) {
    burstParticles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, rot: 0 });
  }
  const state = {
    turkey, entities, burstParticles,
    distanceM: 0, score: 0, lives: LIVES, plumpness: 0,
    farmerGapM: 20, farmerState: 'chase',
    farmerTaunt: '', farmerTauntTimer: 0, tauntTimer: 5,
    stage: 0, speed: TURKEY.baseSpeed, elapsed: 0,
    spawnTimer: 1.2, knifeTimer: KNIFE.throwInterval, lettuceTimer: 22, gravyTimer: 38,
    banner: '', bannerTimer: 0, shake: 0, over: false, escaped: false, overReason: '',
    nearMissText: '', nearMissTimer: 0,
    // v2: the burst economy + a real corn counter (the v1 escaped screen
    // derived "corn eaten" from plumpness and read 0 on a full run).
    cornEaten: 0, burstCharges: 1, burstTimer: 0, burstCooldown: 0,
  };

  function turkeyBox() {
    const w = TURKEY.baseWidth + state.plumpness * TURKEY.widthPerPlump;
    const h = turkey.sliding
      ? 34
      : TURKEY.baseHeight + state.plumpness * TURKEY.heightPerPlump;
    return { x: turkey.x, y: turkey.y, w, h };
  }

  function jumpVelocity() {
    return TURKEY.baseJumpVelocity - state.plumpness * TURKEY.jumpLossPerPlump;
  }

  function syncFarmerGap() {
    state.farmerGapM = Math.max(
      0,
      Math.min(FARMER_MAX_GAP_M, (turkey.x - TURKEY.minX) / GAP_PX_PER_M),
    );
  }

  function reset() {
    turkey.x = 300;
    turkey.y = FIELD.groundY - TURKEY.baseHeight;
    turkey.vx = 0;
    turkey.vy = 0;
    turkey.jumps = 0;
    turkey.onGround = true;
    turkey.sliding = false;
    turkey.slideTimer = 0;
    turkey.hiding = false;
    turkey.hideTimer = 0;
    turkey.invulnerable = 0;
    turkey.runPhase = 0;
    turkey.inMud = false;
    for (const entity of entities) entity.active = false;
    state.distanceM = 0;
    state.score = 0;
    state.lives = LIVES;
    state.plumpness = 0;
    state.farmerState = 'chase';
    state.farmerTaunt = '';
    state.farmerTauntTimer = 0;
    state.tauntTimer = 5;
    state.stage = 0;
    state.speed = TURKEY.baseSpeed;
    state.elapsed = 0;
    state.spawnTimer = 1.2;
    state.knifeTimer = KNIFE.firstThrowSeconds;
    state.lettuceTimer = 16;
    state.gravyTimer = 38;
    state.banner = STAGES[0].banner;
    state.bannerTimer = 2.6;
    state.shake = 0;
    state.over = false;
    state.escaped = false;
    state.overReason = '';
    state.nearMissText = '';
    state.nearMissTimer = 0;
    state.cornEaten = 0;
    state.burstCharges = 1;
    state.burstTimer = 0;
    state.burstCooldown = 0;
    for (const p of burstParticles) p.active = false;
    syncFarmerGap();
  }

  function freeEntity() {
    for (let index = 0; index < entities.length; index += 1) {
      if (!entities[index].active) return entities[index];
    }
    return null;
  }

  function spawn(kind, x, y, w, h) {
    const entity = freeEntity();
    if (entity === null) return null;
    entity.active = true;
    entity.kind = kind;
    entity.x = x;
    entity.y = y;
    entity.w = w;
    entity.h = h;
    entity.vx = 0;
    entity.vy = 0;
    entity.t = 0;
    entity.phase = 0;
    entity.scored = false;
    entity.targetX = 0;
    entity.startX = x;
    entity.startY = y;
    return entity;
  }

  function spawnGround(kind, x, w, h) {
    return spawn(kind, x, FIELD.groundY - h, w, h);
  }

  function spawnCornRow(x, count, arc) {
    for (let i = 0; i < count; i += 1) {
      const cx = x + i * 44;
      const cy = arc
        ? FIELD.groundY - 120 - Math.sin((i / Math.max(1, count - 1)) * Math.PI) * 70
        : FIELD.groundY - 34;
      spawn(KIND_CORN, cx, cy, 26, 26);
    }
  }

  // One spawn pattern: a small cluster of obstacles and pickups, placed ahead.
  function spawnPattern() {
    const stage = state.stage;
    const roll = random();
    const x = FIELD.width + 60;
    if (stage === 0) {
      if (roll < 0.14) {
        spawnCornRow(x, 3, true);
      } else if (roll < 0.3) {
        spawnGround(KIND_FENCE, x, OBSTACLE.fenceWidth, OBSTACLE.fenceHeight);
      } else if (roll < 0.44) {
        spawnGround(KIND_MUD, x, 150 + random() * 70, 14);
        spawnCornRow(x + 40, 3, false);
      } else if (roll < 0.58) {
        spawnGround(KIND_HAY, x, OBSTACLE.hayWidth, OBSTACLE.hayHeight);
        spawn(KIND_FEATHER, x + 10, FIELD.groundY - 190, 30, 30);
      } else if (roll < 0.76) {
        spawnGround(KIND_PUMPKIN, x, OBSTACLE.pumpkinRadius * 2, OBSTACLE.pumpkinRadius * 2);
      } else {
        spawnGround(KIND_FENCE, x, OBSTACLE.fenceWidth, OBSTACLE.fenceHeight);
        spawnGround(KIND_FENCE, x + 190, OBSTACLE.fenceWidth, OBSTACLE.fenceHeight);
      }
    } else if (stage === 1) {
      if (roll < 0.12) {
        spawnCornRow(x, 3, true);
      } else if (roll < 0.28) {
        spawnGround(KIND_PITCHFORK, x, OBSTACLE.pitchforkWidth, OBSTACLE.pitchforkHeight);
      } else if (roll < 0.44) {
        spawnGround(KIND_HAY, x, OBSTACLE.hayWidth, OBSTACLE.hayHeight);
        spawnGround(KIND_HAY, x + 200, OBSTACLE.hayWidth, OBSTACLE.hayHeight);
        spawn(KIND_FEATHER, x + 100, FIELD.groundY - 190, 30, 30);
      } else if (roll < 0.6) {
        const pumpkin = spawnGround(KIND_PUMPKIN, x, OBSTACLE.pumpkinRadius * 2, OBSTACLE.pumpkinRadius * 2);
        if (pumpkin) pumpkin.vx = -70;
      } else if (roll < 0.76) {
        spawnGround(KIND_MUD, x, 170, 14);
        spawnGround(KIND_FENCE, x + 220, OBSTACLE.fenceWidth, OBSTACLE.fenceHeight);
      } else {
        spawnGround(KIND_PITCHFORK, x, OBSTACLE.pitchforkWidth, OBSTACLE.pitchforkHeight);
        spawnGround(KIND_PITCHFORK, x + 170, OBSTACLE.pitchforkWidth, OBSTACLE.pitchforkHeight);
      }
    } else {
      // The kitchen is full of food: corn is twice as common here as in the
      // farmyard (v2) — the temptation that fattens the bird is strongest
      // where the oven is hottest, so a kitchen run can arrive visibly plump.
      if (roll < 0.22) {
        spawnCornRow(x, 3, true);
      } else if (roll < 0.3) {
        const oven = spawnGround(KIND_OVEN, x, OBSTACLE.ovenWidth, 118);
        if (oven) oven.t = random() * OVEN_JET.cycleSeconds;
      } else if (roll < 0.48) {
        spawnGround(KIND_COUNTER, x, OBSTACLE.counterWidth, OBSTACLE.counterHeight);
        spawn(KIND_FEATHER, x + 40, FIELD.groundY - 200, 30, 30);
      } else if (roll < 0.62) {
        const oven = spawnGround(KIND_OVEN, x, OBSTACLE.ovenWidth, 118);
        if (oven) oven.t = random() * OVEN_JET.cycleSeconds;
        spawnGround(KIND_COUNTER, x + 230, OBSTACLE.counterWidth, OBSTACLE.counterHeight);
      } else if (roll < 0.8) {
        spawnGround(KIND_MUD, x, 150, 14);
        spawnGround(KIND_PITCHFORK, x + 200, OBSTACLE.pitchforkWidth, OBSTACLE.pitchforkHeight);
      } else {
        spawnGround(KIND_COUNTER, x, OBSTACLE.counterWidth, OBSTACLE.counterHeight);
        spawnGround(KIND_COUNTER, x + 180, OBSTACLE.counterWidth, OBSTACLE.counterHeight);
      }
    }
  }

  function throwKnife() {
    const targetX = turkey.x + turkeyBox().w / 2 + (random() - 0.5) * 120;
    const knife = spawn(KIND_KNIFE_FALL, -30, 90, 34, 14);
    if (!knife) return;
    knife.targetX = Math.max(60, Math.min(FIELD.width - 60, targetX));
    knife.startX = -30;
    knife.startY = 90;
    knife.t = 0;
  }

  function throwStraightKnife() {
    // A head-height knife the turkey slides under or jumps over.
    const knife = spawn(KIND_KNIFE_THROWN, FIELD.width + 40, FIELD.groundY - 104, 36, 12);
    if (!knife) return;
    knife.vx = -(state.speed + 120);
  }

  function hurt(events) {
    if (turkey.invulnerable > 0 || state.over) return events;
    state.lives -= 1;
    // Knocked back toward the farmer — but never straight into his hands:
    // a hit leaves a fair window to run right again.
    turkey.x = Math.max(TURKEY.minX + 30, turkey.x - TURKEY.knockback);
    turkey.vx = -260;
    turkey.invulnerable = TURKEY.invulnerableSeconds;
    state.shake = 0.35;
    state.nearMissText = '';
    syncFarmerGap();
    events |= EVENT_HIT;
    if (state.lives <= 0) {
      state.over = true;
      state.overReason = 'caught';
      state.farmerState = 'grab';
      // The farmer is on the bird now: put him next to the turkey in the end frame.
      turkey.x = TURKEY.minX + 16;
      syncFarmerGap();
      events |= EVENT_OVER;
    }
    return events;
  }

  function collect(entity, events) {
    entity.active = false;
    if (entity.kind === KIND_CORN) {
      state.score += SCORE.corn;
      state.cornEaten += 1;
      state.plumpness = Math.min(PLUMP.max, state.plumpness + PLUMP.cornGain);
      turkey.x = Math.min(TURKEY.maxX, turkey.x + 6);
      syncFarmerGap();
      events |= EVENT_CORN;
    } else if (entity.kind === KIND_FEATHER) {
      state.score += SCORE.feather;
      // v2: a feather is fuel for a burst, not just points.
      state.burstCharges = Math.min(BURST.maxCharges, state.burstCharges + 1);
      events |= EVENT_FEATHER;
    } else if (entity.kind === KIND_LETTUCE) {
      state.plumpness = Math.max(0, state.plumpness - PLUMP.lettuceLoss);
      state.score += 5;
      events |= EVENT_CORN;
    } else if (entity.kind === KIND_GRAVY) {
      state.lives = Math.min(LIVES, state.lives + 1);
      state.score += 15;
      events |= EVENT_FEATHER;
    }
    return events;
  }

  /**
   * One fixed step.
   * `input` is { jump: bool, slide: bool, direction: -1|0|1 }.
   * With `harmless` set (the title screen's backdrop) things scroll but nothing
   * touches the turkey and nothing scores.
   */
  function step(dt, input, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (state.shake > 0) state.shake -= dt;
    if (state.nearMissTimer > 0) state.nearMissTimer -= dt;
    if (state.farmerTauntTimer > 0) state.farmerTauntTimer -= dt;

    // --- FEATHER BURST (v2): X spends a feather charge + 10 plumpness for a
    // 0.45 s dash. Corn is fuel now — eat to get fat, burst to burn it off.
    if (state.burstCooldown > 0) state.burstCooldown -= dt;
    if (state.burstTimer > 0) state.burstTimer -= dt;
    if (input.burst && state.burstCharges > 0 && state.burstCooldown <= 0
      && !turkey.hiding && !state.over && !harmless) {
      state.burstCharges -= 1;
      state.burstTimer = BURST.durationSeconds;
      state.burstCooldown = BURST.cooldownSeconds;
      state.plumpness = Math.max(0, state.plumpness - BURST.plumpCost);
      let spawned = 0;
      for (const p of burstParticles) {
        if (spawned >= 10) break;
        if (p.active) continue;
        p.active = true;
        p.x = turkey.x + 10 + random() * 30;
        p.y = turkey.y + 10 + random() * 50;
        p.vx = -(120 + random() * 180);
        p.vy = -40 - random() * 80;
        p.life = 1;
        p.rot = random() * Math.PI * 2;
        spawned += 1;
      }
      events |= EVENT_BURST;
    }
    for (const p of burstParticles) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
      p.rot += dt * 3;
      p.life -= dt / 0.8;
      if (p.life <= 0) p.active = false;
    }

    // The scroll speed is the run itself: a plumper bird scrolls faster,
    // and a burst adds a surge on top.
    state.speed = TURKEY.baseSpeed + state.plumpness * TURKEY.speedPerPlump
      + (state.burstTimer > 0 ? BURST.speedBonus : 0);

    if (turkey.hiding) {
      turkey.hideTimer -= dt;
      if (turkey.hideTimer <= 0) {
        turkey.hiding = false;
        state.farmerState = 'chase';
        turkey.x = TURKEY.minX + HIDE.gapAfterPassM * GAP_PX_PER_M;
        syncFarmerGap();
        events |= EVENT_FOUND;
      }
    } else {
      // --- horizontal movement: run right to gain on the farmer, drift back ---
      // v2 fix: the turn penalty was 4/plump — a fat bird could not run right
      // out of trouble. 2/plump keeps the trade-off (slower turns) escapable.
      const moveAccel = TURKEY.moveAccel - state.plumpness * 2;
      const moveSpeed = TURKEY.moveSpeed * (turkey.inMud ? TURKEY.mudSlowFactor : 1);
      const drift = (TURKEY.drift + state.plumpness * TURKEY.driftPerPlump)
        * (turkey.inMud ? 1.5 : 1);
      if (input.direction === 1) turkey.vx = Math.min(moveSpeed, turkey.vx + moveAccel * dt);
      else if (input.direction === -1) turkey.vx = Math.max(-moveSpeed * 0.7, turkey.vx - moveAccel * dt);
      else if (turkey.vx > 0) turkey.vx = Math.max(0, turkey.vx - moveAccel * 1.4 * dt);
      else if (turkey.vx < 0) turkey.vx = Math.min(0, turkey.vx + moveAccel * 1.4 * dt);
      // A burst shoves the bird right, past the normal run speed.
      if (state.burstTimer > 0) turkey.vx = Math.max(turkey.vx, BURST.dashVx);
      turkey.x += (turkey.vx - drift) * dt;
      turkey.x = Math.max(TURKEY.minX, Math.min(TURKEY.maxX, turkey.x));
      syncFarmerGap();

      // --- vertical movement: jump, double jump, gravity ---
      if (input.jump) {
        if (turkey.onGround) {
          turkey.vy = -jumpVelocity();
          turkey.jumps = 1;
          turkey.onGround = false;
        } else if (turkey.jumps < 2) {
          turkey.vy = -TURKEY.doubleJumpVelocity;
          turkey.jumps = 2;
        }
      }
      turkey.sliding = input.slide && turkey.onGround && !turkey.hiding;
      if (turkey.sliding) turkey.slideTimer = TURKEY.slideSeconds;
      else if (turkey.slideTimer > 0) turkey.slideTimer -= dt;

      turkey.vy += TURKEY.gravity * dt;
      turkey.y += turkey.vy * dt;
      const groundTop = FIELD.groundY - turkeyBox().h;
      if (turkey.y >= groundTop) {
        turkey.y = groundTop;
        turkey.vy = 0;
        turkey.onGround = true;
        turkey.jumps = 0;
      } else if (turkey.y < 0) {
        turkey.y = 0;
        turkey.vy = 0;
      }
      turkey.runPhase += (state.speed / 60) * dt;
      if (turkey.invulnerable > 0) turkey.invulnerable -= dt;

      // Mud underfoot halves the pace while the turkey wades through it.
      const box = turkeyBox();
      turkey.inMud = false;
      for (const entity of entities) {
        if (entity.active && entity.kind === KIND_MUD
          && box.x + box.w > entity.x && box.x < entity.x + entity.w
          && turkey.onGround) turkey.inMud = true;
      }

      // Hiding: duck behind a haystack (or a kitchen counter) when one is near
      // and Down is held. The farmer searches, walks past, and loses the trail.
      if (input.slide && turkey.onGround && !harmless) {
        for (const entity of entities) {
          if (entity.active && (entity.kind === KIND_HAY || entity.kind === KIND_COUNTER)
            && entity.x - (turkey.x + box.w) > -10 && entity.x - (turkey.x + box.w) < 110) {
            turkey.hiding = true;
            turkey.hideTimer = HIDE.passSeconds;
            state.farmerState = 'search';
            state.farmerTaunt = 'WHERE’D HE GO?';
            state.farmerTauntTimer = 1.6;
            events |= EVENT_HIDE;
            break;
          }
        }
      }

      // Running burns calories: the plumpness slowly melts off.
      state.plumpness = Math.max(0, state.plumpness - PLUMP.burnPerSecond * dt);

      // --- distance, score, stage ---
      const speedMps = state.speed / PX_PER_M;
      state.distanceM += speedMps * dt;
      state.score += speedMps * dt * SCORE.perMetre;
      const newStage = Math.min(2, Math.floor(state.distanceM / STAGE_LENGTH_M));
      if (newStage !== state.stage) {
        state.stage = newStage;
        state.banner = STAGES[newStage].banner;
        state.bannerTimer = 2.6;
        events |= EVENT_STAGE;
        // A gravy boat waits just inside the kitchen door: a second wind for
        // the hardest stretch, if the turkey can reach it.
        if (newStage === 2) state.gravyTimer = 0.5;
      }
      if (state.distanceM >= ESCAPE_DISTANCE_M && !harmless) {
        state.escaped = true;
        state.over = true;
        state.overReason = 'escaped';
        events |= EVENT_ESCAPED;
        return events;
      }

      // --- the farmer's hands: caught when the drift and the knocks win ---
      if (!harmless) {
        state.tauntTimer -= dt;
        if (state.tauntTimer <= 0 && state.farmerGapM < 18) {
          state.farmerTaunt = FARMER_TAUNTS[Math.floor(random() * FARMER_TAUNTS.length)];
          state.farmerTauntTimer = 1.8;
          state.tauntTimer = 5 + random() * 3;
        }
        if (turkey.x <= TURKEY.minX) {
          state.over = true;
          state.overReason = 'caught';
          state.farmerState = 'grab';
          events |= EVENT_OVER;
          return events;
        }
      }
    }

    // --- spawning ---
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      if (!harmless) spawnPattern();
      else if (random() < 0.5) spawnGround(KIND_FENCE, FIELD.width + 60, OBSTACLE.fenceWidth, OBSTACLE.fenceHeight);
      state.spawnTimer = Math.max(0.72, 1.35 - state.stage * 0.14) + random() * 0.35;
    }
    state.knifeTimer -= dt;
    if (state.knifeTimer <= 0 && !harmless) {
      if (state.stage === 2 && random() < 0.35) throwStraightKnife();
      else throwKnife();
      state.knifeTimer = Math.max(
        KNIFE.minInterval,
        KNIFE.throwInterval + KNIFE.throwIntervalPerStage * state.stage,
      ) + random() * 0.5;
    }
    state.lettuceTimer -= dt;
    if (state.lettuceTimer <= 0 && !harmless) {
      spawn(KIND_LETTUCE, FIELD.width + 80, FIELD.groundY - 120 - random() * 120, 28, 28);
      state.lettuceTimer = 16 + random() * 6;
    }
    state.gravyTimer -= dt;
    if (state.gravyTimer <= 0 && !harmless) {
      spawn(KIND_GRAVY, FIELD.width + 80, FIELD.groundY - 150, 30, 30);
      state.gravyTimer = 40 + random() * 10;
    }

    // --- entities move, animate and collide ---
    const scrollNow = turkey.hiding ? 0 : state.speed * (turkey.inMud ? TURKEY.mudSlowFactor : 1);
    const freshBox = turkeyBox();
    for (const entity of entities) {
      if (!entity.active) continue;
      entity.t += dt;
      if (entity.kind === KIND_KNIFE_FALL) {
        // A thrown knife arcs from the farmer to its marked landing spot.
        const total = KNIFE.flightSeconds;
        const progress = Math.min(1, entity.t / total);
        entity.x = entity.startX + (entity.targetX - entity.startX) * progress;
        const arc = Math.sin(progress * Math.PI) * 260;
        entity.y = entity.startY + (FIELD.groundY - 20 - entity.startY) * progress - arc;
        entity.phase += dt * 14;
        if (progress >= 1) {
          entity.active = false;
          if (!harmless && turkey.onGround) {
            const dx = Math.abs((turkey.x + freshBox.w / 2) - entity.targetX);
            if (dx < OBSTACLE.knifeRadius + freshBox.w / 2) {
              console.log('HURT-BY knife-land t=' + state.elapsed.toFixed(2) + ' d=' + Math.floor(state.distanceM));
              events = hurt(events);
            } else if (dx < 110 && turkey.invulnerable <= 0) {
              state.score += SCORE.nearMiss;
              state.nearMissText = 'CLOSE! +' + SCORE.nearMiss;
              state.nearMissTimer = 1.1;
              events |= EVENT_NEAR;
            }
          }
          continue;
        }
        // Still flying: the blade is not a solid obstacle — it only hurts where
        // it lands. Skip the generic collision code below.
        continue;
      } else if (entity.kind === KIND_KNIFE_THROWN) {
        entity.x += entity.vx * dt;
        entity.phase += dt * 18;
        if (entity.x < -60) entity.active = false;
      } else if (entity.kind === KIND_PUMPKIN) {
        entity.x -= (scrollNow + (entity.vx ? -entity.vx : 0)) * dt;
        entity.phase += dt * 6;
      } else if (entity.kind === KIND_OVEN) {
        entity.x -= scrollNow * dt;
        // The oven's jet cycles: warn (glow), then a column of fire, then idle.
        const cycle = entity.t % OVEN_JET.cycleSeconds;
        entity.phase = cycle < OVEN_JET.warnSeconds ? 0 : cycle < OVEN_JET.warnSeconds + OVEN_JET.jetSeconds ? 1 : 2;
      } else {
        entity.x -= scrollNow * dt;
      }
      if (entity.x + entity.w < -80) {
        entity.active = false;
        continue;
      }

      if (harmless || turkey.hiding) continue;
      if (entity.kind === KIND_CORN || entity.kind === KIND_FEATHER
        || entity.kind === KIND_LETTUCE || entity.kind === KIND_GRAVY) {
        if (overlaps(freshBox, entity)) events = collect(entity, events);
        continue;
      }
      if (entity.kind === KIND_MUD) continue;
      if (entity.kind === KIND_HAY) continue; // hay is jumped over — or hidden behind
      if (entity.kind === KIND_KNIFE_THROWN) {
        if (overlaps(freshBox, entity)) {
          console.log('HURT-BY thrown-knife t=' + state.elapsed.toFixed(2) + ' d=' + Math.floor(state.distanceM) + ' turkey y=' + Math.round(turkey.y));
          entity.active = false;
          events = hurt(events);
        } else if (!entity.scored && entity.x + entity.w < turkey.x) {
          entity.scored = true;
          state.score += SCORE.nearMiss;
          state.nearMissText = 'CLOSE! +' + SCORE.nearMiss;
          state.nearMissTimer = 1.1;
          events |= EVENT_NEAR;
        }
        continue;
      }
      if (entity.kind === KIND_OVEN) {
        const body = { x: entity.x, y: entity.y, w: entity.w, h: entity.h };
        const jet = { x: entity.x + 18, y: entity.y - 130, w: entity.w - 36, h: 130 };
        const turkeyFeet = turkey.y + freshBox.h;
        if (overlaps(freshBox, body) && turkeyFeet - entity.y < 26) {
          // Landed on the oven's lid: safe, like any other low obstacle.
          turkey.y = entity.y - freshBox.h;
          turkey.vy = 0;
          turkey.onGround = true;
          turkey.jumps = 0;
        } else if (overlaps(freshBox, body) || (entity.phase === 1 && overlaps(freshBox, jet))) {
          console.log('HURT-BY oven t=' + state.elapsed.toFixed(2) + ' d=' + Math.floor(state.distanceM) + ' phase=' + entity.phase + ' turkey x=' + Math.round(turkey.x) + ' y=' + Math.round(turkey.y) + ' oven x=' + Math.round(entity.x));
          events = hurt(events);
        }
        continue;
      }
      // Solid ground hazards: fences, pumpkins, pitchforks, counters.
      if (overlaps(freshBox, entity)) {
        // Landing on top of a low obstacle is safe — even clipping its edge while
        // still rising snaps the turkey on top instead of crashing it.
        const turkeyFeet = turkey.y + freshBox.h;
        if (turkeyFeet - entity.y < 26) {
          turkey.y = entity.y - freshBox.h;
          turkey.vy = 0;
          turkey.onGround = true;
          turkey.jumps = 0;
        } else {
          console.log('HURT-BY solid k' + entity.kind + ' t=' + state.elapsed.toFixed(2) + ' d=' + Math.floor(state.distanceM) + ' turkey x=' + Math.round(turkey.x) + ' y=' + Math.round(turkey.y) + ' ent x=' + Math.round(entity.x) + ' y=' + Math.round(entity.y));
          entity.active = false;
          events = hurt(events);
          if (state.over) return events;
        }
      }
    }

    return events;
  }

  reset();
  // `random` is exposed so the screenshot stager can pick a taunt from the
  // game's own list with the same seeded generator (deterministic per seed).
  return { state, reset, step, turkeyBox, random };
}
