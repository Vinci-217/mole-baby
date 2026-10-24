import {describe,it,expect} from 'vitest'
import {createPet} from './game'
import {createMemory,appendMessage,clearMemory,getCompanionMood} from './companion-memory'
import {moodResponse} from './mood-companion'
import {emotionSpec,emotionDuration,emotionPose} from './mood-motion'
import {idleCandidates} from './idle-behavior'
import {sampleSeedPose,getRamActionDuration,sampleFlyingPose} from './components/ram-animation'
const NOW=Date.UTC(2026,9,24,8)
const p=createPet('团团','red',NOW),memory=createMemory(p)
describe('live mood has its own finite expression',()=>{
  it('distinguishes a pet’s low spirits, tiredness, happiness and real recent concern',()=>{
    const low={...p,stats:{...p.stats,happiness:35}},tired={...p,stats:{...p.stats,energy:30}},bright={...p,stats:{...p.stats,happiness:90}}
    expect(getCompanionMood(memory,low,NOW).id).toBe('downcast');expect(moodResponse(low,memory,NOW).action).toBe('mood-grumpy')
    expect(getCompanionMood(memory,tired,NOW).id).toBe('drowsy');expect(moodResponse(tired,memory,NOW).action).toBe('mood-dozy')
    expect(moodResponse(bright,memory,NOW).action).toBe('mood-joy')
    const concerned=appendMessage(memory,'user','我今天很难过',NOW)
    expect(moodResponse(p,concerned,NOW).action).toBe('mood-content');expect(moodResponse(p,clearMemory(concerned),NOW).line).not.toContain('不想说话')
  })
  it('does not celebrate while tired/downcast or turn another person’s sadness into anger',()=>{
    for(const [stats,expected] of [[{...p.stats,happiness:35},'mood-grumpy'],[{...p.stats,energy:30},'mood-dozy']] as const){const actions=idleCandidates({...p,stats},memory,NOW).map(c=>c.action);expect(actions).toContain(expected);expect(actions).not.toContain('mood-joy');expect(actions).not.toContain('happy')}
    const concerned=appendMessage(memory,'user','压力好大',NOW);expect(idleCandidates(p,concerned,NOW).map(c=>c.action)).not.toContain('mood-grumpy')
  })
  it('samples genuine per-stage source clips at 24fps and omits the junior screaming section',()=>{
    for(const form of ['junior','middle','senior','super','water','wood','fire'])for(const action of ['mood-joy','mood-grumpy']){
      const spec=emotionSpec(form,action==='mood-joy'?'joy':'grumpy')!,duration=emotionDuration(action,form)!
      expect(spec.frameMap.length).toBe(spec.frameCount);expect(duration).toBeGreaterThan(1000);expect(duration).toBeLessThan(5000)
      expect(emotionPose(form,action,0).finished).toBe(false);expect(emotionPose(form,action,duration).finished).toBe(true)
      expect(emotionPose(form,action,0,true).frame).toBe(emotionPose(form,action,1000,true).frame)
      expect(getRamActionDuration(action,form)).toBe(duration)
    }
    expect(Math.max(...emotionSpec('junior','grumpy')!.sourceFrames)).toBeLessThanOrEqual(34)
  })
  it('keeps seed gestures in the fixed pot and completes the airborne quiet expressions',()=>{
    for(const action of ['mood-content','mood-dozy','mood-grumpy','mood-joy']){const duration=emotionDuration(action,'seed')!;expect(sampleSeedPose(action,duration).finished).toBe(true);expect(sampleSeedPose(action,1000,true).frame).toBe(0)}
    for(const form of ['senior','super','water','wood','fire'])for(const action of ['mood-content','mood-dozy'])expect(sampleFlyingPose(action,emotionDuration(action,form)!,false,form).finished).toBe(true)
  })
  it('preserves needs and memories while choosing a mood response and keeps sleep a separate state',()=>{
    const before=JSON.stringify({p,memory});moodResponse(p,memory,NOW);expect(JSON.stringify({p,memory})).toBe(before)
    expect(moodResponse({...p,sleeping:true},memory,NOW).action).toBe('sleep')
    expect(moodResponse({...p,stats:{...p.stats,hunger:10}},memory,NOW).action).toBe('look-around')
  })
})
