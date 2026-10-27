// After a new deployment the old hashed files (assets/reportPdf-XXXX.js) no longer exist on the server, so a tab that
// was opened before the deploy fails to load them. Reload once to pick up the new version; if it still fails, say so.
import{FriendlyError}from'../api/client';
const KEY='bmb_chunk_reload';
const tried=()=>{try{return sessionStorage.getItem(KEY)==='1'}catch{return false}};
const mark=(v:boolean)=>{try{v?sessionStorage.setItem(KEY,'1'):sessionStorage.removeItem(KEY)}catch{/* storage unavailable */}};

export async function importFresh<T>(load:()=>Promise<T>):Promise<T>{
  try{const m=await load();mark(false);return m}
  catch{
    if(!tried()){mark(true);location.reload();return new Promise<T>(()=>{})} // page is reloading
    mark(false);
    throw new FriendlyError('A new version of the app was released. Please refresh the page (Ctrl+Shift+R) and try again.');
  }
}

// Vite fires this when a preloaded chunk is missing; reload once for the same reason.
export function reloadOnStaleChunk(){
  addEventListener('vite:preloadError',event=>{
    if(tried())return;
    event.preventDefault();mark(true);location.reload();
  });
}
