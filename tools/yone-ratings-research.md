# Three Yone ratings — 2026-10-28

Primary current data inspected directly from Riot Data Dragon:

- https://ddragon.leagueoflegends.com/api/versions.json → latest `16.21.1`.
- https://ddragon.leagueoflegends.com/cdn/16.21.1/data/en_US/item.json →
  item3006: PercentAttackSpeedMod .30, FlatMovementSpeedMod45.
- https://ddragon.leagueoflegends.com/cdn/16.21.1/data/en_US/runesReforged.json →
  rune8008 description: 6% melee AS per stack, maximum6 stacks, duration6s.
- Riot patch26.16 confirms Greaves25%→30%:
  https://www.leagueoflegends.com/en-gb/news/game-updates/league-of-legends-patch-26-16-notes/
- Riot patch14.21 is the historical LT buff; use the current Data Dragon
  description above rather than old LT versions with level-scaled AS/range:
  https://www.leagueoflegends.com/en-us/news/game-updates/patch-14-21-notes/

Yone base AS .625 and Q coefficients remain sourced from the installed
champion BIN (see yone-mechanics-evidence.md). All three are **fixed base-AS
reference exercises**, excluding level growth, Alacrity and AS shards. His R
is available for training even though the attack-speed reference is level1.
Hard holds full LT stacks for the exercise; no new stacking/decay or bonus
bolt damage is introduced. As before, received damage is calibrated practice
damage. Boots also supply their45 movement speed.

| Difficulty | Bonus AS | AA/s | AA interval | Q CD | Q preparation |
|---|---:|---:|---:|---:|---:|
| Easy, no items | 0% | .625 | 1.6s | 3.12s | .35s |
| Medium, Greaves | 30% | .8125 | 1.23077s | 2.40s | .30625s |
| Hard, Greaves + LT6 | 66% | 1.0375 | .963855s | 1.54s | .25375s |

The old arbitrary +80% slider is removed from the UI. The existing difficulty
selector now selects these three opponent builds in the Yone mode; it still
controls the AI's perception/prediction policy. Entering Yone mode defaults to
Easy. Legacy arbitrary-AS values cannot silently override the selected build.
Q cooldowns were subsequently calibrated to user-provided values (3.12/2.40/1.54s), independently of the sourced AS bonuses; these cooldowns are not claimed as item-only official values. Explicit custom-AS simulations retain the coefficient formula.
History keys include rating version4 to avoid comparing old rules as identical.

## R investigation and correction

The previous simulation already delayed R capture by .75s, independent of AS,
but played `yone_spell4_in` at rate1. Its actual converted duration is
1.6333334446s, so the simulation blinked before the preparation clip finished.
The original clip now spans the complete .75s preparation, followed by the
original `yone_spell4_out_notmoving` clip. There is a stronger lane warning
from the first frame and a visible countdown, controlled by the warning option.

The simulator now separates capture/blink at .75s from damage .3s later,
with .45s post-blink action recovery. The area is checked only on capture,
so leaving before .75s avoids the spell; after capture it is too late to dodge.
The AI waits for the player's preceding knockup to end plus.2s before starting
R, a deliberate training policy to give a usable practice opportunity instead
of immediately chaining guaranteed CC. It is not a claim about human opponents.
These R whole-cast/impact timings remain reconstruction calibrations; the
client SpellObject `.125` field does not establish the entire server sequence.

Tests cover all three rates, unchanged R timing across difficulties, no early
damage, sidestepping before capture, pause, pending impact after caster death,
and the keyboard/UI choice plus original R clip synchronization in Chromium.

The subsequent requested E training rule excludes the complete R action (0.75s
preparation + 0.45s recovery) from the five-second spirit timer. The HUD timer
uses the same extended deadline. Session stop and death still end the encounter.
