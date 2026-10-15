"""Draw the final compact instrument glyphs with the sprite authoring tool."""
import json,pathlib,subprocess,tempfile
root=pathlib.Path('/work')
def r(a,x,y,w,h,c):a.append(dict(op='fill_rect',x=x,y=y,width=w,height=h,color=c))
def l(a,x,y,X,Y,c):a.append(dict(op='line',x0=x,y0=y,x1=X,y1=Y,color=c))
def o(a,x,y,size,c):a.append(dict(op='fill_circle',cx=x,cy=y,r=size,color=c))
for name in ['fuel','hull','cargo','credits','depth','resonite','cryenite','core-sample']:
 a=[];dark='#304e59';light='#dce8d5';gold='#e8bd76'
 if name=='fuel':
  r(a,7,3,10,3,gold);r(a,5,7,13,15,dark);r(a,7,7,9,14,gold);r(a,9,10,3,7,light);l(a,17,8,21,10,gold);l(a,21,10,21,19,gold);r(a,5,20,14,2,gold)
 if name=='hull':
  for y in range(3,21):
   half=8 if y<13 else 8-(y-13);r(a,12-half,y,max(1,half*2),1,'#de9e82')
  r(a,10,6,3,10,light);r(a,7,10,10,3,light);l(a,5,4,18,4,'#f1c5a4')
 if name=='cargo':
  r(a,3,7,18,15,'#8db9b4');r(a,5,9,14,11,dark);r(a,7,3,10,4,'#8db9b4');r(a,9,4,6,3,dark);l(a,5,9,18,20,'#b4d4c4');l(a,18,9,5,20,'#b4d4c4');r(a,3,7,18,2,light)
 if name=='credits':
  o(a,12,12,10,'#8f8257');o(a,12,11,9,gold);o(a,12,11,6,'#ad925c');l(a,15,7,9,7,light);l(a,9,7,8,15,light);l(a,8,15,15,15,light);l(a,12,5,12,18,gold)
 if name=='depth':
  r(a,5,3,3,12,'#82bbcd');r(a,13,3,7,2,dark);r(a,13,8,5,2,dark);r(a,13,13,7,2,dark);r(a,13,19,7,2,dark)
  for y in range(7):r(a,2+y,14+y,10-y*2 if y<5 else 1,1,'#82bbcd')
 if name in ['resonite','cryenite']:
  c='#73d9b2' if name=='resonite' else '#8cc6ec'
  for x,y in [(5,11),(12,4),(18,10)]:
   l(a,x,y,x-3,21,c);l(a,x,y,x+3,21,c)
   for z in range(y,22):r(a,x-(z-y)//6,z,2+(z-y)//3,1,c)
   l(a,x,y,x,18,light)
 if name=='core-sample':
  r(a,8,2,8,3,gold);r(a,9,5,6,5,'#c7d9c4');r(a,6,10,12,12,dark);o(a,12,15,5,'#f09961');o(a,12,14,2,light);r(a,5,21,14,2,gold);r(a,6,10,12,2,'#c7d9c4')
 with tempfile.NamedTemporaryFile('w',suffix='.json')as f:
  json.dump(a,f);f.flush();subprocess.run(['draw','render','--actions',f.name,'--out',str(root/'assets/icons'/f'{name}.png'),'--width','24','--height','24','--no-layers'],check=True,stdout=subprocess.DEVNULL)
