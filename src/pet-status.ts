import type {PetStats} from './game';

export const STATUS_FIELDS: readonly [keyof PetStats,string][] = [
 ['hunger','饱食'],['thirst','水分'],['cleanliness','清洁'],
 ['happiness','心情'],['health','健康'],['energy','精力'],
];
// The simulation and help text share these values so rules cannot drift.
export const NEED_RATES = {
 awake: {hunger:5,thirst:6,happiness:3,cleanliness:3.5,energy:4},
 asleep: {hunger:3,thirst:3,happiness:1,cleanliness:1.5,energy:-22},
} as const;
export const HEALTH_RECOVERY_PER_HOUR = 2;
export const HEALTH_LOSS_PER_HOUR = 6;
