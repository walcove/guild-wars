import { pgTable,text,uuid,primaryKey,unique,check,timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { id,createdAt } from './common';
import { users } from './identity';
export const guilds=pgTable('guilds',{id:id(),name:text('name').notNull(),ownerId:uuid('owner_id').notNull().references(()=>users.id),createdAt:createdAt()});
export const memberships=pgTable('memberships',{guildId:uuid('guild_id').notNull().references(()=>guilds.id),userId:uuid('user_id').notNull().references(()=>users.id),role:text('role').notNull(),status:text('status').notNull(),createdAt:createdAt()},t=>[primaryKey({columns:[t.guildId,t.userId]}),check('membership_role',sql`${t.role} in ('member','captain','administrator')`),check('membership_status',sql`${t.status} in ('active','suspended','departed')`)]);
export const groupBindings=pgTable('group_bindings',{id:id(),guildId:uuid('guild_id').notNull().references(()=>guilds.id).unique(),chatId:text('chat_id').notNull().unique(),topicId:text('topic_id'),administratorId:uuid('administrator_id').notNull().references(()=>users.id),method:text('method').notNull(),verifiedAt:timestamp('verified_at',{withTimezone:true,mode:'string'}).notNull(),createdAt:createdAt()},t=>[unique('binding_guild_id').on(t.id,t.guildId)]);
