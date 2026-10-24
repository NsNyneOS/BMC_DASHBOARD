import{describe,expect,it}from'vitest';
import type{Task}from'../types/task';
import{buildReport,inPeriod,periodRange,type ReportFilters}from'./report';

const mk=(o:Partial<Task>):Task=>({id:o.key??'x',key:'A-1',project:'A',type:'task',summary:'s',description:'',status:'todo',priority:'medium',order:0,assignee:null,reporter:'',startDate:null,dueDate:null,estimate:null,storyPoints:null,sprint:'',labels:[],components:[],fixVersion:'',parentKey:null,dependsOn:[],customDependencies:[],links:[],attachments:[],clientVisible:true,team:'nyneos',createdAt:'',updatedAt:'',completedAt:null,...o});
const base:ReportFilters={period:'all',from:'',to:'',projects:[],priority:[],status:[],team:'all'};
const name=(c:string)=>c;

describe('report periods',()=>{
  it('computes today / week (Mon-Sun) / month',()=>{
    const now=new Date(2026,9,22); // Thu 22 Oct 2026
    expect(periodRange('today',now)).toEqual({from:'2026-10-22',to:'2026-10-22'});
    expect(periodRange('week',now)).toEqual({from:'2026-10-19',to:'2026-10-25'});
    expect(periodRange('month',now)).toEqual({from:'2026-10-01',to:'2026-10-31'});
    expect(periodRange('all',now)).toEqual({from:'',to:''});
  });
  it('includes a task whose span overlaps the range, or that was completed inside it',()=>{
    expect(inPeriod(mk({startDate:'2026-10-20',dueDate:'2026-11-05'}),'2026-11-01','2026-11-30')).toBe(true);
    expect(inPeriod(mk({startDate:'2026-09-01',dueDate:'2026-09-30'}),'2026-10-01','2026-10-31')).toBe(false);
    expect(inPeriod(mk({startDate:'2026-09-01',dueDate:'2026-09-30',status:'done',completedAt:'2026-10-03T10:00:00Z'}),'2026-10-01','2026-10-31')).toBe(true);
    expect(inPeriod(mk({}),'2026-10-01','2026-10-31')).toBe(false);
    expect(inPeriod(mk({}),'','')).toBe(true);
  });
});

describe('buildReport',()=>{
  const tasks=[
    mk({key:'A-1',project:'A',status:'done',team:'nyneos',completedAt:'2026-10-10T00:00:00Z',dueDate:'2026-10-10',priority:'high'}),
    mk({key:'A-2',project:'A',status:'done',team:'bmc',completedAt:'2026-10-11T00:00:00Z',dueDate:'2026-10-11'}),
    mk({key:'A-3',project:'A',status:'in_progress',dueDate:'2026-10-01'}),
    mk({key:'B-1',project:'B',status:'todo',dueDate:'2026-10-20'}),
    mk({key:'B-2',project:'B',status:'testing',dueDate:'2026-10-21',priority:'low'}),
  ];
  const r=buildReport(tasks,base,name,'2026-10-22');
  it('lists only completed NyneOS-side work as accomplished',()=>{expect(r.accomplished.map(t=>t.key)).toEqual(['A-1'])});
  it('switches to the customer side when filtered to it',()=>{
    const c=buildReport(tasks,{...base,team:'bmc'},name,'2026-10-22');expect(c.accomplishedBy).toBe('bmc');expect(c.accomplished.map(t=>t.key)).toEqual(['A-2']);
  });
  it('counts every stage and lists only the open ones',()=>{
    expect(r.stageCounts).toEqual({todo:1,in_progress:1,developing:0,testing:1,review:0,completed:0,in_review:0,rework:0,done:2});
    expect(r.stages.map(s=>s.status)).toEqual(['todo','in_progress','developing','testing','review','completed','in_review','rework']);
  });
  it('gives per-project progress with a total row and overdue counts',()=>{
    expect(r.progress.map(p=>[p.project,p.total,p.percent,p.overdue])).toEqual([['A',3,67,1],['B',2,0,2]]);
    expect(r.total).toMatchObject({total:5,percent:40,overdue:3});
  });
  it('applies the project, priority and status filters',()=>{
    expect(buildReport(tasks,{...base,projects:['B']},name).tasks.length).toBe(2);
    expect(buildReport(tasks,{...base,priority:['low']},name).tasks.map(t=>t.key)).toEqual(['B-2']);
    expect(buildReport(tasks,{...base,status:['done']},name).tasks.length).toBe(2);
  });
});
