export function normalizePinURL(value){
 const raw=String(value).trim();if(!raw||/[\x00-\x1f]/.test(raw))throw Error('Enter a link or an absolute file path.');
 const path=raw.startsWith('/')&&!raw.startsWith('//');
 if(!path&&!raw.startsWith('file:')&&/\s/.test(raw))throw Error('Enter a valid link.');
 const u=new URL(path?'file://'+raw:/^[a-z][a-z0-9+.-]*:/i.test(raw)?raw:'https://'+raw);
 if(u.username||u.password)throw Error('Links with embedded passwords are not supported.');
 if(u.protocol==='file:'){if(u.hostname&&u.hostname!=='localhost')throw Error('Use a local file on this Mac.');if(!u.pathname||u.pathname==='/')throw Error('Include the file path.');}
 else if(!['https:','http:'].includes(u.protocol)||!u.hostname)throw Error('Use an http, https, or file link.');
 return u.href;
}
