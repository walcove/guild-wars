import {pgTable,uuid,text,jsonb,unique,index} from 'drizzle-orm/pg-core';
import {id,createdAt} from './common';
import {seasons} from './rounds';
export const scoreRevisions=pgTable('score_revisions',{id:id(),seasonId:uuid('season_id').notNull().references(()=>seasons.id),inputHash:text('input_hash').notNull(),record:jsonb('record').notNull(),createdAt:createdAt()},t=>[unique('score_input_revision').on(t.seasonId,t.inputHash),index('score_latest').on(t.seasonId,t.createdAt,t.id)]);
