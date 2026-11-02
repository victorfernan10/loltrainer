"""SCB 3.2 meshes from installed WADs to indexed-independent JSON triangles.
Layout verified against LeagueToolkit/Core/Mesh/StaticMesh{,Face}.cs.
"""
from pathlib import Path
import struct,json
ROOT=Path(__file__).resolve().parents[1]
for champion,name,label in [('locke','locke_nail_03','nail'),('ahri','ahri_base_e_heart_01','heart'),('ahri','ahri_base_q_sphere_01','orb')]:
    path=ROOT/f'tools/{champion}-original/assets/characters/{champion}/skins/base/particles/{name}.scb'
    data=path.read_bytes();assert data[:8]==b'r3d2Mesh';assert struct.unpack_from('<HH',data,8)==(3,2)
    count,faces,flags=struct.unpack_from('<III',data,140);colored=struct.unpack_from('<I',data,176)[0];offset=180
    vertices=[struct.unpack_from('<3f',data,offset+i*12) for i in range(count)];offset+=count*12+count*4*colored+12
    positions=[];uv=[];materials=[]
    for i in range(faces):
        ids=struct.unpack_from('<3I',data,offset);material=data[offset+12:offset+76].split(b'\0')[0].decode();tex=struct.unpack_from('<6f',data,offset+76);offset+=100
        materials.append(material)
        for j,index in enumerate(ids):
            assert index<count
            positions.extend(vertices[index]);uv.extend([tex[j],tex[j+3]])
    assert offset+(faces*9 if flags&1 else 0)==len(data)
    out={'positions':positions,'uv':uv,'source':str(path.relative_to(ROOT)),'materials':sorted(set(materials))}
    (ROOT/f'public/assets/{champion}/{label}.json').write_text(json.dumps(out,separators=(',',':')))
    print(champion,label,faces,'faces','bounds',[(min(v[i] for v in vertices),max(v[i] for v in vertices)) for i in range(3)],out['materials'])
