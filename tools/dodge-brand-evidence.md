# Brand dodge resources — 2026-11-01

The installed `E:/Riot Games/League of Legends/Game/DATA/FINAL/Champions/Brand.wad.client`
was read with CDTB 1.3.0. Source offsets, byte counts and SHA-256 hashes are retained
in `tools/brand-original/manifest.json`. No installed game files were modified.

## Model and animations

`skin0.json` selects `brand.skn`, `brand.skl`, `brand_base_tx_cm.tex` and native
skinScale 1.75. The model has one material, `riotRig:lambert4`, with no base
hidden-submesh filter. `animation-map.json` explicitly maps Idle1, Run, Spell1
and Spell2 to the four clips exported into `brand_animated.glb`:

| Clip | Duration | Tracks |
|---|---:|---:|
| brand_idle1 | 4 s | 210 |
| brand_run | 7.966667 s | 210 |
| brand_spell1 | 0.966667 s | 210 |
| brand_spell2 | 1 s | 210 |

Node/Three GLTFLoader sampled each clip at three distinct times. All 70 bones'
quaternions and recomputed skinned bounds were finite and changed between poses;
see `animation-validation.json`. Idle height is approximately 125 source units,
or 219 game units at the native scale. Recommended normalized height: 220.

## Gameplay fields observed in character.json

Q wrapper `Characters/Brand/Spells/BrandQAbility/BrandQ` has cast time 0.25 s.
Its generic castRange 25000, castRadius 210 and missileSpeed 1200 are **not** the
actual projectile's geometry/motion. The separate `BrandQMissile` resource has:

- castRange 1100;
- mMissileWidth 60, represented as radius 60 / diameter 120 in trainer convention;
- FixedSpeedMovement mSpeed 1600 and missileSpeed 1600;
- mTracksTarget false, mProjectTargetToCastRange true, start bone L_hand;
- DestroyOnHit and DestroyOnMovementComplete behaviors.

W `Characters/Brand/Spells/BrandWAbility/BrandW` has castRange 900,
castRadius 240, spellCastTime 0.25 and Area targeting. Its missileSpeed 20 is a
wrapper placeholder, not a moving projectile. No W gameplay explosion-delay
constant was recovered from the selected client BINs.

The commonly documented 0.625 s eruption delay is secondary evidence
([Riot Codex, an unofficial database](https://riotcodex.net/champions/Brand)).
Using a 0.25 s cast followed by 0.625 s delay (0.875 s total) is an explicit
simulation calibration, not proven server timing. The native charge particle
ring has lifetime 0.7 s, which is visual corroboration only. Do not infer damage
time directly from the particle lifespan.

## Native particle resources

`selected-particles.json` retains decoded, source-linked Q projectile/impact and
W cast/charge/eruption definitions from the linked base-skin BINs. The exported
PNG and OBJ mappings are listed in `public/assets/dodge/brand-resources.json`.
The shader's noise multiplication, scroll, blend and emitter scheduling still
require reconstruction by the trainer renderer.

Q `Mis_Head_Bright1` references `brand_base_q_mis_energyflame.scb`, noise texture,
scale [1.5,1.8,1.5] and orange color [1,.53,0,.659]. A second layer uses the
same mesh, swipe texture plus mask, scale [2.1,3,2.1], color [1,.276,.116,1].
The source mesh extends along negative Y and must be oriented into the shot
direction. Additional lava-core emitters reference SRX_Infernal_Brazier_LavaFlow.

W charge `AOE Ring1` uses the exported `brand_w_charge.png`, orange [1,.416,0,1].
W eruption `Outer_Dust_Geo4` uses `brand_w_ring.obj` + `brand_w_ring.png`, native
scale [3.2,2.5,3.2], lifetime 0.5 s. Ground cracks and flame-column resources are
also exported. Their visible extent is independent of the numerical radius 240.

Rebuild: run `tools/extract-dodge-champion.py brand`, then `tools/build-dodge-brand.py`.
