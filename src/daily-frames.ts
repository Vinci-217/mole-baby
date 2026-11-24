import data from '../public/assets/original/daily-frames/index.json'
import type {FrameClipSpec} from './frame-clip-spec'
const clips:Record<string,FrameClipSpec>=data
export const DAILY_FRAME_ACTIONS=['pet','focus','sleep','watch-butterfly','look-around','wake','dizzy']as const
/** Focus and autonomous reading use archived classroom timelines in Ram. */
export const dailyFrameSpec=(form:string,action:string)=>action==='focus'?undefined:clips[`${form}-${action}`]
