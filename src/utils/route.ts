import{useCallback,useEffect,useState}from'react';
import type{AuthUser}from'../api/client';

export type Page='dashboard'|'mytasks'|'customers'|'projects'|'users'|'roles';

// One table decides who may open what. The sidebar, the route guard and the tests all read it.
//   any:      the user needs at least one of these permissions
//   external: customer (external) users may open it regardless of permissions
export const routes:Record<Page,{any:string[];external:boolean}>={
  dashboard:{any:['dashboard.view'],external:true},
  mytasks:{any:['mytasks.view'],external:true},
  customers:{any:['customer.view'],external:false},
  projects:{any:['project.manage'],external:false},
  users:{any:['user.view'],external:false},
  roles:{any:['role.manage','user.view'],external:false}
};
export const pages=Object.keys(routes) as Page[];

export const canAccess=(user:AuthUser|null,page:Page)=>{
  if(!user)return false;
  const r=routes[page];
  if(user.userType==='external')return r.external;
  return r.any.some(p=>user.permissions.includes(p));
};

const parse=():Page|null=>{const p=location.hash.replace(/^#\/?/,'').split('/')[0] as Page;return pages.includes(p)?p:null};

// Tiny hash router: #/customers, #/projects ... An unknown or empty hash is the dashboard.
export function usePage():[Page,(page:Page,opts?:{replace?:boolean})=>void]{
  const[page,setPage]=useState<Page>(()=>parse()??'dashboard');
  // Child effects run before their parent's, so a child may already have redirected: re-read the hash once the listener is in place.
  useEffect(()=>{const on=()=>setPage(parse()??'dashboard');addEventListener('hashchange',on);on();return()=>removeEventListener('hashchange',on)},[]);
  const go=useCallback((p:Page,opts?:{replace?:boolean})=>{
    if(opts?.replace){history.replaceState(null,'','#/'+p);dispatchEvent(new HashChangeEvent('hashchange'))} // no history entry (Back will not return to a refused page); the event tells every usePage() listener
    else location.hash='/'+p;
  },[]);
  return[page,go];
}
