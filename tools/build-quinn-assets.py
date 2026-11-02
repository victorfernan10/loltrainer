"""Convert Quinn's shipped base rig, graph-referenced clips, and Valor VFX rigs.

Source provenance: tools/quinn-original/manifest.json (read-only WAD extraction).
No game files are changed. Native particle rendering remains a separate concern.
"""
from pathlib import Path
from io import BytesIO
import sys, json, os, subprocess, shutil, struct
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools/python-deps'))
from cdtb.export import TexConverter
from PIL import Image
SOURCE=ROOT/'tools/quinn-original';OUT=ROOT/'public/assets/quinn';OUT.mkdir(exist_ok=True,parents=True)
skin_data=json.loads((SOURCE/'skin0.json').read_text())
skin=skin_data['Characters/Quinn/Skins/Skin0']['skinMeshProperties']
graph=json.loads((SOURCE/'animation-map.json').read_text())['Characters/Quinn/Animations/Skin0']['mClipDataMap']
env=dict(os.environ,DOTNET_ROOT=str(ROOT/'tools/dotnet'))

def convert(label,mesh,skeleton,animations):
    staging=SOURCE/'conversion'/label;staging.mkdir(exist_ok=True,parents=True)
    for path in animations:shutil.copyfile(SOURCE/path.lower(),staging/Path(path).name.lower())
    result=subprocess.run([str(ROOT/'tools/lol2gltf.exe'),'skn2gltf','-m',str(SOURCE/mesh.lower()),'-s',str(SOURCE/skeleton.lower()),'-a',str(staging),'-g',str(OUT/(label+'.glb'))],env=env,capture_output=True,text=True)
    if result.returncode:raise RuntimeError(result.stdout+result.stderr)
    data=(OUT/(label+'.glb')).read_bytes();size=struct.unpack_from('<I',data,12)[0];gltf=json.loads(data[20:20+size])
    return {'file':label+'.glb','mesh':mesh,'skeleton':skeleton,'animations':animations,'clips':[x['name'] for x in gltf.get('animations',[])],'materials':[x['name'] for x in gltf.get('materials',[])]}

refs=list(dict.fromkeys(v['mAnimationResourceData']['mAnimationFilePath'] for v in graph.values() if 'mAnimationResourceData' in v))
models=[convert('quinn',skin['simpleSkin'],skin['skeleton'],refs)]
valor_skin=next(v['skinMeshProperties'] for v in json.loads((SOURCE/'valor-skin0.json').read_text()).values() if isinstance(v,dict) and 'skinMeshProperties' in v)
valor_graph=next(iter(json.loads((SOURCE/'valor-animation-map.json').read_text()).values()))['mClipDataMap']
valor_refs=list(dict.fromkeys(v['mAnimationResourceData']['mAnimationFilePath'] for v in valor_graph.values() if 'mAnimationResourceData' in v))
models.append(convert('valor',valor_skin['simpleSkin'],valor_skin['skeleton'],valor_refs))
base='assets/characters/quinn/skins/base/particles/'
for label,mesh,clips in [
    ('valor-q','quinn_base_q_mis_valor',['quinn_base_q_mis_birdflight']),
    ('valor-hit','quinn_base_q_aoe_unit_tar_valor',['quinn_base_q_aoe_unit_tar_valor']),
    ('valor-cast','quinnvalor_q',['quinnvalor_q_bird_cast04','quinnvalor_q_bird_flight04','quinnvalor_dive','quinnvalor_respawn']),
]:models.append(convert(label,base+mesh+'.skn',base+mesh+'.skl',[base+n+'.anm' for n in clips]))
textures=[]
names=['quinn_base_tx_cm','quinn_base_q_mis_valor','quinn_base_q_aoe_unit_tar_valor','quinnvalor_props_01','quinn_base_e_trail','quinn_base_w_ring','quinn_base_r_channel_whisp','quinn_base_r_light']
names.append('quinnvalor_base_tx_cm')
for p in (SOURCE/'assets/characters').rglob('*.tex'):
    if p.stem not in names:continue
    dest=OUT/(p.stem+'.png');Image.open(BytesIO(TexConverter.tex_to_dds(p.read_bytes()))).save(dest)
    textures.append({'file':dest.name,'source':p.relative_to(SOURCE).as_posix()})
records={'skinScale':skin['skinScale'],'texture':'quinn_base_tx_cm.png','model':'quinn.glb','valorSkinScale':valor_skin['skinScale'],'valorTexture':'quinnvalor_base_tx_cm.png','valorModel':'valor.glb','models':models,'textures':textures,'graphClips':{k:Path(v['mAnimationResourceData']['mAnimationFilePath']).stem for k,v in graph.items() if 'mAnimationResourceData' in v}}
(OUT/'resources.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
for m in models:print(m['file'],len(m['clips']),'clips',m['materials'])
