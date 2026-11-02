"""Add Lux Q/Xerath E casts from already extracted original base resources."""
from pathlib import Path
from io import BytesIO
import os, shutil, subprocess, sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools/python-deps'))
from cdtb.export import TexConverter
from PIL import Image
env=os.environ.copy();env['DOTNET_ROOT']=str(ROOT/'tools/dotnet');env['PATH']=env['DOTNET_ROOT']+os.pathsep+env.get('PATH','')
for champion,clip,key in [('lux','lux_spell1','q'),('xerath','xerath_spell3','e')]:
    asset=ROOT/f'tools/game-extract/{champion}/assets/characters/{champion}/skins/base'
    clips=ROOT/f'tools/dodge-animation-clips/{champion}/extra-{key}';clips.mkdir(parents=True,exist_ok=True)
    shutil.copy2(asset/f'animations/{clip}.anm',clips/f'{clip}.anm')
    output=ROOT/f'public/assets/dodge/models/{champion}_{key}_cast.glb'
    subprocess.run([str(ROOT/'tools/lol2gltf.exe'),'skn2gltf','-m',str(asset/f'{champion}.skn'),'-s',str(asset/f'{champion}.skl'),'-a',str(clips),'-g',str(output)],env=env,check=True,stdout=subprocess.DEVNULL)
    if champion=='xerath':
        for path in (asset/'particles').glob('xerath_base_e*.tex'):
            Image.open(BytesIO(TexConverter.tex_to_dds(path.read_bytes()))).save(ROOT/f'public/assets/dodge/{path.stem}.png')
    print(output.name,output.stat().st_size)
