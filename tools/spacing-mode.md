# AA spacing drill

Caitlyn650 versus Lucian500, using edge-to-edge gameplay distance (each radius applied once,65 units). Lucian source was exported with tools/lucian-build-assets.py; public/assets/lucian/resources.json records its hash and animations. Native values: move335, base AS.638 plus2.5% growth per level, projectile2800. Windup .15 uses .3 default plus local offset-.15. Eight original clips, scale1.05, complete255 joint tracks per clip.

Training policy is authored, not Riot AI: difficulties1/2/3 observe movement after320/200/110ms and adjust footwork/feints/retreat distance. Physical speeds, ranges and per-level AS stay unchanged. Lucian stands during windup, cancels if range is lost before release, and launched homing bullets still hit after retreat. This release-range rule is a deliberate trainer policy. Repeated range entry cannot restart a running windup each frame.

Call encounter.update BEFORE player combat.update, then observe drained player events. SpacingView owns presentation only. Enemy bullet impacts apply damage; stun blocks AA/movement, root blocks movement, slow scales walking. Respawn resets debuffs/generation. Ending drains launched bullets and a bounded .9s trade assessment.

A clean point requires an AA released between500 and650, no CC assistance (including slow) and no enemy release in its trade window. Skill hits and marked Headshots outside650 do not inflate scores. Reports retain hits/releases, clean points, responses, cancellations, range-band time and streak. Optional skills are included in history comparability. No gameplay hitbox ring is forced visible.

Tests include actual Caitlyn combat: deterministic 30s trials confirm holding attack receives retaliation while timed retreat/re-entry yields clean attacks. Native Lucian clips stay finite/grounded at eight bearings. UI and eleven-mode playlist are browser-tested.
