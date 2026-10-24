import { getStage } from './game';
import type { GameState } from './game';
import type { CompanionMemory } from './companion-memory';
import { companionFeeling } from './companion-feeling';
import { ITEMS } from './catalog';
import {todaysTimers} from './companion-moments';
import { companionSnoozeUntil, createInvitation } from './companion-invitation';
import type { CompanionInvitation } from './companion-invitation';

export type PresenceTopic='growth'|'work'|'progress'|'culture'|'life'|'memory'|'care'|'feeling'|'reading';
export interface PresenceLine { id:string; topic:PresenceTopic; text:string; invitation?:CompanionInvitation }
export interface PresenceJournal { version:1; petId:string; history:{id:string;topic:PresenceTopic;at:number}[] }
export const presenceKey=(pet:Pick<GameState,'createdAt'>)=>`ramu-presence-v1:${pet.createdAt}`;
const MINUTE=60000;
export const CULTURE = [
  {id:'culture-steps',quote:'不积跬步，无以至千里',text:'“不积跬步，无以至千里。”我也不是一下就长出叶子的，陪你一点点来。'},
  {id:'culture-new',quote:'苟日新，日日新，又日新',text:'“苟日新，日日新，又日新。”今天多懂一点点，也可以偷偷开心一下。'},
  {id:'culture-today',quote:'纸上得来终觉浅',text:'“纸上得来终觉浅。”有空试一小步吧，我在旁边陪着你。'},
  {id:'culture-spring',quote:'草木蔓发，春山可望',text:'“草木蔓发，春山可望。”想到小小的种子也会长大，就觉得日子很有盼头。'},
  {id:'culture-cloud',quote:'行到水穷处，坐看云起时',text:'“行到水穷处，坐看云起时。”偶尔停一停，也可能看见不一样的风景。'},
  {id:'culture-lantern',quote:'灯火可亲',text:'灯火可亲。一盏小灯、一段安静的时间，也能让普通的日子暖起来。'},
] as const;
const READING=[
 '我把这一页翻过去，接着陪你慢慢读。','先读懂一小段，就可以为自己开心一下。','遇到不懂的字，可以先做个记号，回头再找答案。','有时候把一段话读出声，会发现新的意思。',
 '书里有好多小世界，今天想走进哪一个？','读到喜欢的句子，可以留在自己的小本子里。','同一本书，过些日子再读，也许会有新的发现。','我在这边安安静静翻书，陪你按自己的节奏学。',
 '刚读过的内容，可以试着用自己的话讲一遍。','一个小问题，也可能是认识新东西的开始。','学得慢一些没关系，理解比赶页数更有意思。','翻完这一页，我想把好奇心也一起留下来。',
 '读书也可以只是喜欢，不必每一页都有收获。','读到喜欢的句子，就给它留一个小小的记号吧。','把书合上想一小会儿，也是在读懂它。','今天的这段安静时光，我很喜欢。',
];
const BANK:Record<Exclude<PresenceTopic,'memory'|'care'|'feeling'|'growth'|'culture'|'reading'>,string[]>={
  work:['手边的事可以一件件来，我就在这里陪着你。','不用一口气把所有事做好，先把眼前的一小点安顿好。','想歇一小会儿就歇一会儿，回来以后我们再慢慢继续。','肩膀可以放松一点点。今天的你，也值得被好好照顾。','如果手边忙完一小段，可以看看远处，给眼睛一小片风景。','你安静做事，我就在这里陪着。想起我时，摸摸我就好。','杯子里的水要是空了，顺手给自己倒一点吧。','难的事情可以先拆小一点，我陪你慢慢琢磨。'],
  progress:['今天哪怕只多懂一点点，也算在往前走。','做得慢一些没关系，认真走过的小步也有分量。','不必每件事都有漂亮的结果，愿意尝试就很珍贵。','遇到暂时不懂的地方，可以先留个小问号，慢慢找答案。','如果刚好做成了一点小事，记得也为自己开心一下。','进步有时候很安静，像种子在土里慢慢生根。','换一种办法再试试，也是在认识自己的路。','今天做不到的，可以留给更有精神的时候。'],
  life:['有时候，一首喜欢的歌就能让这一小会儿变得柔软。','窗外要是有好看的天色，记得替我多看一眼呀。','我喜欢我们这样，各忙各的，也彼此有个照应。','今天的小小开心，也值得悄悄收好。','生活里不只有待办清单，也有值得慢慢尝一口的甜。','希望今天的你，会遇到一件可爱的小事。','喜欢的东西，不一定要有什么用。喜欢就已经很好了。','我在这里轻轻晃一晃；你在自己的节奏里慢慢来。'],
};
const GROWTH=[
 ['我还住在小花盆里呢。你忙你的，我也在慢慢长大。','种子也有自己的节奏。今天一起安安稳稳地过吧。','花盆是我现在的小天地，你放我在哪里，我就陪在哪里。'],
 ['离开小花盆以后，能陪你去桌面的更多地方啦。','现在还没有叶子，我会一点点长大，你也按自己的节奏来。','小小一只也能做陪伴这件大事，我很认真呢。'],
 ['两片叶子长出来啦，像两个小小的招呼，悄悄送给你。','我把叶子晃一晃，就当给今天的你打个气。','叶子长大要时间，学会一件事也一样。'],
 ['我的扇叶展开了，还是当初被你带回来的那只拉姆。','长大以后想做的事，还是好好陪着你。','扇叶轻轻动一动，陪你把普通的一天过得暖一点。'],
 ['模样长大了，我还记得我们是从一颗小种子开始的。','变成新的模样，也想继续收集和你一起的小日常。','长大不是突然变厉害，是把陪伴一天天积起来。'],
];
export function newPresenceJournal(pet:GameState):PresenceJournal{return {version:1,petId:String(pet.createdAt),history:[]};}
export function readPresenceJournal(pet:GameState):PresenceJournal{
 try{const raw=JSON.parse(localStorage.getItem(presenceKey(pet))||'null');if(raw?.version!==1||raw.petId!==String(pet.createdAt)||!Array.isArray(raw.history))return newPresenceJournal(pet);return {...newPresenceJournal(pet),history:raw.history.filter((v:unknown)=>{const x=v as {id?:unknown;topic?:unknown;at?:unknown};return x&&typeof x.id==='string'&&x.id.length<50&&['growth','work','progress','culture','life','memory','care','feeling','reading'].includes(String(x.topic))&&typeof x.at==='number'&&Number.isFinite(x.at)&&x.at>=0;}).slice(-48)};}catch{return newPresenceJournal(pet);}
}
export function rememberPresence(journal:PresenceJournal,line:PresenceLine,now:number):PresenceJournal{
 const next={...journal,history:[...journal.history,{id:line.id,topic:line.topic,at:now}].slice(-48)};
 try{localStorage.setItem(`ramu-presence-v1:${journal.petId}`,JSON.stringify(next));}catch{/* Optional cadence cache; core memories stay independent. */}return next;
}
export function wantsQuiet(memory:CompanionMemory):boolean{return memory.facts.some(f=>f.kind==='boundary'&&/(?:别|不要|不想|希望|请|陪我).*(?:打扰|安静|主动说话|主动聊天|主动邀请|主动互动)/.test(f.value));}
export function presenceCandidates(pet:GameState,memory:CompanionMemory,now=Date.now()):PresenceLine[]{
 const stage=getStage(pet.growth,pet.evolution),lines:PresenceLine[]=[];
 const add=(id:string,topic:PresenceTopic,text:string)=>lines.push({id,topic,text});
  [
    '摩尔城堡、淘淘乐街……这些名字一念，就有小时候的感觉呢。',
    '小拉姆也有自己的小日子：吃饱、洗干净，再陪你发一会儿呆。',
    '小时候在庄园里忙来忙去，现在也可以一起慢慢过日子。',
    stage===0?'小花盆里也有好多新鲜事。你忙你的，我在这里陪着。':'咕噜？我把身子轻轻一晃，就当和你打过招呼啦。',
  ].forEach((text,i)=>add(`ram-life-${i}`,'life',text));
 GROWTH[stage].forEach((text,i)=>add(`growth-${stage}-${i}`,'growth',text));
 for(const [topic,texts] of Object.entries(BANK))texts.forEach((text,i)=>{if(stage===0&&text.includes('晃晃叶子'))return;add(`${topic}-${i}`,topic as PresenceTopic,text);});
 CULTURE.forEach(v=>add(v.id,'culture',stage<2?v.text.replace('长出叶子','长大'):v.text));
 const hour=new Date(now).getHours();
 if(hour>=6&&hour<11)add('time-morning','life','早上的光很温柔。希望今天有一点让你期待的小事。');
 else if(hour>=11&&hour<14)add('time-noon','work','到中午啦，方便的时候好好吃顿饭。先照顾好自己。');
 else if(hour>=18&&hour<22)add('time-evening','life','天色慢慢晚了。无论今天顺不顺，都给自己留一点松快的时间吧。');
 else if(hour>=22||hour<6)add('time-night','work','夜深了，手边的事要是能告一段落，就早点休息吧。');
 const facts=memory.facts.filter(f=>f.at<=now);
 const like=facts.filter(f=>f.kind==='like'&&Array.from(f.value).length<=16&&!/今天|昨天|明天|sk-/.test(f.value)).at(-1);
 if(like)add('memory-like','memory',`记得你说喜欢${like.value}。想听你再讲讲。`);
 if(facts.some(f=>f.kind==='plan'&&f.status==='done'))add('memory-done','memory','你标记完成的那件事，我记着呢。为自己走过的这一步开心一下吧。');
 if(memory.events.some(e=>['feed','drink','wash','play'].includes(e.kind)&&e.at<=now&&now-e.at<7*86400000))add('memory-care','memory','你照顾我的那些小事，我记着呢。也想把一点温暖留给你。');
 const completed=todaysTimers(memory,now);
 const adventure=memory.events.filter(e=>e.kind==='outing-return'&&e.at<=now&&now-e.at<2*86400000).at(-1);
 if(adventure)add('memory-latest-outing','memory',adventure.detail);
 const reading=memory.events.some(e=>e.kind==='self-read-alone'&&e.at<=now&&now-e.at<86400000);
 if(reading)add('memory-own-book','memory','刚才自己翻的那几页书，我还想再琢磨一下。你也按自己的节奏来呀。');
 if(completed.count)add('memory-timer-today','memory',`今天我们一起等完了${completed.count}段计时。我把这${completed.minutes}分钟的小约定记住啦。`);
 const lastUser=memory.messages.filter(m=>m.role==='user'&&m.at<=now&&now-m.at<2*60*MINUTE).at(-1);
 if(companionFeeling(lastUser?.content??'')==='low')add('feeling-tired','feeling','听你说最近不太轻松，不用急着把自己撑好。我陪着你，想说话时就叫我。');
 if(companionFeeling(lastUser?.content??'')==='bright')add('feeling-bright','feeling','你刚才分享的那件开心事，我还记着。咕噜，替你开心。');
 const lastFood=memory.events.filter(e=>e.kind==='feed'&&e.at<=now&&now-e.at<7*86400000).at(-1);
 const sharedFood=lastFood&&ITEMS.find(item=>item.category==='food'&&lastFood.detail===`你用${item.name}照料了我。`);
 if(sharedFood)add('memory-food','memory',`你给我吃过的${sharedFood.name}，我记着呢。下次等肚子饿了再慢慢吃。`);
 if(pet.stats.hunger<30)add('care-food','care','我有一点点饿，等你空下来再照顾我就好。');
 else if(pet.stats.thirst<30)add('care-water','care','我的水分有点少啦，等你方便时给我一点饮品吧。');
 const boundaries=facts.filter(f=>f.kind==='boundary').map(f=>f.value).join(' ');
 return lines.filter(v=>!(/不要.*(?:鸡汤|说教|大道理)/.test(boundaries)&&['progress','culture'].includes(v.topic))&&!(/(?:别|不要).*提醒.*(?:休息|喝水)/.test(boundaries)&&v.topic==='work'));
}
export function choosePresence(pet:GameState,memory:CompanionMemory,journal:PresenceJournal,now=Date.now(),manual=false,reading=false):PresenceLine|null{
 if(pet.sleeping||(!manual&&(wantsQuiet(memory)||companionSnoozeUntil(memory,now)>now)))return null;
 const recent=journal.history.filter(h=>h.at<=now&&now-h.at<3*86400000),last=recent.at(-1);
 const noLecture=memory.facts.some(f=>f.kind==='boundary'&&/不要.*(?:鸡汤|说教|大道理)/.test(f.value));
 const available:PresenceLine[]=reading?[...READING.map((text,i)=>({id:`study-${i}`,topic:'reading' as const,text})),...(!noLecture?CULTURE.map(v=>({id:`study-${v.id}`,topic:'culture' as const,text:v.text.replace('长出叶子','长大')})):[])]:presenceCandidates(pet,memory,now);
 // An invitation shares the existing cadence instead of adding another timer.
 // Leave two ordinary lines first, then at least three ordinary lines between
 // offers. Counting from the last offer still works after the 48-line journal
 // fills; modulo journal length would otherwise freeze invitations forever.
 // Keep a full hour between automatic invitations even at 10-minute pace.
 const lastInvitation=recent.map(h=>h.id.startsWith('invite-')).lastIndexOf(true);
 const ordinarySince=lastInvitation<0?recent.length:recent.length-lastInvitation-1;
 const canInvite=!manual&&!reading&&ordinarySince>=(lastInvitation<0?2:3)&&!recent.some(h=>h.id.startsWith('invite-')&&now-h.at<60*MINUTE);
 const offer=canInvite?createInvitation(pet,memory,Math.floor(now/MINUTE),now):null;
 if(offer)available.push({id:`invite-${offer.kind}`,topic:'life',text:offer.text,invitation:offer});
 const candidates=available.filter(line=>!recent.slice(-(reading?12:16)).some(h=>h.id===line.id)&&(reading||line.topic!==last?.topic)&&!(line.topic==='care'&&recent.some(h=>h.topic==='care'&&now-h.at<3600000)));
 if(!candidates.length)return null;
 const personal=candidates.filter(c=>['memory','feeling'].includes(c.topic));
 const invitations=candidates.filter(c=>c.invitation);
 const choices=invitations.length?invitations:personal.length&&recent.length%4===0?personal:candidates;
 const seed=Math.abs(Math.floor(pet.createdAt/1000)+Math.floor(now/(5*MINUTE))+recent.length*7+memory.personality.length);
 const selected=choices[seed%choices.length];
 const nickname=memory.facts.find(f=>f.kind==='nickname'&&f.at<=now&&Array.from(f.value).length<=8)?.value;
 const address=nickname&&recent.length%3===0&&Array.from(nickname+selected.text).length<36?`${nickname}，`:'';
 return {...selected,text:address+selected.text};
}

export function welcomeLine(pet:GameState,memory:CompanionMemory,now=Date.now()):string {
 const nickname=memory.facts.find(f=>f.kind==='nickname'&&f.at<=now&&Array.from(f.value).length<=8)?.value;
 const address=nickname?`${nickname}，`:'';
 if(pet.sleeping)return `${address}我还在安心打盹，想我时可以轻轻叫醒。`;
 const hour=new Date(now).getHours(),hello=hour>=6&&hour<11?'早上好':hour>=11&&hour<18?'午好':hour>=18&&hour<23?'晚上好':'夜深啦';
 if(pet.stats.health<35)return `${address}${hello}。我有点不舒服，等你方便时照顾我一下吧。`;
 const days=new Set(memory.events.filter(e=>['feed','drink','wash','play','pet','game'].includes(e.kind)&&e.at<=now).map(e=>new Date(e.at).toDateString())).size;
 return `${address}${hello}。${days>=3?'又能和你一起过一个普通的小日子，真好。':'我在这里，陪你慢慢来。'}`;
}
