'use client';
import useSWR from 'swr';
import {BallotReceipt,type ReceiptView} from './ballot-receipt';
import {browserJson,BrowserRequestError} from '../guild-invitation';
export function ReceiptRefresh({userId,initial}:{userId:string;initial:ReceiptView}){const {data,error,mutate}=useSWR<ReceiptView>(['gw-private',userId,initial.guildId,initial.mode,initial.id,'receipt'],()=>browserJson(`/api/ballots/${initial.id}/receipt`),{fallbackData:initial,refreshInterval:10000,refreshWhenHidden:false,refreshWhenOffline:false,shouldRetryOnError:false});const denied=error instanceof BrowserRequestError&&[401,403].includes(error.status);return <>{error&&<div role="alert" className="status-notice error">The receipt could not be refreshed. Retained information may be out of date. <button className="button" onClick={()=>void mutate()}>Retry receipt</button></div>}{!denied&&data&&<BallotReceipt view={data}/>}</>;}
