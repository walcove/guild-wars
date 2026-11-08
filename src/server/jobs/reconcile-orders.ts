import type {Pool} from 'pg';
import {invariant} from '../../domain/errors';
import type {TradingMode} from '../../domain/types';
import {tokenHash} from '../auth/crypto';
import {providerReadGate} from '../providers/read-access';
import {importProviderEvents} from '../services/import-provider-events';
import type {ProviderObservation} from '../providers/live/normalization';
export interface ReconciliationReader {readKnownOrder:(request:{mode:TradingMode;providerId:string;externalAccountId:string;externalOrderId:string;readAuthorizationRef:string})=>Promise<{relationshipEvidenceRef:string;observations:ProviderObservation[]}>}
// No selected provider/API is installed. This port is fulfilled only by an approved source adapter.
export const configuredReconciliationReader:ReconciliationReader|null=null;
export async function reconcileKnownOrder(db:Pool,intentId:string,reader:ReconciliationReader|null=configuredReconciliationReader):Promise<void>{
 const row=(await db.query('SELECT i.user_id,i.mode,i.external_order_id,a.provider_id,a.external_account_id,a.read_authorization_ref,a.revoked_at FROM order_intents i JOIN provider_accounts a ON a.id=i.account_id AND a.user_id=i.user_id WHERE i.id=$1',[intentId])).rows[0];invariant(row,'intent_unavailable','Canonical owned order unavailable');
 invariant(reader,'provider_unavailable','Approved provider reconciliation is unavailable; existing Unknown/partial commitments are retained');
 invariant(row.external_order_id&&row.read_authorization_ref&&!row.revoked_at,'read_access_changed','A verified order reference and current read authorization are required; screenshots or hashes alone cannot verify a fill');
 if(row.mode==='live')invariant(providerReadGate.gate0Passed&&providerReadGate.approvedProviderId===row.provider_id,'provider_unavailable','Provider record permissions and owner verification have not passed Gate 0');
 // Read outside locks, then the importer rechecks the exact credential revision and owner inside its transaction.
 const result=await reader.readKnownOrder({mode:row.mode,providerId:row.provider_id,externalAccountId:row.external_account_id,externalOrderId:row.external_order_id,readAuthorizationRef:row.read_authorization_ref});
 if(!result.observations.length)return;
 await importProviderEvents(db,{userId:row.user_id,intentId,credentialHash:tokenHash(row.read_authorization_ref),relationshipEvidenceRef:result.relationshipEvidenceRef},result.observations);
}
