from PIL import Image,ImageDraw
from pathlib import Path
files=['lux.png','nautilus_base.png','nautilus_model.png','nautilus.png','thresh.png','thresh_q_head.png','thresh_q_trail.png','ezreal.png','ezreal_q_trail.png','xerath.png','xerath_q.png','lux_r_beam.png']
out=Image.new('RGB',(800,((len(files)+3)//4)*230),(45,55,52));d=ImageDraw.Draw(out)
for i,n in enumerate(files):
 im=Image.open(Path('public/assets/dodge')/n).convert('RGBA'); im.thumbnail((185,185)); x=(i%4)*200+(200-im.width)//2;y=(i//4)*230+5
 out.paste(im,(x,y),im);d.text(((i%4)*200+5,(i//4)*230+195),n,fill='white')
out.save('tools/dodge-textures.png')
