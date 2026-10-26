import{useState}from'react';
import{ArrowRight,Building,Layers,Pencil,Plus}from'lucide-react';
import{api,type Customer}from'../api/client';
import{useCan}from'../store/useAuthStore';
import{useTaskStore}from'../store/useTaskStore';
import ModernSelect from'../components/ModernSelect';
import Loader from'../components/Loader';
import DataTable,{type Column}from'../components/DataTable';
import{toast}from'../store/useToast';
import{Badge,errMsg,Field,FormModal,LogoField,PageHead,useLoad}from'./ui';

const blank={name:'',shortName:'',logoUrl:'',contactName:'',contactEmail:'',contactPhone:'',address:'',status:'active'};

export default function CustomersPage({onOpen}:{onOpen:(code:string)=>void}){
  const canManage=useCan('customer.manage'),current=useTaskStore(s=>s.customer),owner=useTaskStore(s=>s.owner),canInternal=useCan('project.internal.view'),{data,error,loading,reload}=useLoad(()=>api.customers()),
    [editing,setEditing]=useState<Customer|'new'|null>(null),[form,setForm]=useState(blank),[busy,setBusy]=useState(false),[formError,setFormError]=useState('');
  const open=(c:Customer|'new')=>{setEditing(c);setFormError('');setForm(c==='new'?blank:{name:c.name,shortName:c.shortName,logoUrl:c.logoUrl,contactName:c.contactName,contactEmail:c.contactEmail,contactPhone:c.contactPhone,address:c.address,status:c.status})};
  const columns:Column<Customer>[]=[
    {key:'name',label:'Customer',sort:c=>c.name,cell:c=><><strong>{c.name}</strong>{current===c.code&&<> <Badge tone="info">Viewing</Badge></>}</>},
    {key:'code',label:'Code',sort:c=>c.code,cell:c=>c.code},
    {key:'contact',label:'Contact',sort:c=>c.contactName||c.contactEmail,cell:c=>c.contactName||c.contactEmail||'—'},
    {key:'projects',label:'Projects',sort:c=>c.projectCount,cell:c=>c.projectCount},
    {key:'users',label:'Users',sort:c=>c.userCount,cell:c=>c.userCount},
    {key:'status',label:'Status',sort:c=>c.status,cell:c=><Badge tone={c.status==='active'?'ok':'bad'}>{c.status}</Badge>},
    {key:'actions',label:'',actions:true,cell:c=><>
      <button className="pill wide" onClick={()=>onOpen(c.code)}>Open dashboard <ArrowRight size={14}/></button>
      {canManage&&<button className="icon" aria-label={'Edit '+c.name} onClick={()=>open(c)}><Pencil/></button>}
    </>}
  ];
  const set=(k:keyof typeof blank)=>(e:{target:{value:string}})=>setForm(f=>({...f,[k]:e.target.value}));
  const save=async()=>{
    setBusy(true);setFormError('');
    try{
      if(editing==='new')await api.createCustomer(form);
      else if(editing)await api.updateCustomer(editing.id,form);
      toast(editing==='new'?'Customer created':'Customer saved');setEditing(null);reload();void useTaskStore.getState().loadCustomers();
    }catch(e){setFormError(errMsg(e))}finally{setBusy(false)}
  };
  return <>
    <PageHead title="Customers"
      action={canManage&&<button className="primary" onClick={()=>open('new')}><Plus size={16}/> New customer</button>}/>
    {error&&<p className="loginError">{error}</p>}
    {loading&&!data&&<Loader/>}
    {data&&<div className={'card allCustomers'+(current==='all'?' current':'')}>
      <span className="allIcon"><Layers size={20}/></span>
      <div><strong>All customers</strong><p className="muted">One combined dashboard across every customer's projects</p></div>
      {current==='all'&&<Badge tone="info">Viewing</Badge>}
      <button className="pill wide" onClick={()=>onOpen('all')}>Open dashboard <ArrowRight size={14}/></button>
    </div>}
    {data&&owner&&canInternal&&<div className={'card allCustomers'+(current===owner.code?' current':'')}>
      <span className="allIcon"><Building size={20}/></span>
      <div><strong>{owner.name} · internal projects</strong></div>
      {current===owner.code&&<Badge tone="info">Viewing</Badge>}
      <button className="pill wide" onClick={()=>onOpen(owner.code)}>Open dashboard <ArrowRight size={14}/></button>
    </div>}
    {data&&<DataTable rows={data.filter(c=>c.type!=='internal')} rowKey={c=>c.id} filename="customers" onRefresh={reload} loading={loading} empty="No customers yet." searchText={c=>`${c.name} ${c.code} ${c.contactName} ${c.contactEmail}`} columns={columns}/>}
    {editing&&<FormModal title={editing==='new'?'New customer':'Edit '+editing.name} submitLabel={editing==='new'?'Create customer':'Save changes'} busy={busy} error={formError} onClose={()=>setEditing(null)} onSubmit={()=>void save()}>
      <Field label="Customer name *"><input value={form.name} onChange={set('name')} required/></Field>
      <Field label="Short name"><input value={form.shortName} onChange={set('shortName')}/></Field>
      <Field label="Status"><ModernSelect ariaLabel="Status" value={form.status} onChange={v=>setForm(f=>({...f,status:v}))} options={[{value:'active',label:'Active'},{value:'inactive',label:'Inactive (users cannot sign in)'}]}/></Field>
      <div className="full logoFieldWrap"><span className="fieldLabel">Customer logo</span><LogoField value={form.logoUrl} name={form.name} onChange={logo=>setForm(f=>({...f,logoUrl:logo}))}/></div>
    </FormModal>}
  </>;
}
