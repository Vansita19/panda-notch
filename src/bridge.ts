declare global {interface Window {webkit?:any;__PANDA_SAVED__?:any;__PANDA_CONFIG__?:any;pandaNative?:(type:string,payload?:any)=>void;}}
export const native=!!window.webkit?.messageHandlers?.panda;
export function host(type:string,payload:any={}){window.webkit?.messageHandlers?.panda?.postMessage({type,...payload});}
