'use strict';
// Read the same TypeScript definitions as the app; no parallel balance table.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const root=path.resolve(__dirname,'..'),{ITEMS}=require('../src/catalog.ts'),{ALL_OUTFITS}=require('../src/wardrobe.ts'),{FURNITURE}=require('../src/room-furnishings.ts');
const game=require('../src/game.ts'),economy=require('../src/economy.ts'),status=require('../src/pet-status.ts'),{DAILY_BEANS}=require('../src/daily-check-in.ts'),{JOB_PAY,JOB_MS,COURSES}=require('../src/pet-school.ts');
const labels={food:'食物',drink:'饮品',clean:'清洁',medicine:'药水',toy:'玩具'},fields=status.STATUS_FIELDS;
const effects=item=>fields.filter(([key])=>(item[key]??0)>0).map(([key,label])=>`${label}+${item[key]}`).join('、')||(item.changesColor?'永久换色':'免费动作');
const table=(headers,rows)=>[headers,'---|'.repeat(headers.split('|').length-1)+'---',...rows].join('\n');
let coins=`# 摩尔豆数值\n\n本文件记录本地预览的现行规则，正式发布仍以发布版本为准。由 \`node scripts/write-balance-docs.cjs\` 根据代码生成。用户确认规则：十字架 400 豆，普通用品 10～80 豆，可购买衣服和家具统一 80 豆，餐厅每秒 1 豆。\n\n## 收入\n\n`;
coins+=table('来源 | 数值 | 条件',[
 `新领养 | ${economy.INITIAL_BEANS} 豆 | 仅新建拉姆；读取旧存档不重新发放或换算余额`,
 `每日签到 | ${DAILY_BEANS} 豆 | 按本地日期每天一次，不要求连续签到`,
 `小游戏 | floor((100 + 50 × 得分) × 有效秒数 / 30) | 得分 1～10，完成不足 10 秒按 10 秒档，最多按 60 秒档`,
 `每日首局 | +${economy.FIRST_GAME_BEANS} 豆 | 所有计分小游戏合计每天一次，得分至少 5 分`,
 `餐厅打工 | ${JOB_PAY/(JOB_MS/1000)} 豆/秒，${JOB_PAY/(JOB_MS/60000)} 豆/分钟 | 只算完整秒，随时开始/结束；开始扣 ${status.RESTAURANT_ENERGY_COST} 精力`,
 '课程、外出、看书、免费玩耍 | 不发摩尔豆 | 课程保留证书和课程奖励',
]);
coins+='\n\n小游戏适用于接果子、翻翻乐、拍拍乐、采果、拼图和寻宝。暂停和后台时间不计入奖励；0 分、中途退出不领奖。不设每日收益递减。每局使用独立局号，最近 80 个已结算局号保存到原存档；重复局号不重复发奖，任意两次领取还须间隔至少 10 秒。\n\n';
coins+=table('有效时长 | 5 分 | 8 分 | 10 分',[10,15,20,30,45,60].map(seconds=>`${seconds} 秒 | ${economy.gameBeans(5,seconds*1000)} | ${economy.gameBeans(8,seconds*1000)} | ${economy.gameBeans(10,seconds*1000)}`));
coins+='\n\n## 随机奖品\n\n每个有效局额外从当前可获得的奖池里随机发一件：\n\n- 用品：当前阶段可用的食物、饮品、清洁品和药水，包含全能十字架；每种堆叠上限 9999。免费玩耍道具已可直接使用，不重复作为无效库存发放。\n- 服装：尚未拥有的普通衣橱装扮，直接解锁到衣橱；种子可以收藏，长大后才能穿。魔法法杖仍由魔法课结业获得。\n- 家具：尚未解锁的家具，直接解锁到仓库；不会自动摆放，不修改原有布局。留言板和证书按已有赠送/课程规则获得。\n\n所有剩余候选条目等概率；已拥有的服装、家具和满堆叠用品会跳过。全部奖池条目都不可获得时只发摩尔豆。领奖不会自动换装。\n\n## 消费\n\n普通照料用品按“饱食＋水分＋清洁＋心情＋健康＋精力”的标注恢复量之和定价：\n\n`价格 = clamp(ceil(总恢复量 / 10) × 5, 10, 80)`。固定换色药水 80 豆，全能十字架固定 400 豆，自调色药水免费制作，免费玩具直接使用。恢复效果保持原设定，价格适配不修改本地原 XML 或 SWF。\n\n';
coins+=table('用品（ID） | 分类 | 价格/豆 | 恢复效果',ITEMS.map(i=>`${i.name}（${i.id}） | ${labels[i.category]} | ${i.price} | ${effects(i)}`));
coins+='\n\n所有可购买衣服、家具统一 80 豆，不划分大小或稀有度档位。解锁同种家具后，重复摆放、缩放和移动免费，最多同时摆放 200 件。留言板已免费赠送，结业证书及法杖继续按课程规则获得。\n\n';
coins+=table('衣服（ID） | 标价/豆 | 获得方式',ALL_OUTFITS.map(o=>`${o.name}（${o.id}） | ${o.price} | ${o.id==='star-wand'?'魔法课结业奖励，不出售':'购买或游戏奖品'}`));
coins+='\n\n'+table('家具（ID） | 标价/豆 | 获得方式',FURNITURE.map(f=>`${f.name}（${f.id}） | ${f.price} | ${f.id==='message-board'?'已免费赠送':'购买或游戏奖品'}`));
coins+='\n\n## 存档与边界\n\n原有摩尔豆、物品、衣橱、家具摆放、颜色、成长与回忆继续读取；不因改价自动补扣、清零、换算或重建。奖品与局号写入原有存档。摩尔豆上限 1,000,000,000，超限只按实际可入账数额结算。旧版法杖兼容退款仍按旧额 65 豆，不跟随现行标价重算。\n\n餐厅退出后保留已到账工资；关闭/重启后取消工作，没有离线工资。免费玩具、魔法展示、调色、背景/BGM切换、形态选择、存档与更新不收豆。\n';
let stats='# 状态数值\n\n本文件记录现行六项状态及其变化，未调整自然衰减速度。由 `node scripts/write-balance-docs.cjs` 根据代码生成；效果表与经济文档共用同一份用品定义。\n\n## 初始值与自然变化\n\n';
const starter=game.createPet('数值文档','blue',0);
stats+=table('状态 | 新领养初始值 | 清醒每小时 | 睡眠每小时',fields.map(([key,label])=>`${label} | ${starter.stats[key]} | ${key==='health'?'见健康规则':`−${status.NEED_RATES.awake[key]}`} | ${key==='health'?'见健康规则':key==='energy'?`+${-status.NEED_RATES.asleep.energy}`:`−${status.NEED_RATES.asleep[key]}`}`));
stats+=`\n\n状态范围为 0～100，恢复超过上限的部分不累积，满值且没有其他可恢复项时不消耗物品。\n\n- 饱食、水分、清洁均不低于 20 的时段，健康每小时 +${status.HEALTH_RECOVERY_PER_HOUR}；存在一项低于 20 的时段，每小时 −${status.HEALTH_LOSS_PER_HOUR}。自然变化最低健康为 1，不会因为疏于照料死亡或清空存档。\n- 每次离线最多结算 24 小时的状态变化；睡眠、醒来和成长门槛按实际跨越时间分段计算。\n- 精力不高于 ${game.REST_ENERGY} 时自动休息；睡眠每分钟恢复 ${-status.NEED_RATES.asleep.energy/60} 点精力，达到 ${game.WAKE_ENERGY} 后自然醒来。手动睡眠至少持续 1 分钟，手动叫醒或使用满精力饮料/十字架后有 ${game.WAKE_GRACE_MS/60000} 分钟清醒宽限。\n\n## 活动增减\n\n`;
stats+=table('行为 | 饱食 | 水分 | 清洁 | 心情 | 健康 | 精力',[
 '摸摸 | — | — | — | +6 | — | —',
 '一起玩球 | −5 | — | — | +16 | — | −12',
 '小游戏有效结算 | −4 | — | — | +(8 + 得分) | — | −8',
 '完成旧版上传玩具动作 | — | — | — | 最多 +6 | — | −3',
 `开始上课 | — | — | — | — | — | −5`,
 `开始餐厅打工 | — | — | — | — | — | −${status.RESTAURANT_ENERGY_COST}`,
 '普通阅读、免费原版动作、魔法展示、外出 | — | — | — | — | — | —',
]);
stats+='\n\n表中“—”表示没有额外的瞬时增减，期间仍按清醒/睡眠自然变化。小游戏奖品与摩尔豆不额外增加成长。旧版有限餐厅班次完成时心情 +5；当前连续在线打工仅在开始时扣 2 精力，不是每秒或每分钟扣。\n\n## 用品恢复表\n\n';
stats+=table('用品（ID） | 饱食 | 水分 | 清洁 | 心情 | 健康 | 精力 | 备注',ITEMS.map(i=>`${i.name}（${i.id}） | ${i.hunger} | ${i.thirst} | ${i.cleanliness} | ${i.happiness} | ${i.health} | ${i.energy??0} | ${i.id==='180006'?'全部立即恢复到100':i.changesColor?'永久换色，数值与成长保留':i.category==='toy'?'免费动作，不消耗旧库存':`最低阶段：${game.STAGES[i.minStage].name}`}`));
stats+='\n\n自调色药水不改变状态值，只改变颜色；颜色保存在原存档中。种子不能穿衣服，中奖衣服可以先保留在衣橱；切回种子会收好装扮，收藏不会删除。\n\n## 活动门槛\n\n';
for(const [label,rules] of [['上课',status.ACTIVITY_REQUIREMENTS],['餐厅打工',status.RESTAURANT_REQUIREMENTS],['自主小日常与外出',status.PLAY_REQUIREMENTS]])stats+=`- ${label}：${rules.map(r=>`${fields.find(([key])=>key===r.key)[1]}${r.exclusive?'>':'≥'}${r.minimum}`).join('、')}。\n`;
stats+='- 直接一起玩球：精力至少 12；睡眠时先叫醒。\n- 小游戏：上课、工作或睡眠期间不能开始；接果子须长成初级。0 分不结算，不扣本局结算消耗。\n\n## 成长、记录与动画\n\n';
stats+=`自动成长仅累计健康状态下清醒陪伴的有效时长：饱食、水分、心情 >35，清洁 >30，精力 >25 的时段；睡眠时暂停。种子→初级约 ${game.GROWTH_STAGE_HOURS[0]} 小时，初级→中级约 ${game.GROWTH_STAGE_HOURS[1]} 小时，中级→高级约 ${game.GROWTH_STAGE_HOURS[2]} 小时，高级积满末段约 ${game.GROWTH_STAGE_HOURS[3]} 小时后选择超拉形态。固定外观时保留自然进度；恢复自动成长时继续原进度。\n\n当前提供经典超拉、水、木、火形态。神力超拉的新选择入口已撤下，旧版 \`super\` 形态记录继续读取，不强制更换。\n\n状态记录保留最近 40 项，同类自然消耗在 15 分钟窗口内合并；显示实际增加/减少和原因。读书与魔法书装扮独立。碎片变身不在可玩列表中；原版变身遵循原形→烟雾→目标动画→烟雾→原形，加载完成后才开始，过程不更改颜色、成长或穿戴记录。\n\n代码入口：\`src/pet-status.ts\`、\`src/game.ts\`、\`src/catalog.ts\`、\`src/pet-school.ts\`、\`src/pet-records.ts\`。\n`;
fs.mkdirSync(path.join(root,'docs'),{recursive:true});fs.writeFileSync(path.join(root,'docs/摩尔豆数值.md'),coins);fs.writeFileSync(path.join(root,'docs/状态数值.md'),stats);console.log('Generated docs/摩尔豆数值.md and docs/状态数值.md');
