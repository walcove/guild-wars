import type {ProviderGate} from './registry';
// Gate 0 evidence and an explicit release decision are both absent. Client/env claims cannot override this record.
export const executionGate:Readonly<ProviderGate>=Object.freeze({gate0Passed:false,releaseApproved:false,providerId:null});
