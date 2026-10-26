import{useMemo,useState}from'react';
import{CheckCircle2,PlayCircle}from'lucide-react';
import{FormModal}from'../pages/ui';
import type{Task}from'../types/task';
import{statusLabel}from'../utils/report';
import{projectColor,projectName}from'../utils/projects';
import{todayActivity,type TodayActivity as Data}from'../utils/today';

type Kind='started'|'completed';
const copy:Record<Kind,{title:string;empty:string;icon:typeof PlayCircle}>={
  started:{title:'Started today',empty:'No task starts today.',icon:PlayCircle},
  completed:{title:'Completed today',empty:'Nothing has been completed today yet.',icon:CheckCircle2}
};

// Two cards above the project summary: what started today and what was finished today, with a per-project split.
// Click a card for the task list behind the numbers.
export default function TodayActivity({tasks,onOpen}:{tasks:Task[];onOpen:(task:Task)=>void}){
  const data=useMemo(()=>todayActivity(tasks),[tasks]),[open,setOpen]=useState<Kind|null>(null);
  return <>
    <section className="todayGrid" aria-label="Today's activity">
      {(['started','completed'] as Kind[]).map(k=>{
        const d=data[k],Icon=copy[k].icon,max=Math.max(1,...d.byProject.map(p=>p.count));
        return <button key={k} className={'card todayCard '+k} onClick={()=>setOpen(k)} aria-label={`${copy[k].title}: ${d.total}. Show tasks`}>
          <div className="todayHead"><span className="todayIcon"><Icon size={20}/></span><span className="todayTitle">{copy[k].title}</span><strong className="todayTotal">{d.total}</strong></div>
          {d.total===0?<p className="todayEmpty">{copy[k].empty}</p>:<ul className="todayRows">{d.byProject.map(p=><li key={p.code}>
            <span className="todayName"><i style={{background:projectColor(p.code)}}/>{projectName(p.code)}</span>
            <span className="todayBar"><i style={{width:`${p.count/max*100}%`,background:projectColor(p.code)}}/></span>
            <b>{p.count}</b>
          </li>)}</ul>}
        </button>;
      })}
    </section>
    {open&&<DetailModal kind={open} data={data} onClose={()=>setOpen(null)} onOpen={t=>{setOpen(null);onOpen(t)}}/>}
  </>;
}

function DetailModal({kind,data,onClose,onOpen}:{kind:Kind;data:Data;onClose:()=>void;onOpen:(t:Task)=>void}){
  const d=data[kind];
  return <FormModal className="todayModal" title={`${copy[kind].title} · ${d.total}`} submitLabel="Close" hideCancel onClose={onClose} onSubmit={onClose}>
    <div className="full todayDetail">
      {d.total===0&&<p className="todayEmpty">{copy[kind].empty}</p>}
      {d.byProject.map(p=><section key={p.code}>
        <h3><i style={{background:projectColor(p.code)}}/>{projectName(p.code)} <span>{p.count}</span></h3>
        <ul>{p.tasks.map(t=><li key={t.id}><button type="button" onClick={()=>onOpen(t)}>
          <strong>{t.key}</strong><span>{t.summary}</span><small>{(t.assignees??[]).map(a=>a.name).join(', ')||'Unassigned'} · {statusLabel[t.status]}</small>
        </button></li>)}</ul>
      </section>)}
    </div>
  </FormModal>;
}
