# Advanced training rules, revision 3

The UI now starts in **Avançado**. **Assistido** remains available for isolating
the mechanics with direction guides and last-hit highlights. Difficulty changes
decision pressure, not projectile speed. Existing Yone loadouts, requested Q
cooldowns (3.12 / 2.40 / 1.54), and the five seconds of E excluding R are preserved.

Advanced mode disables supplemental missile direction lines, last-hit hints,
Yone/matchup ground overlays, and unlimited mana. Beam preparation still has a
visible cue. These cues are reconstructed visuals, not Riot's particle engine.

## Local resource evidence and limits

`inspect-dodge-rules.py` reads only the five character BIN entries in the installed
WADs using CDTB. REA does not decode this container; no claim is made to recovering
server scripts. Source is `E:/Riot Games/League of Legends/Game/DATA/FINAL/Champions`.
Decoded entries and original BINs are in `tools/dodge-rules/`.

* EzrealQ: `spellCastTime=.25`, missile `mSpeed=2000`, `mMissileWidth=60`.
* NautilusAnchorDrag: `spellCastTime=.25`; AnchorDragMissile uses speed2000,
  radius90. Simulator diameter is180. Script wrapper ranges10000/25000 are
  not treated as gameplay ranges: the existing1100 calibration is retained.
* ThreshQ: explicit `mCastTime=.5`; QMissile speed1900, radius70, range1100.
* XerathArcanopulse2: `mCastTime=.5`; ChargeUp `RectangleWidth=145`.
  Charge time/range growth and moving while charging are still not simulated.
* LuxR has several differing client entries: `spellCastTime=1.375`, line190,
  minimap override3340; LuxRMis has time1.0, range3500 and line250. This change
  uses1.0s for the damage-stage delay, preserves the existing range3340 and
  diameter190 calibration, and removes the old60-wide forgiving collision.
  This is an explicit reconstruction choice, **not verified server equivalence**.

Extracted character BIN SHA256:

| Character | SHA256 |
| --- | --- |
| Ezreal | 0f8dfe8ead7b56f70cbd91731ffa59a4b3c1b389ce393d10987e401d5a88f172 |
| Lux | 4307fdc8248edea5bd9cd97437f75e8b00ff64ac1a3bb30481cc87abf8cf321c |
| Nautilus | 556a4cf9222ce1b6c0763f7c3a586c0ea509f4299f4853182d6ca26ee0265837 |
| Thresh | b59b7b7ed4a224f09ca0492f1e32b823405ba0fd5f88fe8c946fcf0cb57f7824 |
| Xerath | 9afcf8b1a4f4e4d84f76e2db53e17bc5b3a8e3be7215e2393a1408d16de9f784 |

## AI policy (trainer design)

Generic waves use seeded, varying cast distances, curved approaches, and short
hesitations. Each enemy still casts once and leaves. Prediction uses observed
movement history delayed100–200ms; no cursor/destination access. Extrapolation is
capped320u and rejects blink velocities. Cast directions lock at cast start.

Advanced Ahri chooses Q/E order randomly and repositions to alter the returning
orb's angle. Locke varies recast cadence without changing missile speed or cast
preparation. Both retain stationary committed casts. Yone's existing delayed
observation and calibrated timing are unchanged.

Advanced lane LeBlanc uses340u/s for every difficulty. She prioritizes last hits,
but will autoattack an overextended player when no nearby last hit is imminent.
Farm and trades share one cooldown. Windup is stationary; damage requires missile
arrival; leaving range before release prevents the shot. Trades use calibrated62
damage, without armor/item calculations. Advanced minions use the extracted base movement speed350u/s, with animation
playback scaled to that speed (assisted keeps160). Original minion animations remain;
three red deaths still replace both full7-unit waves. No towers, player minion
aggro, complete lane economy, or minion pickup for Syndra W yet.

## Assessment

The primary dodge metric includes casts whose committed trajectory initially
threatened the player, plus hits entered afterward. Already-safe misses remain
in the overall audit, not in the headline rate. A lateral-command sample requires
a move command that increases clearance; attack spam and forward clicks do not
count. This is a command metric, **not a measurement of human reaction latency**.
At least20 threats are requested before assessing consistency, without a fictional
rank or percentile. Lane reports unique farm windows punished and trade damage.
History comparison includes profile/ruleset, so assisted and older rules are not
mixed. Replays retain recorded geometry, preparation and projectile speed.

Validation: Node simulation/animation tests, production build, and browser flows
for advanced pressure, report, profile switching, Ahri and original-minion lane.
