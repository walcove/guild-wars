// Explicit scalar allowlist: never serialize exceptions, provider responses or payloads.
export function safeLogRecord(component:string,event:string,fields:Record<string,unknown>={}){
 const record:Record<string,string|number>={component:/^[a-z_-]{1,40}$/.test(component)?component:'application',event:/^[a-z_-]{1,60}$/.test(event)?event:'event'};
 for(const key of ['durationMs','count','lagSeconds'])if(typeof fields[key]==='number'&&Number.isFinite(fields[key]))record[key]=fields[key] as number;
 if(typeof fields.errorCode==='string'&&/^[a-z_]{1,50}$/.test(fields.errorCode))record.errorCode=fields.errorCode;
 return record;
}
export function logEvent(component:string,event:string,fields:Record<string,unknown>={}){console.info(JSON.stringify(safeLogRecord(component,event,fields)));}
