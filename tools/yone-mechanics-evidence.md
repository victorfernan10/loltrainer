# Yone enemy: mechanics evidence (2026-10-27)

## Scope and source identity

Read-only, format-aware inspection of the installed Riot package:
`E:/Riot Games/League of Legends/Game/DATA/FINAL/Champions/Yone.wad.client`.
The existing `tools/yone-data.json` is an October 15 snapshot and is stale.
Current package (October 21 modification date) was decoded in memory with CDTB
1.3.0 from `tools/python-deps`; source files were not changed. REA does not
support Riot WAD, as established in earlier investigation; no native runtime
or server script execution is claimed.

- WAD SHA-256: `2561f6c1891b2c6807c351794a5df32317f13eba4fd6345611c754d7693d6f27`
- Current `data/characters/yone/yone.bin`: 35,364 bytes; SHA-256
  `1b5f86e2f61ee34c3666138bd338a84946b6f1c14ea88e35ded7b7adc5ce4bb8`.
- 54 decoded top-level entries.
- Current Q AD ratio is **1.05**, compared with **1.10** in the stale snapshot.

## Observed client values

All spell paths below are under `Characters/Yone/Spells/`.
Array index 1 is ability rank 1 (index 0 often contains extrapolated values).

| Source | Observation |
|---|---|
| `Characters/Yone/CharacterRecords/Root` | Movement 345; AA range 175; base AS and AS ratio .625; AS growth 3.5%; selection radius 120 and pathfinding radius 32 are **not** gameplay hitbox radii |
| `YoneBasicAttack` | `spellCastTime=.3161`, `castFrame=8`; root attack slot delay-cast offset -.08 |
| `YoneQAbility/YoneQ` | Range 450; `Width=80`; CD 4 s; `QBaseCastTime=.35`; `BuffDuration=6`; damage 25/50/75/100/125 + 1.05 total AD |
| same Q | CD reduction coefficient `.6`, max `.666670`; cast reduction coefficient `.416670`, max `.5` |
| same Q | Q3 min/max dash 450, speed 1500, body AoE size100; knockup .75 s |
| `YoneQAbility/YoneQ3Missile` | Range950, `mMissileWidth=80`, speed1500 |
| `YoneEAbility/YoneE` | ReturnTimer5; StartingMS.1; MovementSpeed.3; initial dash300 at1200; recast lockout.5 |
| same E | CD22/19/16/13/10; DeathmarkPercent25/27.5/30/32.5/35% |
| `YoneWAbility/YoneW` | CD14 s; WBaseCastTime.5; CD reduction coefficient.6/max.571420; cast coefficient.416670/max.5; ShieldDuration1.5 |
| same W | ConeWidth40; castConeAngle55; castConeDistance600; castRange700; client coneAngleDegrees40 and coneRange700 (conflicting legacy/client declarations) |
| same W | BaseDamage10/20/30/40/50; MaxHealthDamage8/9/10/11/12%; WDamage tooltip also contains total AD term; exact script composition not recovered |
| `YoneRAbility/YoneR` | Range1000; Width225; blink200 behind target; knockup.75; pull speed3000; cooldown120/100/80 |
| same R | `spellCastTime=.125` but castFrame50 and original animation family Spell4: this field alone is **not** sufficient to recover the whole windup |

AA preparation `.3161*.625/AS` can reuse the same calibration policy as the
existing LeBlanc controller, but the true native cast-offset formula is unknown.
Do not use the generic AA SpellObject castRange200 over the root attackRange175.

## Inferences usable by the trainer

The named AS coefficients strongly support these equations, with bonus AS as a
decimal (e.g. `.8` means +80%). They are reconstructed formulas, not observed
server script execution:

```
Q cooldown = 4 * (1 - min(2/3, .6 * bonusAS))
Q cast     = .35 * (1 - min(.5, (5/12) * bonusAS))
W cooldown = 14 * (1 - min(4/7, .6 * bonusAS))
W cast     = .5 * (1 - min(.5, (5/12) * bonusAS))
```

At +80%: AA1.125/s, Q cooldown2.08 s and cast.2333 s, W cooldown7.28 s
and cast.3333 s. At +120%: AA1.375/s, Q cooldown1.3333 s and cast.175 s,
W cooldown6 s and cast.25 s. Scaling does not mean arbitrarily reducing all
animation times: keep AA windup, release and recovery separate from locomotion.

Q gains stacks **on a hit**, not on every cast. Two stacks enable Q3, which
consumes them. A miss must not produce another Q3. Start-with-two-stacks is a
useful explicit practice preset, representing a Yone who prepared Q on minions.
Without minions, an always-dodging player will prevent new Q3 stacks.

E stores a fraction of attack/ability damage and repeats that amount on return;
the return must not invent a damaging line through the player. There is no
targetable second enemy at the body marker. The visible anchor and spirit must
share identity. Keep cooldowns and animation states from restarting when the
player repeatedly crosses AA or Q range.

## Unknowns and explicit trainer calibrations

- **E ramp curve/duration is not present in the inspected client values.** Only
  10% start, 30% end and 5 s total duration were recovered. A linear ramp over
  those5 seconds is a defensible first approximation, not an exact measurement.
- E return speed3000 and return cast.225 are simulator calibration values;
  initial dash speed1200 is directly observed. Native return may be deferred by
  an ongoing attack/cast or crowd control; avoid interrupting an active animation
  just because the timer crosses5 s.
- R whole windup.75 s is a reconstruction calibration. Do not report it as
  extracted from the .125 field. Width225 is a named raw data value: exact
  script half/full-width interpretation has not been recovered. Q Width80 is
  likewise raw client data; the rendered warning and collision must agree.
- W range600 and total cone angle80 are selected calibrations from the general
  cone distance and doubled client angle. The data also advertises700 range,
  so native collision should be checked later rather than called exact.
- E's body backward displacement relative to the cast origin and exact timer
  start, passive crit behavior, damage mitigation, item interactions, native AI
  target prediction, and spell stack edge cases remain unverified.
- The requested trainer deliberately uses fixed practice damage AA55/Q90/W70/
  R140; these are **not** official damage values. E's repeat ratio can use a
  chosen rank (rank3=.30). Training retry/spawn delay is not E's real cooldown.

## Primary public cross-checks

Riot's champion page confirms W is a cone, grants a shield, and scales cooldown
and cast time with attack speed:
https://www.leagueoflegends.com/en-us/champions/yone/

Riot's development article confirms E's stored-damage/true-damage return and
mandatory return when the timer ends:
https://www.leagueoflegends.com/en-us/news/dev/champion-insights-yone/

Riot patch25.07 confirms E return no longer cleanses all crowd control. Do not
implement the historical cleansing behavior:
https://www.leagueoflegends.com/en-ph/news/game-updates/patch-25-07-notes/

These pages corroborate behavior, not the unresolved exact timing geometry.
