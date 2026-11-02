"""Extract Syndra's original orb entity assets (read-only installed WAD)."""
from pathlib import Path
import sys,json,hashlib
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools/python-deps'))
from cdtb.wad import Wad
from cdtb.hashes import default_hash_dir
from cdtb.binfile import BinFile
source=Path('E:/Riot Games/League of Legends/Game/DATA/FINAL/Champions/Syndra.wad.client')
out=ROOT/'tools/syndra-original';hashes={}
prefixes=['assets/characters/syndrasphere/skins/base/','assets/characters/syndraorbs/skins/base/']
data_paths=[f'data/characters/{champ}/{path}' for champ in ['syndrasphere','syndraorbs'] for path in [champ+'.bin','skins/skin0.bin','animations/skin0.bin']]
for line in (default_hash_dir/'hashes.game.txt').read_text(encoding='utf8').splitlines():
    key,path=line.split(' ',1);path=path.lower()
    if any(path.startswith(p) for p in prefixes) or path in data_paths or path=='data/final/champions/syndra.wad.subchunktoc':hashes[int(key,16)]=path
wad=Wad(str(source),hashes=hashes);records=[]
with source.open('rb') as stream:
    for entry in wad.files:
        if not entry.path:continue
        data=entry.read_data(stream,wad.subchunk_toc)
        if data is None:continue
        path=out/entry.path;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
        records.append({'path':entry.path,'offset':entry.offset,'size':len(data),'sha256':hashlib.sha256(data).hexdigest()})
        if path.suffix=='.bin':path.with_suffix('.json').write_text(json.dumps(BinFile(str(path)).to_serializable(),indent=2,default=str))
with source.open('rb') as stream:digest=hashlib.file_digest(stream,'sha256').hexdigest()
(out/'sphere-manifest.json').write_text(json.dumps({'source':str(source),'sha256':digest,'records':records},indent=2))
print('Sphere entity assets:',len(records))
