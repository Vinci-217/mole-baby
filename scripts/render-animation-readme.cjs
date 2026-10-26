/** Inventory-driven, always-visible README GIFs. No publishing side effects. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn,execFileSync}=require('node:child_process'),{chromium}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:5241';let browser;
const server=spawn(process.execPath,[root+'/node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5241','--strictPort'],{cwd:root,stdio:'ignore',env:{...process.env,MOLE_REVIEW_FREEZE:'1'}});
(async()=>{
 for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true});const p=await browser.newPage();await p.goto(url);
 const {groups,coverage}=await p.evaluate(async()=>{const m=await import('/scripts/animation-gallery-fixture.tsx');return{groups:m.GALLERY,coverage:m.GALLERY_COVERAGE}});
 const dir=path.join(root,'artifacts/animation-gallery'),checks=JSON.parse(fs.readFileSync(path.join(dir,'checks.json'),'utf8'));checks.drag=JSON.parse(fs.readFileSync(path.join(dir,'horizontal-checks.json'),'utf8'));checks['drag-young']=JSON.parse(fs.readFileSync(path.join(dir,'young-drag-checks.json'),'utf8'));
 for(const key of Object.keys(groups)){assert.ok(checks[key],`Missing actual recording ${key}`);assert.deepEqual(checks[key].cells,JSON.parse(JSON.stringify(groups[key].cells)),`${key}: GIF was recorded against older catalogue settings`)}
 const index=new Map();for(const [key,spec]of Object.entries(checks)){assert.ok(fs.existsSync(path.join(dir,key+'.gif')),key);assert.deepEqual(spec.errors,[]);for(const cell of spec.cells)if(!index.has(cell.action))index.set(cell.action,key)}
 for(const action of coverage.actions)assert.ok(index.has(action),'Missing renderer action '+action);
 for(const item of coverage.items)assert.ok(Object.values(checks).some(group=>group.cells.some(cell=>cell.itemId===item.id&&cell.action===item.action)),'Missing item '+item.id);
 for(const outfit of coverage.outfits){const group=checks['outfit-'+outfit];assert.equal(group.cells.length,8);assert.ok(group.cells.every(c=>c.costume===outfit))}
 const media=(label,file)=>`![${label}](${file})\n\n`;
 let section='## 本轮重点预览（未发布）\n\n恢复初级与中级的左右转身：朝右拉向右，换向时经过正面转到左侧，松手回正。初级保留原动作的弹性，**只有中级去掉额外的上下弹跳**；用户仍可以用鼠标上下移动宠物。以下GIF来自实际应用的拖动代码。\n\n';
 section+=media('初级与中级：左右转身、多帧拉扯与松手回正','artifacts/animation-gallery/drag-young.gif');
 section+='初级75帧、中级80帧，分别覆盖正面、左右斜侧和左右侧面。角色来自原页游素材；中级新增的横向形变帧属于桌宠适配，保持身体的纵向位置。\n\n';
 section+=media('逐帧对照：每个朝向抽取八帧','artifacts/v33-drag-sequences.png');
 section+=media('五阶段实际拖拽与松手衔接','artifacts/animation-gallery/drag.gif');
 section+='下方睡眠与摸摸为前一轮方案，本轮只修订拖拽。\n\n';
 section+=media('安静睡觉：体型与叶冠不扭曲，闭眼和小嘴呼吸','artifacts/animation-gallery/sleep.gif');
 section+=media('原帧摸摸方案：闭眼微笑，轻轻靠向手掌','artifacts/v30-preview/pet.gif');
 section+='## 全部现有动画（全部展开）\n\n按渲染器动作清单核对，覆盖 **'+coverage.actions.length+' 个动作名、32 种用品、9 件装扮**。每一组都直接显示 GIF；相同动作的兼容名称也有对应预览。九件装扮分别展示全部八种形态的摸摸回应。原帧方案与应用内录制分开标注，均未发布到正式版。\n\n';
 for(const [key,spec]of Object.entries(groups)){
  section+=`### ${spec.title}\n\n`+media(spec.title,'artifacts/animation-gallery/'+key+'.gif');
 }
 section+='### 原帧交互方案与来源对照（历史研究）\n\n下面两组拖拽是上一轮的固定姿态研究，已由本页开头的多朝向、多帧方案替换。保留用于对照。追蝶保留原217帧追虫的身体与叶片；道具和交互编排属于桌宠适配。\n\n';
 for(const [key,label]of [['move','初中级拿起前与水平拖动'],['drag','五阶段原帧拖动'],['butterfly','原版追虫与追蝴蝶适配']])section+=media(label,'artifacts/v30-preview/'+key+'.gif');
 section+='### 动作名与预览对应\n\n| 动作名 | GIF 分类 |\n| --- | --- |\n';
 for(const action of coverage.actions){const key=index.get(action);section+=`| \`${action}\` | [${key}](artifacts/animation-gallery/${key}.gif) |\n`}
 section+='\n### 其余已有动图（历史方案 / 原素材参考）\n\n以下保留在仓库中的动图全部列出，用于对照；它们不是本轮已认可的效果。\n\n';
 const current=new Set(Object.keys(checks).map(k=>'artifacts/animation-gallery/'+k+'.gif').concat(['artifacts/v30-preview/move.gif','artifacts/v30-preview/drag.gif','artifacts/v30-preview/pet.gif','artifacts/v30-preview/butterfly.gif']));
 for(const file of execFileSync('git',['ls-files','*.gif'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean))if(!current.has(file))section+=media('历史 / 原素材：'+path.basename(file),file);
 section+='[本轮拖拽修订与验证](research/v33-directional-drag.md) · [前一轮动作与空间测量](research/v32-animation-and-size.md) · [原素材来源](research/v30-motion-previews.md)\n\n';
 section+='## 体积精简（本地预览构建）\n\n继续使用无损WebP构建，逐张核对透明度和可见像素一致。加入本轮拖拽帧后，710张运行图片约84.97 MB → 50.66 MB。安装目录剔除重复的前端库，Electron语言资源保留中文、英文。前一轮同版本Electron的Linux目录实测约409 MB → 304 MB，减少约26%；该目录数值未包含本轮新增帧，Windows/macOS最终安装包大小也待各自构建验证。预览GIF和录屏帧不进入安装目录，录屏中间帧编码后自动清理。\n\n[上轮测量明细与验证范围](research/v32-animation-and-size.md)\n\n';
 const readmeFile=path.join(root,'README.md'),old=fs.readFileSync(readmeFile,'utf8'),start=old.indexOf('## 本轮'),end=old.indexOf('\n---\n\n一只住在',start);assert.ok(start>=0&&end>start);fs.writeFileSync(readmeFile,old.slice(0,start)+section+old.slice(end));
 fs.writeFileSync(path.join(dir,'checks.json'),JSON.stringify(checks,null,2)+'\n');fs.writeFileSync(path.join(dir,'catalogue-coverage.json'),JSON.stringify({actions:coverage.actions,items:coverage.items,outfits:coverage.outfits,missing:[]},null,2)+'\n');console.log(`PASS README: ${coverage.actions.length} action names, ${coverage.items.length} items, ${coverage.outfits.length} outfits, ${Object.keys(groups).length} gallery GIFs + 2 actual drag GIFs; all existing tracked GIFs included, no collapsed galleries`);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server.kill('SIGTERM')});
