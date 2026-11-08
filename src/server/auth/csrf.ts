import {invariant} from '../../domain/errors';
import {matchesHash} from './crypto';
export function assertCsrf(origin:string|null,expectedOrigin:string,token:string|null,storedHash:string):void {
 invariant(origin===expectedOrigin&&token&&matchesHash(token,storedHash),'csrf','This request was not confirmed in the original browser; reload and retry');
}
