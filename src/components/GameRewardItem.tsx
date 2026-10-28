import {getItem} from '../catalog';
import type {GameReceipt} from './game-receipt';

/** The result view renders the granted item, never guesses from the score. */
export default function GameRewardItem({receipt}:{receipt:GameReceipt|null}){
 const item=getItem(receipt?.itemId);
 return <>{item&&<img className="raster-game-art" src={item.image} alt=""/>}<strong>+{receipt?.food??0}</strong><span>{item?.name??'随机用品'}</span></>;
}
