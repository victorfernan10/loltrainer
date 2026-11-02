from pathlib import Path
import os
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / "tools" / "game-extract"
CLIPS = ROOT / "tools" / "dodge-animation-clips"
OUT = ROOT / "public" / "assets" / "dodge" / "models"
CONVERTER = ROOT / "tools" / "lol2gltf.exe"
DOTNET = ROOT / "tools" / "dotnet"

CHAMPIONS = {
    "xerath": ("xerath", "xerath", ("xerath_idle1.anm", "xerath_run.anm"), ("xerath_spell1.anm",)),
    "nautilus": ("nautilus", "nautilus", ("nautilus_idle1.anm", "nautilus_run.anm"), ("nautilus_spell1.anm",)),
    "thresh": ("thresh", "thresh", ("thresh_idle1.anm", "thresh_run.anm"), ("thresh_spell1_in.anm", "thresh_spell1_out.anm")),
    "lux": ("lux", "lux", ("lux_idle1.anm", "lux_run.anm"), ("lux_spell4.anm",)),
    "ezreal": ("ezreal", "ezreal_base", ("ezreal_idle.anm", "ezreal_run.anm"), ("ezreal_spell1.anm",)),
}


def convert(name, character_dir, mesh_prefix, animation_files, clip_set):
    asset_root = GAME / name / "assets" / "characters" / character_dir / "skins" / "base"
    skn = asset_root / f"{mesh_prefix}.skn"
    skl = asset_root / f"{mesh_prefix}.skl"
    animation_dir = asset_root / "animations"
    clips_out = CLIPS / name / clip_set
    clips_out.mkdir(parents=True, exist_ok=True)
    for stale in clips_out.glob("*.anm"):
        stale.unlink()
    for animation_file in animation_files:
        source = animation_dir / animation_file
        if not source.exists():
            raise FileNotFoundError(source)
        shutil.copy2(source, clips_out / source.name)

    suffix = 'animated' if clip_set == 'idle' else ('r_cast' if name == 'lux' else 'cast')
    output = OUT / f"{name}_{suffix}.glb"
    env = os.environ.copy()
    env["DOTNET_ROOT"] = str(DOTNET)
    env["PATH"] = str(DOTNET) + os.pathsep + env.get("PATH", "")
    subprocess.run(
        [str(CONVERTER), "skn2gltf", "-m", str(skn), "-s", str(skl), "-g", str(output), "-a", str(clips_out)],
        cwd=ROOT,
        env=env,
        check=True,
    )
    print(f"{name}/{clip_set}: {output.stat().st_size:,} bytes, {len(animation_files)} official clips")


for champion, config in CHAMPIONS.items():
    character_dir, mesh_prefix, idle_files, cast_files = config
    convert(champion, character_dir, mesh_prefix, idle_files, "idle")
    convert(champion, character_dir, mesh_prefix, cast_files, "cast")
