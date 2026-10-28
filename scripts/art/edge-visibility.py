"""Record body extents in the fixed 100x108 desktop viewport, from original masks."""
from PIL import Image
import numpy as np,json
from pathlib import Path
root=Path(__file__).resolve().parents[2];profiles={}
for form in ['seed','junior','middle','senior','super','water','wood','fire','classic']:
 if form=='seed':
  # A potted seed's visible silhouette includes its independent original pot.
  a=np.asarray(Image.open(root/'public/assets/original/seed/body-mask.png').convert('RGBA'))[:99,:96];y,x=np.where((a[:,:,:3].max(2)>50)&(a[:,:,3]>32));b=[26.56+x.min()/96*50,17.31,26.56+(x.max()+1)/96*50,95.19]
 else:
  a=np.asarray(Image.open(root/f'public/assets/classic/{form}-mask.png').convert('RGBA'))[:208,:192];y,x=np.where((a[:,:,:3].max(2)>50)&(a[:,:,3]>32));b=[x.min()/192*100,y.min()/208*108,(x.max()+1)/192*100,(y.max()+1)/208*108]
 l,t,r,bottom=map(float,b);w,h=r-l,bottom-t
 hidden={'left':r-w*.3,'right':100-l-w*.3,'top':bottom-h*.3,'bottom':108-t-h*.3}
 profiles[form]={'body':[round(v,3)for v in [l,t,r,bottom]],'hidden':{k:round(v,3)for k,v in hidden.items()},'peek':{k:round(v*.6,3)for k,v in hidden.items()}}
(root/'electron/edge-visibility.json').write_text(json.dumps({'visibleRatio':.3,'viewport':[100,108],'source':'Original body colour masks; seed uses the union with its independent flowerpot.','forms':profiles},indent=2)+'\n')
