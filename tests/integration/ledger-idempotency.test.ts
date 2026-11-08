import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,it} from 'vitest';
import type {Pool} from 'pg';
import {testPool} from './helpers/database';
import {syntheticGuild} from './helpers/fixtures';
import {appendLedger,readLedger,type LedgerInput} from '../../src/server/services/ledger';
let db:Pool;beforeAll(()=>{db=testPool();});afterAll(async()=>{await db.end();});
const stamp={sourceId:'synthetic',observedAt:'2026-11-07T12:00:00.000Z',receivedAt:'2026-11-07T12:00:01.000Z',synthetic:true};
async function sleeve(){const f=await syntheticGuild(db),id=randomUUID();await db.query("INSERT INTO sleeves(id,guild_id,round_id,season_id,user_id,mode,allocation_lamports,reserve_lamports,verification) VALUES($1,$2,$3,$4,$5,'simulation',1000000000,0,'{}')",[id,f.guildId,f.roundId,f.seasonId,f.userId]);return {...f,sleeveId:id};}
const event=(id:string,kind:LedgerInput['kind'],a:string,c:string,l='0'):LedgerInput=>({id,kind,assetDeltaLamports:a,cashDeltaUsdcMicros:c,liabilityDeltaUsdcMicros:l,observedAt:stamp.observedAt,source:stamp});
it('books a fill and physical assignment once, removing delivered SOL before valuing the proceeds',async()=>{
 const f=await sleeve(),fund=event('fund:'+f.sleeveId,'funding','1000000000','0'),fill=event('fill:'+f.sleeveId,'fill','0','2000000','2000000');
 await appendLedger(db,f.sleeveId,'simulation',[fund]);
 await Promise.all(Array.from({length:8},()=>appendLedger(db,f.sleeveId,'simulation',[fill])));
 const settlement=event('settle:'+f.sleeveId,'settlement','-1000000000','110000000','-2000000');
 await appendLedger(db,f.sleeveId,'simulation',[settlement]);await appendLedger(db,f.sleeveId,'simulation',[settlement]);
 expect(await readLedger(db,f.userId,f.sleeveId)).toMatchObject({assetLamports:'0',cashUsdcMicros:'112000000',liabilityUsdcMicros:'0'});
 expect((await db.query('SELECT count(*)::int n FROM ledger_events WHERE sleeve_id=$1',[f.sleeveId])).rows[0].n).toBe(3);
 await expect(appendLedger(db,f.sleeveId,'simulation',[{...fill,cashDeltaUsdcMicros:'3000000'}])).rejects.toMatchObject({code:'duplicate_changed'});
});
it('requires explicit reversible corrections and blocks cross-owner, cross-mode and cross-sleeve leakage',async()=>{
 const a=await sleeve(),b=await sleeve(),fund=event('fund:'+a.sleeveId,'funding','1000000000','0');await appendLedger(db,a.sleeveId,'simulation',[fund]);
 await expect(readLedger(db,b.userId,a.sleeveId)).rejects.toMatchObject({code:'forbidden'});
 await expect(appendLedger(db,a.sleeveId,'live',[event('bad:'+a.sleeveId,'fee','0','0')])).rejects.toMatchObject({code:'mode_immutable'});
 const reversal={...event('reverse:'+a.sleeveId,'correction','-1000000000','0'),correctsId:fund.id};
 await appendLedger(db,a.sleeveId,'simulation',[reversal,event('replacement:'+a.sleeveId,'funding','900000000','0')]);
 expect(await readLedger(db,a.userId,a.sleeveId)).toMatchObject({assetLamports:'900000000'});
 await expect(appendLedger(db,a.sleeveId,'simulation',[{...reversal,id:'again:'+a.sleeveId}])).rejects.toMatchObject({code:'correction'});
 await expect(appendLedger(db,b.sleeveId,'simulation',[{...reversal,id:'cross:'+a.sleeveId}])).rejects.toMatchObject({code:'correction'});
 await expect(db.query("UPDATE ledger_events SET kind='fee' WHERE sleeve_id=$1",[a.sleeveId])).rejects.toThrow(/append-only/);
});
it('allows the ordinary application role to append through the accounting service',async()=>{
 const f=await sleeve(),url=new URL(process.env.TEST_DATABASE_URL!);url.username='guild_wars_app';url.password='local_app_only';const {Pool:RuntimePool}=await import('pg'),app=new RuntimePool({connectionString:url.toString(),max:1});
 try{await appendLedger(app,f.sleeveId,'simulation',[event('runtime:'+f.sleeveId,'funding','1000000000','0')]);expect(await readLedger(app,f.userId,f.sleeveId)).toMatchObject({assetLamports:'1000000000'});}finally{await app.end();}
});
