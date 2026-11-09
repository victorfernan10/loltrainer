"""Convert Caitlyn's base rig, all authored clips, trap entity, Q and E particles.
REA cannot open WAD; this uses verified CDTB format extraction. Game stays read-only.
"""
from pathlib import Path
from io import BytesIO
import sys,json,os,subprocess,shutil,struct,hashlib
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools/python-deps'))
from cdtb.export import TexConverter
from PIL import Image
SOURCE=ROOT/'tools/caitlyn-original';OUT=ROOT/'public/assets/caitlyn';OUT.mkdir(exist_ok=True,parents=True)
manifest=json.loads((SOURCE/'manifest.json').read_text());assert hashlib.sha256(Path(manifest['source']).read_bytes()).hexdigest()==manifest['sha256']
load=lambda name:json.loads((SOURCE/(name+'.json')).read_text())
skin=next(v['skinMeshProperties'] for v in load('skin0').values() if isinstance(v,dict) and 'skinMeshProperties'in v)
trap=next(v['skinMeshProperties'] for v in load('trap-skin0').values() if isinstance(v,dict) and 'skinMeshProperties'in v)
env=dict(os.environ,DOTNET_ROOT=str(ROOT/'tools/dotnet'))
def convert(label,mesh,skeleton,animations):
 staging=SOURCE/'conversion'/label;staging.mkdir(exist_ok=True,parents=True)
 for path in animations:shutil.copyfile(SOURCE/path.lower(),staging/Path(path).name.lower())
 result=subprocess.run([str(ROOT/'tools/lol2gltf.exe'),'skn2gltf','-m',str(SOURCE/mesh.lower()),'-s',str(SOURCE/skeleton.lower()),'-a',str(staging),'-g',str(OUT/(label+'.glb'))],env=env,capture_output=True,text=True)
 if result.returncode:raise RuntimeError(result.stdout+result.stderr)
 data=(OUT/(label+'.glb')).read_bytes();g=json.loads(data[20:20+struct.unpack_from('<I',data,12)[0]])
 return {'file':label+'.glb','mesh':mesh,'skeleton':skeleton,'animations':animations,'clips':[a['name'] for a in g.get('animations',[])],'materials':[a['name'] for a in g.get('materials',[])],'bytes':len(data)}
base='assets/characters/caitlyn/skins/base/';tb='assets/characters/caitlyntrap/skins/base/'
models=[convert('caitlyn',skin['simpleSkin'],skin['skeleton'],[p.relative_to(SOURCE).as_posix() for p in (SOURCE/base/'animations').glob('*.anm')]),convert('trap',trap['simpleSkin'],trap['skeleton'],[tb+'animations/'+n+'.anm' for n in ['set','idle','attack1','death']])]
for label,mesh,anims in [('q-missile','caitlyn_base_qvfx_rg',['caitlyn_base_q_1_loop','caitlyn_base_q_2_anim']),('e-net','caitlyn_base_entrapment_mis_net',['caitlyn_base_entrapment_mis_net'])]:models.append(convert(label,base+'particles/'+mesh+'.skn',base+'particles/'+mesh+'.skl',[base+'particles/'+n+'.anm' for n in anims]))
textures=[]
for p in (SOURCE/'assets/characters').rglob('*.tex'):
 if 'loadscreen' in p.name:continue
 dest=OUT/(p.stem+'.png');Image.open(BytesIO(TexConverter.tex_to_dds(p.read_bytes()))).save(dest)
 textures.append({'file':dest.name,'source':p.relative_to(SOURCE).as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(OUT/'resources.json').write_text(json.dumps({'sourceWadSha256':manifest['sha256'],'skinScale':skin['skinScale'],'hiddenMaterials':['Teacup','Flag'],'trapScale':trap['skinScale'],'models':models,'textures':textures},indent=2))
for m in models:print(m['file'],len(m['clips']),'clips',m['materials'],m['bytes'],'bytes')
print(len(textures),'textures')
