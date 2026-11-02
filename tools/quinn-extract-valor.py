"""Read the companion rig packaged inside Quinn.wad.client."""
from pathlib import Path
import sys,json,hashlib
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools/python-deps'))
from cdtb.wad import Wad
from cdtb.hashes import default_hash_dir
from cdtb.binfile import BinFile
source=Path('E:/Riot Games/League of Legends/Game/DATA/FINAL/Champions/Quinn.wad.client')
out=ROOT/'tools/quinn-original';hashes={}
for line in (default_hash_dir/'hashes.game.txt').read_text(encoding='utf-8').splitlines():
    h,p=line.split(' ',1);p=p.lower()
    if p.startswith('assets/characters/quinnvalor/skins/base/') or p.startswith('data/characters/quinnvalor/'):hashes[int(h,16)]=p
wad=Wad(str(source),hashes=hashes);records=[]
with source.open('rb') as f:
    for e in wad.files:
        if not e.path:continue
        data=e.read_data(f,wad.subchunk_toc)
        if data is None:continue
        dest=out/e.path;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
        records.append({'path':e.path,'offset':e.offset,'size':len(data),'sha256':hashlib.sha256(data).hexdigest()})
(out/'valor-manifest.json').write_text(json.dumps({'source':str(source),'parser':'CDTB','records':records},indent=2))
for label,path in [('valor-skin0','skins/skin0.bin'),('valor-animation-map','animations/skin0.bin')]:
    p=out/'data/characters/quinnvalor'/path
    if p.exists():(out/(label+'.json')).write_text(json.dumps(BinFile(str(p)).to_serializable(),indent=2,default=str))
print('Valor extraction:',len(records),'resources')
