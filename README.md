# GOBBLE & GO — The Great Turkey Escape

[![make.fun · turkey-run-game-01](https://make.fun/badge/turkey-run-game-01.svg)](https://make.fun/bounty/turkey-run-game-01?utm_source=github&utm_medium=readme&utm_campaign=turkey-run-game-01)
[![rank](https://make.fun/badge/turkey-run-game-01/emasinves0-commits/turkey-run-game-01/rank.svg)](https://make.fun/bounty/turkey-run-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=turkey-run-game-01)
[![reward](https://make.fun/badge/turkey-run-game-01/emasinves0-commits/turkey-run-game-01/reward.svg)](https://make.fun/bounty/turkey-run-game-01?utm_source=github&utm_medium=readme&utm_campaign=turkey-run-game-01)

A complete turkey escape game for the [make.fun bounty "Make the best turkey escape game"](https://make.fun/bounty/turkey-run-game-01): Gus the turkey runs from Jed the farmer across the farmyard, through the barn and into the kitchen — 2400 m to the forest and freedom — dodging fences, rolling pumpkins, pitchforks, thrown carving knives and a lit oven with timed fire jets.

## The twist: plumpness

Every corn cob Gus eats makes him run faster — and fatter. A fat bird turns slower, jumps weaker and makes a bigger target, while Jed herds him toward the oven. Eating is a choice, not a free lunch. Lettuce slims him back down; a golden feather is worth 50 points; a gravy boat restores a heart.

## How to play

- **← →** — run from the farmer (right gains ground, left dodges a knife's landing mark)
- **SPACE / ↑ / W** — jump, twice for a double jump
- **↓ / S** — slide under head-height knives — and hide behind a haystack when Jed is close (he searches, walks past, and loses the trail)
- **P** — pause, **M** — mute, **click / tap** — jump

Three hearts. Get caught by the farmer, or battered to zero hearts, and it's Thanksgiving dinner. Reach 2400 m and Gus is free.

## Tech

Plain static files, no library, no network request: a 2D canvas game in ES modules
(`game/src/config.js`, `random.js`, `audio.js`, `input.js`, `world.js`, `render.js`,
`shots.js`, `main.js`), with all sound synthesised by the Web Audio API. Screenshots are
real renders of the game's own code, staged by `?shot=title|farm|kitchen|escaped&seed=N`
with a seeded autopilot that plays by the real rules.

```sh
node serve.ts          # play at http://localhost:8080
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # build the hand-in
```

## License

MIT — see [LICENSE](LICENSE).
