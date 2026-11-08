import {afterAll,beforeAll,expect,it} from 'vitest';
import type {Pool} from 'pg';
import {testPool} from './helpers/database';
import {syntheticGuild} from './helpers/fixtures';
import {researchData} from '../../src/server/services/research-data';
import {addCuratedEvent} from '../../src/server/market/events';
let db:Pool;beforeAll(()=>{db=testPool();});afterAll(async()=>{await db.end();});
it('checks private guild access before returning history/events and never treats unavailable quotes as executable',async()=>{
 const a=await syntheticGuild(db),b=await syntheticGuild(db);await expect(researchData(db,b.userId,a.guildId,a.roundId)).rejects.toMatchObject({code:'forbidden'});
 const source={title:'Synthetic source review',sourceUrl:'https://status.solana.com/',scheduledAt:'2026-11-07T12:00:00.000Z',lastCheckedAt:'2026-11-07T11:00:00.000Z',relevance:'Synthetic test context only',uncertainty:'No event is claimed; fixture only'};
 await addCuratedEvent(db,a.userId,a.guildId,source);
 const view=await researchData(db,a.userId,a.guildId,a.roundId);expect(view.history.status).toBe('unavailable');expect(view.quoteMenu).toMatchObject({status:'unavailable',calls:[]});expect(view.events[0].title).toBe(source.title);
 expect((await researchData(db,b.userId,b.guildId,b.roundId)).events).toHaveLength(0);
 await expect(addCuratedEvent(db,a.userId,a.guildId,{...source,sourceUrl:'javascript:alert(1)'})).rejects.toThrow();
});
