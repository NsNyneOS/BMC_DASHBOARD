import{useEffect,useState}from'react';
import{useForm}from'react-hook-form';
import{zodResolver}from'@hookform/resolvers/zod';
import{z}from'zod';
import{X}from'lucide-react';
import{useTaskStore}from'../store/useTaskStore';
import{useCan,useAuthStore}from'../store/useAuthStore';
import{api,type Assignee}from'../api/client';
import type{Priority,ProjectId,Status}from'../types/task';
import ModernSelect from'./ModernSelect';
import MultiSelect from'./MultiSelect';
import DependencyPicker from'./DependencyPicker';
import VisibilityToggle from'./VisibilityToggle';

export const taskSchema=z.object({
  project:z.string().min(1,'Choose a project'),
  summary:z.string().min(1,'Summary is required').max(120),
  description:z.string(),
  status:z.enum(['todo','in_progress','developing','testing','review','completed','in_review','rework','done']),
  priority:z.enum(['highest','high','medium','low','lowest']),
  startDate:z.string().min(1,'Start date is required'),
  dueDate:z.string().min(1,'Due date is required'),
  dependsOn:z.array(z.string()),
  customDependencies:z.array(z.string()),
  clientVisible:z.boolean(),
  team:z.enum(['nyneos','bmc']),
  assigneeIds:z.array(z.string()).default([]),
  reportingToId:z.string().optional()
}).refine(value=>!value.startDate||!value.dueDate||value.dueDate>=value.startDate,{
  path:['dueDate'],
  message:'Due date must be on or after start date'
});

type Values=z.infer<typeof taskSchema>;

const statusOptions=[
  {value:'todo',label:'New'},
  {value:'in_progress',label:'In Progress'},
  {value:'developing',label:'Developing'},
  {value:'testing',label:'Testing'},
  {value:'review',label:'Review'},
  {value:'completed',label:'Completed'},
  {value:'in_review',label:'Deploying'},
  {value:'rework',label:'Rework'},
  {value:'done',label:'Finished'}
];
const priorityOptions=[
  {value:'highest',label:'Highest'},
  {value:'high',label:'High'},
  {value:'medium',label:'Medium'},
  {value:'low',label:'Low'},
  {value:'lowest',label:'Lowest'}
];

export default function TaskModal({
  open,onClose,status='todo',date,onCreated
}:{
  open:boolean;
  onClose:()=>void;
  status?:Status;
  date?:string;
  onCreated:(key:string)=>void;
}){
  const addTask=useTaskStore(state=>state.addTask);
  const filterProject=useTaskStore(state=>state.filters.project);
  const projectsMeta=useTaskStore(state=>state.projects);
  const multiCustomer=new Set(projectsMeta.map(p=>p.customerCode)).size>1;
  const projectOptions=projectsMeta.filter(p=>p.status!=='archived').map(p=>({value:p.id,label:multiCustomer?`${p.name} · ${p.customerCode}`:p.name}));
  const defaultProject:ProjectId=filterProject==='all'?(projectOptions[0]?.value??''):filterProject;
  const clientSide=useAuthStore(state=>state.user?.userType==='external');
  const{register,handleSubmit,watch,setValue,reset,formState:{errors}}=useForm<Values>({
    resolver:zodResolver(taskSchema),
    defaultValues:{project:defaultProject,summary:'',description:'',status,priority:'medium',startDate:date||'',dueDate:date||'',dependsOn:[],customDependencies:[],clientVisible:true,team:clientSide?'bmc':'nyneos',assigneeIds:[],reportingToId:''}
  });
  const summary=watch('summary');
  const project=watch('project');
    const selectedStatus=watch('status');
  const priority=watch('priority');
  const dependsOn=watch('dependsOn')??[];
  const customDependencies=watch('customDependencies')??[];
  const clientVisible=watch('clientVisible');
  const team=watch('team');
  const canTeam=useCan('task.team.manage'),canVisibility=useCan('task.visibility.manage'),canDeps=useCan('task.dependencies.edit');
  const canMilestone=useCan('milestone.manage'),openMilestone=useTaskStore(state=>state.openMilestone);
  const canAssign=useCan('task.assign'),[people,setPeople]=useState<Assignee[]>([]),[peopleError,setPeopleError]=useState(false);
  const projCustomer=projectsMeta.find(p=>p.id===project);
  // The customer side of a task is named after the project's customer; NyneOS's own projects have no customer side.
  const teamOptions=[{value:'nyneos',label:'NyneOS'},...(projCustomer?.customerType==='internal'?[]:[{value:'bmc',label:projCustomer?.customerName??'Customer'}])];
  const allTasks=useTaskStore(state=>state.tasks);
  const projectTasks=allTasks.filter(t=>t.project===project);

  useEffect(()=>{
    // Who can this project's tasks be assigned to? (NyneOS staff + the customer's own users)
    if(!open||!canAssign||!project){setPeople([]);return}
    let live=true;
    setPeopleError(false);
    api.assignees(project).then(list=>{if(live)setPeople(list)}).catch(()=>{if(live){setPeople([]);setPeopleError(true)}});
    return()=>{live=false};
  },[open,canAssign,project]);

  useEffect(()=>{
    if(open){
      reset({project:defaultProject,summary:'',description:'',status,priority:'medium',startDate:date||'',dueDate:date||'',dependsOn:[],customDependencies:[],clientVisible:true,team:clientSide?'bmc':'nyneos',assigneeIds:[],reportingToId:''});
      setTimeout(()=>document.getElementById('task-summary')?.focus(),0);
    }
  },[open,status,date,defaultProject,clientSide,reset]);

  useEffect(()=>{
    if(!open)return;
    const handleKey=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose()};
    addEventListener('keydown',handleKey);
    document.body.style.overflow='hidden';
    return()=>{removeEventListener('keydown',handleKey);document.body.style.overflow=''};
  },[open,onClose]);

  if(!open)return null;

  const submit=(values:Values)=>{
    const task=addTask({...values,assignees:people.filter(p=>(values.assigneeIds??[]).includes(p.id)),reportingTo:people.find(p=>p.id===values.reportingToId)??null,type:'task',assignee:null,reporter:'u1',startDate:values.startDate||null,dueDate:values.dueDate||null,estimate:null,storyPoints:null,sprint:'Backlog',labels:[],components:[],fixVersion:'',parentKey:null,links:[],attachments:[]});
    onCreated(task.key);
  };

  return <div className="backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <div className="modal compactModal" role="dialog" aria-modal="true" aria-labelledby="create-title">
      <header>
        <h2 id="create-title">Create task</h2>
        {canMilestone&&<div className="kindSwitch" role="tablist" aria-label="What to create">
          <button type="button" role="tab" aria-selected className="active">Task</button>
          <button type="button" role="tab" aria-selected={false} onClick={()=>{onClose();openMilestone('new')}}>Milestone</button>
        </div>}
        <button className="icon" onClick={onClose} aria-label="Close"><X/></button>
      </header>

      <form onSubmit={handleSubmit(submit)}>
        <div className="formGrid">
          <label>Project <b>*</b>
            <ModernSelect ariaLabel="Project" value={project} options={projectOptions} onChange={value=>{setValue('project',value as ProjectId,{shouldValidate:true});setValue('dependsOn',[]);setValue('assigneeIds',[]);setValue('reportingToId','')}}/>
          </label>

          <label className="full">
            Summary <span><b>*</b> {summary.length}/120</span>
            <input id="task-summary" {...register('summary')}/>
            {errors.summary&&<em>{errors.summary.message}</em>}
          </label>

          <label className="full">
            Description
            <textarea {...register('description')} placeholder="Add context, acceptance criteria, or links…"/>
          </label>

          <label>Status
            <ModernSelect disabled ariaLabel="Status (set by selected column)" value={selectedStatus} options={statusOptions} onChange={value=>setValue('status',value as Status,{shouldValidate:true})}/>
          </label>

          <label>Priority
            <ModernSelect ariaLabel="Priority" value={priority} options={priorityOptions} onChange={value=>setValue('priority',value as Priority,{shouldValidate:true})}/>
          </label>

          <label>Start date <b>*</b><input type="date" {...register('startDate')}/>{errors.startDate&&<em>{errors.startDate.message}</em>}</label>
          <label>Due date <b>*</b><input type="date" {...register('dueDate')}/>{errors.dueDate&&<em>{errors.dueDate.message}</em>}</label>



          {canTeam&&<label>Team
            <ModernSelect ariaLabel="Team" value={team} options={teamOptions} onChange={value=>{setValue('team',value as 'nyneos'|'bmc');setValue('assigneeIds',(watch('assigneeIds')??[]).filter(id=>people.find(p=>p.id===id)?.userType===(value==='bmc'?'external':'internal')))}}/>
          </label>}

          {canVisibility&&<div className="visibilityField">Visibility
            <VisibilityToggle visible={clientVisible} onChange={value=>setValue('clientVisible',value)}/>
          </div>}

          {canAssign&&<div className="full assigneeField">Assignees
            <MultiSelect ariaLabel="Assignees" placeholder="Unassigned" emptyText={peopleError?'Could not load members':'No members for this team'} values={watch('assigneeIds')??[]} onChange={ids=>setValue('assigneeIds',ids)} options={people.filter(p=>p.userType===(team==='bmc'?'external':'internal')).map(p=>({value:p.id,label:p.name}))}/>
          </div>}

          {canAssign&&<div className="full assigneeField">Reporting to
            <ModernSelect ariaLabel="Reporting to" searchable value={watch('reportingToId')||''} onChange={v=>setValue('reportingToId',v)} options={[{value:'',label:'Nobody'},...people.map(p=>({value:p.id,label:`${p.name} · ${p.userType==='internal'?'NyneOS':projCustomer?.customerName??'Customer'}`}))]}/>
          </div>}

          {canDeps&&<div className="full dependencyField">Depends on
            <DependencyPicker tasks={projectTasks} selected={dependsOn} custom={customDependencies} onChange={keys=>setValue('dependsOn',keys,{shouldValidate:true})} onCustomChange={values=>setValue('customDependencies',values,{shouldValidate:true})}/>
          </div>}
        </div>

        <footer className="simpleFooter">
          <button type="button" className="pill" onClick={onClose}>Cancel</button>
          <button className="primary" type="submit">Create</button>
        </footer>
      </form>
    </div>
  </div>;
}
