import data from '../public/assets/original/daily-frames/index.json'
import type {UploadedSpec} from './uploaded-actions'
const clips=data as Record<string,UploadedSpec>
export const DAILY_FRAME_ACTIONS=['pet','focus','sleep','watch-butterfly','look-around','wake','dizzy']as const
export const dailyFrameSpec=(form:string,action:string)=>clips[`${form}-${action==='read-alone'?'focus':action}`]
