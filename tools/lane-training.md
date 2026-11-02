# Lane poke training

Mode 08 uses two seven-unit waves: three melee, one siege and three caster minions per side. Blue units are farmed by the enemy. Red units are damageable by the player, so AoE and attack targeting can change the wave. The enemy uses the existing original LeBlanc rig and independent animation playback. Minion geometry, textures and idle/run/attack/death animations are original base-skin resources extracted from the installed Map11.wad.client. The six native skin scales and shared animation references are preserved.

`src/lane-encounter.js` owns troop combat, health, projectiles, generation-safe impacts, immediate full-wave renewal after3red minion deaths, enemy movement and farming decisions. A last-hit command requires current health at most62 and predicted positive health at projectile arrival after already incoming troop missiles. Preparation lasts0.285s; the1700u/s missile then deals damage on arrival. The enemy does not move or abandon an attack to evade during preparation. Crowd control can interrupt it.

Outside that preparation, the opponent strafes, approaches vulnerable minions, maintains spacing and evaluates escape directions after a visible spell event. It never reads the input cursor. Pressure1/2/3 uses reaction0.26/0.15/0.08s and movement340/370/400u/s. These are training calibrations, not a claim of official champion/item statistics. Projectile blockers, tower pressure, aggro against the player, gold and inventory are outside this mode. Syndra W currently uses spheres, not minion pickup.

Poke records use cast identity and the enemy's actual windup timestamps. Damage to minions cannot credit champion poke. Multi-hit abilities credit one successful cast. The report separates casts during and outside the farm preparation and records enemy CS, missed minions and damage to the opponent. Coaching highlights lethal-health minions and the attack preparation; it can be disabled and is part of the history comparison key.

Verification:145 automated tests pass. Lane tests include natural full-wave farming, exact lethal threshold, pending troop damage, stationary windup, travel time, pause, completion, passive target restrictions and an A/B scenario where identical Q aim misses against free movement and lands during committed farming. Browser check `node tools/check-lane.mjs` validates fourteen rendered minions, actual spell damage attribution, animation recovery, pause, result cards and switching back to combat. Production build succeeds.


## Original minion asset provenance

`tools/minions-original/manifest.json` records106extracted members with source WAD paths, offsets, lengths and per-member SHA-256. Extraction uses the existing format-aware CDTB parser because REA's archive inspector does not support Riot WAD (prior unsupported-format result retained in `tools/rea-locke-artifact.json`). No installed game file is modified.

`tools/extract-lane-minions.py` extracts six base characters from Map11. `tools/build-lane-minions.py` follows actual skin0 mesh/rig/texture/scale and animation graph references, then converts SKN/SKL/ANM into GLB and TEX into PNG. Chaos melee idle/run/death clips reference Order melee resources in the original graph; they are included deliberately. Native skin scales: blue melee.70, caster.76, siege.925; red melee.74, caster.87, siege.925. `public/assets/minions/resources.json` retains the clip-to-resource mappings.

Health, damage and wave fighting cadence remain training calibrations. Animation playback maps the native source release point to each training windup. On the third red death, both seven-unit waves restore full HP and new generations in the next simulation tick, with no respawn wait; pending troop bolts and enemy farming windup are cleared. Blue deaths alone do not trigger this rule. The existing3second recovery when all blue troops are gone prevents a stalled drill.
