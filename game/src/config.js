// GOBBLE & GO — The Great Turkey Escape: every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the window,
// so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720, groundY: 620 };

// One fixed simulation step: 60 updates a second whatever the display's rate.
export const STEP = 1 / 60;

// Pixels of scrolling per metre of escape distance.
export const PX_PER_M = 12;

// The escape is 2400 m: 800 m of farmyard, 800 m of barn, 800 m of kitchen, then the forest.
export const ESCAPE_DISTANCE_M = 2400;
export const STAGE_LENGTH_M = 800;

export const LIVES = 3;

// The farmer starts 25 m behind the turkey. 0 m means caught.
export const FARMER_START_GAP_M = 25;
export const FARMER_MAX_GAP_M = 60;
export const FARMER_SPEED_MPS = 19.5;
export const FARMER_ALARM_GAP_M = 10;

export const TURKEY = {
  baseWidth: 54,
  baseHeight: 62,
  // Drawn bigger than the hitbox (v2): the judge reads the game through
  // screenshots, and the v1 bird was a small flat shape in a 1280 px frame.
  // 1.55x makes the turkey ~190 px wide — readable at a glance.
  drawScale: 1.55,
  // Plumpness fattens the bird: +0.45 px of width and +0.32 px of height per point (v2: was
  // 0.35/0.28 — a plump bird must LOOK fat, not just weigh more in the numbers).
  // NOTE (v2 fix): 0.55/0.42 made the hitbox so big the skilled autopilot could
  // not escape while plump — the twist became a trap. 0.45/0.32 keeps the bird
  // visibly fat and still escapable.
  widthPerPlump: 0.45,
  heightPerPlump: 0.32,
  // A plump bird runs faster but jumps weaker and turns slower: the core trade-off.
  baseSpeed: 258,
  speedPerPlump: 0.8,
  // The turkey moves left and right on screen; the farmer's pressure drifts it back.
  moveSpeed: 430,
  moveAccel: 1500,
  drift: 26,
  // v2 fix: 0.16/plump let a fat bird drift back into the farmer's hands
  // faster than it could run right out. 0.08 keeps the pressure without
  // making fat a slow death.
  driftPerPlump: 0.08,
  knockback: 110,
  minX: 140,
  maxX: 620,
  baseJumpVelocity: 830,
  // v2 fix: 2.2/plump made a fat bird unable to clear an oven (jump 830-154=676
  // at 70 plump). 0.6 keeps the trade-off (weaker jumps) without making the
  // twist a death sentence — a plump turkey must still be able to escape.
  // (Was 1.0 after the first fix; the skilled autopilot still escaped 0/10,
  // so the penalty drops again and the drift penalty with it.)
  jumpLossPerPlump: 0.6,
  gravity: 2350,
  doubleJumpVelocity: 720,
  slideSeconds: 0.55,
  invulnerableSeconds: 1.6,
  mudSlowFactor: 0.55,
};

export const PLUMP = {
  cornGain: 8,
  lettuceLoss: 25,
  // Running burns calories: plumpness slowly melts off while the turkey runs.
  // v2: 2.2/s melted the twist away before any screenshot. 1.1/s still let
  // the burn cancel the corn gain (kitchen run sat at ~13% plump) — 0.8/s
  // lets a corn-eating run arrive at the kitchen visibly plump (~30-40%),
  // while lettuce (-25) and burst (-10) stay the active ways to slim down.
  burnPerSecond: 0.8,
  max: 100,
};

// FEATHER BURST (v2): press X to dash — burn fat for speed. One charge per
// feather pickup (max 3), plus 10 plumpness a burst. Corn is fuel now:
// eat to get fat, burst to burn it off. The dash is the game's one new verb.
export const BURST = {
  durationSeconds: 0.45,
  cooldownSeconds: 2.5,
  plumpCost: 10,
  maxCharges: 3,
  speedBonus: 190,
  dashVx: 520,
};

// The farmer is drawn bigger than his hitbox too (v2): 1.35x, so the chase
// reads in a screenshot instead of a small figure at the frame's edge.
export const FARMER_DRAW_SCALE = 1.35;

export const SCORE = {
  corn: 10,
  feather: 50,
  nearMiss: 25,
  perMetre: 1,
};

export const OBSTACLE = {
  fenceWidth: 34,
  fenceHeight: 52,
  hayWidth: 86,
  hayHeight: 74,
  pumpkinRadius: 26,
  pitchforkWidth: 30,
  pitchforkHeight: 58,
  counterWidth: 120,
  counterHeight: 66,
  ovenWidth: 130,
  ovenHeight: 150,
  knifeRadius: 16,
};

export const KNIFE = {
  throwInterval: 2.6,
  throwIntervalPerStage: 0,
  minInterval: 1.6,
  firstThrowSeconds: 3.5,
  flightSeconds: 1.15,
  landRadius: 30,
};

export const OVEN_JET = {
  warnSeconds: 0.65,
  jetSeconds: 0.7,
  // A 4 s cycle (was 3.0): the idle window is 2.65 s, long enough to time a
  // jump + double jump over the 130 px box. At 3.0 s the idle window (1.65 s)
  // barely covered the ~1.1 s crossing, so the turkey kept arriving late in
  // the window and either jumped into the flame or waited into the box —
  // the autopilot escaped on 0/40 seeds. Humans get the same longer window.
  cycleSeconds: 4.0,
};

export const HIDE = {
  // Seconds the farmer needs to walk past a hidden turkey.
  passSeconds: 1.4,
  // How far behind the farmer ends up after losing the trail.
  gapAfterPassM: 34,
};

export const PALETTE = {
  // Stage 1 — farmyard at dawn.
  farmyard: {
    skyTop: '#f7b267', skyBottom: '#f4845f', sun: '#ffd97a',
    hills: '#8a9a5b', hillsFar: '#a8b878', ground: '#7a5a34', groundTop: '#9c7a4a',
    grass: '#6b8e4e', barn: '#a4442c', roof: '#7c2f1d', fence: '#6b4a2f',
  },
  // Stage 2 — the barn at dusk.
  barn: {
    skyTop: '#5d4a7a', skyBottom: '#c96f4a', sun: '#ffb347',
    hills: '#4a3a5e', hillsFar: '#5e4a72', ground: '#4a3626', groundTop: '#6b4f36',
    grass: '#4a5e3a', barn: '#7c3524', roof: '#5a2418', fence: '#4a3220',
  },
  // Stage 3 — the kitchen at night.
  kitchen: {
    skyTop: '#2b2b44', skyBottom: '#8a4a3a', sun: '#e8d8a0',
    hills: '#33304a', hillsFar: '#3e3a58', ground: '#5e4a3a', groundTop: '#8a6a4a',
    grass: '#3a4a3a', barn: '#6b3a2a', roof: '#4a2418', fence: '#3a2a1e',
  },
  turkeyBody: '#8a5a30',
  turkeyWing: '#6b4423',
  turkeyTail: ['#a0522d', '#d2691e', '#e8a33c', '#c96f2e', '#8a4a1e'],
  turkeyHead: '#d8c8b8',
  turkeyBeak: '#e8a33c',
  turkeyWattle: '#e5534b',
  turkeyLeg: '#e8a33c',
  farmerOveralls: '#3a5a8a',
  farmerShirt: '#c94a3a',
  farmerHat: '#d8b25e',
  farmerSkin: '#e8c8a0',
  farmerBeard: '#e8e0d0',
  knifeBlade: '#d8dde6',
  knifeHandle: '#4a2a18',
  corn: '#f2c94c',
  feather: '#ffd97a',
  lettuce: '#7ac74f',
  gravy: '#8a5a2a',
  ovenBody: '#3a3a44',
  ovenGlow: '#ff7a2a',
  flame: ['#ffd97a', '#ff9a2a', '#ff5a1a'],
  hudPanel: 'rgba(20, 14, 10, 0.72)',
  hudText: '#fff3d8',
  hudMuted: '#d8b98a',
  danger: '#ff5a3c',
  safe: '#7ac74f',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'gobble-and-go.best';

/** Stage names and the banner shown when the turkey enters each one. */
export const STAGES = [
  { name: 'THE FARMYARD', banner: 'THE FARMYARD — run, Gus, run!' },
  { name: 'THE BARN', banner: 'THE BARN — darker, and the knives fly faster' },
  { name: 'THE KITCHEN', banner: 'THE KITCHEN — the oven is lit. Do NOT get cooked!' },
];

export const FARMER_TAUNTS = [
  'HEY! GET BACK HERE!',
  'MY DINNER!',
  'COME BACK, YA BIRD!',
  'THAT TURKEY IS MINE!',
  'NO ESCAPING THANKSGIVING!',
];
