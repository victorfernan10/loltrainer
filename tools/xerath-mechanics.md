# Xerath playable reconstruction

The source of the numeric snapshot is the installed `Xerath.wad.client`, decoded
into `tools/xerath-original/character.json`. This is a client resource extraction,
not the server spell scripts or Riot's engine. `src/xerath-data.js` keeps the
selected values; `src/xerath-combat.js` implements their simulation.

## Evidence and selected values

- Q: 70/110/150/190/230 + 90% AP; 9/8/7/6/5 s cooldown; 80–120 mana.
  Native beam rectangle width 145, release cast time .5 s; range indicator
  starts at 750 and reaches 1500 after 1.5 s. Aim remains private during charging.
- W: 50/85/120/155/190 + 65% AP, central multiplier 1.667;
  range 1000, outer radius 250, central radius 100. Cast .25 s followed by .5 s
  damage delay. Slow lasts 2.5 s, outer 25%, central 60–80%.
- E: 70/100/130/160/190 + 45% AP; .25 s cast. Selected child missile speed
  1400, range data value 1125, collision radius 60. First unit hit stops the
  missile. Continuous relative-motion collision catches a target crossing the
  missile between rendering frames, including a dash.
- R: 170/220/270 + 45% AP per shot, ramp 20/25/30 + 5% AP per prior
  champion-hit shot, once per cast even if multiple champions are hit. Range
  5000, radius 200, 4/5/6 shots, ten-second channel, .6 s flight/shot interval,
  130/115/100 s cooldown, 100 mana.
- Passive: level-scaled mana restoration 30–195; champion AA doubles it.
  Actual AA impact procs it, skills do not. Local kill-refund value is 3.5 s.
  Riot's [13.14 notes](https://www.leagueoflegends.com/en-ph/news/game-updates/patch-13-14-notes/)
  corroborate the 16 s passive cooldown, R shot counts and once-per-cast ramp;
  their historical kill refund and damage numbers are superseded by the local snapshot.

## Explicit reconstruction/calibration points

The resources contain mutually inconsistent range/charge metadata. Q's old
targeter says 700–1400, another growth maximum says 1700, `ChargeTime` says four
seconds, and channel duration says three. This version selects the 750–1500
range indicator and three-second maximum hold. Q charge self-slow starts at
20%, ramps ten percentage points per second, and caps at 40%. This interpretation
of the ramp needs comparison with the installed game's runtime.

E stun uses clamp(.5 + .17 × travelDistance/100, .75, 2.25), inferred from the
descriptive scaling data-value name and explicit minimum/maximum. W central
slow uses the extracted .8 multiplicative decay factor every .25 s, with a 25%
floor; the decay interval is reconstructed. A target circle intersecting W's
central area receives the central effect.

R's first-shot gate is .5 s to accommodate the startup; this delay is calibrated,
not extracted from a server script. An unused R refunds half its mana and uses
half cooldown, and an abandoned Q refunds half its mana and consumes its full
cooldown. The .5 refund fields are observed; exact server cancellation semantics
are reconstructed. Last R recoil lasts until its committed impact; moving or S
cancels the channel, but never erases a launched shot. Q may move while charging;
release, W preparation, E preparation, and R channel prevent translation.

No fake cooldown reductions or accuracy assistance are applied by difficulty.
Ability haste, ranks, AP and optional unlimited mana use the existing trainer
controls. Damage uses the trainer's unmitigated health model (no magic resistance).

## Integration and validation

`castAbility`, `releaseAbility`, `updateAim`, `cancelCharge`, and `endChannel`
control input. Public `charge`/`channel` feed animation holds. `visibleThreats()`
contains only committed lines, circles and missiles; charging direction is never
given to the opponent AI. Each committed cast emits `spell-telegraph`, one
`spell-impact`, and one `spell-resolved` outcome with target IDs and W center IDs.
R counts each actual shot, not channel activation, in spell accuracy.

`tests/xerath-combat.test.js` exercises charge privacy/range, movement locks,
delayed impacts, swept E collisions, first-target selection, R cadence/ramping,
mana/passive behavior and termination without stuck pending work.

## Browser composition

The playable renderer loads the original Q beam/energy layers, W target ring
and sky beam, R ring geometry/texture, and E warped-sphere geometry/texture.
Ground markers follow the same committed cast positions as the collision model;
visual lifetimes do not determine damage. Materials and particle composition are
locally reconstructed, not Riot shaders or a pixel-identical particle graph.

The free aim drill selects Xerath and one continuously moving LeBlanc. Her native
movement/dash parameters are preserved; difficulty changes the observation delay,
footwork and use of available dashes. The playlist now includes this tenth drill.
Full-kit browser smoke checks cover keyboard Q hold/release, W/E outcomes, all four
rank-one R shots, return to idle, report generation and absence of console errors.
