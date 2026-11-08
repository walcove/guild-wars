import { pgTable,text,uuid,jsonb } from 'drizzle-orm/pg-core';
import { id,createdAt } from './common';
export const auditEvents=pgTable('audit_events',{id:id(),actorId:uuid('actor_id'),guildId:uuid('guild_id'),kind:text('kind').notNull(),recordId:text('record_id').notNull(),reason:text('reason').notNull(),record:jsonb('record').notNull(),correctsEventId:uuid('corrects_event_id'),createdAt:createdAt()});
