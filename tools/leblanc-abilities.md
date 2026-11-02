# LeBlanc: playable abilities

Select LeBlanc, choose **Kiting sob pressão**, and start a block. Level 6 is the
default and learns Q1/W3/E1/R1. Quick cast: aim at a target for Q, at the ground
for W/E. R copies the last successfully cast basic ability. Press W or R again
to return to that ability's own pad. S clears movement/attack orders and the
buffered next spell; it does not undo an already committed spell or dash.

## Evidence and implementation

The source is `tools/leblanc-original/character.json`, decoded from the installed
`Leblanc.wad.client`. `src/leblanc-data.js` retains its normal-mode arrays (not
Arena/cherry overrides). Spell damage/cooldown arrays use rank as index; mana
arrays start at rank 1 in index 0. Animation resources are the original 31 clips
in `public/assets/leblanc/leblanc.glb`, with the existing weapon layer preserved.
The basic behavior is also described by Riot:
https://www.leagueoflegends.com/en-sg/champions/leblanc/

| Spell | Implemented behavior | Local data |
| --- | --- | --- |
| Q | Targeted homing missile; mark on impact; another ability consumes it, AA does not | 700 range, .25 s cast, 2000 speed, 3.5 s mark, 6 s CD; 65–165 + .4 AP hit and mark |
| W | Dash, AoE at arrival, separate return pad | 600 max displacement, 220 damage radius, .2 s return delay, 4 s window; 75–235 + .9 AP; 15–10 s CD |
| E | Swept first-target collision, tether, second damage/root if maintained | 950 missile travel / 925 displayed range, 55 missile collision radius, 1750 speed, .25 s cast; 865 tether distance; 1.5 s tether/root; 50–130 + .4 AP, then 80–240 + .85 AP |
| R | Copies Q/W/E using R rank, separate cooldown and independent W return | 45/35/25 s CD; RQ/RE 70/150/230 + .4 AP; RQ mark 140/300/460 + .8 AP; RE delayed 140/300/460 + .85 AP; RW 150/315/480 + .9 AP |

`src/leblanc-combat.js` handles casts independently of render rate and keeps
AA accuracy separate from ability hits. An input buffer holds one next spell,
not an automated combo. Marks, missiles and tethers carry target generation IDs
so respawns cannot inherit damage/effects. Pause freezes all timers. Finishing a
block drains committed effects but does not execute queued/new spells.

`src/leblanc-animation.js` plays Spell1, Spell2/recast and Spell3 with blend back
to idle/run; a subsequent AA/spell can interrupt visual recovery after release.
The source animation graph calls W `Spell4` but provides the Spell2 clip family;
this family mapping and transition timing are reconstruction choices.

## Explicit simulator choices / remaining fidelity limits

- This is not the League runtime. Original skeletal animations are used, but
  VFX (orbs, marks, pads, chains and impact rings) are training geometry.
- W travel speed is calibrated to 1450 u/s. Engine script timing, exact return
  window start, Q center-distance range checking, E radius interpretation and
  input buffer policy have not been validated against a native runtime capture.
- Q outside 700 u reports out of range instead of automatically walking into
  range. W has no walls to interact with in this arena. Invalid Q casts consume
  neither mana nor cooldown. R initially copies Q.
- Targets are the existing stationary Ryze training targets: 600 HP, no magic
  resistance. E records and displays the root duration; it does not disable
  target walking because these targets have no movement AI yet.
- Mirror Image passive, minion-only Q refunds, stealth/vision and items/runes
  are not simulated. W return has no damage.
- Mana-free practice is enabled by default and visibly labelled. Disable it
  in settings for spell costs and regeneration. AP is configurable before a
  block. Normal mana uses extracted 400/+25 and 1.6/+.16 with level growth.
- Ranks use a declared W > Q > E leveling policy, with R at 6/11/16. This is a
  training choice, not recovered player settings. Level 1 has only W.
- Session history includes AP/mana rules in comparison keys and reports casts,
  detonations, roots and returns. Damage remains training damage.

## Validation

`npm test` includes combo/mark lifecycle, E miss/first collision/tether break,
W/RW independent returns, resource/range guards, input buffering, pause/death/
respawn/draining and AA separation. `node tools/check-leblanc-abilities.mjs`
exercises real keyboard/mouse input, original clip selection, post-cast idle,
pause, saved ability-only reports and switch-back to Kayle W in Chromium.
