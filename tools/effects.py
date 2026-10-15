"""Author live particle systems with distinct emission, motion and color profiles."""
import json,pathlib,subprocess
root=pathlib.Path('/work')
def run(cfg,*args):subprocess.run(['particle-2d','--config',str(cfg),*map(str,args)],check=True,stdout=subprocess.DEVNULL)
profiles={
'gas-seep':(9,1600,12,10,.19,'#bed7be@0,#789a96@1',1,28),
'drill-debris':(32,500,105,2,.75,'#c7b398@0,#75634f@1',1,120),
'jetpack-exhaust':(50,400,150,4,.85,'#d2f4db@0,#ffaa62@0.3,#9b7367@1',-1,17),
'ore-sparkle':(22,650,65,2,.9,'#fff9cf@0,#e9c587@1',1,180),
'material-shimmer':(48,1200,54,3,.8,'#c5ffe7@0,#6ddbbe@0.5,#648ad7@1',1,180),
'gas-explosion':(100,950,170,8,.9,'#fff4ca@0,#edac60@0.3,#684d4c@1',1,180),
'lava-embers':(32,750,80,3,.8,'#ffecb0@0,#ff9c51@0.4,#c44b38@1',1,55),
'impact-dust':(44,850,60,6,.4,'#b9b09c@0,#6b675a@1',1,80),
'core-extract':(75,1500,85,4,.8,'#fff1c0@0,#ecb785@0.4,#bd729c@1',1,180),
'core-detonation':(180,1700,200,10,1,'#fff9e2@0,#ffb765@0.2,#b55463@0.7,#564352@1',1,180),
'launch-exhaust':(160,1700,160,10,.8,'#fff9d2@0,#eec580@0.3,#869b9d@1',-1,20),
'death-burst':(65,1200,130,4,.7,'#d9eee5@0,#9bb8b5@0.4,#59747e@1',1,180)}
for name,(burst,life,speed,size,opacity,color,dy,angle) in profiles.items():
 cfg=root/'artwork'/f'{name}.particle.json'
 cfg.write_text(json.dumps(dict(width=200,height=200,duration_ms=1800,fps=24,seed=5,actions=str(cfg)+'.ops',preview=str(cfg)+'.png',system=str(root/'assets/fx'/f'{name}.json'))))
 (root/'assets/fx').mkdir(exist_ok=True)
 run(cfg,'init');run(cfg,'add-emitter','--name','body','--shape','disc','--x',100,'--y',100,'--radius',10 if name=='gas-seep' else 3,'--burst',burst,'--lifetime',life,'--lifetime-spread',life//4,'--speed',speed,'--speed-spread',speed//3,'--dir-y',dy,'--cone-angle',angle)
 run(cfg,'set-particle','--emitter','body','--size-from',size,'--size-to',size*2 if name in ['gas-seep','impact-dust','launch-exhaust'] else 0,'--opacity-from',opacity,'--opacity-to',0,'--color-gradient',color)
 if name in ['gas-explosion','core-detonation']:
  run(cfg,'add-emitter','--name','flash','--shape','point','--x',100,'--y',100,'--burst',1,'--lifetime',130,'--speed',0)
  run(cfg,'set-particle','--emitter','flash','--size-from',50,'--size-to',0,'--opacity-from',1,'--opacity-to',0,'--color-gradient','#fff9d7@0,#ffd08e@1')
  run(cfg,'add-emitter','--name','shockwave','--shape','disc','--x',100,'--y',100,'--radius',6,'--burst',100,'--lifetime',450,'--speed',210,'--cone-angle',180)
  run(cfg,'set-particle','--emitter','shockwave','--size-from',3,'--size-to',0,'--opacity-from',.75,'--opacity-to',0,'--color-gradient','#fff2c3@0,#e8aa77@1')
 run(cfg,'render','--frame',8,'--out',str(root/'artwork'/f'{name}-preview.png'))
