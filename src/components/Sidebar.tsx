import{Building2,FolderKanban,LayoutDashboard,ListChecks,ShieldCheck,Users,X,type LucideIcon}from'lucide-react';
import{useAuthStore}from'../store/useAuthStore';
import type{Page}from'../utils/route';

// Items are shown only when the user holds one of the permissions (internal roles get them; external roles do not).
const items:{page:Page;label:string;icon:LucideIcon;any:string[]}[]=[
  {page:'dashboard',label:'Dashboard',icon:LayoutDashboard,any:['dashboard.view']},
  {page:'mytasks',label:'My Tasks',icon:ListChecks,any:['mytasks.view']},
  {page:'customers',label:'Customers',icon:Building2,any:['customer.view']},
  {page:'projects',label:'Projects',icon:FolderKanban,any:['project.manage']},
  {page:'users',label:'Users & Access',icon:Users,any:['user.view']},
  {page:'roles',label:'Roles & Permissions',icon:ShieldCheck,any:['role.manage','user.view']}
];

export const allowedPages=(permissions:string[]):Page[]=>items.filter(i=>i.any.some(p=>permissions.includes(p))).map(i=>i.page);

export default function Sidebar({page,go,open,collapsed,onClose}:{page:Page;go:(p:Page)=>void;open:boolean;collapsed:boolean;onClose:()=>void}){
  const permissions=useAuthStore(s=>s.user?.permissions??[]);
  const visible=items.filter(i=>i.any.some(p=>permissions.includes(p)));
  return <>
    {open&&<button className="sideShade" aria-label="Close menu" onClick={onClose}/>}
    <aside className={'sidebar'+(open?' open':'')+(collapsed?' collapsed':'')} aria-label="Sidebar">
      <div className="sideTop"><strong>Menu</strong><button className="sideClose" onClick={onClose} aria-label="Close menu"><X/></button></div>
      <nav aria-label="Main navigation">{visible.map(({page:p,label,icon:Icon})=><button key={p} className={p===page?'active':''} aria-current={p===page?'page':undefined} aria-label={label} data-tip={label} onClick={()=>{go(p);onClose()}}>
        <Icon size={20}/><span>{label}</span>
      </button>)}</nav>
    </aside>
  </>;
}
