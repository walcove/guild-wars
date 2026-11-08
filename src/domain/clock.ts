export interface Clock { now(): Date }
export const systemClock: Clock = { now: () => new Date() };
export function fixedClock(instant: string): Clock { return { now: () => new Date(instant) }; }
