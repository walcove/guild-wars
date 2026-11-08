import { pgTable,text,uuid,integer,jsonb,unique,foreignKey } from 'drizzle-orm/pg-core';
import { id,createdAt } from './common';
import { users } from './identity';
import { rounds } from './rounds';
export const proposals=pgTable('proposals',{id:id(),requestId:uuid('request_id').notNull().defaultRandom(),guildId:uuid('guild_id').notNull(),roundId:uuid('round_id').notNull(),authorId:uuid('author_id').notNull().references(()=>users.id),draft:jsonb('draft').notNull(),revision:integer('revision').notNull().default(1),createdAt:createdAt()},t=>[unique('proposal_author_request').on(t.authorId,t.requestId),unique('proposal_tenant').on(t.id,t.guildId,t.roundId),foreignKey({columns:[t.roundId,t.guildId],foreignColumns:[rounds.id,rounds.guildId]})]);
export const proposalVersions=pgTable('proposal_versions',{id:id(),proposalId:uuid('proposal_id').notNull(),guildId:uuid('guild_id').notNull(),roundId:uuid('round_id').notNull(),version:integer('version').notNull(),content:jsonb('content').notNull(),contentHash:text('content_hash').notNull(),createdAt:createdAt()},t=>[unique('version_number').on(t.proposalId,t.version),unique('version_tenant').on(t.id,t.guildId,t.roundId),foreignKey({columns:[t.proposalId,t.guildId,t.roundId],foreignColumns:[proposals.id,proposals.guildId,proposals.roundId]})]);

export const proposalAnnotations=pgTable('proposal_annotations',{id:id(),versionId:uuid('version_id').notNull().references(()=>proposalVersions.id),authorId:uuid('author_id').notNull().references(()=>users.id),text:text('text').notNull(),createdAt:createdAt()});
