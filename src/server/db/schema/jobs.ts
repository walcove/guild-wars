import { pgTable,text,uuid,jsonb,integer,timestamp,index } from 'drizzle-orm/pg-core';
import {sql} from 'drizzle-orm';
import { id,createdAt } from './common';
import { proposalVersions } from './proposals';
// Application effects/delivery uncertainty only. Graphile Worker owns scheduling and leases.
export const operations=pgTable('operations',{id:text('id').primaryKey(),kind:text('kind').notNull(),state:text('state').notNull(),record:jsonb('record').notNull(),createdAt:createdAt()},t=>[index('operation_kind_intent').on(t.kind,sql`(${t.record}->>'intentId')`),index('operation_reassessment_position').on(t.kind,sql`(${t.record}->>'positionId')`,t.createdAt)]);
export const telegramDeliveries=pgTable('telegram_deliveries',{id:id(),operationId:text('operation_id').notNull().references(()=>operations.id).unique(),proposalVersionId:uuid('proposal_version_id').notNull().references(()=>proposalVersions.id),chatId:text('chat_id').notNull(),topicId:text('topic_id'),messageId:text('message_id'),state:text('state').notNull(),attempts:integer('attempts').notNull().default(0),lastAttemptAt:timestamp('last_attempt_at',{withTimezone:true,mode:'string'}),replacesId:uuid('replaces_id'),createdAt:createdAt()});
