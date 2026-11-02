"""Rebuild original Syndra model and selected VFX resources from local extraction.

Input provenance: tools/syndra-original/manifest.json, installed Syndra.wad.client.
Conversion does not write to the installed game. Shader/scheduler reconstruction
is separate from these original geometry, texture and animation resources.
"""
from pathlib import Path
from io import BytesIO
import sys, os, subprocess, json, struct
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools/python-deps'))
from cdtb.export import TexConverter
from PIL import Image
OUT=ROOT/'public/assets/syndra';OUT.mkdir(parents=True,exist_ok=True)
ORIGINAL=ROOT/'tools/syndra-original/assets/characters'
env=dict(os.environ,DOTNET_ROOT=str(ROOT/'tools/dotnet'))
for character,model,label in [('syndra','syndra','syndra'),('syndrasphere','syndrasphere','sphere')]:
    folder=ORIGINAL/character/'skins/base'
    subprocess.run([str(ROOT/'tools/lol2gltf.exe'),'skn2gltf','-m',str(folder/(model+'.skn')),'-s',str(folder/(model+'.skl')),'-a',str(folder/'animations'),'-g',str(OUT/(label+'.glb'))],env=env,check=True)
textures=['syndra_base_tx_cm','syndra_base_q_orb_core','common_darksov_blackhole','common_darksov_orb_outlines','common_darksov_blasthole','common_darksov_forcebubble','common_darksov_forcetrail','syndra_base_2021_q_flash_01','syndra_base_2021_q_lines_01','syndra_base_2021_q_cracks','syndra_base_2021_e_bg','syndra_base_2021_e_core','syndra_base_2021_e_edge_2','syndra_base_2021_e_lead','syndra_base_e_beam_core_color','syndra_base_e_chaintrail','syndra_base_w_void_background','syndra_base_w_lightning03','syndra_base_2021_r_mis_core','syndra_base_2021_r_mis_lead','syndra_base_2021_r_hitflash_core','syndra_base_2021_r_hitflash_ring','orianna_base_tx_cm']
records=[]
for path in ORIGINAL.rglob('*.tex'):
    if path.stem not in textures:continue
    dest=OUT/(path.stem+'.png')
    Image.open(BytesIO(TexConverter.tex_to_dds(path.read_bytes()))).save(dest)
    records.append({'file':dest.name,'source':str(path.relative_to(ROOT))})
meshes={'syndra_base_2021_q_flatsphere':'q-flat-sphere','syndra_base_q_2021_swirlsphere':'q-swirl-sphere','syndra_base_e_2021_baseplane':'e-plane','syndra_base_e_2021_leadingwindwall':'e-wave','syndra_base_w_2021_centerbase':'w-center','syndra_base_w_void_ring':'w-ring'}
for path in (ORIGINAL/'syndra/skins/base/particles').glob('*.scb'):
    if path.stem not in meshes:continue
    data=path.read_bytes();assert data[:8]==b'r3d2Mesh'
    version=struct.unpack_from('<HH',data,8);assert version in [(3,1),(3,2)]
    count,faces,flags=struct.unpack_from('<III',data,140)
    colored=struct.unpack_from('<I',data,176)[0] if version[1]>=2 else 0
    offset=180 if version[1]>=2 else 176
    vertices=[struct.unpack_from('<3f',data,offset+i*12) for i in range(count)];offset+=count*12+count*4*colored+12
    positions=[];uv=[];materials=[]
    for i in range(faces):
        ids=struct.unpack_from('<3I',data,offset);material=data[offset+12:offset+76].split(b'\0')[0].decode();tex=struct.unpack_from('<6f',data,offset+76);offset+=100
        materials.append(material)
        for j,index in enumerate(ids):positions.extend(vertices[index]);uv.extend([tex[j],tex[j+3]])
    # Optional per-face colors and trailing bounds on this legacy ring resource.
    assert offset+(faces*9 if flags&1 else 0)+(24 if flags&4 else 0)==len(data)
    dest=OUT/(meshes[path.stem]+'.json');dest.write_text(json.dumps({'positions':positions,'uv':uv,'materials':sorted(set(materials)),'source':str(path.relative_to(ROOT))},separators=(',',':')))
    records.append({'file':dest.name,'source':str(path.relative_to(ROOT))})
(OUT/'resources.json').write_text(json.dumps({'skinScale':1.25,'sphereSkinScale':.5,'resources':records},indent=2))
print('Original Syndra resources built:',len(records))
