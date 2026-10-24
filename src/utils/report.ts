import{endOfMonth,endOfWeek,format,startOfMonth,startOfWeek}from'date-fns';
import type{Priority,Status,Task}from'../types/task';

export const statusOrder:Status[]=['todo','in_progress','developing','testing','review','completed','in_review','rework','done'];
export const statusLabel:Record<Status,string>={todo:'New',in_progress:'In Progress',developing:'Developing',testing:'Testing',review:'Review',completed:'Completed',in_review:'Deploying',rework:'Rework',done:'Finished'};
export const priorityLabel:Record<Priority,string>={highest:'Highest',high:'High',medium:'Medium',low:'Low',lowest:'Lowest'};

export type Period='all'|'today'|'week'|'month'|'custom';
export interface ReportFilters{period:Period;from:string;to:string;projects:string[];priority:string[];status:string[];team:'all'|'nyneos'|'bmc'}

const ymd=(d:Date)=>format(d,'yyyy-MM-dd');

// The date range a period stands for ('' = open ended).
export function periodRange(p:Period,now=new Date()):{from:string;to:string}{
  if(p==='today')return{from:ymd(now),to:ymd(now)};
  if(p==='week')return{from:ymd(startOfWeek(now,{weekStartsOn:1})),to:ymd(endOfWeek(now,{weekStartsOn:1}))};
  if(p==='month')return{from:ymd(startOfMonth(now)),to:ymd(endOfMonth(now))};
  return{from:'',to:''};
}

// A task belongs to the period when its working span (start..due) overlaps it, or it was completed inside it.
// With no dates set at all it only appears in an open-ended ("All time") report.
export function inPeriod(t:Task,from:string,to:string):boolean{
  if(!from&&!to)return true;
  const done=t.completedAt?.slice(0,10);
  if(done&&(!from||done>=from)&&(!to||done<=to))return true;
  const s=t.startDate??t.dueDate,e=t.dueDate??t.startDate;
  if(!s||!e)return false;
  return(!to||s<=to)&&(!from||e>=from);
}

export interface ProgressRow{project:string;total:number;byStatus:Record<Status,number>;percent:number;overdue:number}
export interface Report{
  tasks:Task[];
  accomplished:Task[];
  accomplishedBy:'nyneos'|'bmc';
  stageCounts:Record<Status,number>;
  stages:{status:Status;tasks:Task[]}[];
  progress:ProgressRow[];
  total:ProgressRow;
}

const overdue=(t:Task,today:string)=>!!t.dueDate&&t.status!=='done'&&t.dueDate<today;

export function buildReport(all:Task[],f:ReportFilters,projectName:(code:string)=>string,today=ymd(new Date())):Report{
  const tasks=all.filter(t=>
    inPeriod(t,f.from,f.to)&&
    (!f.projects.length||f.projects.includes(t.project))&&
    (!f.priority.length||f.priority.includes(t.priority))&&
    (!f.status.length||f.status.includes(t.status))&&
    (f.team==='all'||t.team===f.team));
  // "Accomplished by NyneOS": completed NyneOS-side work (the customer's side when the report is filtered to it).
  const accomplishedBy=f.team==='bmc'?'bmc':'nyneos';
  const accomplished=tasks.filter(t=>t.status==='done'&&t.team===accomplishedBy)
    .sort((a,b)=>(b.completedAt??'').localeCompare(a.completedAt??''));
  const stageCounts=Object.fromEntries(statusOrder.map(s=>[s,tasks.filter(t=>t.status===s).length])) as Record<Status,number>;
  const stages=statusOrder.filter(s=>s!=='done').map(status=>({status,tasks:tasks.filter(t=>t.status===status).sort((a,b)=>(a.dueDate??'9999').localeCompare(b.dueDate??'9999'))}));
  const row=(label:string,list:Task[]):ProgressRow=>{
    const byStatus=Object.fromEntries(statusOrder.map(s=>[s,list.filter(t=>t.status===s).length])) as Record<Status,number>;
    return{project:label,total:list.length,byStatus,percent:list.length?Math.round(byStatus.done/list.length*100):0,overdue:list.filter(t=>overdue(t,today)).length};
  };
  const codes=[...new Set(tasks.map(t=>t.project))];
  const progress=codes.map(c=>row(projectName(c),tasks.filter(t=>t.project===c))).sort((a,b)=>a.project.localeCompare(b.project));
  return{tasks,accomplished,accomplishedBy,stageCounts,stages,progress,total:row('All projects',tasks)};
}
