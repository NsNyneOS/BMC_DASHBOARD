import{useEffect,useMemo,useState}from'react';
import{format}from'date-fns';
import{ChevronLeft,ChevronRight}from'lucide-react';
import type{Task}from'../types/task';

export interface Breakdown{code:string;name:string;color:string;count:number}
// scope 'project': an alert of one project. scope 'global': a ready-made one (today's starts / completions, your tasks, deadlines).
export interface AlertItem{id:string;scope?:'project'|'global';project:string;projectName:string;color:string;meta:string;severity:string;message:string;tasks:Task[];breakdown?:Breakdown[];advice?:string}

export const TONE:Record<string,string>={critical:'bad',warning:'warn',info:'info',success:'ok',milestone:'milestone'};
export const NAME:Record<string,string>={critical:'Critical',warning:'Warning',info:'Info',success:'Done',milestone:'Milestone'};
export const ADVICE:Record<string,string>={
  critical:'Review these tasks first: confirm who owns each one, then re-plan the dates or hand them over.',
  warning:'Check progress with the owners now, before this slips into a critical alert.',
  info:'For your information. No action is needed.'
};
const PAGE=3;

// Four at-a-glance numbers for the alert's tasks.
export function stats(a:AlertItem):{label:string;value:string;warn?:boolean}[]{
  const t=a.tasks,today=format(new Date(),'yyyy-MM-dd');
  const dates=t.map(x=>x.dueDate).filter((d):d is string=>!!d).sort();
  const earliest=dates[0];
  return[
    {label:t.length===1?'Task':'Tasks',value:String(t.length)},
    {label:'Projects',value:String(new Set(t.map(x=>x.project)).size)},
    {label:earliest&&earliest<today?'Oldest deadline':'Next deadline',value:earliest?format(new Date(`${earliest}T12:00:00`),'MMM d'):'None',warn:!!earliest&&earliest<today},
    {label:'Unassigned',value:String(t.filter(x=>!(x.assignees??[]).length).length),warn:t.some(x=>!(x.assignees??[]).length)}
  ];
}

// Alerts as clickable rows (click for the details popup), three per page, with severity filter chips and centred paging.
export default function AlertsCarousel({alerts,onViewTasks}:{alerts:AlertItem[];onViewTasks:(alert:AlertItem,project?:string)=>void}){
  const[filter,setFilter]=useState('all'),[page,setPage]=useState(0);
  const severities=useMemo(()=>['critical','warning','milestone','info','success'].filter(s=>alerts.some(a=>a.severity===s)),[alerts]);
  const list=useMemo(()=>filter==='all'?alerts:alerts.filter(a=>a.severity===filter),[alerts,filter]);
  const key=list.map(a=>a.id).join('|');
  useEffect(()=>{setPage(0)},[filter,key]);
  useEffect(()=>{if(filter!=='all'&&!severities.includes(filter))setFilter('all')},[filter,severities]);
  const pages=Math.max(1,Math.ceil(list.length/PAGE)),at=Math.min(page,pages-1);
  const rows=list.slice(at*PAGE,at*PAGE+PAGE);

  return <section className="card alertPanel" aria-label="Alerts">
    <div className="alertHead">
      <div className="alertHeadText">
        <h2>Alerts</h2>
        <span className="alertCaption">{alerts.length} alert{alerts.length===1?'':'s'}</span>
      </div>
      {alerts.length>0&&<div className="rangeTabs alertChips" role="tablist" aria-label="Filter alerts by severity">
      <button role="tab" aria-selected={filter==='all'} className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>All<b>{alerts.length}</b></button>
      {severities.map(s=><button key={s} role="tab" aria-selected={filter===s} className={filter===s?'active':''} onClick={()=>setFilter(s)}>{NAME[s]}<b>{alerts.filter(a=>a.severity===s).length}</b></button>)}
      </div>}
    </div>
    {rows.length===0?<p className="alertEmpty">No alerts right now. Everything is on track.</p>:<div className="drillList">
      {rows.map(cur=><button type="button" key={cur.id} className={"drillRow alertRow"+(cur.severity==='milestone'?' milestoneAlert':'')} onClick={()=>onViewTasks(cur)} title="Show details">
        <i className="drillDot" style={{background:cur.color}}/>
        <span className="drillMain"><h3>{cur.message}</h3><small>{cur.meta}</small></span>
        <span className="drillSide">
          <span className={'badge '+(TONE[cur.severity]??'neutral')}>{NAME[cur.severity]??cur.severity}</span>
          <span className="drillMeta">{cur.projectName}{cur.tasks.length>0&&` · ${cur.tasks.length} task${cur.tasks.length===1?'':'s'}`}</span>
        </span>
      </button>)}
    </div>}
    {pages>1&&<div className="alertNav">
      <button className="icon small" aria-label="Previous page" onClick={()=>setPage(at-1)} disabled={at===0}><ChevronLeft/></button>
      <span className="alertDots">{Array.from({length:pages},(_,i)=><button key={i} aria-label={`Page ${i+1}`} aria-current={i===at} className={i===at?'on':''} onClick={()=>setPage(i)}>{i+1}</button>)}</span>
      <button className="icon small" aria-label="Next page" onClick={()=>setPage(at+1)} disabled={at===pages-1}><ChevronRight/></button>
    </div>}
  </section>;
}
