import{useEffect}from'react';
import{useForm}from'react-hook-form';
import{zodResolver}from'@hookform/resolvers/zod';
import{z}from'zod';
import{X}from'lucide-react';
import{useTaskStore}from'../store/useTaskStore';
import type{IssueType,Priority,ProjectId,Status}from'../types/task';
import ModernSelect from'./ModernSelect';

export const taskSchema=z.object({
  project:z.enum(['AML','EKYC','DPDP','WEB']),
  type:z.enum(['task','bug','story','epic','subtask']),
  summary:z.string().min(1,'Summary is required').max(120),
  description:z.string(),
  status:z.enum(['todo','in_progress','in_review','done']),
  priority:z.enum(['highest','high','medium','low','lowest']),
  startDate:z.string(),
  dueDate:z.string()
}).refine(value=>!value.startDate||!value.dueDate||value.dueDate>=value.startDate,{
  path:['dueDate'],
  message:'Due date must be on or after start date'
});

type Values=z.infer<typeof taskSchema>;

const projectOptions=[
  {value:'AML',label:'AML'},
  {value:'EKYC',label:'EKYC'},
  {value:'DPDP',label:'DPDP'},
  {value:'WEB',label:'Website'}
];
const issueOptions=[
  {value:'task',label:'Task'},
  {value:'bug',label:'Bug'},
  {value:'story',label:'Story'},
  {value:'epic',label:'Epic'},
  {value:'subtask',label:'Sub-task'}
];
const statusOptions=[
  {value:'todo',label:'New'},
  {value:'in_progress',label:'Testing'},
  {value:'in_review',label:'Deploying'},
  {value:'done',label:'Completed'}
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
  const{register,handleSubmit,watch,setValue,reset,formState:{errors}}=useForm<Values>({
    resolver:zodResolver(taskSchema),
    defaultValues:{project:'AML',type:'task',summary:'',description:'',status,priority:'medium',startDate:date||'',dueDate:date||''}
  });
  const summary=watch('summary');
  const project=watch('project');
  const issueType=watch('type');
  const selectedStatus=watch('status');
  const priority=watch('priority');

  useEffect(()=>{
    if(open){
      reset({project:'AML',type:'task',summary:'',description:'',status,priority:'medium',startDate:date||'',dueDate:date||''});
      setTimeout(()=>document.getElementById('task-summary')?.focus(),0);
    }
  },[open,status,date,reset]);

  useEffect(()=>{
    if(!open)return;
    const handleKey=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose()};
    addEventListener('keydown',handleKey);
    document.body.style.overflow='hidden';
    return()=>{removeEventListener('keydown',handleKey);document.body.style.overflow=''};
  },[open,onClose]);

  if(!open)return null;

  const submit=(values:Values)=>{
    const task=addTask({...values,assignee:null,reporter:'u1',startDate:values.startDate||null,dueDate:values.dueDate||null,estimate:null,storyPoints:null,sprint:'Backlog',labels:[],components:[],fixVersion:'',parentKey:null,links:[],attachments:[]});
    onCreated(task.key);
  };

  return <div className="backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <div className="modal compactModal" role="dialog" aria-modal="true" aria-labelledby="create-title">
      <header>
        <h2 id="create-title">Create task</h2>
        <button className="icon" onClick={onClose} aria-label="Close"><X/></button>
      </header>

      <form onSubmit={handleSubmit(submit)}>
        <div className="formGrid">
          <label>Project <b>*</b>
            <ModernSelect ariaLabel="Project" value={project} options={projectOptions} onChange={value=>setValue('project',value as ProjectId,{shouldValidate:true})}/>
          </label>

          <label>Issue type <b>*</b>
            <ModernSelect ariaLabel="Issue type" value={issueType} options={issueOptions} onChange={value=>setValue('type',value as IssueType,{shouldValidate:true})}/>
          </label>

          <label className="full">
            Summary <span><b>*</b> {summary.length}/120</span>
            <input id="task-summary" {...register('summary')}/>
            {errors.summary&&<em>{errors.summary.message}</em>}
          </label>

          <label className="full">
            Description
            <span className="toolbar">B · <i>I</i> · • List · 1. List · Link · Code</span>
            <textarea {...register('description')} placeholder="Add context, acceptance criteria, or links…"/>
          </label>

          <label>Status
            <ModernSelect ariaLabel="Status" value={selectedStatus} options={statusOptions} onChange={value=>setValue('status',value as Status,{shouldValidate:true})}/>
          </label>

          <label>Priority
            <ModernSelect ariaLabel="Priority" value={priority} options={priorityOptions} onChange={value=>setValue('priority',value as Priority,{shouldValidate:true})}/>
          </label>

          <label>Start date<input type="date" {...register('startDate')}/></label>
          <label>Due date<input type="date" {...register('dueDate')}/>{errors.dueDate&&<em>{errors.dueDate.message}</em>}</label>
        </div>

        <footer className="simpleFooter">
          <button type="button" className="pill" onClick={onClose}>Cancel</button>
          <button className="primary" type="submit">Create</button>
        </footer>
      </form>
    </div>
  </div>;
}
