import{useEffect,useMemo,useState}from'react';
import{format}from'date-fns';
import{ChevronLeft,ChevronRight}from'lucide-react';
import{api}from'../api/client';
import{useLoad}from'../pages/ui';
import{useTaskStore}from'../store/useTaskStore';
import type{Priority,Task}from'../types/task';
import{projectColor,projectName}from'../utils/projects';
import{priorityLabel,statusLabel}from'../utils/report';
import Loader from'./Loader';

type Tab='all'|'today'|'pending'|'overdue';
const PAGE=4;
const ymd=(d:Date)=>format(d,'yyyy-MM-dd');
const priorityTone:Record<Priority,string>={highest:'bad',high:'bad',medium:'warn',low:'neutral',lowest:'neutral'};

// Rules: Today = due today (and not completed); Pending = not completed and not yet late; Overdue = past due and not completed.
const matches=(t:Task,tab:Tab,today:string)=>{
  if(tab==='all')return true;
  if(t.status==='done')return false;
  const late=!!t.dueDate&&t.dueDate<today;
  return tab==='today'?t.dueDate===today:tab==='overdue'?late:!late;
};
const tabs:{key:Tab;label:string;empty:string}[]=[
  {key:'all',label:'All',empty:'No tasks are assigned to you.'},
  {key:'today',label:'Today',empty:'Nothing is due today.'},
  {key:'pending',label:'Pending',empty:'No pending tasks. Nice work!'},
  {key:'overdue',label:'Overdue',empty:'No overdue tasks.'}
];

// The signed-in user's own tasks (assigned to them), on the dashboard.
export default function MyTasksCard({onOpen}:{onOpen:(task:Task)=>void}){
  const mine=useLoad(()=>api.myTasks('assigned')),selected=useTaskStore(s=>s.selectedTask),[tab,setTab]=useState<Tab>('all'),[page,setPage]=useState(0);
  // Refetch after the task panel closes so edits made there show up here.
  useEffect(()=>{if(!selected)mine.reload()},[selected]);// eslint-disable-line react-hooks/exhaustive-deps
  const today=ymd(new Date());
  const counts=useMemo(()=>Object.fromEntries(tabs.map(t=>[t.key,(mine.data??[]).filter(x=>matches(x,t.key,today)).length])) as Record<Tab,number>,[mine.data,today]);
  const list=useMemo(()=>(mine.data??[]).filter(t=>matches(t,tab,today)).sort((a,b)=>(a.dueDate??'9999').localeCompare(b.dueDate??'9999')),[mine.data,tab,today]);
  const pages=Math.max(1,Math.ceil(list.length/PAGE)),current=Math.min(page,pages-1),visible=list.slice(current*PAGE,(current+1)*PAGE);
  return <section className="card myTasksCard">
    <div className="cardHead">
      <h2>My Tasks</h2>
      <div className="rangeTabs inHead" role="tablist" aria-label="My tasks filter">
    {tabs.map(t=><button key={t.key} role="tab" aria-selected={tab===t.key} className={tab===t.key?'active':''} onClick={()=>{setTab(t.key);setPage(0)}}>{t.label}<b>{counts[t.key]}</b></button>)}
  </div>
    </div>
    {mine.error&&<p className="loginError">{mine.error}</p>}
    {mine.loading&&!mine.data?<Loader/>:<ul className="mtList">
      {visible.map(t=><li key={t.id}><button className="mtRow" onClick={()=>onOpen(t)}>
        <span className="mtDot" style={{background:projectColor(t.project)}}/>
        <span className="mtMain"><strong>{t.summary}</strong><small>{t.description||'No description'}</small></span>
        <span className="mtMeta"><span className="mtProject">{t.key} · {projectName(t.project)} · {statusLabel[t.status]}</span><span className={'badge '+priorityTone[t.priority]}>{priorityLabel[t.priority]}</span><em className={t.dueDate&&t.dueDate<today?'overdue':''}>{t.dueDate?format(new Date(`${t.dueDate}T12:00:00`),'MMM d'):'No date'}</em></span>
      </button></li>)}
      {list.length===0&&<li className="mtEmpty">{tabs.find(x=>x.key===tab)!.empty}</li>}
    </ul>}
    {list.length>PAGE&&<div className="pageNav mtPager">
      <button className="pageBtn" disabled={current===0} onClick={()=>setPage(current-1)}><ChevronLeft size={15}/> Previous</button>
      <span>Page <b>{current+1}</b> of <b>{pages}</b></span>
      <button className="pageBtn" disabled={current>=pages-1} onClick={()=>setPage(current+1)}>Next <ChevronRight size={15}/></button>
    </div>}
  </section>;
}
