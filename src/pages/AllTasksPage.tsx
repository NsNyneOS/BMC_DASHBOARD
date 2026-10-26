import{useEffect,useMemo,useState}from'react';
import{endOfWeek,format,startOfWeek}from'date-fns';
import{ArrowRight}from'lucide-react';
import{api}from'../api/client';
import DataTable,{type Column}from'../components/DataTable';
import Loader from'../components/Loader';
import ModernSelect from'../components/ModernSelect';
import{useTaskStore}from'../store/useTaskStore';
import type{Priority,Status,Task}from'../types/task';
import{Badge,PageHead,useLoad}from'./ui';

const statusLabel:Record<Status,string>={todo:'New',in_progress:'In Progress',developing:'Developing',testing:'Testing',review:'Review',completed:'Completed',in_review:'Deploying',rework:'Rework',done:'Finished'};
const statusTone:Record<Status,'neutral'|'info'|'warn'|'ok'>={todo:'neutral',in_progress:'info',developing:'info',testing:'warn',review:'warn',completed:'ok',in_review:'info',rework:'warn',done:'ok'};
const statusRank:Record<Status,number>={todo:0,in_progress:1,developing:2,testing:3,review:4,completed:5,in_review:6,rework:7,done:8};
const priorityLabel:Record<Priority,string>={highest:'Highest',high:'High',medium:'Medium',low:'Low',lowest:'Lowest'};
const priorityTone:Record<Priority,'bad'|'warn'|'neutral'>={highest:'bad',high:'bad',medium:'warn',low:'neutral',lowest:'neutral'};
const priorityRank:Record<Priority,number>={highest:0,high:1,medium:2,low:3,lowest:4};
const ymd=(d:Date)=>format(d,'yyyy-MM-dd');
const when=(d:string|null)=>d?format(new Date(`${d}T12:00:00`),'MMM d, yyyy'):'—';
const overdue=(t:Task)=>!!t.dueDate&&t.status!=='done'&&t.dueDate<ymd(new Date());
const names=(t:Task)=>(t.assignees??[]).map(a=>a.name);

const dueOptions=[{value:'all',label:'Any due date'},{value:'overdue',label:'Overdue'},{value:'today',label:'Due today'},{value:'week',label:'Due this week'},{value:'none',label:'No due date'}];
const inDue=(t:Task,f:string)=>{
  if(f==='all')return true;
  if(f==='overdue')return overdue(t);
  if(f==='none')return !t.dueDate;
  if(!t.dueDate)return false;
  const now=new Date();
  return f==='today'?t.dueDate===ymd(now):t.dueDate>=ymd(startOfWeek(now,{weekStartsOn:1}))&&t.dueDate<=ymd(endOfWeek(now,{weekStartsOn:1}));
};

// Every task across every customer in one filterable table.
export default function AllTasksPage({onOpen}:{onOpen:(task:Task,customerCode:string|null)=>void}){
  const tasks=useLoad(()=>api.allTasks()),projects=useLoad(()=>api.projects().catch(()=>[])),selected=useTaskStore(s=>s.selectedTask);
  // Refetch after the task panel closes, so edits made there show up in the table.
  useEffect(()=>{if(!selected)tasks.reload()},[selected]);// eslint-disable-line react-hooks/exhaustive-deps
  const[f,setF]=useState({customer:'all',project:'all',status:'all',priority:'all',team:'all',assignee:'all',due:'all',from:'',to:''});
  const set=(k:keyof typeof f)=>(v:string)=>setF(x=>({...x,[k]:v}));
  const meta=useMemo(()=>new Map((projects.data??[]).map(p=>[p.id,p])),[projects.data]);
  const customerOf=(t:Task)=>{const p=meta.get(t.project);return p?(p.customerType==='internal'?'NyneOS':p.customerName):''};
  // Saves made in the task panel update the shared store at once; overlay them so the table changes without waiting for a refetch.
  const live=useTaskStore(s=>s.tasks),all=useMemo(()=>{const m=new Map(live.map(t=>[t.id,t]));return(tasks.data??[]).map(t=>m.get(t.id)??t)},[tasks.data,live]);
  const opts=useMemo(()=>{
    const customers=[...new Set(all.map(customerOf).filter(Boolean))].sort(),
      projs=[...new Map(all.map(t=>[t.project,meta.get(t.project)?.name??t.project])).entries()].sort((a,b)=>a[1].localeCompare(b[1])),
      people=[...new Set(all.flatMap(names))].sort();
    return{
      customer:[{value:'all',label:'All customers'},...customers.map(c=>({value:c,label:c}))],
      project:[{value:'all',label:'All projects'},...projs.map(([v,l])=>({value:v,label:l}))],
      status:[{value:'all',label:'All statuses'},...(Object.keys(statusLabel) as Status[]).map(s=>({value:s,label:statusLabel[s]}))],
      priority:[{value:'all',label:'All priorities'},...(Object.keys(priorityLabel) as Priority[]).map(p=>({value:p,label:priorityLabel[p]}))],
      team:[{value:'all',label:'All teams'},{value:'nyneos',label:'NyneOS'},{value:'bmc',label:'Customer'}],
      assignee:[{value:'all',label:'Anyone'},{value:'none',label:'Unassigned'},...people.map(n=>({value:n,label:n}))]
    };
  },[all,meta]);// eslint-disable-line react-hooks/exhaustive-deps
  const rows=useMemo(()=>all.filter(t=>
    (f.customer==='all'||customerOf(t)===f.customer)&&(f.project==='all'||t.project===f.project)&&(f.status==='all'||t.status===f.status)&&
    (f.priority==='all'||t.priority===f.priority)&&(f.team==='all'||t.team===f.team)&&
    (f.assignee==='all'||(f.assignee==='none'?names(t).length===0:names(t).includes(f.assignee)))&&inDue(t,f.due)&&(!f.from||(!!t.dueDate&&t.dueDate>=f.from))&&(!f.to||(!!t.dueDate&&t.dueDate<=f.to))
  ),[all,f,meta]);// eslint-disable-line react-hooks/exhaustive-deps
  const active=Object.values(f).some(v=>v!=='all'&&v!=='');
  const columns:Column<Task>[]=[
    {key:'key',label:'Task',sort:t=>t.key,csv:t=>`${t.key} ${t.summary}`,cell:t=><><strong>{t.key}</strong> <span>{t.summary}</span></>},
    {key:'customer',label:'Customer',sort:customerOf,csv:customerOf,cell:t=>customerOf(t)||'—'},
    {key:'project',label:'Project',sort:t=>meta.get(t.project)?.name??t.project,csv:t=>meta.get(t.project)?.name??t.project,cell:t=>{const p=meta.get(t.project);return <><span className="dot" style={{background:p?.color??'var(--accent)'}}/> {p?.name??t.project}</>}},
    {key:'status',label:'Status',sort:t=>statusRank[t.status],csv:t=>statusLabel[t.status],cell:t=><Badge tone={statusTone[t.status]}>{statusLabel[t.status]}</Badge>},
    {key:'priority',label:'Priority',sort:t=>priorityRank[t.priority],csv:t=>priorityLabel[t.priority],cell:t=><Badge tone={priorityTone[t.priority]}>{priorityLabel[t.priority]}</Badge>},
    {key:'assignee',label:'Assigned to',sort:t=>names(t).join(', '),csv:t=>names(t).join(', '),cell:t=>names(t).join(', ')||'—'},
    {key:'team',label:'Team',sort:t=>t.team,csv:t=>t.team==='bmc'?'Customer':'NyneOS',cell:t=>t.team==='bmc'?'Customer':'NyneOS'},
    {key:'start',label:'Start',sort:t=>t.startDate??'',csv:t=>t.startDate??'',cell:t=><span className="nowrap">{when(t.startDate)}</span>},
    {key:'due',label:'Due',sort:t=>t.dueDate??'9999',csv:t=>t.dueDate??'',cell:t=><span className={'nowrap'+(overdue(t)?' overdue':'')}>{when(t.dueDate)}</span>},
    {key:'actions',label:'',actions:true,cell:t=>{const p=meta.get(t.project);return <button className="pill wide" onClick={()=>onOpen(t,p&&p.customerType!=='internal'?p.customerCode:null)}>Open <ArrowRight size={14}/></button>}}
  ];
  const sel=(k:keyof typeof f,label:string,options:{value:string;label:string}[])=><div className="filterField"><span>{label}</span><ModernSelect className="tableFilter" ariaLabel={label} value={f[k]} options={options} searchable={options.length>8} onChange={set(k)}/></div>;
  const date=(k:'from'|'to',label:string)=><label className="filterField"><span>{label}</span><input type="date" value={f[k]} onChange={e=>set(k)(e.target.value)} aria-label={label}/></label>;
  return <>
    <PageHead title="All Tasks" action={<span className="muted">{rows.length} of {all.length} tasks{active&&<> · <button className="textButton" onClick={()=>setF({customer:'all',project:'all',status:'all',priority:'all',team:'all',assignee:'all',due:'all',from:'',to:''})}>Clear filters</button></>}</span>}/>
    {tasks.error&&<p className="loginError">{tasks.error}</p>}
    {tasks.loading&&!tasks.data&&<Loader/>}
    {tasks.data&&<DataTable rows={rows} rowKey={t=>t.id} filename="all-tasks" onRefresh={tasks.reload} loading={tasks.loading} empty="No tasks yet." searchText={t=>`${t.key} ${t.summary} ${customerOf(t)} ${meta.get(t.project)?.name??t.project} ${statusLabel[t.status]} ${priorityLabel[t.priority]} ${names(t).join(' ')}`} columns={columns}
      filters={<div className="tableFilters">
        {sel('customer','Customer',opts.customer)}{sel('project','Project',opts.project)}{sel('status','Status',opts.status)}{sel('priority','Priority',opts.priority)}
        {sel('team','Team',opts.team)}{sel('assignee','Assignee',opts.assignee)}{sel('due','Due',dueOptions)}{date('from','Due from')}{date('to','Due to')}
      </div>}/>}
  </>;
}
