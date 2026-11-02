# Ahri and Locke dodge challenges — installed snapshot, 2026-10-28

## Source and scope

Read-only inputs: `E:/Riot Games/League of Legends/Game/DATA/FINAL/Champions/Ahri.wad.client`
and `Locke.wad.client`. Complete source hashes and extracted-member byte ranges,
sizes and SHA-256 are in `ahri-original/manifest.json` and `locke-original/manifest.json`.
These are file observations, not captured live game/server execution.

REA CLI 6.4.0 `inspect-artifact` could not parse this proprietary WAD format
(`rea-locke-artifact.json`, `target_unavailable`). No successful REA Evidence ID
is claimed. The established CDTB reader performed extraction, and lol2gltf
converted the original skeletons, meshes and selected animation files.

`extract-dodge-champion.py ahri|locke` extracts the selected champion.
`build-matchup-assets.py` builds the validated clips and particle textures.
`convert-matchup-particles.py` converts the actual SCB nail, heart and sphere
meshes, including per-face UVs. SCB 3.2 layout was checked against the reader:
https://github.com/LeagueToolkit/LeagueToolkit/blob/main/src/LeagueToolkit/Core/Mesh/StaticMesh.cs
https://github.com/LeagueToolkit/LeagueToolkit/blob/main/src/LeagueToolkit/Core/Mesh/StaticMeshFace.cs

## Models

Ahri: original `idle1`, `run`, `spell1` and four directional `spell3_*` clips.
Runtime casts E with the north clip on a world-rotated full 3D rig. The other
directional variants remain imported. Body/eye texture and separate tail texture
come from the base skin. `Tail_Large`/`Body_Proxy` are hidden as declared by the skin.

Locke: original `idle_base`, `run`, `spell1_l` and `spell1_r`; Q alternates left,
right, left. The skin's initially hidden Nail, Weaponsmear and VFX_* props stay
hidden. Body, hair and weapon textures are separate. Both characters preserve
game-unit geometry; model bounds never rescale on animation changes.

Some Ahri transition ANMs generated non-finite quaternions in the existing
converter. Only individually validated clips are in the final GLBs. Missing
tracks in a clip are completed from original idle tracks; reset/re-enable and
short blend transitions prevent disabled idle actions and bind-pose flashes.
Procedural tail deformation, native shader parameters and the complete Riot
particle renderer are not reconstructed.

Skin0 contains newer material records CDTB does not fully understand. Entries
were read by declared entry lengths, retaining successful records in
`skin0-partial.json` with offsets/errors for unsupported entries. Both actual
SkinCharacterDataProperties records were decoded, including initial submesh
visibility. Partial material parsing is not presented as full coverage.

## Missile and control observations

Relevant decoded SpellObjects are retained in each `character.json`:

- AhriQ: cast .25 s; display range 970 (missile declaration 1000). Training uses
  the 970 range. AhriQMissile: initial speed 2500, acceleration -3200, min 400,
  max 2500, missile width 100.
- AhriQReturnMissile: initial/min 60, acceleration 1900, max 2600, width 100.
  Return homes to Ahri's position and can hit separately from the outgoing leg.
- AhriE: cast .25 s, display range 975 (missile declaration 1000). Training uses
  975. AhriEMissile: speed 1550, width 60, DestroyOnHit.
  CharmDuration by rank starts at 1.2 s, SlowPercent -.65; the drill uses rank 1.
- LockeQ: Ammo/MaxStacks 3; NailDuration 4; slow amounts .25/.25/.60,
  durations 1/1/2 s. LockeQMissile: cast .25, range 950, speed 1650, width 60.
  Basic Q has a 0 cast-time wrapper; the actual missile spell supplies .25.
  The automatic attack timing flag also exists; variable attack-speed scaling
  and server scripting were not recovered for this drill.

`matchup-data.js` represents full collision diameter: 200 for the orb, 120
for Charm/nails. A player's 65 radius is added once. Collision uses relative
movement sweeps; a piercing missile cannot repeatedly hit the same player in
one leg. The return is recorded as its own attempt. Actual projectile paths
are saved for review, including curved returns.

## Explicit practice policies

The new dedicated drills do not implement either champion's full combat kit.
Ahri alternates E→Q and Q→E, or isolates Q/E via settings. Locke always casts
Q1→Q2→Q3. Every cast commits its own aim; difficulty changes prediction and
spacing, never projectile speed. Locke start-to-start spacing is 1.05/.78/.55 s
(practice calibration, not a claim that the queue-threshold BIN field proves
the server recast cooldown). Each fresh sequence resets cooldowns and starts
from a random direction; characters reposition between casts. Session stop
drains active missiles and control effects. Pause freezes simulation/animation.

VFX uses original textures and actual SCB meshes, rendered with Three.js
materials and reconstructed trails. Color, glow, scale and emitter behavior
are calibrated presentation, not an exact reproduction of Riot shaders.

## Checks

- Unit tests: both Q legs, current-position homing, Charm control, three Locke
  recasts, hit-only stacks, slow expiry, relative collision sweep, pause/drain.
- Actual imported rigs: repeated cast/run/idle cycles at 360-degree rotations,
  finite transforms and enabled animation weights.
- `check-matchups.mjs`: both visible UI entries, load/start, original animations,
  real projectile renders, pause, full sequences, results, single-shot replay,
  reset and no browser errors.
