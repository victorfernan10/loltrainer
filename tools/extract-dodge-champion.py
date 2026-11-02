"""Extract base Dodge champion resources from the installed WAD, read-only at source."""
from pathlib import Path
import sys,json,hashlib,os,subprocess
from io import BytesIO
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools/python-deps'))
from cdtb.wad import Wad
from cdtb.hashes import default_hash_dir
from cdtb.binfile import BinFile
from cdtb.export import TexConverter
from PIL import Image

champion=sys.argv[1].lower()
source=Path('E:/Riot Games/League of Legends/Game/DATA/FINAL/Champions')/(champion.capitalize()+'.wad.client')
out=ROOT/f'tools/{champion}-original';public=ROOT/f'public/assets/{champion}';public.mkdir(parents=True,exist_ok=True)
base=f'assets/characters/{champion}/skins/base/'
hashes={}
with (default_hash_dir/'hashes.game.txt').open(encoding='utf-8') as f:
    for line in f:
        h,p=line.rstrip('\n').split(' ',1);p=p.lower()
        if p.startswith(base) or p.startswith(f'data/characters/{champion}/') or p==f'data/final/champions/{champion}.wad.subchunktoc':hashes[int(h,16)]=p
wad=Wad(str(source),hashes=hashes);records=[]
with source.open('rb') as f:
    for e in wad.files:
        if not e.path:continue
        data=e.read_data(f,wad.subchunk_toc)
        if data is None:continue
        relative=Path(e.path)
        if len(relative.name)>200:relative=relative.with_name(relative.stem[:150]+f'.{e.path_hash:016x}'+relative.suffix)
        dest=out/relative;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
        records.append({'path':e.path,'localPath':relative.as_posix(),'offset':e.offset,'size':len(data),'sha256':hashlib.sha256(data).hexdigest()})
with source.open('rb') as f:source_hash=hashlib.file_digest(f,'sha256').hexdigest()
(out/'manifest.json').write_text(json.dumps({'source':str(source),'sha256':source_hash,'parser':'CDTB 1.3.0','records':records},indent=2))
for path,label in [(f'data/characters/{champion}/animations/skin0.bin','animation-map'),(f'data/characters/{champion}/skins/skin0.bin','skin0'),(f'data/characters/{champion}/{champion}.bin','character')]:
    if (out/path).exists():
        try:
            data=BinFile(str(out/path)).to_serializable();(out/(label+'.json')).write_text(json.dumps(data,indent=2,default=str))
        except ValueError as error:print('BIN decode pending:',path,str(error))
asset=out/base
print('MODELS', [p.name for p in asset.glob('*.sk*')]);print('TEXTURES',[p.name for p in asset.glob('*.tex')]);print('CLIPS',[p.name for p in (asset/'animations').glob('*.anm')])
for path in asset.glob('*.tex'):
    if any(word in path.stem for word in ['tx','diff','base','leblanc']):
        Image.open(BytesIO(TexConverter.tex_to_dds(path.read_bytes()))).save(public/(path.stem+'.png'))

print('Extraction complete; select model and clips before conversion')
