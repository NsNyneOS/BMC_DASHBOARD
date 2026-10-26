import{useEffect,useMemo,useState}from'react';
import{endOfWeek,format,startOfWeek}from'date-fns';
import{ArrowRight}from'lucide-react';
import{api}from'../api/client';
import DataTable,{type Column}from'../components/DataTable';
import Loader from'../components/Loader';
import{useTaskStore}from'../store/useTaskStore';
import type{Priority,Status,Task}from'../types/task';
import{Badge,PageHead,useLoad}from'./ui';

const statusLabel:Record<Status,string>={todo:'New',in_progress:'In Progress',developing:'Developing',testing:'Testing',review:'Review',completed:'Completed',in_review:'Deploying',rework:'Rework',done:'Finished'};
const statusTone:Record<Status,'neutral'|'info'|'warn'|'ok'>={todo:'neutral',in_progress:'info',developing:'info',testing:'warn',review:'warn',completed:'ok',in_review:'info',rework:'warn',done:'ok'};
const priorityLabel:Record<Priority,string>={highest:'Highest',high:'High',medium:'Medium',low:'Low',lowest:'Lowest'};
const priorityTone:Record<Priority,'bad'|'warn'|'neutral'>={highest:'bad',high:'bad',medium:'warn',low:'neutral',lowest:'neutral'};
const priorityRank:Record<Priority,number>={highest:0,high:1,medium:2,low:3,lowest:4};
const statusRank:Record<Status,number>={todo:0,in_progress:1,developing:2,testing:3,review:4,completed:5,in_review:6,rework:7,done:8};
const when=(d:string|null)=>d?format(new Date(`${d}T12:00:00`),'MMM d, yyyy'):'—';
const ymd=(d:Date)=>format(d,'yyyy-MM-dd');
const overdue=(t:Task)=>!!t.dueDate&&t.status!=='done'&&t.dueDate<ymd(new Date());

type Range='all'|'today'|'week'|'overdue';
const ranges:{key:Range;label:string;empty:string}[]=[
  {key:'all',label:'All',empty:'No tasks are assigned to you.'},
  {key:'today',label:'Today',empty:'Nothing is due today.'},
  {key:'week',label:'This week',empty:'Nothing is due this week.'},
  {key:'overdue',label:'Overdue',empty:'No overdue tasks.'}
];
// "Today" / "This week" look at the due date, like the dashboard's own range filter.
const inRange=(t:Task,r:Range)=>{
  if(r==='all')return true;
  if(r==='overdue')return overdue(t);
  if(!t.dueDate)return false;
  const now=new Date();
  return r==='today'?t.dueDate===ymd(now):t.dueDate>=ymd(startOfWeek(now,{weekStartsOn:1}))&&t.dueDate<=ymd(endOfWeek(now,{weekStartsOn:1}));
};

// Tasks assigned to the signed-in user, across every customer they work on.
export default function MyTasksPage({onOpen}:{onOpen:(task:Task,customerCode:string|null)=>void}){
  const[view,setView]=useState<'assigned'|'reviewing'>('assigned');
  const assigned=useLoad(()=>api.myTasks('assigned')),reviewing=useLoad(()=>api.myTasks('reviewing')),tasks=view==='assigned'?assigned:reviewing,live=useTaskStore(s=>s.tasks),projects=useLoad(()=>api.projects().catch(()=>[])),selected=useTaskStore(s=>s.selectedTask);
  // Refetch after the task panel closes, so edits made there show up in the table.
  useEffect(()=>{if(!selected){assigned.reload();reviewing.reload()}},[selected]);// eslint-disable-line react-hooks/exhaustive-deps
  const[range,setRange]=useState<Range>('all');
  // Saves made in the task panel update the shared store at once; overlay them so the table changes without a refetch.
  const current=useMemo(()=>{const m=new Map(live.map(t=>[t.id,t]));return(tasks.data??[]).map(t=>m.get(t.id)??t)},[tasks.data,live]);
  const counts=useMemo(()=>Object.fromEntries(ranges.map(r=>[r.key,current.filter(t=>inRange(t,r.key)).length])) as Record<Range,number>,[current]);
  const rows=useMemo(()=>current.filter(t=>inRange(t,range)),[current,range]);
  const meta=useMemo(()=>new Map((projects.data??[]).map(p=>[p.id,p])),[projects.data]);
  const columns:Column<Task>[]=[
    {key:'key',label:'Task',sort:t=>t.summary,csv:t=>`${t.key} ${t.summary}`,cell:t=><strong>{t.summary}</strong>},
    {key:'description',label:'Summary',sort:t=>t.description??'',csv:t=>t.description??'',cell:t=>t.description?<span className="cellClamp" title={t.description}>{t.description}</span>:'—'},
    {key:'project',label:'Project',sort:t=>meta.get(t.project)?.name??t.project,csv:t=>`${meta.get(t.project)?.name??t.project} (${meta.get(t.project)?.customerName??''})`,cell:t=>{const p=meta.get(t.project);return <><span className="dot" style={{background:p?.color??'var(--accent)'}}/> {p?.name??t.project}</>}},
    {key:'status',label:'Status',sort:t=>statusRank[t.status],csv:t=>statusLabel[t.status],cell:t=><Badge tone={statusTone[t.status]}>{statusLabel[t.status]}</Badge>},
    {key:'priority',label:'Priority',sort:t=>priorityRank[t.priority],csv:t=>priorityLabel[t.priority],cell:t=><Badge tone={priorityTone[t.priority]}>{priorityLabel[t.priority]}</Badge>},
    view==='assigned'
      ?{key:'who',label:'Reporting to',sort:t=>t.reportingTo?.name??'',csv:t=>t.reportingTo?.name??'',cell:t=>t.reportingTo?.name??'—'}
      :{key:'who',label:'Assigned to',sort:t=>(t.assignees??[]).map(a=>a.name).join(', '),csv:t=>(t.assignees??[]).map(a=>a.name).join(', '),cell:t=>(t.assignees??[]).map(a=>a.name).join(', ')||'—'},
    {key:'start',label:'Start',sort:t=>t.startDate??'',csv:t=>t.startDate??'',cell:t=><span className="nowrap">{when(t.startDate)}</span>},
    {key:'due',label:'Due',sort:t=>t.dueDate??'9999',csv:t=>t.dueDate??'',cell:t=><span className={'nowrap'+(overdue(t)?' overdue':'')}>{when(t.dueDate)}</span>},
    {key:'actions',label:'',actions:true,cell:t=>{const p=meta.get(t.project);return <button className="pill wide" onClick={()=>onOpen(t,p&&p.customerType!=='internal'?p.customerCode:null)}>Open <ArrowRight size={14}/></button>}}
  ];
  return <>
    <PageHead title="My Tasks" action={<>
      <div className="rangeTabs" role="tablist" aria-label="Which tasks">{([['assigned','Assigned to me',assigned.data?.length],['reviewing','Reviewing',reviewing.data?.length]] as const).map(([k,label,n])=><button key={k} role="tab" aria-selected={view===k} className={view===k?'active':''} onClick={()=>setView(k)}>{label}<b>{n??0}</b></button>)}</div>
      <div className="rangeTabs" role="tablist" aria-label="Filter by due date">{ranges.map(r=><button key={r.key} role="tab" aria-selected={range===r.key} className={range===r.key?'active':''} onClick={()=>setRange(r.key)}>{r.label}<b>{counts[r.key]}</b></button>)}</div>
    </>}/>
    {tasks.error&&<p className="loginError">{tasks.error}</p>}
    {tasks.loading&&!tasks.data&&<Loader/>}
    {tasks.data&&<DataTable rows={rows} rowKey={t=>t.id} filename={`my-tasks-${view}${range==='all'?'':'-'+range}`} onRefresh={tasks.reload} loading={tasks.loading} empty={view==='reviewing'&&range==='all'?'You are not reviewing any tasks.':ranges.find(r=>r.key===range)!.empty} searchText={t=>`${t.key} ${t.summary} ${t.description??''} ${meta.get(t.project)?.name??t.project} ${statusLabel[t.status]} ${priorityLabel[t.priority]}`} columns={columns}/>}
  </>;
}
