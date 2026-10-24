import type {GameState} from './game'
import {getPetCondition} from './game'
import {getCompanionMood,type CompanionMemory} from './companion-memory'

/** Interpret live needs and retained memories, without assigning a new mood. */
export function moodResponse(pet:GameState,memory:CompanionMemory,now=Date.now()) {
  const condition=getPetCondition(pet),mood=getCompanionMood(memory,pet,now)
  const sequence=memory.events.filter(e=>e.kind==='mood-check'&&e.at<=now).length
  const say=(lines:string[])=>lines[sequence%lines.length]
  if(pet.sleeping)return {action:'sleep',line:'我正睡着呢，醒来再陪你玩。'}
  if(['sick','hungry','thirsty','dirty'].includes(condition.id))return {action:'look-around',line:`我${condition.label}，先照顾好自己，再陪你玩。`}
  if(mood.id==='downcast')return {action:'mood-grumpy',line:say(['有一点点闷，我先鼓鼓脸。你来看我，我已经很高兴啦。','有一点小情绪，我先缓一缓，等会儿再和你玩。','今天想安静一点，不过你来看看我，我知道啦。'])}
  if(mood.id==='drowsy')return {action:'mood-dozy',line:say(['唔，打个小哈欠。我有点困，先慢慢陪着你。','眼皮有一点沉啦。先眯一下，我还陪着你呢。','呼，打个小哈欠，今天也慢慢来。'])}
  if(mood.id==='concerned')return {action:'mood-content',line:say(['我在这里，安安静静陪你。不想说话也没关系。','不用急着好起来，我在这里陪着你。','你先忙你的一小步，我安静待在旁边。'])}
  if(pet.stats.happiness>=80)return {action:'mood-joy',line:say(['嘿嘿，今天心情亮亮的！分一点小小的开心给你。','今天有好多小开心，先攒一颗给你。','我把开心轻轻晃给你看啦。'])}
  return {action:'mood-content',line:say(['这样待在你旁边，就很安心。你忙你的，我陪着你。','嗯，我在呢。想起我时，看看我就好。','不急，我们一起慢慢来。'])}
}
