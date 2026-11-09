from pathlib import Path
import json,os,subprocess,shutil,struct,hashlib
r=Path(__file__).resolve().parents[1];source=r/'tools/lucian-original';base=source/'assets/characters/lucian/skins/base';out=r/'public/assets/lucian';stage=source/'conversion';stage.mkdir(exist_ok=True)
manifest=json.loads((source/'manifest.json').read_text())
assert hashlib.sha256(Path(manifest['source']).read_bytes()).hexdigest()==manifest['sha256'],'Installed WAD changed; extract again before conversion'
names=['lucian_idle1','lucian_idle_ready','lucian_run1','lucian_run2','lucian_run1_in','lucian_attack1','lucian_attack2','lucian_death']
for name in names:shutil.copyfile(base/'animations'/f'{name}.anm',stage/f'{name}.anm')
env=dict(os.environ,DOTNET_ROOT=str(r/'tools/dotnet'))
p=subprocess.run([str(r/'tools/lol2gltf.exe'),'skn2gltf','-m',str(base/'lucian_base.skn'),'-s',str(base/'lucian_base.skl'),'-a',str(stage),'-g',str(out/'lucian.glb')],env=env,capture_output=True,text=True)
assert p.returncode==0,p.stdout+p.stderr
b=(out/'lucian.glb').read_bytes();j=json.loads(b[20:20+struct.unpack_from('<I',b,12)[0]])
manifest=json.loads((source/'manifest.json').read_text());skin=next(iter(json.loads((source/'skin0.json').read_text()).values()))['skinMeshProperties']
(out/'resources.json').write_text(json.dumps({'sourceWadSha256':manifest['sha256'],'skinScale':skin['skinScale'],'texture':'lucian_base_tx_cm.png','clips':[a['name'] for a in j['animations']],'materials':[m['name'] for m in j['materials']]},indent=2))
print('GLB',len(b),'materials',[m['name'] for m in j['materials']],'clips',[(a['name'],len(a['channels'])) for a in j['animations']])
