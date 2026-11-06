# Xerath playable model and original resources

## Evidence and scope

- Installed source: `E:/Riot Games/League of Legends/Game/DATA/FINAL/Champions/Xerath.wad.client`.
- SHA-256 verified again by the conversion script: `a29a37e41e65fb3d6692a9c90f3fd7a7806cb8f34c0ec6f9db4ec3fab6653708`.
- Existing CDTB 1.3.0 extraction: `tools/xerath-original/manifest.json` (225 resources), decoded character/animation/skin records in that directory. Extraction files remain local; the runtime resource inventory is published in `public/assets/xerath/resources.json`.
- REA `open_binary` was requested against that exact installed WAD. The provider returned `target_unavailable`, reason `unsupported binary format`; it returned no successful Evidence ID. No native runtime, proprietary shader execution or particle scheduler was observed. Subsequent findings are **format-parser observations**, not REA runtime observations.
- `tools/xerath-build-assets.py` verifies the WAD identity, converts the original SKN/SKL and all ANMs with the existing `lol2gltf` tool, and converts TEX/SCB resources. It never edits the installed game.

## Model binding

`public/assets/xerath/xerath.glb` contains **25 original animation clips**, a single skinned mesh and 99 joints. Every exported clip contains all 297 joint TRS tracks. The sole material is `xarin_base_MD_v05_lambert2`; apply `xerath_base_tx_cm.png`, flipped Y off, sRGB, double sided. No exported vertex-color channel exists, and the skin does not declare props/submeshes to hide. No substitute meshes or billboard angles were used.

`skinMeshProperties.skinScale = 1.7000000476837158` and `selfIllumination = 0.699999988079071` are observed skin parameters. The exported material uses `KHR_materials_unlit`. The full model already contains its original floating limbs/armor. Do not normalize separate limbs or remove bones. Idle/raw mesh spans approximately y29.6–160.7; this is an intentionally floating champion. Source animations and yaw are 3D, not fixed-direction sprites.

## Authored animation mapping

| State | Original animation resource |
|---|---|
| Idle/run | `xerath_idle1`, `xerath_run` |
| Basic attacks | graph Attack1 → `xerath_attack3`; Attack2 → `xerath_attack2` |
| Q charge start/loop/release | `xerath_channel_windup`, `xerath_channel`, `xerath_spell1` |
| W | graph Spell4 → `xerath_spell4` |
| E | graph Spell3 → `xerath_spell3` |
| R start/loop/shot/end | `spell5start`, `spell5loop`, `spell5_fast`, `spell5end` |

The Q charge record declares `Channel_WNDUP` and winddown `Spell1`; the W spell record declares **Spell4**, not Spell2. The animation graph gives `spell5_fast` a 1/60-second tick. Its GLB resource duration is 2.3s; the trainer fits the visual shot/recovery into its committed shot interval. That playback rate, blend timing and state scheduling are reconstruction decisions. Damage/collision/cooldowns are owned by `XerathCombat`, never the animator.

`XerathAnimator.cast(event,time)` consumes Q `charge/release/cancel/end/expire` and R `channel/start/shot/end/cancel/expire` phases, with `ability` or `key` identifying the spell. `update` optionally reads public `charge` and `channel` objects: `undefined` leaves event-driven holds intact, `null` ends an active hold. On successive R shots the animator alternates two actions of the same original clip, allowing crossfade without resetting the sole weighted action into bind pose. Idle fallback also protects missing tracks.

## Original VFX resources

43 TEX/SCB-derived runtime resources are listed with source-file SHA-256s in `resources.json`. All images come from the shipped base skin; particle composition, lifetime and blending require a separate renderer reconstruction.

- Q: `xerath_base_q_beam`, `_beamenergy`, `_beam_01`, `_beam_02`, `_beam_03`, `_beam_mult`.
- W: `xerath_base_w_targetring`, `_skybeam`, `_blastdome`, `_scorch`.
- R: `xerath_base_r_aoering_tx`; `xerath_base_z_mortar`, `_nova`, `_praxiswave`.
- E/shared energy: `common_zapball2`, `common_lightning02`, `xerath_base_z_warpedsphere_tx`, `_02`, `_boltsblue`, `_energywisps`, `_energyswirls_1x4`, `_energy_4x4_blur`.
- `r-ring.json`: original horizontal XZ ring at y26.4, approximately ±1019 units. Scale radius accordingly and offset its authored height if ground anchored.
- `impact-ring.json`: horizontal XZ ring at y0, approximately ±164 units.
- `warped-sphere.json`: original sphere mesh approximately ±1.6 units in XYZ.

Particle JSON includes non-indexed triangle `positions`, `uv`, and source materials. The converted rings are already horizontal; do not rotate them by another 90 degrees.

## Validation

`node --test tests/xerath-animation.test.js`: both tests passed. Uses the actual GLB, verifies all clips/joints, samples actual skinned vertices (updated skeleton matrices), tests Q/W/E at eight yaw angles, fast AA → run, Q moving charge/release/cancel, successive R shots, loop/ending recovery, and reset. All sampled combat poses remain finite and above the ground; no snapshot-only/static bounds are used for those assertions.

The source graph/data and original pixels establish resource identity. They do not establish pixel-perfect League rendering or exact runtime animation blending; those remain explicit reconstruction limits.
