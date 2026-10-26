import{addDays,format}from'date-fns';
import type{Task}from'../types/task';

export interface ProjectCount{code:string;count:number;tasks:Task[]}
export interface TodayActivity{started:{total:number;byProject:ProjectCount[]};completed:{total:number;byProject:ProjectCount[]}}

const local=(d:Date)=>format(d,'yyyy-MM-dd');

export const groupByProject=(list:Task[])=>{
  const m=new Map<string,Task[]>();
  for(const t of list)m.set(t.project,[...(m.get(t.project)??[]),t]);
  return[...m].map(([code,tasks])=>({code,count:tasks.length,tasks})).sort((a,b)=>b.count-a.count||a.code.localeCompare(b.code));
};

// "Started today" = the task's start date is today. "Completed today" = it was finished today (completion time, in local time).
// Both are grouped per project, biggest first.
export function todayActivity(tasks:Task[],now=new Date()):TodayActivity{
  const today=local(now);
  const group=(list:Task[])=>({total:list.length,byProject:groupByProject(list)});
  return{
    started:group(tasks.filter(t=>t.startDate===today)),
    completed:group(tasks.filter(t=>t.status==='done'&&!!t.completedAt&&local(new Date(t.completedAt))===today))
  };
}

// Open tasks assigned to this user, soonest deadline first.
export const assignedTo=(tasks:Task[],userId:string)=>
  tasks.filter(t=>t.status!=='done'&&(t.assignees??[]).some(a=>a.id===userId)).sort((a,b)=>(a.dueDate??'9999').localeCompare(b.dueDate??'9999'));

// Open tasks whose deadline is today or within the next `days` days (already-late tasks are covered by the overdue alert).
export function deadlinesSoon(tasks:Task[],days=3,now=new Date()){
  const from=local(now),to=local(addDays(now,days));
  return tasks.filter(t=>t.status!=='done'&&!!t.dueDate&&t.dueDate>=from&&t.dueDate<=to).sort((a,b)=>a.dueDate!.localeCompare(b.dueDate!));
}
