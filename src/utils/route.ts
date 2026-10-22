import{useCallback,useEffect,useState}from'react';

export type Page='dashboard'|'mytasks'|'customers'|'projects'|'users'|'roles';
const pages:Page[]=['dashboard','mytasks','customers','projects','users','roles'];

const read=():Page=>{const p=location.hash.replace(/^#\/?/,'').split('/')[0] as Page;return pages.includes(p)?p:'dashboard'};

// Tiny hash router: #/customers, #/projects ... (no dependency needed for five pages).
export function usePage():[Page,(page:Page)=>void]{
  const[page,setPage]=useState<Page>(read);
  useEffect(()=>{const on=()=>setPage(read());addEventListener('hashchange',on);return()=>removeEventListener('hashchange',on)},[]);
  const go=useCallback((p:Page)=>{location.hash='/'+p},[]);
  return[page,go];
}
