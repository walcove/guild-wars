'use client';
import {useEffect,useRef} from 'react';
import {createChart,LineSeries,LineStyle,ColorType,type UTCTimestamp} from 'lightweight-charts';
import type {MarketHistory} from '../../server/market/coingecko';
export default function PriceChart({history,strikes,expiresAt}:{history:MarketHistory;strikes:{label:string;usd:number}[];expiresAt:string}) {
 const target=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!target.current)return;const chart=createChart(target.current,{width:target.current.clientWidth,height:280,layout:{background:{type:ColorType.Solid,color:'#111d24'},textColor:'#d8e4ee',attributionLogo:true},grid:{vertLines:{visible:false},horzLines:{color:'#34434c'}},timeScale:{timeVisible:true}}),series=chart.addSeries(LineSeries,{color:'#4adadc',priceFormat:{type:'price',precision:2,minMove:0.01}});
  const unique=new Map(history.points.map(p=>[Math.floor(p.time/1000),p.value]));series.setData([...unique].map(([time,value])=>({time:time as UTCTimestamp,value})));
  for(const strike of strikes)series.createPriceLine({price:strike.usd,color:'#e99f3e',lineStyle:LineStyle.Dashed,title:strike.label});
  chart.timeScale().fitContent();const observer=new ResizeObserver(entries=>{for(const e of entries)if(e.contentRect.width)chart.applyOptions({width:e.contentRect.width});});observer.observe(target.current);return ()=>{observer.disconnect();chart.remove();};
 },[history,strikes]);
 return <><div ref={target} role="img" aria-label="SOL reference history in USD; an accessible source table follows"/><p>Contract expiration: {new Date(expiresAt).toUTCString()}. The history ends at its last observed price; future prices are unknown.</p><p>TradingView Lightweight Charts™ · Copyright (с) 2025 TradingView, Inc. <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView</a></p></>;
}
