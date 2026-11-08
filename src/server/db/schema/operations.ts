import {pgTable,text,timestamp,jsonb} from 'drizzle-orm/pg-core';
export const workerHealth=pgTable('worker_health',{component:text('component').primaryKey(),observedAt:timestamp('observed_at',{withTimezone:true,mode:'string'}).notNull(),metrics:jsonb('metrics').notNull()});
