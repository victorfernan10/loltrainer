"""Extract base LeBlanc resources from the installed WAD, read-only at source."""
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

source=Path('E:/Riot Games/League of Legends/Game/DATA/FINAL/Champions/Leblanc.wad.client')
out=ROOT/'tools/leblanc-original';public=ROOT/'public/assets/leblanc';public.mkdir(parents=True,exist_ok=True)
base='assets/characters/leblanc/skins/base/'
hashes={}
with (default_hash_dir/'hashes.game.txt').open(encoding='utf-8') as f:
    for line in f:
        h,p=line.rstrip('\n').split(' ',1);p=p.lower()
        if p.startswith(base) or p.startswith('data/characters/leblanc/') or p=='data/final/champions/leblanc.wad.subchunktoc':hashes[int(h,16)]=p
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
for path,label in [('data/characters/leblanc/animations/skin0.bin','animation-map'),('data/characters/leblanc/skins/skin0.bin','skin0'),('data/characters/leblanc/leblanc.bin','character')]:
    if (out/path).exists():
        try:
            data=BinFile(str(out/path)).to_serializable();(out/(label+'.json')).write_text(json.dumps(data,indent=2))
        except ValueError as error:print('BIN decode pending:',path,str(error))
asset=out/base
print('MODELS', [p.name for p in asset.glob('*.sk*')]);print('TEXTURES',[p.name for p in asset.glob('*.tex')]);print('CLIPS',[p.name for p in (asset/'animations').glob('*.anm')])
for path in asset.glob('*.tex'):
    if any(word in path.stem for word in ['tx','diff','base','leblanc']):
        Image.open(BytesIO(TexConverter.tex_to_dds(path.read_bytes()))).save(public/(path.stem+'.png'))
meshes=list(asset.glob('*.skn'));skeletons=list(asset.glob('*.skl'))
if len(meshes)!=1 or len(skeletons)!=1:raise RuntimeError('Select mesh/skeleton explicitly')
env=os.environ.copy();env['DOTNET_ROOT']=str(ROOT/'tools/dotnet');env['PATH']=env['DOTNET_ROOT']+os.pathsep+env.get('PATH','')
subprocess.run([str(ROOT/'tools/lol2gltf.exe'),'skn2gltf','-m',str(meshes[0]),'-s',str(skeletons[0]),'-a',str(asset/'animations'),'-g',str(public/'leblanc.glb')],cwd=ROOT,env=env,check=True)
print('Extracted',len(records),'resources; source SHA-256',source_hash)
