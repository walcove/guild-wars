import {createClient} from '@solana/kit';
import {solanaRpcConnection} from '@solana/kit-plugin-rpc';
// Read-only devnet RPC composition. No browser wallet/signer imports or funded operation.
export function solanaReadClient(){return createClient().use(solanaRpcConnection({rpcUrl:'https://api.devnet.solana.com'}));}
