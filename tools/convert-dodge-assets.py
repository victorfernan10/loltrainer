from io import BytesIO
from pathlib import Path
from PIL import Image
from cdtb.export import TexConverter
root=Path('tools/game-extract')
out=Path('public/assets/dodge')
out.mkdir(parents=True,exist_ok=True)
items={
'lux':('lux','assets/characters/lux/skins/base/lux_base_cm_tx.tex'),
'nautilus':('nautilus','assets/characters/jade_nautilus/skins/base/particles/jade_nautilus_base_q_missilehead.tex'),
'nautilus_base':('nautilus','assets/characters/nautilus/skins/base/nautilus_base_tx_cm.tex'),
'nautilus_model':('nautilus','assets/characters/jade_nautilus/skins/base/jade_nautilus_base_tx_cm.tex'),
'thresh':('thresh','assets/characters/thresh/skins/base/thresh_base_tx_cm.tex'),
'thresh_q_head':('thresh','assets/characters/thresh/skins/base/particles/thresh_base_q_missilehead.tex'),
'thresh_q_trail':('thresh','assets/characters/thresh/skins/base/particles/thresh_base_q_trail.tex'),
'ezreal':('ezreal','assets/characters/ezreal/skins/base/ezreal_base_tx_cm.tex'),
'ezreal_q_trail':('ezreal','assets/characters/ezreal/skins/base/particles/ezreal_base_q_mis_trail.tex'),
'ezreal_q_hit':('ezreal','assets/characters/ezreal/skins/base/particles/ezreal_base_q_hit_spark.tex'),
'xerath':('xerath','assets/characters/xerath/skins/base/xerath_base_tx_cm.tex'),
'xerath_q':('xerath','assets/characters/xerath/skins/base/particles/xerath_base_q_beam.tex'),
'xerath_q_01':('xerath','assets/characters/xerath/skins/base/particles/xerath_base_q_beam_01.tex'),
'xerath_q_02':('xerath','assets/characters/xerath/skins/base/particles/xerath_base_q_beam_02.tex'),
'xerath_q_energy':('xerath','assets/characters/xerath/skins/base/particles/xerath_base_q_beamenergy.tex'),
'lux_r_beam':('lux','assets/characters/lux/skins/base/particles/lux_base_r_lazurbeam01.tex'),
'lux_r_core':('lux','assets/characters/lux/skins/base/particles/lux_base_r_beam_core_mult.tex'),
'lux_q_trail':('lux','assets/characters/lux/skins/base/particles/lux_base_q_trail.tex'),
'lux_q_cap':('lux','assets/characters/lux/skins/base/particles/lux_base_q_tar_cap.tex'),
'lux_q_shape':('lux','assets/characters/lux/skins/base/particles/lux_q_shape.tex'),
}
for output,(champ,path) in items.items():
    f=root/champ/path
    if not f.exists(): print('MISSING',f); continue
    im=Image.open(BytesIO(TexConverter.tex_to_dds(f.read_bytes()))).convert('RGBA')
    im.save(out/f'{output}.png')
    print(output, im.size, 'alpha',im.getchannel('A').getextrema())
