import {expect,it} from 'vitest';
import {discussionLink} from '../../src/server/telegram/proposal-messages';
import {escapeHtml} from '../../src/server/telegram/render';
it('creates ordinary exact-message links without assuming a basic-group permalink or granting access',()=>{
 expect(discussionLink({state:'published',chat_id:'-1000000012345',message_id:'42',topic_id:'9'},null)).toBe('https://t.me/c/12345/9/42');
 expect(discussionLink({state:'unknown',chat_id:'-1000000012345',message_id:'42',topic_id:null},null)).toBeNull();
 expect(discussionLink({state:'published',chat_id:'-12345',message_id:'42',topic_id:null},null)).toBeNull();
 expect(discussionLink({state:'published',chat_id:'-1000000012345',message_id:'42',topic_id:null},'https://t.me/example_group')).toBe('https://t.me/example_group/42');
 expect(escapeHtml('<script>&')).toBe('&lt;script&gt;&amp;');
});
import fixture from '../fixtures/synthetic-options.json';
import {proposalCard} from '../../src/server/telegram/proposal-messages';
import type {ProposalContent} from '../../src/domain/proposals';
it('renders bounded escaped plan cards and exact ordinary website buttons',()=>{
 const content:ProposalContent={schemaVersion:1,guildId:'guild',roundId:'round',mode:'simulation',dataClass:'teaching_only',terms:fixture.terms as ProposalContent['terms'],source:fixture.source,comparisonLamports:'1000000000',allocationLamports:'10000000000',reserveLamports:'1000000000',referenceLamports:'9000000000',minimumLamports:null,incrementLamports:null,capacityLamports:null,quote:null,acceptance:{minimumNetPremiumUsdcMicrosPerSol:'0',maxFees:[{currency:'USDC',units:'0'}]},research:{selection:'synthetic-call',why:'<&'.repeat(750),mainRisk:'<&'.repeat(750),sourceUrl:'https://status.solana.com/',changeOfView:'Opposing evidence'}};
 const card=proposalCard({guild:'&'.repeat(100),round:1,proposalId:'proposal',versionId:'version',version:1,content,replacement:true},'http://127.0.0.1:3000');expect(card.text.length).toBeLessThanOrEqual(3500);expect(card.text).not.toContain('<&');expect(card.text).toContain('Replacement');expect(card.text).toContain('Hypothetical');expect(JSON.stringify(card.buttons)).not.toContain('web_app');expect(JSON.stringify(card.buttons)).toContain('version=version');
});
