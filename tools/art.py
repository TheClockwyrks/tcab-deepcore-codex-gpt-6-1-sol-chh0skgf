"""One-time original pixel art authoring. Builds draw action logs, then renders with draw/draw-sheet."""
import json,random,subprocess,pathlib
ROOT=pathlib.Path('/work'); (ROOT/'artwork').mkdir(exist_ok=True); random.seed(48)
def rect(a,x,y,w,h,c): a.append(dict(op='fill_rect',x=int(x),y=int(y),width=int(w),height=int(h),color=c))
def line(a,x,y,X,Y,c): a.append(dict(op='line',x0=int(x),y0=int(y),x1=int(X),y1=int(Y),color=c))
def circle(a,x,y,r,c): a.append(dict(op='fill_circle',cx=int(x),cy=int(y),r=int(r),color=c))
def emit(path,a,w=80,h=80,sheet=False):
 p=ROOT/'assets'/path;p.parent.mkdir(parents=True,exist_ok=True)
 log=ROOT/'artwork'/ (path.replace('/','_')+'.json');log.write_text(json.dumps(a))
 cfg=log.with_suffix('.config.json');cfg.write_text(json.dumps(dict(width=w,height=h,background='#00000000',actions=str(log),preview=str(p))))
 subprocess.run(['draw-sheet' if path.startswith('miner/') or 'frame' in path else 'draw','render','--actions',str(log),'--out',str(p),'--width',str(w),'--height',str(h)],check=True,stdout=subprocess.DEVNULL)
def texture(base,light,dark):
 a=[];rect(a,0,0,80,80,base)
 for _ in range(570):
  x=random.randrange(80);y=random.randrange(80);rect(a,x,y,random.choice([1,2,3]),1,random.choice([light,dark]))
 for _ in range(18):
  x=random.randrange(80);y=random.randrange(80);line(a,x,y,min(79,x+random.randrange(3,10)),min(79,y+2),dark)
 return a
for band,colors in {'topsoil':['#594d3e','#6a5b47','#4f4337'],'rockbed':['#4a555b','#576269','#3b454c'],'deepstone':['#333c50','#424b60','#293142'],'coreshell':['#493136','#583a3c','#38262e']}.items():
 for n in range(3):emit(f'tiles/{band}-{n}.png',texture(*colors))
emit('tiles/tunnel.png',texture('#101e27','#15252e','#0e1a23'))
emit('tiles/bedrock.png',texture('#253341','#40515c','#192733'))
for n in range(2):
 a=texture('#424e59','#56636e','#303d49');circle(a,40,40,34,'#839099');circle(a,38,36,29,'#626f7b');line(a,18,25,52,15,'#b7c6c9');line(a,20,62,62,45,'#354957');emit(f'tiles/stone-{n}.png',a)
colors=['#c3a680','#b8d4af','#de885b','#c3d4e1','#6da2dc','#d6c564','#ae9ce9','#ee7950','#e45b82','#8fe5d1','#65edae','#ff85b9','#ffdc79']
names=['ferron','marlite','cuprite','argenite','cobaltine','voltite','halcite','pyronium','cindrite','adamite','verdite','roselite','aurite']
for i,(name,c) in enumerate(zip(names,colors)):
 a=[]
 if i<10:
  for x in range(0,80,2):
   y=int(38+10*__import__('math').sin(x/17));rect(a,x,y,3,random.randrange(5,17),c+'bb')
  for _ in range(90):
   x=random.randrange(80); y=int(41+10*__import__('math').sin(x/17)+random.randrange(-10,15));rect(a,x,y,2,2,c+random.choice(['55','88','cc','ff']))
 else:
  for y in range(14,65):
   half=int((y-12)*.85) if y<30 else int((66-y)*.8);rect(a,40-half,y,max(1,half*2),1,c)
  line(a,18,30,62,30,'#f6fff0');line(a,18,30,40,63,'#426782');line(a,62,30,40,63,'#ffffff');rect(a,29,18,22,10,'#eaffed');line(a,62,10,62,24,'#ffffff');line(a,55,17,69,17,'#ffffff')
 emit('ore/'+name+'.png',a)
for name,c in [('resonite','#62efc0'),('cryenite','#84c9ff'),('core','#ffc279'),('core-sample','#ff9964')]:
 a=[]
 for x,y in [(25,43),(40,30),(54,42)]:
  for z in range(35):rect(a,x-z//6,y+z,3+z//3,1,c)
  line(a,x,y,x+4,y+29,'#ecffff')
 circle(a,42,45,8,'#f8ffd9');emit('materials/'+name+'.png',a)
# Miner silhouette: brass pressure helmet, cyan glass, orange utility suit, strapped backpack and toothed drill.
for state,n in [('idle',2),('walk',4),('drill-down',3),('drill-side',3),('jetpack',3),('fall',2),('hurt',2),('fuel-out',2)]:
 for f in range(n):
  a=[];bob=(f%2) if state!='hurt' else f*3; ox=-f*2 if state=='hurt' else 0
  def R(x,y,w,h,c):rect(a,x+ox,y+bob,w,h,c)
  R(15,31,15,29,'#182c38');R(16,33,10,22,'#71858b');R(17,35,4,15,'#afc3b5');R(25,32,28,28,'#253b46');R(28,34,23,23,'#cf7845');R(30,36,7,19,'#ecaa66');R(27,54,27,7,'#233c47');R(40,48,8,6,'#f6cf7f')
  stride=[0,6,0,-6][f%4] if state=='walk' else (5 if state=='fall' else 0)
  R(28,60,9,12-stride//2,'#a65f3f');R(43,60,9,11+stride//2,'#cf8750');R(26,69-stride//2,13,6,'#182e3c');R(42,69+stride//2,15,6,'#182e3c')
  R(24,10,33,25,'#24343b');R(26,10,28,23,'#e5ae61');R(29,13,25,15,'#244d60');R(31,14,19,10,'#83d4d6');R(31,14,7,4,'#d7fff0');R(25,30,28,5,'#705c49');R(49,9,10,7,'#f8edb3' if f%2 else '#c9e8d0')
  if state=='drill-down':
   R(43,49,13,8,'#e3b780');R(42,56,15,10,'#7f9ba2');R(46,66,8,9,'#c5d8d3');R(49,74,3,5,'#f4e2bc')
  else:
   yy=43+(f%2 if state=='drill-side' else 0);R(46,yy,14,8,'#d5945c');R(56,yy-3,13,13,'#80969c');R(68,yy,8,7,'#d3ddd0');R(75,yy+2,4,3,'#faf1ce')
  if state=='jetpack':
   R(17,58,7,12+f*2,'#fc944b');R(19,58,3,9+f,'#ffed9c')
  if state=='fuel-out': R(27,25,27,8,'#85664b')
  # Render each animation frame through draw-sheet using a one-frame sheet config.
  p=ROOT/'assets'/f'miner/{state}/frame{f:02}.png';p.parent.mkdir(parents=True,exist_ok=True)
  log=ROOT/'artwork'/f'miner-{state}-{f}.json';log.write_text(json.dumps(a));cfg=log.with_suffix('.config.json');cfg.write_text(json.dumps(dict(width=80,height=80,background='#00000000',frames=1,actions=str(log),preview=str(p))))
  # draw-sheet requires template paths; draw renderer shares the authored operation schema.
  emit(f'miner/{state}/frame{f:02}.png',a)
for f in range(4):
 a=[]
 for branch in range(3+f*3):
  x=random.randrange(15,65);y=random.randrange(15,65);line(a,40,40,x,y,'#0b151ecc');line(a,x,y,x+random.randrange(-12,12),y+12,'#17232add')
 emit(f'tiles/crack/frame{f:02}.png',a)
for f in range(3):
 a=texture('#d34e30','#f07e3b','#90312d')
 for i in range(18):
  x=random.randrange(80);y=random.randrange(80);line(a,x,y,min(79,x+16),y,'#ffc871')
 emit(f'hazards/lava/frame{f:02}.png',a)
for idx,name in enumerate(['fuel-depot','ore-market','save-pad','upgrade-shop','supply-depot','launch-pad']):
 a=[];c=['#edb95c','#7dd0ba','#8cc8ea','#e4a377','#a7be84','#c0c9ce'][idx]
 rect(a,8,65,144,15,'#253e49');rect(a,18,20,124,46,'#344c57');rect(a,23,24,114,37,'#51636a');rect(a,14,15,132,8,c);rect(a,14,23,132,3,'#192e3a');rect(a,95,35,30,30,'#152b39');rect(a,99,39,22,12,c)
 for x in range(30,85,13):rect(a,x,33,7,14,'#203d4a');rect(a,x,33,6,3,c)
 for x in [22,135]:rect(a,x,57,4,8,'#c3b595')
 if idx==0:rect(a,32,2,38,15,'#728a8d');rect(a,36,4,29,5,c)
 if idx==2:rect(a,61,0,5,16,c);line(a,48,4,79,4,c)
 if idx==3:rect(a,112,0,9,16,'#293d48');rect(a,108,0,17,3,c)
 emit('surface/'+name+'.png',a,160,80)
for stage in range(6):
 a=[];rect(a,8,142,144,18,'#425b65');rect(a,17,143,126,4,'#a3b1ad')
 if stage:
  rect(a,64,42,33,100,'#b4c5c2');rect(a,65,44,7,95,'#e4e1c5');rect(a,90,43,7,96,'#6b8690')
  for y in range(43,143,20):rect(a,64,y,33,3,'#34515e')
 if stage>=2:rect(a,48,100,12,42,'#d68e59');rect(a,101,100,12,42,'#d68e59')
 if stage>=3:circle(a,81,68,9,'#213d4b');circle(a,81,67,6,'#8edbd8')
 if stage>=4:rect(a,70,137,23,9,'#eab772')
 if stage>=5:
  for y in range(9,43):rect(a,80-(y-9)//2,y,max(1,y-8),1,'#d58151')
 emit(f'rocket/stage{stage}.png',a,160,160)
a=texture('#675d4b','#a08960','#443f36');emit('surface/ground.png',a)
a=[];rect(a,0,0,320,180,'#102530')
for i in range(140):rect(a,random.randrange(320),random.randrange(180),1,1,random.choice(['#64828a','#385763','#a7b7ac']))
for x in range(320):
 y=int(145+15*__import__('math').sin(x/30)+8*__import__('math').sin(x/11));rect(a,x,y,1,180-y,'#1c3540')
emit('surface/sky.png',a,320,180)
a=[];rect(a,7,12,66,68,'#1c3038');rect(a,13,20,54,60,'#091b25');rect(a,9,9,62,7,'#d8a963');emit('surface/cave-mouth.png',a)
for i,name in enumerate(['fuel','hull','cargo','credits','depth','resonite','cryenite','core-sample']):
 a=[];c=['#eebd6c','#e4856b','#91bcbc','#e8d38a','#8abacb','#62efc0','#84c9ff','#ff9964'][i];rect(a,6,4,13,16,'#243d48');rect(a,8,3,9,17,c);rect(a,10,5,3,6,'#f1e7c4');rect(a,5,19,15,2,c);emit('icons/'+name+'.png',a,24,24)
