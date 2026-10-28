import {useEffect} from 'react';
import {getStage,type GameState} from './game';
import {STATUS_FIELDS} from './pet-status';

/** Rounded snapshots avoid sending IPC on every fractional simulation tick. */
export function useDesktopPetStatus(pet:GameState|null){
 const snapshot=JSON.stringify(pet?{name:pet.name,stage:getStage(pet.growth,pet.evolution),sleeping:pet.sleeping,
  stats:Object.fromEntries(STATUS_FIELDS.map(([key])=>[key,Math.round(pet.stats[key])])),
  activity:pet.sleeping?undefined:pet.activity?.kind??(pet.outing?'outing':undefined)}:null);
 useEffect(()=>{void window.desktop?.setPetStatus?.(JSON.parse(snapshot)).catch(()=>{});},[snapshot]);
}
