import type {Pool} from 'pg';
import {reconcileKnownOrder,type ReconciliationReader,configuredReconciliationReader} from './reconcile-orders';
// Expiration never invokes a claim/withdrawal or fabricates terminal records. Read the same verified relationship.
export async function reconcileKnownPositions(db:Pool,intentId:string,reader:ReconciliationReader|null=configuredReconciliationReader):Promise<void>{await reconcileKnownOrder(db,intentId,reader);}
