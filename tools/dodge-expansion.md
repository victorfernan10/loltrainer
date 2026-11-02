# Dodge expansion — implementation and evidence

The general dodge pool now contains 8 casters and 11 spells: the previous five,
plus Morgana Q, Blitzcrank Q, Brand Q/W, Lux Q and Xerath E. Original idle/run/cast
clips are selected per ability. Sibling spells share one champion, and never
produce a duplicate caster in the same wave.

REA `open_binary` on the installed Brand.wad.client returned `target_unavailable`
with reason `unsupported binary format`. Extraction therefore uses the existing
format-aware CDTB pipeline, without modifying the installation. Evidence and
rebuild paths for new champions are in `dodge-mb-evidence.md` and
`dodge-brand-evidence.md`. Lux/Xerath extra casts are built by
`build-dodge-extra-casts.py` from their original extracted animation resources.

Lux Q uses the actual LuxLightBindingMis missile definition: range 1300,
radius-like width 70 (trainer full width 140), speed 1200, cast .25s. Its displayed
1175 range differs from the actual missile field. Xerath E uses MageSpear's
Range DataValue 1125 and MageSpearMissile speed 1400/radius 60; the wrapper's 1600
speed is not the missile movement component. Sources: `tools/dodge-rules/*.json`.
Morgana's .25s cast and Brand W's total .875s delay are explicit calibrations,
not proven server timings. Particles are reconstructed with extracted textures;
this is a dodge/hit exercise, without reproducing the spells' full crowd control.

Brand W uses a circle at the committed, range-clamped aim point, with radius240
plus the player's radius65. Its native textured charge signal remains visible
in advanced mode. Threat accounting, escape commands, replay and damage all use
that area center rather than treating the cast as a line.

Pressure level3 generates up to3 different casters. Current and predicted aim
alternate; sequential delays prevent approaches from collapsing into one cast
frame. A balanced skill bag covers enabled spells before refilling. Difficulty
changes wave composition and downtime, not spell speed, width or release time.
Range floors are placement guidance, not guarantees that every combined volley
can be avoided after a late input. Ready casters are not blocked by an ally who
is still chasing. Ruleset5 separates new reports from older difficulty settings.

Flash is F toward the cursor, up to400 units, 10 simulated seconds of cooldown.
It is enabled for precision/rhythm/pressure/Ahri/Locke dodge drills, blocked while
paused or charmed, and reset on a new block. Teleports do not sweep collision
across the intervening path. Review records mark the discontinuity; the movement
observer retains its delayed perception rather than learning the new position
immediately. No terrain/wall mechanics exist in this arena.

Morgana rendering fix: the converted vertex-color channel suppressed the browser
color pass while leaving a shadow. Disabling that channel restores her original
diffuse atlas, verified visually. Blitzcrank normalized model height reduced from
225 to170 without changing its projectile geometry or collision.

Validation: unit suite, production build, and `tools/check-dodge-expansion.mjs`
cover all11 stationary spell collisions and native casts, triple waves, F-key
input, cooldown rejection, a second Flash after10s, pause and report rendering.
Screenshots: `dodge-models-corrected.png`, `brand-w-warning.png`,
`dodge-flash-cooldown.png`, `dodge-expansion-report.png`.
