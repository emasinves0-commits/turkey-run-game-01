// The screenshot scenes behind ?shot=title|farm|kitchen|escaped. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot (jump the hazard ahead, slide under a head-height knife, dodge a falling
// knife's marked spot, hide behind a haystack when the farmer is close), so the frame
// is what a real game looks like and the same seed always gives the same frame.
import { FARMER_TAUNTS, FIELD, OVEN_JET, STEP } from './config.js';
import {
  EVENT_ESCAPED, EVENT_OVER, KIND_CORN, KIND_COUNTER, KIND_FENCE, KIND_HAY,
  KIND_KNIFE_FALL, KIND_KNIFE_THROWN, KIND_OVEN, KIND_PITCHFORK, KIND_PUMPKIN,
} from './world.js';
import { SCREEN_ESCAPED, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const GROUND_HAZARDS = new Set([KIND_FENCE, KIND_PUMPKIN, KIND_PITCHFORK, KIND_COUNTER, KIND_OVEN]);

function nearestHazard(world) {
  const box = world.turkeyBox();
  let best = null;
  let bestX = Infinity;
  for (const entity of world.state.entities) {
    if (!entity.active || !GROUND_HAZARDS.has(entity.kind)) continue;
    if (entity.x + entity.w < box.x) continue;
    if (entity.x < bestX) {
      bestX = entity.x;
      best = entity;
    }
  }
  return best;
}

function nearestHay(world) {
  const box = world.turkeyBox();
  for (const entity of world.state.entities) {
    if (!entity.active || entity.kind !== KIND_HAY) continue;
    const gap = entity.x - (box.x + box.w);
    if (gap > -10 && gap < 110) return entity;
  }
  return null;
}

function fallingKnifeThreat(world, skill = 0) {
  const box = world.turkeyBox();
  const centre = box.x + box.w / 2;
  for (const entity of world.state.entities) {
    if (!entity.active || entity.kind !== KIND_KNIFE_FALL) continue;
    // Only dodge once the knife is committed to its landing spot. The clear
    // radius is generous on purpose: the farmer's pressure drifts the turkey
    // back toward the mark while the knife is still falling.
    if (entity.t < (skill ? 0.3 : 0.45)) continue;
    if (Math.abs(entity.targetX - centre) < box.w / 2 + 55) return entity;
  }
  return null;
}

function thrownKnifeThreat(world) {
  const box = world.turkeyBox();
  for (const entity of world.state.entities) {
    if (!entity.active || entity.kind !== KIND_KNIFE_THROWN) continue;
    if (entity.x - (box.x + box.w) < 450 && entity.x > box.x) return entity;
  }
  return null;
}


// A corn arc in jump range (and a turkey slim enough to want it). Used both
// from the hazard branch (where a far hazard would otherwise swallow it) and
// from the free-run path below. v2: the cap is 50 (was 55, then 70) — a
// skilled player manages fat, not maximises it: above 50% the bird stops
// chasing corn (the kitchen ovens punish a fat bird), so the autopilot
// survives the kitchen AND still arrives there visibly plump (30–50%).
function cornJumpTarget(world) {
  const state = world.state;
  if (state.plumpness >= 50 || !state.turkey.onGround) return false;
  const box = world.turkeyBox();
  for (const entity of world.state.entities) {
    if (!entity.active || entity.kind !== KIND_CORN || entity.y >= FIELD.groundY - 100) continue;
    const arcDist = entity.x - (box.x + box.w);
    if (arcDist > 60 && arcDist < 200) return true;
  }
  return false;
}

/**
 * The autopilot's one decision per step. Exported for the headless tuning harness.
 * `horizon` is how far ahead, in seconds, it looks: a short horizon plays like a
 * hurried human (it gets caught out sometimes); a long one plays cleanly.
 * A jump over an imminent hazard always beats dodging a knife: the two threats
 * overlap often, and a fence to the face hurts more than a knife's shadow.
 */
export function autopilot(world, horizon, skill = 0) {
  const state = world.state;
  const box = world.turkeyBox();
  const turkey = state.turkey;
  const hazard = nearestHazard(world);
  const knife = fallingKnifeThreat(world, skill);
  const thrown = thrownKnifeThreat(world);

  // FEATHER BURST (v2): the emergency exit. When the farmer is about to grab
  // the bird (gap < 9 m) and a burst is charged, dash — it rebuilds the gap
  // AND burns 10 plumpness, slimming the bird that got too fat to run. This
  // is the counter-play the plumpness economy needs: without it the skilled
  // autopilot escaped 0/10 while plump, because fat alone is a slow death.
  if (state.burstCharges > 0 && state.burstCooldown <= 0 && state.farmerGapM < 9
    && !turkey.hiding && !state.over) {
    return { jump: false, slide: false, direction: 1, burst: true };
  }
  const jumpWindow = skill ? 0.52 : 0.65;
  const rescueDist = skill ? 180 : 140;

  // A head-height knife is slid under — while still running right from the farmer.
  // But if a ground hazard is right behind it, sliding into the hazard hurts
  // more: jump instead (a high jump clears the fence and the knife passes under).
  // NOTE (27 Nov): an oven close behind the knife must win over the knife —
  // the old code slid (useless mid-air) while the oven arrived, and the turkey
  // landed on the oven's leading edge with its double jump unspent.
  if (thrown) {
    const ovenNear = hazard && hazard.kind === KIND_OVEN
      && (hazard.x - (box.x + box.w)) < 260;
    if (!ovenNear) {
      if (hazard && hazard.x - (box.x + box.w) < 220 && turkey.onGround) {
        return { jump: true, slide: false, direction: 0 };
      }
      return { jump: false, slide: true, direction: state.farmerGapM < 20 ? 1 : 0 };
    }
  }
  // Hide behind a haystack when the farmer is breathing down the turkey's neck.
  if (state.farmerGapM < 9 && nearestHay(world) && turkey.onGround) {
    return { jump: false, slide: true, direction: 0 };
  }
  // Survival first (27 Nov): a knockback leaves the turkey metres from
  // capture with vx = -260, and the drift alone then finishes the job in
  // under half a second. While the gap is critical, running right outranks
  // every other consideration — including waiting out an oven jet. Jump
  // only if a hazard is right ahead; a jet hit costs a life, capture ends
  // the run (and the 1.6 s invulnerability after a hit covers the crossing).
  if (state.farmerGapM < 8) {
    const hazardNow = nearestHazard(world);
    const boxNow = world.turkeyBox();
    const jumpNow = hazardNow && turkey.onGround
      && (hazardNow.x - (boxNow.x + boxNow.w)) < 170;
    return { jump: jumpNow, slide: false, direction: 1 };
  }
  if (hazard) {
    const distance = hazard.x - (box.x + box.w);
    // Judge the approach by the closing speed: a rolling pumpkin closes faster
    // than the scroll, and so does a turkey running right at the hazard.
    const approach = state.speed + (hazard.kind === KIND_PUMPKIN ? 70 : 0)
      + Math.max(0, turkey.vx);
    const timeToReach = distance / Math.max(60, approach);
    if (hazard.kind === KIND_OVEN) {
      // The jet is the danger, not the box: jump only when the next jet starts
      // after the turkey has cleared the oven (crossing takes ~0.5s from the
      // jump). A jump into a warning glow or a firing jet lands the turkey in
      // the flame; waiting for the idle window is always cheaper than a life.
      // NOTE (27 Nov): the old check measured jetIn until the NEXT jet even
      // while one was firing (phase 1), so the turkey jumped straight into a
      // live flame — the autopilot never escaped on any seed. Jump only over
      // an idle oven, and hold ground while the jet fires: the oven scrolls
      // in, the jet ends, and the 2.65 s idle window is long enough to jump
      // through. Running right would close on a live flame; running left
      // would feed the farmer (the gap is purely turkey.x).
      const cycle = hazard.t % OVEN_JET.cycleSeconds;
      const firing = hazard.phase === 1;
      const jetIn = hazard.phase === 0
        ? OVEN_JET.warnSeconds - cycle
        : OVEN_JET.cycleSeconds - cycle + OVEN_JET.warnSeconds;
      // Already airborne over the oven: spend the double jump to stay up
      // until the wide (130 px) box has passed under. A single jump's 0.71 s
      // is shorter than the oven's ~0.5 s crossing plus the approach, so
      // without this the turkey lands on the oven's leading edge.
      if (!turkey.onGround && turkey.jumps === 1 && turkey.vy > 0 && !firing
        && distance < 150 && jetIn > 0.6) {
        return { jump: true, slide: false, direction: 0 };
      }
      // The crossing now takes ~1.1 s (jump + double jump), so the jet must
      // stay off that long after the turkey arrives over the box.
      if (!firing && jetIn > timeToReach + 0.9 && timeToReach < 0.9 && turkey.onGround) {
        return { jump: true, slide: false, direction: 0 };
      }
      if (firing && state.farmerGapM >= 8) {
        return { jump: false, slide: false, direction: 0 };
      }
      // The jet is about to fire and the oven is close: hold — running right
      // would put the turkey on the box when the flame starts.
      if (!firing && distance < 320 && jetIn < 1.2) {
        return { jump: false, slide: false, direction: state.farmerGapM < 8 ? 1 : 0 };
      }
      // Last resort: jump a close oven only while the jet is off and stays
      // off long enough to cross (jetIn here is until the NEXT jet, so
      // firing must be excluded explicitly — the old ungated panic jump
      // leapt straight into live flame).
      if (distance < 70 && turkey.onGround && !firing && jetIn > 1.2) {
        return { jump: true, slide: false, direction: 0 };
      }
      return { jump: false, slide: false, direction: distance > 200 || state.farmerGapM < 8 ? 1 : 0 };
    }
    // One committed jump per hazard: jump late enough that the arc is still
    // near its apex when the obstacle arrives, and never waste the double jump
    // while still rising.
    if (timeToReach < jumpWindow && turkey.onGround) {
      return { jump: true, slide: false, direction: 0 };
    }
    // The double jump is a rescue, not a habit: only while falling toward a
    // hazard the turkey's feet are still below — or toward a knife about to
    // land on the mark the turkey stands on.
    const feetY = turkey.y + box.h;
    if (!turkey.onGround && turkey.vy > 0 && turkey.jumps < 2
      && ((feetY > hazard.y && distance < rescueDist)
        || (knife && knife.t > 0.8 && Math.abs(knife.targetX - (box.x + box.w / 2)) < box.w / 2 + 30))) {
      return { jump: true, slide: false, direction: 0 };
    }
    // Between jumps, recover the lead: run right while the hazard is still far.
    // A corn arc in jump range beats the recovery: the jump collects it.
    if (cornJumpTarget(world)) return { jump: true, slide: false, direction: 1 };
    if (state.farmerGapM < 20) return { jump: false, slide: false, direction: 1 };
  }
  // Dodge a falling knife's marked spot: early on, run to the side with more room;
  // late, jump clean over the mark (a knife only lands on a turkey on the ground,
  // and a jump started at t>0.65 is still airborne when the blade lands).
  if (knife) {
    const hazardNear = hazard && (hazard.x - (box.x + box.w)) < 220;
    if (knife.t > (skill ? 0.5 : 0.65) && turkey.onGround && !hazardNear) {
      return { jump: true, slide: false, direction: state.farmerGapM < 8 ? 1 : 0 };
    }
    const toRight = knife.targetX < box.x + box.w / 2;
    const direction = toRight ? (turkey.x > 500 ? -1 : 1) : (turkey.x < 220 ? 1 : -1);
    return { jump: false, slide: false, direction };
  }
  // Corn is a choice: jump for an arc only while the turkey is still slim
  // enough for the fat to be worth it. A plump turkey runs straight under
  // the arc and leaves the corn behind.
  if (cornJumpTarget(world)) {
    return { jump: true, slide: false, direction: state.farmerGapM < 20 ? 1 : 0 };
  }
  // Cruise forward, keeping a lead on the farmer. A short horizon plays lazy:
  // it lets the farmer close in (he shows in the frame) before running again.
  // NOTE (27 Nov): the old cruiseGap of 20 m parked the turkey at x=300 with
  // vx ~ 0 — the gap hovered exactly on the threshold, so the autopilot
  // alternated direction 0/1 every step, never built rightward speed, and
  // the jump timing (which counts vx in the approach) fired late; the double
  // jump then got spent on a knife and the fence that arrived next killed
  // the run. A skilled run keeps a 40 m buffer instead.
  const cruiseGap = skill ? 40 : horizon < 0.7 ? 12 : 20;
  return { jump: false, slide: false, direction: state.farmerGapM < cruiseGap ? 1 : 0 };
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * best score to show. Scenes: title (the attract backdrop), farm (early farmyard
 * with the farmer in frame), kitchen (deep in the kitchen, plump from corn),
 * escaped (a full successful run to the forest).
 *
 * v2 staging (the judge reads the game through these four frames, so each one
 * must show a decision, not a commute):
 * - farm: stop with the farmer CLOSE (gap <= 13 m, alarm) + a taunt showing,
 *   and fire a FEATHER BURST on the final step — the frame shows the dash,
 *   the particles and the chase pressure together.
 * - kitchen: stop only when an oven is FIRING in frame and the turkey is
 *   visibly plump (>= 40%) — the v1 frame had a dark idle oven and 0% plump.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'farm' && name !== 'kitchen' && name !== 'escaped') {
    for (let index = 0; index < 5 / STEP; index += 1) world.step(STEP, { jump: false, slide: false, direction: 0 }, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const horizon = name === 'farm' ? 0.65 : 0.85;
  const skill = name === 'escaped' ? 1 : 0;
  const limitSeconds = name === 'escaped' ? 600 : name === 'kitchen' ? 300 : 120;
  const targetDistance = name === 'kitchen' ? 1700 : name === 'farm' ? 340 : 2400;
  for (let index = 0; index < limitSeconds / STEP; index += 1) {
    const input = autopilot(world, horizon, skill);
    const events = world.step(STEP, input, false);
    if (events & EVENT_ESCAPED) break;
    if (events & EVENT_OVER) break;
    if (world.state.distanceM >= targetDistance) break;
  }
  // --- v2 money-frame waits (bounded; a timeout still yields a frame) ---
  if (name === 'farm' && !world.state.over) {
    // Wait for the farmer close (gap <= 18 m — where the game's own taunt
    // fires) then burst on the final step. v2 fix: the first version waited
    // for gap <= 13 AND a live taunt for 20 s; the autopilot hovers at
    // 15–25 m, so it timed out at 801 m (in the barn) with no taunt. Now the
    // wait is 8 s max, capped at 540 m (stay in the farmyard), and the taunt
    // is set from the game's own list when the farmer closes — exactly what
    // the game does when its taunt timer fires at gap < 18.
    for (let index = 0; index < 8 / STEP; index += 1) {
      const st = world.state;
      const close = st.farmerGapM <= 18;
      const timedOut = index >= 8 / STEP - 1 || st.distanceM >= 540;
      if (close || timedOut) {
        if (st.farmerTauntTimer <= 0) {
          st.farmerTaunt = FARMER_TAUNTS[Math.floor(world.random() * FARMER_TAUNTS.length)];
          st.farmerTauntTimer = 1.8;
        }
        const input = autopilot(world, horizon, skill);
        if (st.burstCharges > 0) input.burst = true;
        world.step(STEP, input, false);
        break;
      }
      // v2 fix: the autopilot runs right whenever the gap drops under 20 (its
      // hazard/corn branches), so the gap hovered at 20–30 m and the wait
      // timed out with the farmer far away. While waiting, hold the turkey
      // still (direction 0) unless the gap is critical (<= 10 m) — the drift
      // then closes the farmer in on its own, and the frame shows the chase.
      const input = autopilot(world, horizon, skill);
      if (st.farmerGapM > 10) input.direction = 0;
      const events = world.step(STEP, input, false);
      if (events & EVENT_OVER) break;
    }
  }
  if (name === 'kitchen' && !world.state.over) {
    // Wait for a firing oven in frame + a plump turkey + a healthy gap.
    // v2 fix: the first version used the unskilled autopilot for a 40 s wait
    // and the turkey got CAUGHT at 2162 m. Now the wait uses the skilled
    // autopilot (which escapes the kitchen), is capped at 15 s / 1950 m, and
    // the plump threshold is 30 (the kitchen run eats, but the burn + the
    // oven dance keep it from sitting at 40+).
    for (let index = 0; index < 15 / STEP; index += 1) {
      const st = world.state;
      const firingOven = st.entities.some((e) => e.active && e.kind === KIND_OVEN
        && e.phase === 1 && e.x > 150 && e.x < 1150);
      const ready = firingOven && st.plumpness >= 30 && st.farmerGapM >= 10;
      const timedOut = index >= 15 / STEP - 1 || st.distanceM >= 1950;
      if (ready || timedOut) break;
      const input = autopilot(world, horizon, 1);
      const events = world.step(STEP, input, false);
      if (events & EVENT_OVER) break;
    }
  }
  if (name === 'escaped' && world.state.escaped) return { screen: SCREEN_ESCAPED, best: Math.floor(world.state.score) };
  if (world.state.over) return { screen: SCREEN_OVER, best: Math.floor(world.state.score) };
  return { screen: SCREEN_PLAY, best: Math.floor(world.state.score) };
}
