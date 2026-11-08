import {randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {transaction} from '../../../src/server/db/client';
export async function syntheticGuild(db:Pool) {
 const ids={userId:randomUUID(),guildId:randomUUID(),seasonId:randomUUID(),roundId:randomUUID(),proposalId:randomUUID(),versionId:randomUUID()};
 const telegramId=(BigInt('0x'+ids.userId.replaceAll('-','').slice(0,15))+1n).toString();
 await transaction(db,async tx=>{
  await tx.query('INSERT INTO users(id,telegram_id) VALUES($1,$2)',[ids.userId,telegramId]);
  await tx.query("INSERT INTO guilds(id,name,owner_id) VALUES($1,'Synthetic test guild',$2)",[ids.guildId,ids.userId]);
  await tx.query("INSERT INTO memberships(guild_id,user_id,role,status) VALUES($1,$2,'administrator','active')",[ids.guildId,ids.userId]);
  await tx.query("INSERT INTO seasons(id,guild_id,mode,division,rules_version,rules) VALUES($1,$2,'simulation','synthetic','1','{}')",[ids.seasonId,ids.guildId]);
  await tx.query("INSERT INTO rounds(id,guild_id,season_id,mode,number,state,schedule,expires_at) VALUES($1,$2,$3,'simulation',1,'research','{}',clock_timestamp()+interval '7 days')",[ids.roundId,ids.guildId,ids.seasonId]);
  await tx.query("INSERT INTO proposals(id,guild_id,round_id,author_id,draft) VALUES($1,$2,$3,$4,'{\"synthetic\":true}')",[ids.proposalId,ids.guildId,ids.roundId,ids.userId]);
  await tx.query("INSERT INTO proposal_versions(id,proposal_id,guild_id,round_id,version,content,content_hash) VALUES($1,$2,$3,$4,1,'{\"synthetic\":true}','synthetic')",[ids.versionId,ids.proposalId,ids.guildId,ids.roundId]);
 });return {...ids,telegramId};
}
