# Syndra mechanics evidence

Snapshot inspected 2026-10-29 from the user's installed `E:/Riot Games/League of Legends/Game/DATA/FINAL/Champions/Syndra.wad.client`. Parsed read-only through the existing CDTB pipeline into `tools/syndra-original/character.json`; this is client resource evidence, **not** recovered authoritative server scripts. REA's WAD limitation is not represented as successful native decompilation. All units below are League world units and seconds.

`src/syndra-data.js` exports rank arrays with rank 1 at index 0. In the BIN, most damage/CD arrays contain a rank-0 slot; mana arrays already start at rank 1. Mode overrides for ARAM/Kiwi are intentionally excluded.

## Directly observed resources

Paths below are relative to `Characters/Syndra/Spells/` unless stated otherwise.

| Resource | Observed values |
| --- | --- |
| `SyndraQAbility/SyndraQ` | Range 800, radius 180, sphere lifetime 6, cooldown 7, damage 90/125/160/195/230 + 0.7 AP, mana 40/45/50/55/60. Resource animation cast time .375. |
| `SyndraQAbility/SyndraQUpgrade` | Two ammo, 7 s recharge, 1.25 s inter-cast cooldown. An unused-looking `Upgrade2MaxAmmo=3` also exists; there is no corresponding current passive threshold, so three charges are not implemented. |
| `SyndraQAbility/SyndraQSpell` | FixedTimeMovement .6 s. Used as sphere formation delay; it is separate from the resource animation cast time. |
| `SyndraWAbility/SyndraW` | Pickup cast range 925, extra sphere pickup radius 450, damage 70/100/130/160/190 + .65 AP, mana 60/70/80/90/100, slow 25% for 1.5 s. Modern `Cooldown.values` 13/12/11/10/9 takes precedence over legacy `cooldownTime` 12/11/10/9/8. Exact runtime field precedence was not measured. |
| W `PassiveBonusDamage` calculation | `ThrowDamage * (.12 + .02 * AP * .01)` bonus true damage, equivalent to 12% + 2 percentage points per 100 AP. |
| `SyndraWAbility/SyndraWCast` | Range 950, radius 195, resource cast time .25. Root W has missileSpeed 1450, while this helper has missile speed 20; neither alone recovers server throw scheduling. |
| `SyndraEAbility/SyndraE` | Named cone angle 56 degrees, upgraded 84; range 650; cast .25; damage 60/95/130/165/200 + .6 AP; cooldown 15; mana 50. Stun 1.25; upgraded slow70% for1.25. Generic `castConeAngle=30`/`castConeDistance=675` conflict with named gameplay values; prefer named values. |
| `SyndraEAbility/SyndraESphereMissile` | FixedSpeedMovement 2000, `mMissileWidth=100`. Treat width as missile collision radius in trainer convention, not a 100-unit diameter. Helper range3000 is not a credible gameplay range. |
| E wave helpers | Speeds2500/1600/1100 for `SyndraEMissile`, `SyndraEMissile2`, `SyndraEMissile3`; exact server phase boundaries absent. |
| `SyndraRAbility/SyndraR` | Cast .25, range675, cooldown120/100/80, mana100; damage per sphere80/120/160 + .2 AP; minimum3 maximum7 spheres; upgraded execute threshold15%; each R rank grants10 Q ability haste. |
| `SyndraRAbility/SyndraRSpell` | AcceleratingMovement initial speed1, acceleration7500, maximum10000. Wrapper missileSpeed1100 is not used instead of the actual movement component. |
| `SyndraRBounce` | FixedTimeMovement .4, gravity6000. This supports the landing visual, not R launch cadence. |
| `SyndraPassiveAbility/SyndraPassive` | Mark4 s, per-target cooldown8 s, 5 stacks per level-up, siege kill1, cap120, thresholds40/60/80/100 and AP bonus15% at120. Proc stacks calculation1, +1 at11, +1 at18. |
| Passive mana calculation | Level1=20, initial slope4, slope6 atlevel7, 15 atlevel11, 20 atlevel16. Helper evaluates these named breakpoints (20 at1,46 at7,79 at11,159 at16,199 at18); generic breakpoint engine semantics have not been verified in running League. Historical20–215 must not silently override the current resource. |
| `Characters/Syndra/CharacterRecords/Root` | MS330, AA range550, AS.658, ratio.625, AS growth2%; AD54+2.9; HP583+100; armor25+4; MR30+1.3. Resource base480/growth40, regen1.6/growth.16 (resource property names hashed). Pathfinding radius35, selection radius125; neither equals gameplay collision radius. |
| Basic attack | Missile1800. Character `mAttackDelayCastOffsetPercent=-.1125`; a windup fraction .1875 is inferred by adding the usual .30 baseline, not explicitly stored as a fraction. |

## Official design cross-checks

[Riot patch12.19](https://www.leagueoflegends.com/en-us/news/game-updates/patch-12-19-notes/) establishes the splinter redesign, 4-second two-ability proc, upgrade thresholds and post-E sphere restriction. Its initial numerical damage values are historical and are superseded by this installed client. [Riot patch12.23](https://www.leagueoflegends.com/en-us/news/game-updates/patch-12-23-notes/) confirms W's revised12% +2% per100 AP bonus and the Q-upgrade cooldown reset fix. [Riot patch25.08](https://www.leagueoflegends.com/en-us/news/game-updates/patch-25-08-notes/) corroborates W's flat25% slow and E's60/95/130/165/200 +60%AP damage. The [official champion page](https://www.leagueoflegends.com/en-us/champions/syndra/) identifies the four abilities and passive upgrade behavior.

## Reconstruction boundaries

These are deliberately grouped under `SYNDRA.reconstruction`, not claimed extracted timings:

- Gameplay collision radius65; pickup/throw movement locks0 (mobile casting); W held lifetime5, recast guard.25, flight approximated by distance/1450 with.25 floor. Exact W target priority, grab search, stasis eligibility, throw acceleration, cooldown-start moment and sphere reset/expiry rules live in missing script/runtime behavior. Root W has `mDoesNotConsumeMana=true`; charge mana only once at the chosen actual spell activation, never both pickup and throw.
- E sphere endpoint1300 from caster and direct knockback .25. Swept collision is required for pushed spheres; never stretch a sphere's damage over the whole cone. Wave contact and Q formation need chronological processing. The 12.19 rule rejects spheres whose Q was initiated after E; it does not justify rejecting an already-forming Q indiscriminately. An enemy should not receive duplicate damage from both E cone and sphere during the same E.
- R gathering radius1300, launch spacing.10. Client `castRadius=1010`, helper range4000, trigger flight.15 and bounce.4 do **not** independently establish gather radius or shot interval. Gather available ground spheres at cast, reserve them against duplicate consumption, add up to3 orbiting spheres, cap7; release them as ground entities after hits. Held/in-flight sphere eligibility and selection order require runtime verification. The trainer excludes held/in-flight spheres as a deliberate consistent reconstruction.
- Q and W animation-resource cast times do not establish an immobilizing input lock. Animation layering/visual playback is independent from combat hit times. E/R use their .25 spell cast time.
- No item/rune damage, map-specific modifiers, minion/monster special-case scripts, spell shields, projectile blockers or authoritative networking are recovered here. A client BIN is insufficient to claim a byte-identical League simulation.

Rank plan is deterministic for training: Q W E Q Q R Q W Q W R W W E E R E E (Q then W then E max).


## Integrated trainer behavior and verification

The playable selector loads `public/assets/syndra/syndra.glb` with all 27 original clips and the client skin scale1.25. Three particle orbs attach to the original animated orb bones. Sphere state is owned by `src/syndra-combat.js`; `src/syndra-effects.js` composes the exported particle geometry/textures. Particle composition and animation blending are reconstructed.

- Q entities form after0.6s, damage once, remain6s, and retain identity through W/E/R. Q and W allow movement. Q charges recharge sequentially; R ranks add Q-specific haste.
- W pickup/recast preserves identity, charges mana once, starts cooldown on release/timeout and resets ground lifetime. Only sphere pickup is exposed: no minions or monsters are present in this arena.
- E snapshots eligible spheres when the command commits. An already forming Q can be pushed after formation; a Q issued after E is not included. Swept sphere hits stun without a second E damage instance on cone victims.
- R gathers at cast completion, excludes held/in-flight spheres, reserves up to4ground spheres and adds3orbitals. Homing missiles retain target generation so a respawn cannot inherit damage. Landing spheres remain available for E/W.
- Two distinct ability casts within4s award passive stacks, with8s per-target cooldown. Initial fragments can be automatic from level or selected for upgrade practice. Level remains fixed during a block; there is no XP/level-up simulation.
- Syndra AA uses her base AD/growth, ranged projectile and inferred windup. Attack speed remains an adjustable training setting. Targets have no armor/MR; W true damage therefore contributes to the same numeric health pool.
- E crowd control interrupts uncommitted Yone actions, stops pursuit and delays return until recovery. His already committed R and E return retain their established trainer behavior.

Validation: `npm test` passes128tests, including actual GLB playback through repeated spells/attacks in8directions, sphere lifetime/identity, cooldowns, passive, R generation safety and Yone CC. `npm run build` succeeds. `node tools/check-syndra.mjs` exercised actual keyboard Q/W/E/R in the browser, pause/resume, report generation and switching back to LeBlanc/Kayle with no browser errors. Visual captures: `tools/syndra-q.png`, `syndra-held.png`, `syndra-e.png`, `syndra-r.png`, `syndra-final.png`.
