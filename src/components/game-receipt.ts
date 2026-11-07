/** What actually changed in the save, including full inventory/growth caps. */
import type {GamePrize,RewardRound} from '../economy';
export type GameComplete=(score:number,round?:RewardRound)=>GameReceipt|void;
export interface GameReceipt { ok: boolean; coins: number; growth: number; food: number; itemId?:string; prize?:GamePrize;baseCoins?:number;bonusCoins?:number;message: string }
