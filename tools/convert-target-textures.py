from io import BytesIO
from pathlib import Path
from PIL import Image
from cdtb.export import TexConverter
root=Path('tools/extracted-models/assets/characters')
out=Path('public/assets/targets')
items={
'yone': [('yone/skins/base/yone_base_tx_cm.tex','yone_base_tx_cm.png'),('yone/skins/base/yone_base_props_tx_cm.tex','yone_base_props_tx_cm.png')],
'xerath': [('xerath/skins/base/xerath_base_tx_cm.tex','xerath_base_tx_cm.png')],
'ryze': [('ryze/skins/base/ryze.tex','ryze_base.png')],
}
for champ, files in items.items():
    for source,name in files:
        path=root/source
        image=Image.open(BytesIO(TexConverter.tex_to_dds(path.read_bytes())))
        image.save(out/name)
        print(name,image.size)
