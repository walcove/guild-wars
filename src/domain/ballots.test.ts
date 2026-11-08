import {expect,it} from 'vitest';
import {decideBallot,ballotDecision} from './ballots';
const c=(a:number,b:number,h:number)=>[{choiceId:'a',votes:a},{choiceId:'b',votes:b},{choiceId:'hold',votes:h}];
it.each([[5,2,0,0,'hold'],[5,3,0,0,'a'],[4,2,2,0,'hold'],[5,1,1,3,'hold'],[0,0,0,0,'hold'],[3,1,1,0,'hold'],[3,2,0,0,'a']])('uses frozen-roster quorum and unique winner: %j',(n,a,b,h,winner)=>expect(decideBallot(Number(n),c(Number(a),Number(b),Number(h)),'hold')).toBe(winner));
it.each([c(-1,1,1),c(1.5,0,1),c(4,0,0),[{choiceId:'a',votes:2},{choiceId:'a',votes:0},{choiceId:'hold',votes:1}],[{choiceId:'hold',votes:3}]].map(counts=>({counts})))('records invalid counts/candidates as Hold rather than inventing a winner %j',({counts})=>expect(ballotDecision(3,counts,'hold')).toMatchObject({choiceId:'hold',valid:false}));
it('accepts one candidate plus Hold and treats abstention as no vote',()=>{
 expect(ballotDecision(3,[{choiceId:'a',votes:1},{choiceId:'hold',votes:0}],'hold')).toMatchObject({choiceId:'hold',reason:'no_quorum',quorum:2,total:1});
 expect(decideBallot(3,[{choiceId:'a',votes:2},{choiceId:'hold',votes:0}],'hold')).toBe('a');
});
