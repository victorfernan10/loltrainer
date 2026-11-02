"""Convert the installed Brand base rig and selected original dodge VFX.

Run extract-dodge-champion.py brand first. Source WAD is never modified.
"""
from pathlib import Path
from io import BytesIO
import json, os, shutil, struct, subprocess, sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools/python-deps'))
from cdtb.export import TexConverter
from PIL import Image
SOURCE=ROOT/'tools/brand-original'
BASE=SOURCE/'assets/characters/brand/skins/base'
OUT=ROOT/'public/assets/dodge'
MODELS=OUT/'models';MODELS.mkdir(parents=True,exist_ok=True)
STAGE=SOURCE/'conversion';STAGE.mkdir(exist_ok=True)
clips=['brand_idle1','brand_run','brand_spell1','brand_spell2']
for name in clips:shutil.copy2(BASE/f'animations/{name}.anm',STAGE/f'{name}.anm')
env=dict(os.environ,DOTNET_ROOT=str(ROOT/'tools/dotnet'))
result=subprocess.run([str(ROOT/'tools/lol2gltf.exe'),'skn2gltf','-m',str(BASE/'brand.skn'),'-s',str(BASE/'brand.skl'),'-a',str(STAGE),'-g',str(MODELS/'brand_animated.glb')],env=env,capture_output=True,text=True)
if result.returncode:raise RuntimeError(result.stdout+result.stderr)
textures={'brand_base_tx_cm':'brand','brand_base_q_radgrad':'brand_q_core','brand_base_q_smoke_trail':'brand_q_trail','brand_base_blurnoise':'brand_q_noise','brand_base_q_mask_01':'brand_q_mask','srx_infernal_brazier_lavaflow':'brand_q_lava','brand_base_q_swipe_mult':'brand_q_flame','brand_base_w_lavacracks':'brand_w_cracks','brand_base_w_fireup':'brand_w_pillar','brand_base_w_ring_shockwave_2':'brand_w_ring','brand_base_e_circlethin':'brand_w_charge','brand_base_w_13':'brand_w_border'}
for native,label in textures.items():
    source=BASE/(native+'.tex') if native=='brand_base_tx_cm' else BASE/'particles'/(native+'.tex')
    Image.open(BytesIO(TexConverter.tex_to_dds(source.read_bytes()))).save(OUT/(label+'.png'))

def scb_to_obj(native,label):
    data=(BASE/'particles'/(native+'.scb')).read_bytes()
    assert data[:8]==b'r3d2Mesh' and struct.unpack_from('<HH',data,8)==(3,2)
    count,faces,flags=struct.unpack_from('<III',data,140);colored=struct.unpack_from('<I',data,176)[0];offset=180
    verts=[struct.unpack_from('<3f',data,offset+i*12) for i in range(count)]
    offset+=count*12+count*4*colored+12
    lines=['# Native Brand SCB mesh; UVs unchanged']+['v '+' '.join(map(str,v)) for v in verts]
    indices=[]
    for i in range(faces):
        ids=struct.unpack_from('<3I',data,offset);uv=struct.unpack_from('<6f',data,offset+76);offset+=100
        for j in range(3):lines.append(f'vt {uv[j]} {uv[j+3]}')
        indices.append('f '+' '.join(f'{ids[j]+1}/{i*3+j+1}' for j in range(3)))
    assert offset+(faces*9 if flags&1 else 0)==len(data)
    (MODELS/(label+'.obj')).write_text('\n'.join(lines+indices)+'\n')
    return {'file':label+'.obj','source':native+'.scb','vertices':count,'triangles':faces,'bounds':[[min(v[i] for v in verts),max(v[i] for v in verts)] for i in range(3)]}
meshes=[scb_to_obj('brand_base_q_mis_energyflame','brand_q_missile'),scb_to_obj('brand_base_w_fireup','brand_w_pillar'),scb_to_obj('brand_base_w_ring_outline','brand_w_ring')]
data=(MODELS/'brand_animated.glb').read_bytes();size=struct.unpack_from('<I',data,12)[0];gltf=json.loads(data[20:20+size])
record={'sourceManifest':'tools/brand-original/manifest.json','skinScale':1.75,'clips':[a['name'] for a in gltf['animations']],'materials':[m['name'] for m in gltf['materials']],'textures':textures,'meshes':meshes}
(OUT/'brand-resources.json').write_text(json.dumps(record,indent=2))
print(json.dumps(record,indent=2))

