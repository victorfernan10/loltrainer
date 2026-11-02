# Morgana and Blitzcrank dodge resources

Read-only sources: installed `Game/DATA/FINAL/Champions/Morgana.wad.client`
and `Blitzcrank.wad.client`. Exact SHA-256, extracted member paths and hashes
are in `tools/morgana-original/manifest.json` and
`tools/blitzcrank-original/manifest.json`. These are locally installed patch
resources, not proof of runtime server scripts. CDTB provides format-aware WAD,
BIN and texture parsing; lol2gltf converts the original SKN/SKL/ANM tracks.

## Model output

`tools/build-dodge-expansion-mb.py` builds:

| Caster | Original clips | Public model | Texture |
| --- | --- | --- | --- |
| Morgana | `morgana_idle1`, `morgana_run`, `morgana_spell1_0` | `dodge/models/morgana_animated.glb` | `dodge/morgana.png` |
| Blitzcrank | `blitzcrank_idle1`, `blitzcrank_run`, `blitzcrank_spell1` | `dodge/models/blitzcrank_animated.glb` | `dodge/blitzcrank.png` |

The native skin scales are Morgana 1.32 and Blitzcrank 1.35. Suggested heights
for the existing normalized caster renderer are 200 and 225 respectively;
those screen-size choices are calibration, not native skin scales.

Morgana Skin0 declares `initialSubmeshToHide = "wings_open flower"`. Only those
two primitives are removed. `wings_closed` and `wings_mid_open` remain, with
their original wing texture. Body and wing diffuse maps are copied into a
1024×512 atlas; UVs change only to address the two original 512×512 images.
No painted replacement is used. Morgana's global Skin0 BIN contains two entries
unsupported by this CDTB version. `skin0-partial.json` retains the two successfully
parsed, length-delimited records and explicitly lists unsupported entries with
offsets; the SkinCharacterDataProperties record parsed successfully.

Each resulting GLB was loaded through Three.js GLTFLoader. Every original idle,
run and cast clip was sampled across its full duration, with finite skinned
bounds and no missing animation bindings. Morgana has three visible skinned
primitives / 549 tracks per clip; Blitzcrank one / 138 tracks per clip.

## Q mechanics observed in character BIN

| Property | MorganaQ | RocketGrabMissile |
| --- | --- | --- |
| Actual cast range field | 1300 | 1080 |
| Display range override | 1250 | 1050 |
| FixedSpeedMovement / missileSpeed | 1200 | 1800 |
| mMissileWidth / mLineWidth | 70 | 70 |
| spellCastTime | 0 | 0.25 |
| castFrame | 4.545 | 7.5 |

The trainer uses full collision width 140 for these native radius-like width
fields. Both movement components have `mTracksTarget=false` and
`mProjectTargetToCastRange=true`: they travel toward a committed cast direction.
Morgana's zero wrapper cast time does not establish zero windup in gameplay;
any chosen nonzero training warning/cast delay needs explicit calibration.
Blitzcrank's parent `RocketGrab` has range 10000 and display override 1079;
use the missile's 1080 range instead of that script-wrapper placeholder.
`RocketGrab` also has `LolipopLength=70`. Endpoint acquisition expansion is a
separate server mechanic, not proven by a uniform capsule collision model.

## Original effect resources

Morgana: `morgana_base_q_mis_core.png`, `morgana_base_q_mis_energy.png`,
`morgana_base_q_firetrail.png`, `morgana_base_q_chaintrail.png`.

Blitzcrank: `blitzcrank_base_z_fist.png`, `blitzcrank_base_q_glow_01.png`,
`blitzcrank_base_q_smoke_01.png`, `blitzcrank_q_shape.png`, and
`models/blitzcrank_fist.obj` from `blitzcrank_base_z_golemfist.scb`.
Skin0 `Particles/Blitzcrank_Base_Q_mis` explicitly references that mesh and fist
texture. Its fist emitter has native birthScale 1.3 and birthRotation
[-90, 90, 0]; engine emitter-coordinate conventions still need mapping to the
trainer's projectile frame. The raw fist bounds are X[-32.207,32.208],
Y[-27.233,18.618], Z[0.627,41.800]. Textures and geometry are native; their
Three.js shading, emission scheduling and composition remain reconstructed.
