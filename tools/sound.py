import pathlib,json,subprocess
root=pathlib.Path('/work');out=root/'assets/audio';out.mkdir(parents=True,exist_ok=True)
def run(tool,cfg,*args):subprocess.run([tool,'--config',str(cfg),*map(str,args)],check=True,stdout=subprocess.DEVNULL)
for i,name in enumerate(['drill','thrust','ore-pickup','material-chime','gas-explosion','lava-sizzle','impact','fabricate','launch','death','alarm-fuel','alarm-core']):
 cfg=root/'artwork'/f'{name}.sound.json';cfg.write_text(json.dumps(dict(sample_rate=22050,channels="mono",max_duration_ms=1800,seed=43,actions=str(cfg)+'.ops',preview=str(cfg)+'.png',wav=str(out/f'{name}.wav'))))
 run('sfx-synth',cfg,'init')
 noise=name in ['drill','thrust','gas-explosion','lava-sizzle','impact','launch','death'];dur=1200 if name in ['drill','thrust','launch'] else 500
 run('sfx-synth',cfg,'add-voice','--name','body','--wave','noise' if noise else 'triangle','--freq',420+i*55,'--dur',dur,'--gain',-22 if noise else -17)
 run('sfx-synth',cfg,'set-envelope','--voice','body','--env','gate' if name in ['drill','thrust'] else 'pluck')
 run('sfx-synth',cfg,'add-voice','--name','tone','--wave','sine','--freq',65 if noise else 650+i*35,'--dur',dur,'--gain',-23)
 run('sfx-synth',cfg,'set-pitch','--voice','tone','--slide-to',30 if noise else 1000+i*40,'--over',dur)
 run('sfx-synth',cfg,'render')
cfg=root/'artwork/music.config.json';cfg.write_text(json.dumps(dict(sample_rate=22050,channels="mono",max_duration_ms=24000,seed=5,actions=str(cfg)+'.ops',preview=str(cfg)+'.png',wav=str(out/'music.wav'),midi=str(out/'music.mid'))))
run('music',cfg,'init');run('music',cfg,'set-tempo','--bpm',80)
for name,wave in [('drone','sine'),('bell','triangle')]:run('music',cfg,'define-track','--name',name,'--instrument',wave)
for i,p in enumerate(['D2','D2','Bb1','C2']):run('music',cfg,'add-note','--track','drone','--pitch',p,'--t',i*8,'--dur',8,'--velocity',45)
for i,p in enumerate(['D4','A4','F4','E4','D4','C4','A3','E4']):run('music',cfg,'add-note','--track','bell','--pitch',p,'--t',i*4,'--dur',2,'--velocity',32)
run('music',cfg,'render')

# The tool emits its MIDI sibling under its default name on this run.
if (root/'clip.mid').exists(): (root/'clip.mid').replace(out/'music.mid')
for name,samples in [('impact',[('impact_metal_hollow',0,-13),('debris_rubble',40,-22)]),('fabricate',[('mech_clip_load',0,-13),('zap_electric',100,-20)])]:
 cfg=root/'artwork'/f'{name}.sound.json'
 run('sfx-sample',cfg,'init')
 for sample,t,gain in samples:run('sfx-sample',cfg,'add-sample','--name',sample,'--t',t,'--gain',gain,'--trim','0,800','--fade-out',100)
 run('sfx-sample',cfg,'render')
