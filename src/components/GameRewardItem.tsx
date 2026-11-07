import {getItem} from '../catalog';
import type {GameReceipt} from './game-receipt';

/** The result view renders the granted item, never guesses from the score. */
export default function GameRewardItem({receipt}:{receipt:GameReceipt|null}){
 const item=getItem(receipt?.itemId);
 const prize=receipt?.prize;
 return <>{(prize||item)&&<img className="raster-game-art" src={prize?.image??item!.image} alt=""/>}<strong>{prize?prize.kind==='item'?'+1':'已解锁':`+${receipt?.food??0}`}</strong><span>{prize?.name??item?.name??'随机奖励'}</span></>;
}
