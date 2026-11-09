# Caitlyn original rig, animation and particles

## Source and evidence boundary

- Read-only source: `E:/Riot Games/League of Legends/Game/DATA/FINAL/Champions/Caitlyn.wad.client`.
- Source SHA-256: `8b23e9cdd4470acd22846e50f4ee422a3805ef9b91d13995ba91db3e7066fd01`.
- REA `open_binary` against this exact WAD returned `target_unavailable` / unsupported binary format, with no successful Evidence ID. The successful resource observations below come from CDTB 1.3.0's format-aware extraction, not native engine tracing.
- Local evidence: `tools/caitlyn-original/manifest.json`, `character.json`, `skin0.json`, `animation-map.json`, `trap-manifest.json`, `trap-skin0.json`, `trap-animation-map.json`, `trap-character.json`. Raw game data remain local/ignored by Git.
- Reproduce: run `tools/extract-dodge-champion.py caitlyn`, `tools/caitlyn-extract-trap.py`, then `tools/caitlyn-build-assets.py`. The converter verifies the installed WAD SHA against the extraction manifest before exporting runtime assets.

## Champion model and playback

`public/assets/caitlyn/caitlyn.glb` is the original base SKN/SKL, 140 joints, four skinned submeshes, and all **46 authored base animation files**. Native `skinScale` is 1.05. `Body` and `Weapon` use `caitlyn_base_tx_cm.png`. `Flag` and `Teacup` are explicitly hidden by native skin data during ordinary combat; preview emotes use their individual original textures and authored visibility windows.

Most clips carry 420 TRS tracks; `crit`, `recall` and `spell3_toidle` are partial. The adapter fills missing channels from idle, or from run for the E-to-run recovery, avoiding return to the bind pose. The preview selector lists all 46 original resources.

| State | Native resource |
|---|---|
| Idle / locomotion | `idle1`, `run` |
| AA / headshot | `attack1`, `attack2`, `passive` |
| AA recovery | `attack1_to_idle`, `attack2_to_idle`, `passive_to_idle`, `attack_to_run` |
| Q / W / E | `spell1`, `spell2`, `spell3` |
| Q/W/E recovery | corresponding `_to_idle` / `_to_run`; graph E-to-run maps to `spell3_toidle` |
| R / recovery | `spell4`, `spell4_to_idle`, `spell4_to_run` |
| R alternate aim resources | `spell4_-90`, `spell4_90` |

The graph declares muzzle events at frame 7 for Attack1, 9 for Attack2, 10 for Passive and 8 for Crit. Their animation playback is fitted to the mechanical attack windup, without delaying a gameplay command for a fixed turn interval. World yaw supplies continuous 360-degree orientation. R preserves its active pose on the projectile-release event. E cast and dash phases with the same spell ID do not restart the clip. Blends and playback rates are local scheduling choices, not recovered Riot runtime execution.

`Rifle_Root` is snapped to the authored `Rifle_World_Snap` during R and designated idle/emote windows, according to graph joint-snap events. Flag appears during Joke frames 21–145; teacup during Laugh frames 4–138 and Recall from frame 122. They are hidden again when combat resumes. Native cloth path/conform simulation and particle/sound event scheduling are not reproduced by the animation adapter.

## Skill entities and particles

- `trap.glb`: original **CaitlynTrap** entity packaged inside Caitlyn's WAD, native scale **2.0**; original `set` (1s), `idle`, `attack1` (snap/trigger, 1.167s), and `death` (1.5s) clips. Texture: `caitlyntrap_base_tx_cm.png`. Idle geometry before scale spans approximately XZ ±21.42, Y 0–25.59. The character data declare perception radius 100, but this is **not** evidence of its gameplay trigger radius.
- `q-missile.glb`: original `caitlyn_base_qvfx_rg`, two authored clips `caitlyn_base_q_1_loop` and `caitlyn_base_q_2_anim`; texture `caitlyn_base_q_tx_cm.png`. At t=.1 the unscaled model spans X±79, Y±24, Z−162..175; longitudinal axis is Z.
- `e-net.glb`: original `caitlyn_base_entrapment_mis_net` mesh/rig/animation, texture of the same stem. At t=.1 spans X±65, Y0..126, Z−67..53. The texture and skeletal net are exported; effect orientation/placement are compositor responsibilities.
- The runtime folder includes 120 original TEX-to-PNG textures used by the champion, trap, and particles. `resources.json` records source paths, SHA-256 values, model identities, clip lists, materials and scales.

These are original assets rendered by Three.js, not Riot's shaders or a claim of a pixel-identical particle graph. Geometry conversion does not recover the proprietary server-side spell scripts.

## Validation

`tests/caitlyn-animation.test.js` loads the actual exported rig, checks all original clips/full runtime track coverage, samples Q/W/E at eight bearings, checks finite above-ground combat poses, AA-to-run/recovery, repeated headshot blending, R channel/fire/end/cancel, and emote-only prop visibility. The gameplay engine remains the authority for range, collision, windup, damage and cooldowns.
