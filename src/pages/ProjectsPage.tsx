import{useState}from'react';
import{Pencil,Plus}from'lucide-react';
import{api,type ProjectMeta,type ProjectStatus}from'../api/client';
import{useCan}from'../store/useAuthStore';
import{useTaskStore}from'../store/useTaskStore';
import ModernSelect from'../components/ModernSelect';
import Loader from'../components/Loader';
import DataTable,{type Column}from'../components/DataTable';
import{Badge,ColorField,errMsg,Field,FormModal,PageHead,useLoad}from'./ui';

const statusLabel:Record<ProjectStatus,string>={active:'Active',on_hold:'On hold',completed:'Completed',archived:'Archived'};
const tone={active:'ok',on_hold:'warn',completed:'info',archived:'neutral'} as const;
const blank={customerId:'',code:'',name:'',description:'',color:'#c95b12',status:'active' as ProjectStatus,internalOnly:false};
const fmt=(d:string|null)=>d||'—';

export default function ProjectsPage(){
  const canManage=useCan('project.manage'),
    projects=useLoad(()=>api.projects()),
    customers=useLoad(()=>api.customers().catch(()=>[])),
    owner=useLoad(()=>api.owner().catch(()=>null)),
    [filter,setFilter]=useState('all'),[typeFilter,setTypeFilter]=useState<'all'|'external'|'internal'>('all'),
    [editing,setEditing]=useState<ProjectMeta|'new'|null>(null),[form,setForm]=useState(blank),[busy,setBusy]=useState(false),[formError,setFormError]=useState('');
  // Anything that is not explicitly the owner's (NyneOS) is an external, customer project, so projects still show if the API omits the type.
  const isInternal=(p:ProjectMeta)=>p.customerType==='internal';
  const list=(projects.data??[]).filter(p=>typeFilter==='internal'?isInternal(p):typeFilter==='external'?!isInternal(p)&&(filter==='all'||p.customerCode===filter):filter==='all'||(!isInternal(p)&&p.customerCode===filter));
  // Customers are the clients NyneOS serves; NyneOS itself is the owner and only appears as the home of internal projects.
  const custs=customers.data&&customers.data.length?customers.data.filter(c=>c.type!=='internal').map(c=>({id:c.id,code:c.code,name:c.name})):[...new Map((projects.data??[]).filter(p=>!isInternal(p)).map(p=>[p.customerId,{id:p.customerId,code:p.customerCode,name:p.customerName}])).values()];
  const ownerOpt=owner.data?{id:owner.data.id,code:owner.data.code,name:owner.data.name+' (internal)'}:null,
    allOwners=ownerOpt?[ownerOpt,...custs]:custs,isOwnerProject=!!ownerOpt&&form.customerId===ownerOpt.id;
  const open=(p:ProjectMeta|'new')=>{
    setEditing(p);setFormError('');
    setForm(p==='new'?{...blank,customerId:custs.find(c=>c.code===filter)?.id??custs[0]?.id??''}:{customerId:p.customerId,code:p.id,name:p.name,description:p.description,color:/^#[0-9a-f]{6}$/i.test(p.color)?p.color:'#c95b12',status:p.status,internalOnly:p.internalOnly});
  };
  const columns:Column<ProjectMeta>[]=[
    {key:'name',label:'Project',sort:p=>p.name,csv:p=>`${p.name} (${p.id})`,cell:p=><><span className="dot" style={{background:p.color}}/> <strong>{p.name}</strong> <span className="muted">{p.id}</span>{!isInternal(p)&&p.internalOnly&&<> <span className="muted">(hidden from customer)</span></>}</>},
    {key:'type',label:'Type',sort:p=>isInternal(p)?'Internal':'External',csv:p=>isInternal(p)?'Internal':'External',cell:p=><Badge tone={isInternal(p)?'info':'neutral'}>{isInternal(p)?'Internal':'External'}</Badge>},
    {key:'customer',label:'Customer',sort:p=>p.customerName,csv:p=>p.customerName,cell:p=>p.customerName},
    {key:'status',label:'Status',sort:p=>statusLabel[p.status],cell:p=><Badge tone={tone[p.status]}>{statusLabel[p.status]}</Badge>},
    {key:'started',label:'Started',sort:p=>p.startDate??'',csv:p=>p.startDate??'',cell:p=>fmt(p.startDate)},
    {key:'tasks',label:'Tasks',sort:p=>p.taskCount,cell:p=>p.taskCount},
    {key:'actions',label:'',actions:true,cell:p=>canManage&&<button className="icon" aria-label={'Edit '+p.name} onClick={()=>open(p)}><Pencil/></button>}
  ];
  const save=async()=>{
    if(editing==='new'&&!form.customerId){setFormError('Choose a customer');return}
    setBusy(true);setFormError('');
    try{
      if(editing==='new')await api.createProject({customerId:form.customerId,name:form.name,description:form.description,color:form.color,status:form.status,internalOnly:form.internalOnly});
      else if(editing)await api.updateProject(editing.id,{name:form.name,description:form.description,color:form.color,status:form.status,internalOnly:form.internalOnly});
      setEditing(null);projects.reload();void useTaskStore.getState().loadAll();
    }catch(e){setFormError(errMsg(e))}finally{setBusy(false)}
  };
  return <>
    <PageHead title="Projects"
      action={<>
        {canManage&&<button className="primary" onClick={()=>open('new')}><Plus size={16}/> New project</button>}
      </>}/>
    {projects.error&&<p className="loginError">{projects.error}</p>}
    {projects.loading&&!projects.data&&<Loader/>}
    {projects.data&&<DataTable filters={<><ModernSelect className="pageFilter" ariaLabel="Filter by project type" value={typeFilter} onChange={v=>setTypeFilter(v as 'all'|'external'|'internal')} options={[{value:'all',label:'All projects'},{value:'external',label:'External (customer)'},{value:'internal',label:'Internal (NyneOS)'}]}/>{typeFilter!=='internal'&&<ModernSelect className="pageFilter" ariaLabel="Filter by customer" searchable value={filter} onChange={setFilter} options={[{value:'all',label:'All customers'},...custs.map(c=>({value:c.code,label:c.name}))]}/>}</>} rows={list} rowKey={p=>p.uuid} filename="projects" onRefresh={projects.reload} loading={projects.loading} empty="No projects to show." searchText={p=>`${p.name} ${p.id} ${p.customerName} ${p.status}`} columns={columns}/>}
    {editing&&<FormModal title={editing==='new'?'New project':'Edit '+editing.name} submitLabel={editing==='new'?'Create project':'Save changes'} busy={busy} error={formError} onClose={()=>setEditing(null)} onSubmit={()=>void save()}>
      <Field label="Customer *"><ModernSelect ariaLabel="Customer" searchable disabled={editing!=='new'} value={form.customerId} onChange={v=>setForm(f=>({...f,customerId:v}))} options={[{value:'',label:'Select customer…'},...allOwners.map(c=>({value:c.id,label:c.name}))]}/></Field>
      {editing!=='new'&&<Field label="Project code" hint="Generated automatically; it cannot be changed"><input value={form.code} disabled/></Field>}
      <Field label="Project name *" full><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required/></Field>
      <Field label="Description" full><textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/></Field>
      <Field label="Status"><ModernSelect ariaLabel="Status" value={form.status} onChange={v=>setForm(f=>({...f,status:v as ProjectStatus}))} options={(Object.keys(statusLabel) as ProjectStatus[]).map(s=>({value:s,label:statusLabel[s]}))}/></Field>
      <div className="colorFieldWrap full"><span className="fieldText">Colour</span><ColorField value={form.color} onChange={color=>setForm(f=>({...f,color}))}/></div>
      {!isOwnerProject&&<label className="full checkline"><input type="checkbox" checked={form.internalOnly} onChange={e=>setForm(f=>({...f,internalOnly:e.target.checked}))}/> Internal only — hidden from the customer's own users</label>}
    </FormModal>}
  </>;
}
