import type {ReactNode} from 'react'

/** Only authored resting/walking poses reach this wrapper. Unsupported
 * actions use the normal original renderer, never a simulated costume pose. */
export default function OfficialOutfitMotion({action,tilt,children}:{action:string;tilt:number;children:(pose:string)=>ReactNode}){
 return <span className="ram-artwork" style={{transform:`rotate(${tilt}deg)`}}><span className="ram-elastic-layer"><span className="ram-pose-layer">{children(action)}</span></span></span>
}
