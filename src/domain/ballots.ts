export interface ChoiceCount {choiceId:string;votes:number}
export interface BallotDecision {choiceId:string;reason:'choice_won'|'hold_won'|'no_quorum'|'tie'|'invalid';valid:boolean;quorum:number;total:number}
export function ballotDecision(eligible:number,counts:readonly ChoiceCount[],holdChoiceId:string,allowHoldOnly=false):BallotDecision {
 const validRoster=Number.isSafeInteger(eligible)&&eligible>=0,quorum=validRoster?Math.floor(eligible/2)+1:0;
 const invalid=():BallotDecision=>({choiceId:holdChoiceId,reason:'invalid',valid:false,quorum,total:0});
 if(!validRoster||!Array.isArray(counts)||counts.length<(allowHoldOnly?1:2)||counts.length>3||!holdChoiceId)return invalid();
 if(new Set(counts.map(c=>c.choiceId)).size!==counts.length||!counts.some(c=>c.choiceId===holdChoiceId)||counts.some(c=>!c.choiceId||!Number.isSafeInteger(c.votes)||c.votes<0))return invalid();
 const total=counts.reduce((sum,c)=>sum+c.votes,0);if(!Number.isSafeInteger(total)||total>eligible)return invalid();
 if(eligible===0||total<quorum)return {choiceId:holdChoiceId,reason:'no_quorum',valid:true,quorum,total};
 const highest=Math.max(...counts.map(c=>c.votes)),winners=counts.filter(c=>c.votes===highest);
 if(winners.length!==1)return {choiceId:holdChoiceId,reason:'tie',valid:true,quorum,total};
 return {choiceId:winners[0].choiceId,reason:winners[0].choiceId===holdChoiceId?'hold_won':'choice_won',valid:true,quorum,total};
}
export function decideBallot(eligible:number,counts:readonly ChoiceCount[],holdChoiceId:string):string{return ballotDecision(eligible,counts,holdChoiceId).choiceId;}
