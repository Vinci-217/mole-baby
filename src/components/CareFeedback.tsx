import type {CareFeedbackData} from '../care-feedback'
import './CareFeedback.css'
export default function CareFeedback({feedback}:{feedback:CareFeedbackData|null}) {
  if(!feedback||!feedback.gains.length)return null
  return <span key={feedback.id} className="care-gain" role="status" aria-live="polite" data-testid="care-gain">
    {feedback.gains.map(gain=><span key={gain.key} data-care-stat={gain.key}><img src={gain.image} alt=""/><span>{gain.label}{gain.amount!==undefined&&<b> +{gain.amount}</b>}</span></span>)}
  </span>
}
