"""Read shipped spell definitions only; never write to the installation."""
from pathlib import Path
from io import BytesIO
import sys, json, hashlib
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools/python-deps'))
from cdtb.wad import Wad
from cdtb.hashes import default_hash_dir
from cdtb.binfile import BinFile
names=['ezreal','lux','nautilus','thresh','xerath']
paths={f'data/characters/{n}/{n}.bin' for n in names}
hashes={}
for line in (default_hash_dir/'hashes.game.txt').read_text(encoding='utf-8').splitlines():
    h,p=line.split(' ',1)
    if p.lower() in paths: hashes[int(h,16)]=p.lower()
out=ROOT/'tools/dodge-rules';out.mkdir(exist_ok=True)
for name in names:
    source=Path('E:/Riot Games/League of Legends/Game/DATA/FINAL/Champions')/(name.capitalize()+'.wad.client')
    wad=Wad(str(source),hashes=hashes)
    with source.open('rb') as f:
        for entry in wad.files:
            if entry.path not in paths: continue
            data=entry.read_data(f,wad.subchunk_toc)
            dest=out/(name+'.bin');dest.write_bytes(data)
            result=BinFile(str(dest)).to_serializable()
            (out/(name+'.json')).write_text(json.dumps(result,indent=2,default=str))
            print(name,entry.path,'offset',entry.offset,'sha256',hashlib.sha256(data).hexdigest())
