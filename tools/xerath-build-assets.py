"""Convert the verified base Xerath rig, all 25 ANMs and original VFX resources.

REA's WAD open returned target_unavailable/unsupported binary format. The existing
format-aware CDTB extraction is verified against its source hash before conversion.
No installed game files are modified. Renderer timing/composition is reconstructed.
"""
from pathlib import Path
from io import BytesIO
import hashlib,json,os,struct,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools/python-deps'))
from cdtb.export import TexConverter
from PIL import Image
source=ROOT/'tools/xerath-original';manifest=json.loads((source/'manifest.json').read_text())
wad=Path(manifest['source'])
assert hashlib.sha256(wad.read_bytes()).hexdigest()==manifest['sha256'],'Installed WAD changed; extract and verify again first'
base=source/'assets/characters/xerath/skins/base'
out=ROOT/'public/assets/xerath';out.mkdir(parents=True,exist_ok=True)
env=dict(os.environ,DOTNET_ROOT=str(ROOT/'tools/dotnet'))
subprocess.run([str(ROOT/'tools/lol2gltf.exe'),'skn2gltf','-m',str(base/'xerath.skn'),'-s',str(base/'xerath.skl'),'-a',str(base/'animations'),'-g',str(out/'xerath.glb')],env=env,check=True)
records=[]
common={'common_zapball2','common_lightning02','common_lightning_beam_thin_glow','common_flashblue_02','common_glow-soft','common_sparks','common_flare-blue','common_circle-flares','common_whitesquare'}
for path in base.rglob('*.tex'):
    if path.stem!='xerath_base_tx_cm' and not path.stem.startswith('xerath_base_') and path.stem not in common:continue
    dest=out/(path.stem+'.png')
    Image.open(BytesIO(TexConverter.tex_to_dds(path.read_bytes()))).save(dest)
    records.append({'file':dest.name,'source':str(path.relative_to(source)).replace('\\','/'),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
meshes={'xerath_base_r_aoering':'r-ring','xerath_base_z_praxisring':'impact-ring','xerath_base_z_warpedsphere':'warped-sphere'}
for path in (base/'particles').glob('*.scb'):
    if path.stem not in meshes:continue
    data=path.read_bytes();assert data[:8]==b'r3d2Mesh'
    major,minor=struct.unpack_from('<HH',data,8);assert (major,minor) in [(3,1),(3,2)]
    count,faces,flags=struct.unpack_from('<III',data,140);colored=struct.unpack_from('<I',data,176)[0] if minor>=2 else 0
    offset=180 if minor>=2 else 176
    vertices=[struct.unpack_from('<3f',data,offset+i*12) for i in range(count)];offset+=count*12+count*4*colored+12
    positions=[];uv=[];materials=[]
    for i in range(faces):
        ids=struct.unpack_from('<3I',data,offset);material=data[offset+12:offset+76].split(b'\0')[0].decode();tex=struct.unpack_from('<6f',data,offset+76);offset+=100
        materials.append(material)
        for j,index in enumerate(ids):positions.extend(vertices[index]);uv.extend([tex[j],tex[j+3]])
    assert offset+(faces*9 if flags&1 else 0)+(24 if flags&4 else 0)==len(data)
    dest=out/(meshes[path.stem]+'.json');dest.write_text(json.dumps({'positions':positions,'uv':uv,'materials':sorted(set(materials))},separators=(',',':')))
    records.append({'file':dest.name,'source':str(path.relative_to(source)).replace('\\','/'),'sha256':hashlib.sha256(data).hexdigest()})
glb=(out/'xerath.glb').read_bytes();gltf=json.loads(glb[20:20+struct.unpack_from('<I',glb,12)[0]])
skin=json.loads((source/'skin0.json').read_text())['Characters/Xerath/Skins/Skin0']['skinMeshProperties']
(out/'resources.json').write_text(json.dumps({'sourceWadSha256':manifest['sha256'],'skinScale':skin['skinScale'],'selfIllumination':skin['selfIllumination'],'clips':[a['name'] for a in gltf['animations']],'resources':records},indent=2))
print('Xerath:',len(gltf['animations']),'original animation clips;',len(records),'VFX/texture resources;',len(glb),'model bytes')
