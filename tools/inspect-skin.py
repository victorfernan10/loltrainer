from pathlib import Path
from cdtb.binfile import BinFile
import json
out = {}
for file in Path('tools/extracted/data/characters/kayle').glob('*.bin'):
    data = BinFile(str(file)).to_serializable()
    for key, value in data.items():
        if isinstance(value, dict) and (value.get('__type') == 'SkinCharacterDataProperties' or ('skin0' in key.lower() and ('material' in key.lower() or 'skin0' == key.lower().split('/')[-1]))):
            out[key] = value
Path('tools/skin-records.json').write_text(json.dumps(out,indent=2))
print('records:', len(out))
