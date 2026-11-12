import json, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
W,H=1200,630; S=2
INK=(16,24,40); OR=(243,122,35); CREAM=(250,247,242)
img=Image.new('RGB',(W*S,H*S),INK); d=ImageDraw.Draw(img)
F=lambda p,s:ImageFont.truetype(p,s*S)
serif6='package/files/newsreader-latin-600-normal.woff'; serif4='package/files/newsreader-latin-400-normal.woff'
mono='jb/package/files/jetbrains-mono-latin-600-normal.woff'
# map area: right side, equirectangular, lat 70..-50
mx0,mx1,my0,my1=600,1180,90,540
def P(lat,lon):
    x=mx0+(lon+128)/(160+128)*(mx1-mx0); y=my0+(72-lat)/(72+50)*(my1-my0); return x*S,y*S
# grid
for lon in range(-150,181,30):
    x,_=P(0,lon); d.line([(x,my0*S),(x,my1*S)],fill=(30,40,60),width=S)
for lat in range(-40,71,20):
    _,y=P(lat,0); d.line([(mx0*S,y),(mx1*S,y)],fill=(30,40,60),width=S)
pts=[(o['la'],o['lo']) for o in json.load(open('/home/claude/inv/investors-feed.json')) if o.get('la') is not None]
glow=Image.new('RGB',img.size,(0,0,0)); g=ImageDraw.Draw(glow)
from collections import Counter
c=Counter((round(a,1),round(b,1)) for a,b in pts)
for (a,b),n in c.items():
    if a>72 or a<-50 or b<-128 or b>160: continue
    x,y=P(a,b); r=(1.6+min(5.5,1.1*math.sqrt(n)))*S
    g.ellipse([x-r*2,y-r*2,x+r*2,y+r*2],fill=(90,40,10))
    d.ellipse([x-r,y-r,x+r,y+r],fill=OR)
glow=glow.filter(ImageFilter.GaussianBlur(14*S))
img=Image.blend(img,Image.fromarray(__import__('numpy').maximum(__import__('numpy').array(img),__import__('numpy').array(glow)).astype('uint8')),1.0)
d=ImageDraw.Draw(img)
# left panel gradient fade
fade=Image.new('L',img.size,0); fd=ImageDraw.Draw(fade)
for x in range(0,640*S):
    a=int(255*max(0,min(1,(640*S-x)/(90*S))))
    fd.line([(x,0),(x,H*S)],fill=a)
img=Image.composite(Image.new('RGB',img.size,INK),img,fade); d=ImageDraw.Draw(img)
X=64
d.text((X*S,70*S),'COLAEB  ·  FOUNDER RESOURCES',font=F(mono,18),fill=OR)
d.text((X*S,120*S),'The Colaeb',font=F(serif6,84),fill=CREAM)
d.text((X*S,212*S),'Investor List',font=F(serif6,84),fill=OR)
d.text((X*S,330*S),'VCs, angels and accelerators,',font=F(serif4,32),fill=(200,206,216))
d.text((X*S,372*S),'mapped and searchable by stage.',font=F(serif4,32),fill=(200,206,216))
stats=[('3,500+','INVESTORS'),('67','COUNTRIES'),('Free','TO SEARCH')]
x=X
for big,lab in stats:
    d.text((x*S,452*S),big,font=F(serif6,46),fill=CREAM)
    d.text((x*S,512*S),lab,font=F(mono,15),fill=(150,160,176))
    x+=200
d.text((X*S,568*S),'colaeb.com/investors',font=F(mono,18),fill=OR)
img=img.resize((W,H),Image.LANCZOS); img.save('investors-og.png',optimize=True)
print('ok')
