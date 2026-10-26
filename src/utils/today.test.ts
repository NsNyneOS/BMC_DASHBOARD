import{describe,expect,it}from'vitest';
import type{Task}from'../types/task';
import{todayActivity}from'./today';

const mk=(o:Partial<Task>):Task=>({id:o.key??'x',key:'A-1',project:'A',type:'task',summary:'s',description:'',status:'todo',priority:'medium',order:0,assignee:null,reporter:'',startDate:null,dueDate:null,estimate:null,storyPoints:null,sprint:'',labels:[],components:[],fixVersion:'',parentKey:null,dependsOn:[],customDependencies:[],links:[],attachments:[],clientVisible:true,team:'nyneos',createdAt:'',updatedAt:'',completedAt:null,...o});
const now=new Date(2026,9,26,15,0,0); // Mon 26 Oct 2026, 3pm local

describe('todayActivity',()=>{
  const tasks=[
    mk({key:'A-1',project:'A',startDate:'2026-10-26'}),
    mk({key:'A-2',project:'A',startDate:'2026-10-26'}),
    mk({key:'B-1',project:'B',startDate:'2026-10-26'}),
    mk({key:'B-2',project:'B',startDate:'2026-10-25'}),
    mk({key:'A-3',project:'A',status:'done',completedAt:new Date(2026,9,26,9,30).toISOString()}),
    mk({key:'B-3',project:'B',status:'done',completedAt:new Date(2026,9,25,23,59).toISOString()}),
    mk({key:'B-4',project:'B',status:'review',completedAt:new Date(2026,9,26,9,0).toISOString()}),
  ];
  const r=todayActivity(tasks,now);
  it('counts tasks that start today, per project, biggest first',()=>{
    expect(r.started.total).toBe(3);
    expect(r.started.byProject.map(p=>[p.code,p.count])).toEqual([['A',2],['B',1]]);
  });
  it('counts only finished tasks completed today (local time)',()=>{
    expect(r.completed.total).toBe(1);
    expect(r.completed.byProject.map(p=>[p.code,p.tasks.map(t=>t.key)])).toEqual([['A',['A-3']]]);
  });
  it('is empty on a quiet day',()=>{
    const q=todayActivity(tasks,new Date(2026,9,1));
    expect(q.started.total+q.completed.total).toBe(0);expect(q.started.byProject).toEqual([]);
  });
});

import{assignedTo,deadlinesSoon}from'./today';
describe('assignedTo / deadlinesSoon',()=>{
  const me={id:'u1',name:'Me',initials:'M',userType:'internal' as const};
  const list=[
    mk({key:'A-1',assignees:[me],dueDate:'2026-10-30'}),
    mk({key:'A-2',assignees:[me],dueDate:'2026-10-27'}),
    mk({key:'A-3',assignees:[me],status:'done',dueDate:'2026-10-27'}),
    mk({key:'A-4',dueDate:'2026-10-28'}),
    mk({key:'A-5',dueDate:'2026-10-25'}),
    mk({key:'A-6',dueDate:'2026-11-05'}),
  ];
  it('lists only my open tasks, soonest first',()=>{expect(assignedTo(list,'u1').map(t=>t.key)).toEqual(['A-2','A-1']);expect(assignedTo(list,'zzz')).toEqual([])});
  it('finds open tasks due from today to 3 days ahead, not late or later ones',()=>{
    expect(deadlinesSoon(list,3,new Date(2026,9,26)).map(t=>t.key)).toEqual(['A-2','A-4']);
  });
});
