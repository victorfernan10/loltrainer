from pathlib import Path
import sys,json,hashlib,os,subprocess,re
from io import BytesIO
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools/python-deps'))
from cdtb.wad import Wad
from cdtb.hashes import default_hash_dir
from cdtb.export import TexConverter
from PIL import Image
source=Path('E:/Riot Games/League of Legends/Game/DATA/FINAL/Champions/Yone.wad.client')
out=ROOT/'tools/yone-combat-original';public=ROOT/'public/assets/yone';public.mkdir(parents=True,exist_ok=True)
base='assets/characters/yone/skins/base/'
textures=['yone_base_tx_cm','yone_base_swords_tx_cm','streak_red_tx_cm','streak_white_tx_cm']
def wanted(p):
 if p.startswith(base+'animations/'):
  name=Path(p).stem
  return bool(re.match(r'yone_(attack|attacks|idle01$|run01|spell|death01$|walk01$)',name)) or name=='dusk_spell3_dash'
 return p in [base+'yone_base.skn',base+'yone_base.skl']+[base+t+'.tex' for t in textures]
hashes={}
with (default_hash_dir/'hashes.game.txt').open(encoding='utf8') as f:
 for line in f:
  h,p=line.rstrip('\n').split(' ',1);p=p.lower()
  if wanted(p) or p=='data/final/champions/yone.wad.subchunktoc':hashes[int(h,16)]=p
wad=Wad(str(source),hashes=hashes);records=[]
with source.open('rb') as f:
 for entry in wad.files:
  if not entry.path:continue
  data=entry.read_data(f,wad.subchunk_toc)
  if data is None:continue
  dest=out/entry.path;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
  records.append({'path':entry.path,'offset':entry.offset,'size':len(data),'sha256':hashlib.sha256(data).hexdigest()})
with source.open('rb') as f:digest=hashlib.file_digest(f,'sha256').hexdigest()
(out/'manifest.json').write_text(json.dumps({'source':str(source),'sha256':digest,'parser':'CDTB 1.3.0','records':records},indent=2))
asset=out/base
for name in textures:
 path=asset/(name+'.tex')
 if not path.exists():raise RuntimeError('Missing material texture '+name)
 Image.open(BytesIO(TexConverter.tex_to_dds(path.read_bytes()))).save(public/(name+'.png'))
env=os.environ.copy();env['DOTNET_ROOT']=str(ROOT/'tools/dotnet');env['PATH']=env['DOTNET_ROOT']+os.pathsep+env.get('PATH','')
subprocess.run([str(ROOT/'tools/lol2gltf.exe'),'skn2gltf','-m',str(asset/'yone_base.skn'),'-s',str(asset/'yone_base.skl'),'-a',str(asset/'animations'),'-g',str(public/'yone-combat.glb')],cwd=ROOT,env=env,check=True)
print('Exported',len(records),'resources;',len(list((asset/'animations').glob('*.anm'))),'combat clips; SHA256',digest)
