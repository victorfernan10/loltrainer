"""Read-only extraction of six base Summoner's Rift minion rigs and graphs."""
from pathlib import Path
import sys,json,hashlib
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools/python-deps'))
from cdtb.wad import Wad
from cdtb.hashes import default_hash_dir
from cdtb.binfile import BinFile
characters=[f'sru_{team}minion{kind}' for team in ['order','chaos'] for kind in ['melee','ranged','siege']]
out=ROOT/'tools/minions-original';out.mkdir(exist_ok=True)
hashes={}
with (default_hash_dir/'hashes.game.txt').open(encoding='utf-8') as file:
    for line in file:
        h,p=line.rstrip('\n').split(' ',1);p=p.lower()
        if p.endswith('.subchunktoc') or any(p.startswith(f'assets/characters/{c}/skins/base/') or p in [f'data/characters/{c}/{c}.bin',f'data/characters/{c}/skins/skin0.bin',f'data/characters/{c}/animations/skin0.bin'] for c in characters):hashes[int(h,16)]=p
base=Path('E:/Riot Games/League of Legends/Game/DATA/FINAL')
records=[];seen=set()
for source in [base/'Maps/Shipping/Map11.wad.client',base/'Maps/Shipping/Common.wad.client',base/'Global.wad.client',base/'DATA.wad.client']:
    wad=Wad(str(source),hashes=hashes);count=0
    with source.open('rb') as file:
        for entry in wad.files:
            p=entry.path
            if not p or p in seen or p.endswith('.subchunktoc'):continue
            data=entry.read_data(file,wad.subchunk_toc)
            if data is None:continue
            dest=out/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data);seen.add(p);count+=1
            records.append({'source':str(source),'sourceSize':source.stat().st_size,'path':p,'offset':entry.offset,'size':len(data),'sha256':hashlib.sha256(data).hexdigest()})
            if p.endswith('.bin'):
                dest.with_suffix('.json').write_text(json.dumps(BinFile(str(dest)).to_serializable(),indent=2,default=str),encoding='utf-8')
    print(source.name,count)
(out/'manifest.json').write_text(json.dumps({'parser':'CDTB','records':records},indent=2),encoding='utf-8')
for c in characters:
    folder=out/f'assets/characters/{c}/skins/base'
    print(c,'models',[p.name for p in folder.glob('*.sk*')],'clips',[p.stem for p in (folder/'animations').glob('*.anm')])
