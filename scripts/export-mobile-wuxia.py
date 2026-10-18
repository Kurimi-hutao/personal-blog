from pathlib import Path
import subprocess,json
from PIL import Image
import imageio_ffmpeg
root=Path(__file__).resolve().parents[1]
masters=root/'outputs/ae-wuxia-20261018/masters'
out=root/'assets/mobile-wuxia-v3';out.mkdir(exist_ok=True)
ff=imageio_ffmpeg.get_ffmpeg_exe()
assets=[('reading','05-reading-v3',384),('parasol-hero','06-parasol-hero-v3',384),('resting','07-resting-v3',384),('peeking','08-peeking-v3',384),('parasol','01-parasol',256),('prayer','02-prayer',192),('seal','03-seal',128),('river','04-river',768)]
report=[]
for name,source,size in assets:
    src=masters/(source+'.mov')
    def run(args): subprocess.run([ff,'-v','error','-y',*args],check=True)
    run(['-i',str(src),'-an','-vf',f'scale={size}:-2','-c:v','libvpx-vp9','-pix_fmt','yuva420p','-b:v','0','-crf','32','-auto-alt-ref','0','-row-mt','1','-cpu-used','3',str(out/(name+'.webm'))])
    run(['-ss','0.8','-i',str(src),'-frames:v','1','-vf',f'scale={size}:-2','-c:v','libwebp','-quality','82',str(out/(name+'-still.webp'))])
    fallback=min(size,128) if name!='river' else 320
    run(['-i',str(src),'-an','-vf',f'fps=24,scale={fallback}:-2','-c:v','libwebp_anim','-quality','48','-loop','0',str(out/(name+'-motion.webp'))])
    row=dict(name=name,width=size,videoBytes=(out/(name+'.webm')).stat().st_size,posterBytes=(out/(name+'-still.webp')).stat().st_size,fallbackBytes=(out/(name+'-motion.webp')).stat().st_size)
    im=Image.open(out/(name+'-still.webp'));row['posterAlphaExtrema']=im.getchannel('A').getextrema();report.append(row);print(row,flush=True)
(out/'manifest.json').write_text(json.dumps(dict(version='20261018-v3',source='After Effects corrected V3 native renders',characters=dict(duration=8,fps=60,corrections=['closed mouth','whole raised arm follows forehead','complete bell contour masks']),assets=report),indent=2),encoding='utf-8')

