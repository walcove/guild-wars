import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,it} from 'vitest';
import type {Pool} from 'pg';
import {testPool} from './helpers/database';
import {syntheticProposal} from './helpers/proposals';
import {lockHouse,inheritHouse,type StoredHouse} from '../../src/server/services/house';
import type {HouseInput} from '../../src/domain/house';
let db:Pool;beforeAll(()=>{db=testPool();});afterAll(async()=>{await db.end();});
async function prepared(offset=3600000){const f=await syntheticProposal(db),now=(await db.query<{t:Date}>('SELECT clock_timestamp() t')).rows[0].t,id=randomUUID(),opens=new Date(now.getTime()+offset);await db.query("INSERT INTO ballots(id,guild_id,round_id,state,kind,opens_at,closes_at) VALUES($1,$2,$3,'prepared','opening',$4,$5)",[id,f.guildId,f.roundId,opens,new Date(opens.getTime()+43200000)]);const input:HouseInput={policyVersion:'highest-strike-v1',mode:'simulation',providerId:'synthetic',expiresAt:(await db.query<{expires_at:Date}>('SELECT expires_at FROM rounds WHERE id=$1',[f.roundId])).rows[0].expires_at.toISOString(),referenceLamports:'9990000000',cutoff:now.toISOString(),spot:null,usdPerUsdc:null,fxSource:null,limits:null,candidates:[]};return {...f,id,input};}
it('stores a reproducible Hold snapshot before opening and refuses changed or retrospective choices',async()=>{
 const f=await prepared(),saved=await lockHouse(db,f.id,f.input);expect(saved.decision.kind).toBe('hold');expect((await lockHouse(db,f.id,f.input)).inputHash).toBe(saved.inputHash);
 await expect(lockHouse(db,f.id,{...f.input,referenceLamports:'1'})).rejects.toMatchObject({code:'house_locked'});
 await expect(db.query("UPDATE house_decisions SET decision='{}' WHERE ballot_id=$1",[f.id])).rejects.toThrow(/append-only/);
 const late=await prepared(-1);await expect(lockHouse(db,late.id,late.input)).rejects.toMatchObject({code:'house_too_late'});
});
it('inherits the exact earlier precommit on a same-window supersession rather than picking again',async()=>{
 const f=await prepared(),first=await lockHouse(db,f.id,f.input),replacement=randomUUID();await db.query("UPDATE ballots SET state='superseded',superseded_by=$2 WHERE id=$1",[f.id,replacement]);await db.query("INSERT INTO ballots(id,guild_id,round_id,state,kind,opens_at,closes_at,rules) SELECT $2,guild_id,round_id,'prepared',kind,opens_at,closes_at,rules FROM ballots WHERE id=$1",[f.id,replacement]);
 const next:StoredHouse=await inheritHouse(db,f.id,replacement);expect(next.inputHash).toBe(first.inputHash);expect(next.precommittedAt).toEqual(first.precommittedAt);expect(next.inheritedFromBallot).toBe(f.id);
});
