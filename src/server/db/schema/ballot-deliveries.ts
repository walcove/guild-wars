import {pgTable,text,uuid,integer,timestamp,primaryKey} from 'drizzle-orm/pg-core';
import {createdAt} from './common';
import {ballots} from './ballots';
import {users} from './identity';
import {operations} from './jobs';
export const botStarts=pgTable('bot_starts',{botId:text('bot_id').notNull(),telegramId:text('telegram_id').notNull(),startedAt:timestamp('started_at',{withTimezone:true,mode:'string'}).notNull().defaultNow(),blockedAt:timestamp('blocked_at',{withTimezone:true,mode:'string'})},t=>[primaryKey({columns:[t.botId,t.telegramId]})]);
export const ballotDeliveries=pgTable('ballot_deliveries',{navigationRef:uuid('navigation_ref').notNull().defaultRandom().unique(),operationId:text('operation_id').primaryKey().references(()=>operations.id),ballotId:uuid('ballot_id').notNull().references(()=>ballots.id),kind:text('kind').notNull(),userId:uuid('user_id').references(()=>users.id),botId:text('bot_id').notNull(),chatId:text('chat_id').notNull(),topicId:text('topic_id'),messageId:text('message_id'),state:text('state').notNull().default('pending'),attempts:integer('attempts').notNull().default(0),lastAttemptAt:timestamp('last_attempt_at',{withTimezone:true,mode:'string'}),createdAt:createdAt()});
