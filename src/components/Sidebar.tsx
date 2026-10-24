import{Building2,FolderKanban,LayoutDashboard,ListChecks,ListTodo,ScrollText,ShieldCheck,Users,X,type LucideIcon}from'lucide-react';
import{useAuthStore}from'../store/useAuthStore';
import{canAccess,type Page}from'../utils/route';

// Items are shown only when the user holds one of the permissions (internal roles get them; external roles do not).
const items:{page:Page;label:string;icon:LucideIcon}[]=[
  {page:'dashboard',label:'Dashboard',icon:LayoutDashboard},
  {page:'mytasks',label:'My Tasks',icon:ListChecks},
  {page:'alltasks',label:'All Tasks',icon:ListTodo},
  {page:'customers',label:'Customers',icon:Building2},
  {page:'projects',label:'Projects',icon:FolderKanban},
  {page:'users',label:'Users & Access',icon:Users},
  {page:'roles',label:'Roles & Permissions',icon:ShieldCheck},
  {page:'audit',label:'Audit',icon:ScrollText}
];


export default function Sidebar({page,go,open,collapsed,onClose}:{page:Page;go:(p:Page)=>void;open:boolean;collapsed:boolean;onClose:()=>void}){
  const user=useAuthStore(s=>s.user);
  const visible=items.filter(i=>canAccess(user,i.page));
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
