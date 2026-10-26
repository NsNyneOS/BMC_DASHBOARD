import{useState}from'react';
import{Clock3}from'lucide-react';
import{format}from'date-fns';
import type{Priority,Status,Task}from'../types/task';
import{priorityLabel}from'../utils/report';

const tone:Record<Priority,string>={highest:'bad',high:'bad',medium:'warn',low:'neutral',lowest:'neutral'};
// A small colour per stage, taken from the theme tokens.
const dot:Record<string,string>={todo:'var(--muted)',in_progress:'var(--info)',developing:'var(--info)',testing:'var(--warning)',review:'var(--warning)',completed:'var(--accent2)',in_review:'var(--accent)',rework:'var(--danger)',done:'var(--success)'};
const today=()=>format(new Date(),'yyyy-MM-dd');

// A project's tasks as cards, grouped by stage. Stages with nothing in them are left out; the chips filter to one stage.
export default function ActivityCards({tasks,statuses,statusName,onOpen}:{tasks:Task[];statuses:Status[];statusName:Record<string,string>;onOpen:(key:string)=>void}){
  const[stage,setStage]=useState<'all'|Status>('all');
  const groups=statuses.map(s=>({status:s,items:tasks.filter(t=>t.status===s).sort((a,b)=>a.order-b.order)})).filter(g=>g.items.length);
  const shown=stage==='all'?groups:groups.filter(g=>g.status===stage);
  const t0=today();
  if(!groups.length)return <p className="actEmpty">No activities in this project yet.</p>;
  return <div className="actWrap">
    <div className="rangeTabs actChips" role="tablist" aria-label="Filter by stage">
      <button role="tab" aria-selected={stage==='all'} className={stage==='all'?'active':''} onClick={()=>setStage('all')}>All<b>{tasks.length}</b></button>
      {groups.map(g=><button key={g.status} role="tab" aria-selected={stage===g.status} className={stage===g.status?'active':''} onClick={()=>setStage(g.status)}>{statusName[g.status]}<b>{g.items.length}</b></button>)}
    </div>
    {shown.map(g=><section className="actGroup" key={g.status}>
      <h3><i style={{background:dot[g.status]}}/>{statusName[g.status]}<span>{g.items.length}</span></h3>
      <div className="actGrid">
        {g.items.map(t=>{
          const late=!!t.dueDate&&t.status!=='done'&&t.dueDate<t0,people=t.assignees??[];
          return <button key={t.id} className="actCard" onClick={()=>onOpen(t.key)}>
            <span className="actTop"><span className="actKey">{t.key}</span><span className={'badge '+tone[t.priority]}>{priorityLabel[t.priority]}</span></span>
            <strong className="actTitle">{t.summary}</strong>
            <span className="actFoot">
              <span className={'actDue'+(late?' overdue':'')}><Clock3 size={14}/>{t.dueDate?format(new Date(`${t.dueDate}T12:00:00`),'MMM d'):'No date'}</span>
              {people.length>0&&<span className="actPeople" title={people.map(p=>p.name).join(', ')}>{people.slice(0,3).map(p=><b key={p.id}>{p.initials}</b>)}{people.length>3&&<em>+{people.length-3}</em>}</span>}
            </span>
          </button>;
        })}
      </div>
    </section>)}
  </div>;
}
