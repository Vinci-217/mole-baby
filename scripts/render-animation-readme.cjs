/** Inventory-driven, always-visible README GIFs. No publishing side effects. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn,execFileSync}=require('node:child_process'),{chromium}=require('@playwright/test');
const releaseMode=process.argv.includes('--release'),releaseVersion=require('../package.json').version;
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
 let section='## 本轮重点预览（未发布）\n\n**课程、技能、餐厅打工、小屋家具，以及修订后的叶柄绑定。** 原拉姆身体与表情继续使用可核对的页游素材；新书页、餐盘、帽子和四系法术是参考原画风绘制的关键帧，再离线编排成24fps透明图集，不称为官方完整技能原帧。\n\n';
 section+=media('应用内速览：帽子变花、旋风、流火、寒冰、陨石、餐厅服务员','artifacts/animation-gallery/school-preview.gif');
 section+='### 课程与生活玩法\n\n语言课前只会 bibobibo，结业后才说中文；英文课解锁英文问候，魔术课解锁帽子变花及后续四系课程。每门课三节，每节2–4分钟，进度和证书随宠物存档保存。餐厅每班2分钟，完成获得180摩尔豆；中断不结算，重开不会重复领工资。玩耍中可以主动睡觉，也保留困倦后的自动入睡。\n\n';
 section+=media('学习动作：原角色与新绘书页、发音及魔法练习','artifacts/animation-gallery/school.gif');
 section+=media('小屋布置：家具放地面，结业证书挂墙上','artifacts/v38-school/furnished-room.png');
 section+='[课程、技能与玩法说明](docs/COURSES.md) · [动画 skill 与原帧参考](skills/mole-classic-art/SKILL.md)\n\n';
 section+='### 修正叶片接点\n\n上一版把外侧叶片的重叠处误作叶柄，本轮改为双叶中央接点，并通过眼部位置跟随头部。身体仍沿用初级原帧；独立叶片转动幅度收小。以下是实际应用录制，左初级、右中级。\n\n';
 section+=media('修正后的初级和中级同步拖拽','artifacts/animation-gallery/drag-young.gif');
 section+=media('中级单独拖拽与松手衔接','artifacts/animation-gallery/middle-bound.gif');
 section+=media('修正接点后的合成序列：相同身体加中级叶片','artifacts/v38-school/crown/bound-sequence.gif');
 section+='[下载75张透明PNG逐帧序列](artifacts/v38-school/crown/frames-red.zip) · [接点与轮廓抽帧图](artifacts/v38-school/crown/frames.png)\n\n';
 section+=media('五阶段实际拖拽与松手衔接','artifacts/animation-gallery/drag.gif');
 section+='睡眠、摸摸、足球等既有动作仍全部展示在下面。\n\n';
 section+='## 全部现有动画（全部展开）\n\n按渲染器动作清单核对，覆盖 **'+coverage.actions.length+' 个动作名、32 种用品、9 件装扮**。每一组都直接显示 GIF；相同动作的兼容名称也有对应预览。九件装扮分别展示全部八种形态的摸摸回应。原帧方案与应用内录制分开标注，均未发布到正式版。\n\n';
 for(const [key,spec]of Object.entries(groups)){
  section+=`### ${spec.title}\n\n`+media(spec.title,'artifacts/animation-gallery/'+key+'.gif');
 }
 section+='### 原帧交互方案与来源对照（历史研究）\n\n下面两组拖拽是上一轮的固定姿态研究，已由本页开头的多朝向、多帧方案替换。保留用于对照。追蝶保留原217帧追虫的身体与叶片；道具和交互编排属于桌宠适配。\n\n';
 for(const [key,label]of [['move','初中级拿起前与水平拖动'],['drag','五阶段原帧拖动'],['butterfly','原版追虫与追蝴蝶适配']])section+=media(label,'artifacts/v30-preview/'+key+'.gif');
 section+='### 动作名与预览对应\n\n| 动作名 | GIF 分类 |\n| --- | --- |\n';
 for(const action of coverage.actions){const key=index.get(action);section+=`| \`${action}\` | [${key}](artifacts/animation-gallery/${key}.gif) |\n`}
 section+='\n### 其余已有动图（历史方案 / 原素材参考）\n\n以下保留在仓库中的动图全部列出，用于对照；它们不是本轮已认可的效果。\n\n';
 const current=new Set([...section.matchAll(/!\[[^\]]*\]\(([^)]+\.gif)\)/g)].map(match=>match[1]));
 for(const file of execFileSync('git',['ls-files','*.gif'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean))if(!current.has(file))section+=media('历史 / 原素材：'+path.basename(file),file);
 section+='[本轮课程与接点修订记录](research/v38-school-room.md) · [此前绑定研究（已替换）](research/v37-bound-crown-drag.md) · [原素材来源](research/v30-motion-previews.md)\n\n';
 const reportFile=path.join(root,'dist/asset-size-report.json'),report=fs.existsSync(reportFile)?JSON.parse(fs.readFileSync(reportFile,'utf8')):null;
 const imageSize=report?`${report.count}张图片 ${(report.before/1e6).toFixed(2)} MB → ${(report.after/1e6).toFixed(2)} MB`:'图片在构建时转换为无损WebP';
 section+='## 体积精简（本地预览构建）\n\n'+imageSize+'，逐张核对透明度和可见像素一致。Java、Python、OpenCV只用于离线生成图片，不随客户端安装。预览GIF、PNG序列ZIP和原始录屏帧均不进入安装目录。此前同版本Electron的Linux目录实测约409 MB → 304 MB；该旧测量未包含后续动画素材，Windows/macOS最终安装包大小待各自构建验证。\n\n[此前测量明细与验证范围](research/v32-animation-and-size.md)\n\n';
 if(releaseMode)section=section.replace('## 本轮重点预览（未发布）',`## 本轮更新 · v${releaseVersion}`).replace('均未发布到正式版。','来源与自制适配分别标注。');
 const readmeFile=path.join(root,'README.md'),old=fs.readFileSync(readmeFile,'utf8'),start=old.indexOf('## 本轮'),end=old.indexOf('\n---\n\n一只住在',start);assert.ok(start>=0&&end>start);let intro=old.slice(0,start);if(releaseMode)intro=intro.replace(/^>.*$/m,`> **Windows 与 Mac 桌面拉姆。** [下载与安装](https://github.com/Vinci-217/mole-baby/releases/latest) · [自动更新说明](docs/UPDATES.md)。v${releaseVersion} 的动画与玩法见下方，构建进度见 [GitHub Actions](https://github.com/Vinci-217/mole-baby/actions/workflows/windows-build.yml)。`);fs.writeFileSync(readmeFile,intro+section+old.slice(end));
 fs.writeFileSync(path.join(dir,'checks.json'),JSON.stringify(checks,null,2)+'\n');fs.writeFileSync(path.join(dir,'catalogue-coverage.json'),JSON.stringify({actions:coverage.actions,items:coverage.items,outfits:coverage.outfits,missing:[]},null,2)+'\n');console.log(`PASS README: ${coverage.actions.length} action names, ${coverage.items.length} items, ${coverage.outfits.length} outfits, ${Object.keys(groups).length} gallery GIFs + ${Object.keys(checks).length-Object.keys(groups).length} actual drag GIFs; all existing tracked GIFs included, no collapsed galleries`);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server.kill('SIGTERM')});
