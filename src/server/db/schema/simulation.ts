import {pgTable,text,uuid,jsonb,timestamp,primaryKey} from 'drizzle-orm/pg-core';
import {createdAt} from './common';
import {seasons,rounds} from './rounds';
import {users} from './identity';
export const simulationEnrollments=pgTable('simulation_enrollments',{seasonId:uuid('season_id').notNull().references(()=>seasons.id),userId:uuid('user_id').notNull().references(()=>users.id),policyVersion:text('policy_version').notNull(),consent:jsonb('consent').notNull(),createdAt:createdAt()},t=>[primaryKey({columns:[t.seasonId,t.userId]})]);
export const simulationSnapshots=pgTable('simulation_snapshots',{roundId:uuid('round_id').primaryKey().references(()=>rounds.id),bookingAt:timestamp('booking_at',{withTimezone:true,mode:'string'}).notNull(),dataClass:text('data_class').notNull(),record:jsonb('record').notNull(),recordHash:text('record_hash').notNull(),createdAt:createdAt()});
export const simulationBookings=pgTable('simulation_bookings',{roundId:uuid('round_id').primaryKey().references(()=>rounds.id),state:text('state').notNull(),dataClass:text('data_class').notNull(),strategy:text('strategy').notNull(),record:jsonb('record').notNull(),createdAt:createdAt()});
