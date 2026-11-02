# Quinn mechanics: evidence and reconstruction boundaries

Inspected31October2026. Source is the installed
`E:/Riot Games/League of Legends/Game/DATA/FINAL/Champions/Quinn.wad.client`.
WAD SHA256: `db97e118b7017b49bf5f79e2f023063eb0e7ea09898b59c8dc7bfd95976d4e5a`.
`tools/quinn-original/manifest.json` retains each extracted member's offset and
hash; `character.json` is the CDTB decoding of `data/characters/quinn/quinn.bin`.
This is format-aware resource evidence, not recovered server code or a REA
runtime observation. REA's unsupported-WAD result was already established by
the project's earlier extraction workflow. No installed game file was changed.

## Observed in the shipped character BIN

CharacterRecords/Root: MS330, AA525, AS/ratio.668, AS growth3.1%, AD59/+3.2,
HP565/+107, mana269/+35, mana regeneration1.4/+.08 per second. Resource-slot
property hashes have the same schema used by the project's other champions.
Basic attack missile speed2000; spellCastTime.45965; castFrame5.2. CharacterRecord
basicAttack and critAttack both set mAttackDelayCastOffsetPercent=-.124561399.
Use the offset-based windup reconstruction `.3 + offset = .175438601` (17.544%),
not `.45965×.668`: the SpellData wrapper does not establish the live attack timer.
At baseAS this is roughly.2626s. The animation release marker5.2/30=.1733s is a
source clip timestamp; playback scales it to the gameplay windup. The record's
critDamageMultiplier is2.0. Pathfinding/selection radii are not gameplay radii.

All arrays in `src/quinn-data.js` use rank-1. The original DataValues/cooldown
arrays contain an extra rank0 entry, whereas mana arrays start at rank1.

| Ability | Resource observations |
| --- | --- |
| Passive | BonusDamage calculation interpolates15→120 over levels1→18, plus40% bonusAD. RevealDuration4. R resource exposes HarrierCooldown7. |
| Q | .25s cast; range1050; missile speed1550; radius60. Damage65/100/135/170/205 +80/85/90/95/100% bonusAD +50%AP. CD11/10.5/10/9.5/9; mana50/55/60/65/70; nearsight1.75s. |
| W | Buff2s, bonusAS28/41/54/67/80%, bonusMS20/25/30/35/40%; vision radius2100 for2s; CD50/45/40/35/30. |
| E | Range600 with `castRangeUseBoundingBoxes=true`; display override675. Damage40/65/90/115/140 +20%bonusAD, mana50, CD12/11/10/9/8; slow50% decaying over1.5s. Tags include KnockBack and AttackReset; cannot cast while rooted. |
| R | MS70/100/130%; mana50/25/0; CD3. Damage60/90/120 +35%bonusAD. Finale radius700; RHarrierMarkDuration4.5; SlowDuration3. |

Q/R/E calculations use `mStat=2,mStatFormula=2` for bonusAD, matching the
Q client tooltip's `Spell_ListType_BonusADRatio` label. They are not totalAD.
Arena (`cherry`) overrides are deliberately excluded. Search results for patch
26.14 included mode-specific values; they do not supersede the installed
Summoner's Rift resources.

## What the available client resources do not prove

The wrapper spells contain misleading placeholders. In particular E's
`missileSpeed=20` does **not** establish the champion's dash speed, and its .25s
wrapper cast field does not establish a stationary delay before a script-driven
dash. The trainer uses an immediate approach at2000u/s, knockback50u over.25s,
and a2000u/s rebound to525u on Quinn's approach side. Those trajectory numbers
remain explicit reconstruction/calibration choices pending runtime comparison.
Target movement must be sampled at actual contact, not at E keypress.

Other reconstructed values: Q splash radius210, nearsight vision radius350,
passive automatic acquisition range1300, passive crit-CD multiplier .99 per
percentage point of crit, R channel2s, and the exact interruption/slow semantics
of R. The local SlowDuration is3; whether damage fully dismounts or temporarily
removes flight speed is script behavior, not established by that field alone.
The trainer can retain Valor and suppress the movement bonus for that duration,
but should describe this as reconstruction. Moving/casting/attacking cancels
the R channel; hostile damage interrupts the channel and imposes its3s lockout.
Map occlusion/fog is not present, so W's revealed-state mechanics have less
practical effect than in a full map.

## E versus LeBlanc W

Riot's [official Quinn overview](https://www.leagueoflegends.com/en-us/champions/quinn/)
describes Vault as dashing to a target, briefly interrupting it on arrival, and
leaping back near maximum attack range. That supports **contact-triggered**
interruption, not interruption when the input is received.

LeBlanc's installed `LeblancW` DataValues specify SpellMaxRange600, return
window4s, recast lockout.2s, radius220, and damage75/115/155/195/235 +90%AP.
The existing trainer's1450u/s W movement is retained as its dash calibration;
the Quinn BIN does not supply that value. Implemented drills should:

1. Commit W destination at cast start, rather than continuously homing on Quinn.
2. Advance both bodies and compute their earliest relative swept contact.
3. Cancel W only when E contact precedes W's arrival. Freeze/knockback LeBlanc
   from her position at that collision and suppress the cancelled W's endpoint
   damage; do not teleport her to the original endpoint.
4. If W already arrived, keep the W damage outcome and classify E as late.
5. Classify E before the W begins separately from an actual dash interruption.
6. Do not make the drill easier by slowing either dash. Vary approach distance,
   angle and pre-cast timing instead. Reset abilities between trials explicitly
   as a training convenience, not as champion cooldown rules.

This contact model is a reconstruction consistent with the official description;
server collision scheduling, exact displacement priority, and corner cases with
terrain are not recovered from this resource inspection.

## Helper contract

`QUINN` contains base/passive/Q/W/E/R; arrays use rank-1. `quinnRanks(level)` is
a training leveling preset (E,Q,W then W→Q→E, R6/11/16). `quinnHarrierDamage`
returns only the bonus physical damage; apply critical multiplier to the ordinary
AA component before adding Harrier. `quinnHarrierCooldown` exposes the explicit
crit-CD reconstruction. No fake 1:1 server claim follows from these helpers.

## Implemented practice mode and validation

Select **Quinn × LeBlanc**, start a block, hover LeBlanc and press **E** during
her W advance. Each new round restores E, mana and health. The ordinary combat
mode retains normal cooldowns. The report separates interceptions, early and
late contacts, W hits and reaction time. Difficulty varies distance and delay,
not champion dash speed. Pause freezes both combat and animation clocks.

The original Quinn GLB contains 37 animation clips. Valor is a separate original
rig with 13 clips, attached only for its appropriate channel/flight states.
Q uses the extracted Valor projectile. Some particles and selection volumes
are reconstructed. LeBlanc selection uses native height 85/radius 100 for a
fallback volume between animated limbs, separate from her combat radius 65.

Validation covers full QWER/passive combat, original skeletons in eight facing
directions, pause, relative E/W contact at 20/60/144 FPS, late W damage, selection,
and round resets. `tools/check-quinn.mjs` exercises the browser, including a real
mouse hover plus E keypress, the report, Q and Valor channel/flight/recast.
