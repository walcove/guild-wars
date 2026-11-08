import {pgTable,text,uuid,jsonb,timestamp} from 'drizzle-orm/pg-core';
import {createdAt} from './common';
import {ballots} from './ballots';
export const houseDecisions=pgTable('house_decisions',{ballotId:uuid('ballot_id').primaryKey().references(()=>ballots.id),policyVersion:text('policy_version').notNull(),cutoffAt:timestamp('cutoff_at',{withTimezone:true}).notNull(),precommittedAt:timestamp('precommitted_at',{withTimezone:true}).notNull(),inputHash:text('input_hash').notNull(),input:jsonb('input').notNull(),decision:jsonb('decision').notNull(),inheritedFromBallot:uuid('inherited_from_ballot').references(()=>ballots.id),createdAt:createdAt()});
