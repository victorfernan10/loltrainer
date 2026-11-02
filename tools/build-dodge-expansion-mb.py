"""Build original Morgana/Blitzcrank dodge resources from read-only WAD extraction.

Run extract-dodge-champion.py for both first. Morgana's default hidden submeshes
are removed; the two original diffuse maps are atlased without repainting.
"""
from pathlib import Path
from io import BytesIO
import sys, os, subprocess, shutil, json, struct
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools/python-deps'))
from cdtb.export import TexConverter
from PIL import Image
OUT=ROOT/'public/assets/dodge';MODELS=OUT/'models'
env=dict(os.environ,DOTNET_ROOT=str(ROOT/'tools/dotnet'))

def texture(path):return Image.open(BytesIO(TexConverter.tex_to_dds(path.read_bytes()))).convert('RGBA')

def build(champion,clips):
    base=ROOT/f'tools/{champion}-original/assets/characters/{champion}/skins/base'
    stage=ROOT/f'tools/{champion}-original/conversion';stage.mkdir(exist_ok=True)
    for clip in clips:shutil.copyfile(base/f'animations/{clip}.anm',stage/f'{clip}.anm')
    dest=MODELS/f'{champion}_animated.glb'
    result=subprocess.run([str(ROOT/'tools/lol2gltf.exe'),'skn2gltf','-m',str(base/f'{champion}.skn'),'-s',str(base/f'{champion}.skl'),'-a',str(stage),'-g',str(dest)],env=env,capture_output=True,text=True)
    if result.returncode:raise RuntimeError(result.stdout+result.stderr)
    raw=dest.read_bytes();n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);binary=bytearray(raw[28+n:])
    if champion=='morgana':
        # Skin0 initialSubmeshToHide='wings_open flower'; mid/closed wings remain.
        primitives=g['meshes'][0]['primitives'];keep=[p for p in primitives if g['materials'][p['material']]['name'] not in ['wings_open','flower']]
        used={}
        for p in keep:
            ia=g['accessors'][p['indices']];iv=g['bufferViews'][ia['bufferView']];typ={5121:'B',5123:'H',5125:'I'}[ia['componentType']]
            ids=set(struct.unpack_from('<'+typ*ia['count'],binary,iv.get('byteOffset',0)+ia.get('byteOffset',0)))
            uid=p['attributes']['TEXCOORD_0'];seen=used.setdefault(uid,set())
            assert not ids&seen,'Atlas needs independent material vertices'
            seen|=ids;uv=g['accessors'][uid];bv=g['bufferViews'][uv['bufferView']];assert uv['componentType']==5126
            offset=bv.get('byteOffset',0)+uv.get('byteOffset',0);stride=bv.get('byteStride',8);shift=0 if p['material']==0 else .5
            for i in ids:
                at=offset+i*stride;u=struct.unpack_from('<f',binary,at)[0];struct.pack_into('<f',binary,at,u*.5+shift)
        g['meshes'][0]['primitives']=keep
        body=texture(base/'morgana_base_tx_cm.tex');wings=texture(base/'morgana_base_wings_tx_cm.tex');assert body.size==wings.size
        atlas=Image.new('RGBA',(body.width*2,body.height));atlas.paste(body,(0,0));atlas.paste(wings,(body.width,0));atlas.save(OUT/'morgana.png')
        encoded=json.dumps(g,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
        dest.write_bytes(struct.pack('<III',0x46546c67,2,12+8+len(encoded)+8+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary)
    else:texture(base/'steamgolem.tex').save(OUT/'blitzcrank.png')
    print(champion,'clips:',[c['name'] for c in g['animations']],'materials:',[g['materials'][p['material']]['name'] for p in g['meshes'][0]['primitives']])
    return base

def mesh_obj(path,name):
    data=path.read_bytes();assert data[:8]==b'r3d2Mesh';version=struct.unpack_from('<HH',data,8);assert version in [(3,1),(3,2)]
    count,faces,flags=struct.unpack_from('<III',data,140);colored=struct.unpack_from('<I',data,176)[0] if version[1]>=2 else 0;offset=180 if version[1]>=2 else 176
    vertices=[struct.unpack_from('<3f',data,offset+i*12) for i in range(count)];offset+=count*12+count*4*colored+12
    lines=['# Original Riot SCB geometry: '+path.name]+['v %g %g %g'%v for v in vertices];tris=[]
    for i in range(faces):
        ids=struct.unpack_from('<3I',data,offset);uv=struct.unpack_from('<6f',data,offset+76);offset+=100
        lines.extend('vt %g %g'%(uv[j],uv[j+3]) for j in range(3));tris.append('f '+' '.join(f'{ids[j]+1}/{i*3+j+1}' for j in range(3)))
    assert offset+(faces*9 if flags&1 else 0)+(24 if flags&4 else 0)==len(data)
    (MODELS/(name+'.obj')).write_text('\n'.join(lines+tris)+'\n')
    print(name,'bounds',[[min(v[i] for v in vertices),max(v[i] for v in vertices)] for i in range(3)])

for champion,clips in [('morgana',['morgana_idle1','morgana_run','morgana_spell1_0']),('blitzcrank',['blitzcrank_idle1','blitzcrank_run','blitzcrank_spell1'])]:
    base=build(champion,clips)
    names={'morgana':['morgana_base_q_mis_core','morgana_base_q_mis_energy','morgana_base_q_firetrail','morgana_base_q_chaintrail'],
           'blitzcrank':['blitzcrank_base_z_fist','blitzcrank_base_q_glow_01','blitzcrank_base_q_smoke_01','blitzcrank_q_shape']}[champion]
    for name in names:texture(base/f'particles/{name}.tex').save(OUT/(name+'.png'))
    if champion=='blitzcrank':mesh_obj(base/'particles/blitzcrank_base_z_golemfist.scb','blitzcrank_fist')
