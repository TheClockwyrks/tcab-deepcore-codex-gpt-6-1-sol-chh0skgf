"""Additional hand-authored equipment silhouettes for the camp sprites."""
import json,pathlib,subprocess
root=pathlib.Path('/work')
def R(a,x,y,w,h,c):a.append(dict(op='fill_rect',x=x,y=y,width=w,height=h,color=c))
def L(a,x,y,X,Y,c):a.append(dict(op='line',x0=x,y0=y,x1=X,y1=Y,color=c))
def O(a,x,y,r,c):a.append(dict(op='fill_circle',cx=x,cy=y,r=r,color=c))
for idx,name in enumerate(['fuel-depot','ore-market','save-pad','upgrade-shop','supply-depot','launch-pad']):
 path=root/'artwork'/f'surface_{name}.png.json';a=json.loads(path.read_text());gold='#edbd73';navy='#172e3a';pale='#acbfb5'
 if idx==0:
  for x in [28,53]:
   O(a,x+8,38,8,'#a1aaa0');R(a,x,38,17,23,'#a1aaa0');O(a,x+8,61,8,'#7f9391');R(a,x,43,17,5,gold);R(a,x+4,39,3,18,'#d2d4b7');R(a,x+1,63,15,4,navy)
  R(a,81,37,6,28,'#7f9391');L(a,85,36,92,36,gold);L(a,92,36,92,51,gold)
 if idx==1:
  R(a,19,23,120,10,'#8fc4af')
  for x in range(19,139,16):R(a,x,23,8,10,'#d9c590')
  R(a,26,54,61,11,'#354b52');R(a,34,45,3,9,gold);L(a,27,46,43,46,gold);L(a,27,47,24,52,pale);L(a,43,47,46,52,pale);R(a,22,52,7,2,gold);R(a,43,52,7,2,gold)
  for x in [56,71]:R(a,x,48,12,14,'#a57d51');L(a,x,48,x+11,61,'#dbb57b');L(a,x+11,48,x,61,'#dbb57b')
 if idx==2:
  R(a,30,43,50,20,'#213f4b');R(a,34,46,40,10,'#75c9c7')
  for x in range(38,71,8):R(a,x,48,3,6,'#c3ead9')
  R(a,122,4,6,61,pale);O(a,125,5,5,'#afdee0');O(a,125,5,2,'#ffffff');L(a,110,13,140,13,'#7eb9cf')
 if idx==3:
  O(a,53,44,15,'#d6a274');O(a,53,44,10,navy);O(a,53,44,4,pale)
  for dx,dy in [(-17,0),(13,0),(-2,-17),(-2,13)]:R(a,53+dx,44+dy,5,5,'#d6a274')
  R(a,75,44,22,20,'#253f4a');R(a,78,47,16,3,pale);R(a,78,54,12,3,gold)
 if idx==4:
  for x,y in [(26,47),(47,47),(36,29),(68,47)]:
   R(a,x,y,18,18,'#879a79');R(a,x+2,y+2,14,14,'#526e65');L(a,x+2,y+2,x+15,y+15,'#b4c497');L(a,x+15,y+2,x+2,y+15,'#b4c497')
 if idx==5:
  a=[];R(a,4,65,152,15,'#4b636c');R(a,8,66,144,4,pale)
  for x in range(12,145,16):R(a,x,71,7,5,gold)
  for x in [22,130]:
   R(a,x,5,7,60,'#526f78');R(a,x+1,5,2,60,pale)
  R(a,22,4,115,5,'#879e9b')
  for y in range(12,61,12):L(a,23,y,136,y+10,'#3e5b67');L(a,136,y,23,y+10,'#3e5b67')
  R(a,60,59,40,6,'#293f49')
 path.write_text(json.dumps(a));subprocess.run(['draw','render','--actions',str(path),'--out',str(root/'assets/surface'/f'{name}.png'),'--width','160','--height','80','--no-layers'],check=True,stdout=subprocess.DEVNULL)
