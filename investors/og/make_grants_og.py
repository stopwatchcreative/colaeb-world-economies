from PIL import Image, ImageDraw, ImageFont
W,H=1200,630; S=2
WHITE=(255,255,255); INK=(23,32,48); GREEN=(27,110,63); BRIGHT=(46,204,113); ORANGE=(243,122,35); GRAY=(91,101,120); LINE=(227,232,239); SOFT=(246,248,250); MINT=(227,246,234)
img=Image.new('RGB',(W*S,H*S),WHITE); d=ImageDraw.Draw(img)
fp='/tmp/fonts/package/files/sora-latin-%s-normal.woff'
F=lambda w,s:ImageFont.truetype(fp%w,s*S)
def rr(box,r,fill,outline=None,width=1):
    d.rounded_rectangle([v*S for v in box],radius=r*S,fill=fill,outline=outline,width=width*S)
# top accent bar
d.rectangle([0,0,W*S,10*S],fill=BRIGHT)
X=72
# eyebrow pill
rr((X,74,X+232,112),19,MINT)
d.text(((X+18)*S,82*S),'COLAEB · FUNDING',font=F(600,17),fill=GREEN)
d.text((X*S,146*S),'Grants',font=F(700,84),fill=INK)
d.text((X*S,244*S),'Now Available',font=F(700,84),fill=GREEN)
d.text((X*S,378*S),'Non-dilutive funding for startups,',font=F(400,28),fill=GRAY)
d.text((X*S,416*S),'small businesses and nonprofits.',font=F(400,28),fill=GRAY)
# CTA pill
rr((X,488,X+330,552),32,BRIGHT)
d.text(((X+34)*S,505*S),'colaeb.com/grants',font=F(700,26),fill=(19,36,26))
# right: stacked grant cards
cx=790
cards=[('','Federal and state','Open now',ORANGE),('','AI and tech','Open now',GREEN),('','Small business','Open now',(55,90,200))]
y=96
for i,(src,amt,due,col) in enumerate(cards):
    x0=cx+i*18; y0=y+i*150
    rr((x0,y0,x0+330,y0+128),18,WHITE,LINE,2)
    rr((x0+22,y0+24,x0+30,y0+104),4,col)
    d.text(((x0+50)*S,(y0+22)*S),src.upper(),font=F(600,16),fill=GRAY)
    d.text(((x0+50)*S,(y0+30)*S),amt,font=F(700,27),fill=INK)
    d.text(((x0+50)*S,(y0+76)*S),due,font=F(400,19),fill=GRAY)
# stat badge
rr((cx+150,548,cx+366,604),28,INK)
d.text(((cx+172)*S,562*S),'Updated monthly',font=F(600,19),fill=WHITE)
img=img.resize((W,H),Image.LANCZOS); img.save('og-grants.png',optimize=True); print('ok')
