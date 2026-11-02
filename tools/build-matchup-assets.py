"""Convert selected, verified original clips and VFX textures; never modify game files."""
from pathlib import Path
from io import BytesIO
import sys, os, shutil, subprocess, json, struct
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools/python-deps'))
from cdtb.export import TexConverter
from PIL import Image
CLIPS={'ahri':['idle1','run','spell1','spell3_north','spell3_south','spell3_east','spell3_west'],
       'locke':['idle_base','run','spell1_l','spell1_r']}
TEXTURES={'ahri':['ahri_base_q_orbbackground','ahri_base_q_orbedge','ahri_base_q_trail_01','ahri_base_e_heart_01','ahri_base_e_trail_01'],
          'locke':['lock_base_q_trail_v2','locke_q_nailtipblnd','locke_q_cursed_trail_base3']}
env=os.environ.copy();env['DOTNET_ROOT']=str(ROOT/'tools/dotnet');env['PATH']=env['DOTNET_ROOT']+os.pathsep+env.get('PATH','')
for champion,names in CLIPS.items():
    asset=ROOT/f'tools/{champion}-original/assets/characters/{champion}/skins/base'
    clips=ROOT/f'tools/{champion}-verified-clips';clips.mkdir(exist_ok=True)
    for name in names:shutil.copy2(asset/f'animations/{name}.anm',clips/f'{name}.anm')
    public=ROOT/f'public/assets/{champion}'
    subprocess.run([str(ROOT/'tools/lol2gltf.exe'),'skn2gltf','-m',str(asset/f'{champion}_base.skn'),'-s',str(asset/f'{champion}_base.skl'),'-a',str(clips),'-g',str(public/f'{champion}.glb')],env=env,check=True,stdout=subprocess.DEVNULL)
    for name in TEXTURES[champion]:
        Image.open(BytesIO(TexConverter.tex_to_dds((asset/f'particles/{name}.tex').read_bytes()))).save(public/f'{name}.png')
    print(champion,len(names),'original clips converted')
