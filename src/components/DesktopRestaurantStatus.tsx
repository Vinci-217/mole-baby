import type {GameState} from '../game';
import ActivityCountdown from './ActivityCountdown';
import './DesktopRestaurantStatus.css';

export default function DesktopRestaurantStatus({pet,onView,onStop}:{pet:GameState;onView:()=>void;onStop:()=>void}){
 return <section className="desktop-work-status" aria-label="餐厅打工状态" data-testid="desktop-work-status">
  <img src="./assets/original/restaurant/dock.png" alt=""/>
  <strong>拉姆去餐厅打工了</strong>
  {pet.activity&&<ActivityCountdown activity={pet.activity}/>}
  <div><button onClick={onView}>进入餐厅</button><button onClick={onStop}>停止打工</button></div>
 </section>;
}
