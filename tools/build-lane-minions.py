"""Convert extracted native minion rigs, following base skin and animation references."""
from pathlib import Path
from io import BytesIO
import sys,json,os,shutil,subprocess
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools/python-deps'))
from cdtb.export import TexConverter
from PIL import Image
source=ROOT/'tools/minions-original';out=ROOT/'public/assets/minions';out.mkdir(parents=True,exist_ok=True)
env=dict(os.environ,DOTNET_ROOT=str(ROOT/'tools/dotnet'));records={}
def paths(value):
    if isinstance(value,dict):
        for key,item in value.items():
            if key=='mAnimationFilePath':yield item.lower()
            else:yield from paths(item)
    elif isinstance(value,list):
        for item in value:yield from paths(item)
for team,native in [('blue','order'),('red','chaos')]:
    for kind,resource in [('melee','melee'),('caster','ranged'),('siege','siege')]:
        character=f'sru_{native}minion{resource}';key=f'{team}-{kind}'
        folder=source/f'data/characters/{character}'
        skin=next(v for v in json.loads((folder/'skins/skin0.json').read_text()).values() if isinstance(v,dict) and 'skinMeshProperties' in v)['skinMeshProperties']
        graph=next(v for v in json.loads((folder/'animations/skin0.json').read_text()).values() if isinstance(v,dict) and 'mClipDataMap' in v)['mClipDataMap']
        refs=list(dict.fromkeys(paths(graph)));staging=ROOT/'tools/minions-conversion'/key;staging.mkdir(parents=True,exist_ok=True)
        for ref in refs:shutil.copyfile(source/ref,staging/Path(ref).name)
        command=[str(ROOT/'tools/lol2gltf.exe'),'skn2gltf','-m',str(source/skin['simpleSkin'].lower()),'-s',str(source/skin['skeleton'].lower()),'-a',str(staging),'-g',str(out/(key+'.glb'))]
        result=subprocess.run(command,env=env,capture_output=True,text=True)
        if result.returncode:raise RuntimeError(result.stdout+result.stderr)
        Image.open(BytesIO(TexConverter.tex_to_dds((source/skin['texture'].lower()).read_bytes()))).save(out/(key+'.png'))
        names=[Path(p).stem for p in refs]
        records[key]={'model':key+'.glb','texture':key+'.png','scale':skin['skinScale'],'idle':next(n for n in names if 'idle' in n),'run':next(n for n in names if 'run' in n),'death':next(n for n in names if 'death' in n),'attacks':[n for n in names if 'attack' in n], 'castTime':{'melee':.393,'caster':.47,'siege':.3}[kind], 'sourceCharacter':character,'clipResources':refs}
        print(key,records[key]['scale'],len(names),'clips')
(out/'resources.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
