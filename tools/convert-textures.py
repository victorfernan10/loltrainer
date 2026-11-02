from pathlib import Path
from io import BytesIO
from PIL import Image
from cdtb.export import TexConverter

source = Path(__file__).parent / 'extracted/assets/characters/kayle/skins/base'
out = Path(__file__).parent.parent / 'public/assets'
for name in ['kayle_base_tx_cm','kayle_base_lvl11_tx_cm','kayle_base_wings_tx_cm','kayle_base_sword_tx_cm']:
    image = Image.open(BytesIO(TexConverter.tex_to_dds((source / (name+'.tex')).read_bytes())))
    image.save(out / (name+'.png'))
    print(name, image.size)
