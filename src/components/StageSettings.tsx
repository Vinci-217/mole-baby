import { EVOLUTIONS, getStage, STAGES } from '../game';
import type { Evolution, GameState, Stage } from '../game';
import Ram from './Ram';

export default function StageSettings({ pet, onChange }: { pet: GameState; onChange: (stage: Stage, evolution?: Evolution) => void }) {
  const stage = getStage(pet.growth, pet.evolution);
  return <section className="stage-settings" aria-label="当前成长阶段">
    <h3>当前成长阶段</h3>
    <p>随时切换，名字、颜色和回忆都会保留。</p>
    <div className="stage-choices" role="group" aria-label="选择当前阶段">
      {STAGES.map((s, i) => <button key={s.name} type="button" aria-label={`切换到${s.name}`} aria-pressed={stage === i} onClick={() => onChange(i as Stage)}>
        <span className="stage-portrait"><Ram color={pet.color} stage={i as Stage} evolution={i === 4 ? pet.evolution ?? 'super' : undefined} action="still"/></span>
        <b>{s.name}</b>
      </button>)}
    </div>
    {stage === 4 && <div className="stage-evolutions" role="group" aria-label="选择神力形态">
      {EVOLUTIONS.map(form => <button key={form.id} type="button" aria-label={`切换为${form.name}`} aria-pressed={pet.evolution === form.id} onClick={() => onChange(4, form.id)}>
        <span className="stage-portrait"><Ram color={pet.color} stage={4} evolution={form.id} action="still"/></span><b>{form.name}</b>
      </button>)}
    </div>}
  </section>;
}
