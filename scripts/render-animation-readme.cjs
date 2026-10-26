/** Inventory-driven, always-visible README GIFs. No publishing side effects. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn,execFileSync}=require('node:child_process'),{chromium}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:5241';let browser;
const server=spawn(process.execPath,[root+'/node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5241','--strictPort'],{cwd:root,stdio:'ignore',env:{...process.env,MOLE_REVIEW_FREEZE:'1'}});
(async()=>{
 for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true});const p=await browser.newPage();await p.goto(url);
 const {groups,coverage}=await p.evaluate(async()=>{const m=await import('/scripts/animation-gallery-fixture.tsx');return{groups:m.GALLERY,coverage:m.GALLERY_COVERAGE}});
 const dir=path.join(root,'artifacts/animation-gallery'),checks=JSON.parse(fs.readFileSync(path.join(dir,'checks.json'),'utf8'));checks.drag=JSON.parse(fs.readFileSync(path.join(dir,'horizontal-checks.json'),'utf8'));checks['drag-young']=JSON.parse(fs.readFileSync(path.join(dir,'young-drag-checks.json'),'utf8'));
 checks['middle-elastic']=JSON.parse(fs.readFileSync(path.join(dir,'middle-elastic-checks.json'),'utf8'));
 checks['drag-shared-body']=JSON.parse(fs.readFileSync(path.join(dir,'shared-body-checks.json'),'utf8'));
 for(const key of Object.keys(groups)){assert.ok(checks[key],`Missing actual recording ${key}`);assert.deepEqual(checks[key].cells,JSON.parse(JSON.stringify(groups[key].cells)),`${key}: GIF was recorded against older catalogue settings`)}
 const index=new Map();for(const [key,spec]of Object.entries(checks)){assert.ok(fs.existsSync(path.join(dir,key+'.gif')),key);assert.deepEqual(spec.errors,[]);for(const cell of spec.cells)if(!index.has(cell.action))index.set(cell.action,key)}
 for(const action of coverage.actions)assert.ok(index.has(action),'Missing renderer action '+action);
 for(const item of coverage.items)assert.ok(Object.values(checks).some(group=>group.cells.some(cell=>cell.itemId===item.id&&cell.action===item.action)),'Missing item '+item.id);
 for(const outfit of coverage.outfits){const group=checks['outfit-'+outfit];assert.equal(group.cells.length,8);assert.ok(group.cells.every(c=>c.costume===outfit))}
 const media=(label,file)=>`![${label}](${file})\n\n`;
 let section='## 本轮重点预览（未发布）\n\n按最新要求，**拖拽时中级直接使用初级的身体、脸部和动作，只增加原版叶片**。两者共用75帧身体序列、同一个播放时钟和同一套拖动响应。下方截取实际拖拽与回弹片段，逐帧检查身体像素、当前帧和拉扯变换一致。\n\n';
 section+=media('同一身体、同一动作：中级只多出叶片（实际拖拽及回弹片段）','artifacts/animation-gallery/drag-shared-body.gif');
 section+=media('完整过程：拖拽前后仍各自使用原待机形态','artifacts/animation-gallery/drag-young.gif');
 section+=media('中级完整过程特写（放大1.44倍观察）','artifacts/animation-gallery/middle-elastic.gif');
 section+='初级和中级均为五种朝向、每朝向15帧。原初级身体和表情逐像素保留，中级原叶片贴在身体后方，不挡住身体和眼睛。原素材的组合及叶片贴合属于桌宠适配；本轮修改范围为拖拽与松手衔接。\n\n';
 section+=media('身体帧对照：每个方向上排初级、下排中级','artifacts/v35-shared-body.png');
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
 section+='[本轮共用身体的实现与验证](research/v35-shared-drag-body.md) · [此前独立形变研究](research/v34-middle-elastic-drag.md) · [原素材来源](research/v30-motion-previews.md)\n\n';
 section+='## 体积精简（本地预览构建）\n\n继续使用无损WebP构建，逐张核对透明度和可见像素一致。当前710张运行图片约84.40 MB → 50.04 MB，较上一轮图片减少约1.06 MB。安装目录剔除重复的前端库，Electron语言资源保留中文、英文。此前同版本Electron的Linux目录实测约409 MB → 304 MB，减少约26%；该目录数值未包含新增拖拽帧，Windows/macOS最终安装包大小也待各自构建验证。预览GIF和录屏帧不进入安装目录，录屏中间帧编码后自动清理。\n\n[此前测量明细与验证范围](research/v32-animation-and-size.md)\n\n';
 const readmeFile=path.join(root,'README.md'),old=fs.readFileSync(readmeFile,'utf8'),start=old.indexOf('## 本轮'),end=old.indexOf('\n---\n\n一只住在',start);assert.ok(start>=0&&end>start);fs.writeFileSync(readmeFile,old.slice(0,start)+section+old.slice(end));
 fs.writeFileSync(path.join(dir,'checks.json'),JSON.stringify(checks,null,2)+'\n');fs.writeFileSync(path.join(dir,'catalogue-coverage.json'),JSON.stringify({actions:coverage.actions,items:coverage.items,outfits:coverage.outfits,missing:[]},null,2)+'\n');console.log(`PASS README: ${coverage.actions.length} action names, ${coverage.items.length} items, ${coverage.outfits.length} outfits, ${Object.keys(groups).length} gallery GIFs + 4 actual drag GIFs; all existing tracked GIFs included, no collapsed galleries`);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server.kill('SIGTERM')});
