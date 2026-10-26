import{format}from'date-fns';
import type{Task}from'../types/task';

export interface ProjectCount{code:string;count:number;tasks:Task[]}
export interface TodayActivity{started:{total:number;byProject:ProjectCount[]};completed:{total:number;byProject:ProjectCount[]}}

const local=(d:Date)=>format(d,'yyyy-MM-dd');

// "Started today" = the task's start date is today. "Completed today" = it was finished today (completion time, in local time).
// Both are grouped per project, biggest first.
export function todayActivity(tasks:Task[],now=new Date()):TodayActivity{
  const today=local(now);
  const group=(list:Task[]):{total:number;byProject:ProjectCount[]}=>{
    const m=new Map<string,Task[]>();
    for(const t of list)m.set(t.project,[...(m.get(t.project)??[]),t]);
    return{total:list.length,byProject:[...m].map(([code,tasks])=>({code,count:tasks.length,tasks})).sort((a,b)=>b.count-a.count||a.code.localeCompare(b.code))};
  };
  return{
    started:group(tasks.filter(t=>t.startDate===today)),
    completed:group(tasks.filter(t=>t.status==='done'&&!!t.completedAt&&local(new Date(t.completedAt))===today))
  };
}
