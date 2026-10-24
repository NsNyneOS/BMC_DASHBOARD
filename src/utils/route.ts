import{useCallback,useEffect,useState}from'react';
import type{AuthUser}from'../api/client';

export type Page='dashboard'|'mytasks'|'alltasks'|'customers'|'projects'|'users'|'roles'|'audit';

// One table decides who may open what. The sidebar, the route guard and the tests all read it.
//   any:      the user needs at least one of these permissions
//   external: customer (external) users may open it regardless of permissions
export const routes:Record<Page,{any:string[];external:boolean}>={
  dashboard:{any:['dashboard.view'],external:true},
  mytasks:{any:['mytasks.view'],external:false},
  alltasks:{any:['alltasks.view'],external:false},
  customers:{any:['customer.view'],external:false},
  projects:{any:['project.manage'],external:false},
  users:{any:['user.view'],external:false},
  roles:{any:['role.manage','user.view'],external:false},
  audit:{any:['audit.view'],external:false}
};
export const pages=Object.keys(routes) as Page[];

export const canAccess=(user:AuthUser|null,page:Page)=>{
  if(!user)return false;
  const r=routes[page];
  if(user.userType==='external')return r.external;
  return r.any.some(p=>user.permissions.includes(p));
};

// What the address bar asks for. An empty hash ("/" or "#/") is the dashboard; a known page is that page; anything else
// (an unknown hash, or a path other than the app's root) is "not found".
const readRoute=():{page:Page;notFound:boolean}=>{
  const base=import.meta.env.BASE_URL||'/';
  const path=location.pathname.startsWith(base)?location.pathname.slice(base.length):location.pathname.replace(/^\//,'');
  const word=location.hash.replace(/^#\/?/,'').split('/')[0];
  if(path!==''&&path!=='index.html')return{page:'dashboard',notFound:true};
  if(word==='')return{page:'dashboard',notFound:false};
  return pages.includes(word as Page)?{page:word as Page,notFound:false}:{page:'dashboard',notFound:true};
};

// Leave a missing page: back to the dashboard at the app's root address.
export const goHome=()=>{history.replaceState(null,'',(import.meta.env.BASE_URL||'/')+'#/dashboard');dispatchEvent(new HashChangeEvent('hashchange'))};

// Tiny hash router: #/customers, #/projects ... notFound is true for an address that matches nothing.
export function usePage():[Page,(page:Page,opts?:{replace?:boolean})=>void,boolean]{
  const[route,setRoute]=useState(readRoute);
  // Child effects run before their parent's, so a child may already have redirected: re-read the address once the listener is in place.
  useEffect(()=>{const on=()=>setRoute(readRoute());addEventListener('hashchange',on);addEventListener('popstate',on);on();return()=>{removeEventListener('hashchange',on);removeEventListener('popstate',on)}},[]);
  const go=useCallback((p:Page,opts?:{replace?:boolean})=>{
    if(opts?.replace){history.replaceState(null,'',(import.meta.env.BASE_URL||'/')+'#/'+p);dispatchEvent(new HashChangeEvent('hashchange'))} // no history entry (Back will not return to a refused page); the event tells every usePage() listener
    else{if(location.pathname!==(import.meta.env.BASE_URL||'/'))history.pushState(null,'',(import.meta.env.BASE_URL||'/')+'#/'+p);else location.hash='/'+p;setRoute(readRoute())}
  },[]);
  return[route.page,go,route.notFound];
}
