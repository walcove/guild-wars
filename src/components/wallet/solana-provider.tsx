'use client';
import {createClient} from '@solana/kit';
import {walletWithoutSigner} from '@solana/kit-plugin-wallet';
import {ClientProvider} from '@solana/react';
const client=createClient().use(walletWithoutSigner({chain:'solana:devnet',autoConnect:false,storage:null}));
export type WalletClient=typeof client;
export function SolanaProvider({children}:{children:React.ReactNode}){return <ClientProvider client={client}>{children}</ClientProvider>;}
