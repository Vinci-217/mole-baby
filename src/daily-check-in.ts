import { tick } from './game'
import type { CareResult, GameState } from './game'

export interface DailyCheckIn { day: string; claimedAt: number; streak: number; total: number }
export const DAILY_BEANS = 1000
export function localDay(now = Date.now()): string {
  const date = new Date(now)
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
export function normalizeCheckIn(value: unknown, now: number): DailyCheckIn | undefined {
  if (!value || typeof value !== 'object') return
  const p = value as Partial<DailyCheckIn>
  if (typeof p.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.day) || typeof p.claimedAt !== 'number' || !Number.isSafeInteger(p.claimedAt) || p.claimedAt < 0 || p.claimedAt > now+300000) return
  const [year,month,day]=p.day.split('-').map(Number),date=new Date(Date.UTC(year,month-1,day))
  if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return
  if (!Number.isSafeInteger(p.streak) || p.streak! < 1 || p.streak! > 100000 || !Number.isSafeInteger(p.total) || p.total! < p.streak! || p.total! > 100000) return
  return p as DailyCheckIn
}
export function checkedInToday(pet: GameState, now = Date.now()): boolean {
  return Boolean(pet.checkIn && (pet.checkIn.day >= localDay(now) || pet.checkIn.claimedAt > now))
}
/** Local calendar reward. Clock rollback never opens another claim; no missed-day debt. */
export function claimDailyCheckIn(pet: GameState, now = Date.now()): CareResult {
  if (!Number.isSafeInteger(now) || now < pet.lastTick || checkedInToday(pet, now)) return {state:pet,ok:false,message:'今天的 1000 摩尔豆已经收好啦，明天再来。'}
  // Settling time may finish a paid shift. Never overwrite its wage with the
  // stale pre-tick balance, and check the daily reward's capacity afterwards.
  const current = tick(pet,now)
  if (current.coins > 1_000_000_000-DAILY_BEANS) return {state:current,ok:false,message:'豆袋快装满啦，先花掉一些再来领取。'}
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate()-1)
  const streak = current.checkIn?.day === localDay(yesterday.getTime()) ? Math.min(100000,current.checkIn.streak+1) : 1
  const checkIn: DailyCheckIn = {day:localDay(now),claimedAt:now,streak,total:Math.min(100000,(current.checkIn?.total??0)+1)}
  return {state:{...current,coins:current.coins+DAILY_BEANS,checkIn},ok:true,message:'签到啦！1000 摩尔豆装进小豆袋。'}
}
