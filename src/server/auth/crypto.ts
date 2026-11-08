import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
export const opaqueToken=()=>randomBytes(32).toString('base64url');
export const tokenHash=(value:string)=>createHash('sha256').update(value).digest('hex');
export const validToken=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
export function matchesHash(token:string,hash:string):boolean {return validToken(token)&&/^[a-f0-9]{64}$/.test(hash)&&timingSafeEqual(Buffer.from(tokenHash(token),'hex'),Buffer.from(hash,'hex'));}
