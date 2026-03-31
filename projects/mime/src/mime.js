const DB = {html:'text/html',css:'text/css',js:'application/javascript',json:'application/json',xml:'application/xml',txt:'text/plain',csv:'text/csv',md:'text/markdown',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',svg:'image/svg+xml',webp:'image/webp',ico:'image/x-icon',pdf:'application/pdf',zip:'application/zip',gz:'application/gzip',tar:'application/x-tar',mp3:'audio/mpeg',wav:'audio/wav',mp4:'video/mp4',webm:'video/webm',woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf',eot:'application/vnd.ms-fontobject'};
const REVERSE = Object.fromEntries(Object.entries(DB).map(([k,v])=>[v,k]));
export function lookup(path) { const ext = path.split('.').pop().toLowerCase(); return DB[ext] || 'application/octet-stream'; }
export function extension(mime) { return REVERSE[mime] || null; }
export function charset(mime) { return mime.startsWith('text/') || mime === 'application/json' || mime === 'application/javascript' ? 'UTF-8' : null; }
export function isText(mime) { return mime.startsWith('text/') || ['application/json','application/javascript','application/xml'].includes(mime); }
