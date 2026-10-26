/** Inventory-driven, always-visible README GIFs. No publishing side effects. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn,execFileSync}=require('node:child_process'),{chromium}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:5241';let browser;
const server=spawn(process.execPath,[root+'/node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5241','--strictPort'],{cwd:root,stdio:'ignore',env:{...process.env,MOLE_REVIEW_FREEZE:'1'}});
(async()=>{
 for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true});const p=await browser.newPage();await p.goto(url);
 const {groups,coverage}=await p.evaluate(async()=>{const m=await import('/scripts/animation-gallery-fixture.tsx');return{groups:m.GALLERY,coverage:m.GALLERY_COVERAGE}});
 const dir=path.join(root,'artifacts/animation-gallery'),checks=JSON.parse(fs.readFileSync(path.join(dir,'checks.json'),'utf8'));checks.drag=JSON.parse(fs.readFileSync(path.join(dir,'horizontal-checks.json'),'utf8'));checks['drag-young']=JSON.parse(fs.readFileSync(path.join(dir,'young-drag-checks.json'),'utf8'));
 delete checks['middle-elastic'];delete checks['drag-shared-body'];delete checks['middle-nojump'];
 checks['middle-bound']=JSON.parse(fs.readFileSync(path.join(dir,'middle-bound-checks.json'),'utf8'));
 for(const key of Object.keys(groups)){assert.ok(checks[key],`Missing actual recording ${key}`);assert.deepEqual(checks[key].cells,JSON.parse(JSON.stringify(groups[key].cells)),`${key}: GIF was recorded against older catalogue settings`)}
 const index=new Map();for(const [key,spec]of Object.entries(checks)){assert.ok(fs.existsSync(path.join(dir,key+'.gif')),key);assert.deepEqual(spec.errors,[]);for(const cell of spec.cells)if(!index.has(cell.action))index.set(cell.action,key)}
 for(const action of coverage.actions)assert.ok(index.has(action),'Missing renderer action '+action);
 for(const item of coverage.items)assert.ok(Object.values(checks).some(group=>group.cells.some(cell=>cell.itemId===item.id&&cell.action===item.action)),'Missing item '+item.id);
 for(const outfit of coverage.outfits){const group=checks['outfit-'+outfit];assert.equal(group.cells.length,8);assert.ok(group.cells.every(c=>c.costume===outfit))}
 const media=(label,file)=>`![${label}](${file})\n\n`;
 let section='## 本轮重点预览（未发布）\n\n**中级直接使用初级的75张黏滞身体原帧，仅增加跟随头顶的叶片序列。** 拖动的转身、拖尾、拉伸、挤压和松手响应共用初级。未重新绘制身体、眼睛和嘴，也未增加独立的上下跳跃。\n\n';
 section+=media('应用实录：左初级，右中级；身体原帧与拖拽时序相同','artifacts/animation-gallery/drag-young.gif');
 section+='### 先生成序列，再接入逐帧播放\n\n原版中级叶片纹理生成17档叶尖弯曲姿态，叶柄固定在头顶关节，随身体形变选帧并延迟回摆；合成五方向共75张PNG。叶片动画、绑定及桌面拖拽编排属于本项目适配，不称为官方完整拖拽动作。透明画布向外扩展，身体尺寸不缩小、叶片不裁切。\n\n';
 section+=media('生成序列：左为初级原帧，右为相同身体加绑定叶片','artifacts/v37-bound/bound-sequence.gif');
 section+='[下载PNG逐帧序列：五方向 × 15帧，红色预览](artifacts/v37-bound/frames-red.zip)\n\n';
 section+=media('合成序列抽帧：完整75帧见下载','artifacts/v37-bound/frames.png');
 section+=media('中级单独实录：原帧拉伸、叶片跟随和松手衔接','artifacts/animation-gallery/middle-bound.gif');
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
 const current=new Set(Object.keys(checks).map(k=>'artifacts/animation-gallery/'+k+'.gif').concat(['artifacts/v30-preview/move.gif','artifacts/v30-preview/drag.gif','artifacts/v30-preview/pet.gif','artifacts/v30-preview/butterfly.gif','artifacts/v37-bound/bound-sequence.gif']));
 for(const file of execFileSync('git',['ls-files','*.gif'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean))if(!current.has(file))section+=media('历史 / 原素材：'+path.basename(file),file);
 section+='[本轮逐帧绑定、来源与验证](research/v37-bound-crown-drag.md) · [此前贴地补间研究（已替换）](research/v36-original-grounded-drag.md) · [原素材来源](research/v30-motion-previews.md)\n\n';
 const reportFile=path.join(root,'dist/asset-size-report.json'),report=fs.existsSync(reportFile)?JSON.parse(fs.readFileSync(reportFile,'utf8')):null;
 const imageSize=report?`${report.count}张图片 ${(report.before/1e6).toFixed(2)} MB → ${(report.after/1e6).toFixed(2)} MB`:'图片在构建时转换为无损WebP';
 section+='## 体积精简（本地预览构建）\n\n'+imageSize+'，逐张核对透明度和可见像素一致。Java、Python、OpenCV只用于离线生成图片，不随客户端安装。预览GIF、PNG序列ZIP和原始录屏帧均不进入安装目录。此前同版本Electron的Linux目录实测约409 MB → 304 MB；该旧测量未包含后续动画素材，Windows/macOS最终安装包大小待各自构建验证。\n\n[此前测量明细与验证范围](research/v32-animation-and-size.md)\n\n';
 const readmeFile=path.join(root,'README.md'),old=fs.readFileSync(readmeFile,'utf8'),start=old.indexOf('## 本轮'),end=old.indexOf('\n---\n\n一只住在',start);assert.ok(start>=0&&end>start);fs.writeFileSync(readmeFile,old.slice(0,start)+section+old.slice(end));
 fs.writeFileSync(path.join(dir,'checks.json'),JSON.stringify(checks,null,2)+'\n');fs.writeFileSync(path.join(dir,'catalogue-coverage.json'),JSON.stringify({actions:coverage.actions,items:coverage.items,outfits:coverage.outfits,missing:[]},null,2)+'\n');console.log(`PASS README: ${coverage.actions.length} action names, ${coverage.items.length} items, ${coverage.outfits.length} outfits, ${Object.keys(groups).length} gallery GIFs + ${Object.keys(checks).length-Object.keys(groups).length} actual drag GIFs; all existing tracked GIFs included, no collapsed galleries`);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server.kill('SIGTERM')});
