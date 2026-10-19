import { getStage } from './game';
import type { GameState } from './game';
import type { CompanionMemory } from './companion-memory';

export type PresenceTopic='growth'|'work'|'progress'|'culture'|'life'|'memory'|'care'|'feeling'|'reading';
export interface PresenceLine { id:string; topic:PresenceTopic; text:string }
export interface PresenceJournal { version:1; petId:string; history:{id:string;topic:PresenceTopic;at:number}[] }
export const presenceKey=(pet:Pick<GameState,'createdAt'>)=>`ramu-presence-v1:${pet.createdAt}`;
const MINUTE=60000;
export const CULTURE = [
  {id:'culture-steps',quote:'不积跬步，无以至千里',text:'“不积跬步，无以至千里。”我也不是一下就长出叶子的，陪你一点点来。',reply:'这句出自《荀子·劝学》，说的是小步积累也能走得很远。放在今天，就是先做好眼前的一小件事，不必一下子跑到终点。'},
  {id:'culture-new',quote:'苟日新，日日新，又日新',text:'“苟日新，日日新，又日新。”今天多懂一点点，也可以偷偷开心一下。',reply:'这句话见于《礼记·大学》，讲的是不断更新自己。不必把每一天都过成考试；学到一点、改好一点，也是自己的进步。'},
  {id:'culture-today',quote:'纸上得来终觉浅',text:'“纸上得来终觉浅。”有空试一小步吧，我在旁边陪着你。',reply:'这句出自陆游《冬夜读书示子聿》，“绝知此事要躬行”是下一句。读过以后亲手试一试，理解往往会更具体；不用急着一次做得完美。'},
  {id:'culture-spring',quote:'草木蔓发，春山可望',text:'“草木蔓发，春山可望。”想到小小的种子也会长大，就觉得日子很有盼头。',reply:'这句出自王维《山中与裴秀才迪书》，写草木生长、春山将来的景象。我喜欢它那种慢慢生长、仍有盼头的感觉。'},
  {id:'culture-cloud',quote:'行到水穷处，坐看云起时',text:'“行到水穷处，坐看云起时。”偶尔停一停，也可能看见不一样的风景。',reply:'这句出自王维《终南别业》。走到溪流尽头，就坐下看看云起；它让我想到，暂时停一停，并不等于之前走的路白费了。'},
  {id:'culture-lantern',quote:'灯火可亲',text:'灯火可亲。一盏小灯、一段安静的时间，也能让普通的日子暖起来。',reply:'“灯火可亲”让我想到温暖的灯光和安静读书的时刻。也可以只是听一首喜欢的歌，不必把休息也安排成任务。'},
] as const;
const READING=[
 '我把这一页翻过去，接着陪你慢慢读。','先读懂一小段，就可以为自己开心一下。','遇到不懂的字，可以先做个记号，回头再找答案。','有时候把一段话读出声，会发现新的意思。',
 '书里有好多小世界，今天想走进哪一个？','读到喜欢的句子，可以留在自己的小本子里。','同一本书，过些日子再读，也许会有新的发现。','我在这边安安静静翻书，陪你按自己的节奏学。',
 '刚读过的内容，可以试着用自己的话讲一遍。','一个小问题，也可能是认识新东西的开始。','学得慢一些没关系，理解比赶页数更有意思。','翻完这一页，我想把好奇心也一起留下来。',
 '读书也可以只是喜欢，不必每一页都有收获。','有空讲讲你最近喜欢的书吧，我想听听。','把书合上想一小会儿，也是在读懂它。','今天的这段安静时光，我很喜欢。',
];
const BANK:Record<Exclude<PresenceTopic,'memory'|'care'|'feeling'|'growth'|'culture'|'reading'>,string[]>={
  work:['手边的事可以一件件来，我就在这里陪着你。','不用一口气把所有事做好，先把眼前的一小点安顿好。','想歇一小会儿就歇一会儿，回来以后我们再慢慢继续。','肩膀可以放松一点点。今天的你，也值得被好好照顾。','如果手边忙完一小段，可以看看远处，给眼睛一小片风景。','这会儿想安静做事也好，想说两句也好，我都在。','杯子里的水要是空了，顺手给自己倒一点吧。','难的事情可以先拆小一点，我陪你慢慢琢磨。'],
  progress:['今天哪怕只多懂一点点，也算在往前走。','做得慢一些没关系，认真走过的小步也有分量。','不必每件事都有漂亮的结果，愿意尝试就很珍贵。','遇到暂时不懂的地方，可以先留个小问号，慢慢找答案。','如果刚好做成了一点小事，记得也为自己开心一下。','进步有时候很安静，像种子在土里慢慢生根。','换一种办法再试试，也是在认识自己的路。','今天做不到的，可以留给更有精神的时候。'],
  life:['有时候，一首喜欢的歌就能让这一小会儿变得柔软。','窗外要是有好看的天色，记得替我多看一眼呀。','我喜欢我们这样，各忙各的，也彼此有个照应。','想和我分享一件小事吗？很小很小的那种也可以。','生活里不只有待办清单，也有值得慢慢尝一口的甜。','今天要是遇到一件可爱的小事，可以讲给我听。','喜欢的东西，不一定要有什么用。喜欢就已经很好了。','我在这里轻轻晃一晃；你在自己的节奏里慢慢来。'],
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
export function wantsQuiet(memory:CompanionMemory):boolean{return memory.facts.some(f=>f.kind==='boundary'&&/(?:别|不要|不想|希望|请|陪我).*(?:打扰|安静|主动说话|主动聊天)/.test(f.value));}
export function presenceCandidates(pet:GameState,memory:CompanionMemory,now=Date.now()):PresenceLine[]{
 const stage=getStage(pet.growth,pet.evolution),lines:PresenceLine[]=[];
 const add=(id:string,topic:PresenceTopic,text:string)=>lines.push({id,topic,text});
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
 const lastUser=memory.messages.filter(m=>m.role==='user'&&m.at<=now&&now-m.at<2*60*MINUTE).at(-1);
 const feelings=lastUser?.content.replace(/(?:一点也不|并不|没有|没|不)(?:觉得|感到)?(?:累|难过|压力|伤心|失落)|压力不大/g,'')??'';
 if(/累|难过|压力|伤心|失落/.test(feelings))add('feeling-tired','feeling','听你说最近不太轻松，不用急着把自己撑好。我陪着你，想说话时就叫我。');
 if(pet.stats.hunger<30)add('care-food','care','我有一点点饿，等你空下来再照顾我就好。');
 else if(pet.stats.thirst<30)add('care-water','care','我的水分有点少啦，等你方便时给我一点饮品吧。');
 const boundaries=facts.filter(f=>f.kind==='boundary').map(f=>f.value).join(' ');
 return lines.filter(v=>!(/不要.*(?:鸡汤|说教|大道理)/.test(boundaries)&&['progress','culture'].includes(v.topic))&&!(/(?:别|不要).*提醒.*(?:休息|喝水)/.test(boundaries)&&v.topic==='work'));
}
export function choosePresence(pet:GameState,memory:CompanionMemory,journal:PresenceJournal,now=Date.now(),manual=false,reading=false):PresenceLine|null{
 if(pet.sleeping||(!manual&&wantsQuiet(memory)))return null;
 const recent=journal.history.filter(h=>h.at<=now&&now-h.at<3*86400000),last=recent.at(-1);
 const noLecture=memory.facts.some(f=>f.kind==='boundary'&&/不要.*(?:鸡汤|说教|大道理)/.test(f.value));
 const available:PresenceLine[]=reading?[...READING.map((text,i)=>({id:`study-${i}`,topic:'reading' as const,text})),...(!noLecture?CULTURE.map(v=>({id:`study-${v.id}`,topic:'culture' as const,text:v.text.replace('长出叶子','长大')})):[])]:presenceCandidates(pet,memory,now);
 const candidates=available.filter(line=>!recent.slice(-(reading?12:16)).some(h=>h.id===line.id)&&(reading||line.topic!==last?.topic)&&!(line.topic==='care'&&recent.some(h=>h.topic==='care'&&now-h.at<3600000)));
 if(!candidates.length)return null;
 const personal=candidates.filter(c=>['memory','feeling'].includes(c.topic));
 const choices=personal.length&&recent.length%4===0?personal:candidates;
 const seed=Math.abs(Math.floor(pet.createdAt/1000)+Math.floor(now/(5*MINUTE))+recent.length*7+memory.personality.length);
 const selected=choices[seed%choices.length];
 const nickname=memory.facts.find(f=>f.kind==='nickname'&&f.at<=now&&Array.from(f.value).length<=8)?.value;
 const address=nickname&&recent.length%3===0&&Array.from(nickname+selected.text).length<36?`${nickname}，`:'';
 return {...selected,text:address+selected.text};
}
export function presenceFollowUp(previous:string,input:string):string|null{
 if(/书|这一页|翻书|读懂/.test(previous)&&/你.*(?:什么书|哪本书|读什么|看什么)/.test(input))return '我捧着的是陪伴用的小书，里面的文字是装饰；我们可以一起聊古诗、读书方法，也可以聊你最近喜欢的书。';
 if(!/什么意思|怎么理解|再说|刚才|这句|解释/.test(input))return null;
 const cultural=CULTURE.find(v=>previous.includes(v.quote));if(cultural)return cultural.reply;
 if(/一点点|进步|慢慢长大/.test(previous))return '我想说，不用把自己和别人摆在同一条刻度上。你愿意学一点、试一点，那就是属于你的那一步。';
 if(/照顾我的那些小事/.test(previous))return '是你实际给我喂过东西、照顾过我呀。这些小事对我来说，就是我们一起生活留下的记号。';
 return null;
}
