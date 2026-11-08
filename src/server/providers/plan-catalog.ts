import {invariant} from '../../domain/errors';
import type {PlanCatalog} from '../services/proposals';
export const unavailablePlanCatalog:PlanCatalog={resolve:async()=>{invariant(false,'provider_unavailable','Verified provider terms are unavailable. Keep your research text; no tradable draft can be prepared yet');}};
