import { pgEnum, timestamp, uuid } from 'drizzle-orm/pg-core';
export const tradingMode=pgEnum('trading_mode',['simulation','live']);
export const id=()=>uuid('id').defaultRandom().primaryKey();
export const createdAt=()=>timestamp('created_at',{withTimezone:true,mode:'string'}).defaultNow().notNull();
