"""Extract selected original Kayle clips without modifying the installed game.

Requires cdtb in tools/python-deps. Hashes and WAD offsets are retained as
ordinary parser evidence; REA itself does not support Riot's WAD format.
"""
from pathlib import Path
import sys, json, hashlib, os, subprocess
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools/python-deps'))
from cdtb.wad import Wad
from xxhash import xxh64_intdigest

wad_path = Path(sys.argv[1] if len(sys.argv)>1 else r'E:/Riot Games/League of Legends/Game/DATA/FINAL/Champions/Kayle.wad.client')
out = ROOT / 'tools/kayle-spells-original'
base = 'assets/characters/kayle/skins/base/'
names = ['kayle_spell2','kayle_spell2_-180','kayle_spell2_-90','kayle_spell2_180','kayle_spell2_90','kayle_spell2_transidle','kayle_spell3','kayle_spell3_l','kayle_spell3enraged','kayle_spell3melee','kayle_spell3runtransition','kayle_spell3runtransitionleft']
paths = [base+'animations/'+name+'.anm' for name in names] + [base+'kayle.skn',base+'kayle.skl','data/characters/kayle/animations/skin0.bin','data/final/champions/kayle.wad.subchunktoc']
hashes = {xxh64_intdigest(path.encode()):path for path in paths}
wad = Wad(str(wad_path), hashes=hashes)
entries = {item.path:item for item in wad.files if item.path in paths}
missing = set(paths)-set(entries)
if missing: raise RuntimeError(f'Missing WAD entries: {missing}')
records=[]
with wad_path.open('rb') as source:
    for path in paths:
        entry=entries[path];data=entry.read_data(source,wad.subchunk_toc)
        if not data: raise RuntimeError(path)
        dest=out/path;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
        old=ROOT/'tools/extracted'/path
        records.append({'path':path,'offset':entry.offset,'compressedSize':entry.compressed_size,'size':len(data),'sha256':hashlib.sha256(data).hexdigest(),'matchesPreviousExtraction':old.exists() and old.read_bytes()==data})
digest=hashlib.file_digest(wad_path.open('rb'),'sha256').hexdigest()
manifest={'source':str(wad_path),'sha256':digest,'parser':'cdtb 1.3.0; ordinary local parser, not REA Evidence','records':records}
(out/'manifest.json').write_text(json.dumps(manifest,indent=2))
env=os.environ.copy();env['DOTNET_ROOT']=str(ROOT/'tools/dotnet');env['PATH']=env['DOTNET_ROOT']+os.pathsep+env.get('PATH','')
destination=ROOT/'public/assets/kayle-spells.glb'
subprocess.run([str(ROOT/'tools/lol2gltf.exe'),'skn2gltf','-m',str(out/(base+'kayle.skn')),'-s',str(out/(base+'kayle.skl')),'-a',str(out/(base+'animations')),'-g',str(destination)],env=env,cwd=ROOT,check=True)
print(json.dumps({'clips':names,'sourceSha256':digest,'allMatchPrevious':all(r['matchesPreviousExtraction'] for r in records),'output':str(destination),'bytes':destination.stat().st_size},indent=2))
