import{useEffect,useState}from'react';
import{Trash2}from'lucide-react';
import{useCan}from'../store/useAuthStore';
import{useTaskStore}from'../store/useTaskStore';
import{errMsg,Field,FormModal}from'../pages/ui';
import ConfirmDialog from'./ConfirmDialog';
import ModernSelect from'./ModernSelect';

const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
type Form={title:string;summary:string;date:string;customerId:string;projectCode:string};

// Add / edit / view a milestone. People without milestone.manage get a read-only view.
export default function MilestoneModal(){
  const editing=useTaskStore(s=>s.milestoneEditor),open=useTaskStore(s=>s.openMilestone),save=useTaskStore(s=>s.saveMilestone),remove=useTaskStore(s=>s.deleteMilestone),
    customers=useTaskStore(s=>s.customers),projects=useTaskStore(s=>s.projects),owner=useTaskStore(s=>s.owner),current=useTaskStore(s=>s.customer),canManage=useCan('milestone.manage');
  // "Internal" is NyneOS itself: the milestone is for the internal team and never shown to customer users.
  const clients=[...customers.filter(c=>c.type!=='internal'),...(owner?[{...owner,name:'Internal'}]:[])];
  const[form,setForm]=useState<Form>({title:'',summary:'',date:today(),customerId:'',projectCode:''}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirm,setConfirm]=useState(false);
  useEffect(()=>{
    if(!editing)return;
    setError('');
    setForm(editing==='new'
      ?{title:'',summary:'',date:today(),customerId:clients.find(c=>c.code===current)?.id??'',projectCode:''}
      :{title:editing.title,summary:editing.summary,date:editing.date,customerId:editing.customerId,projectCode:editing.projectCode??''});
  },[editing]);// eslint-disable-line react-hooks/exhaustive-deps
  if(!editing)return null;
  const isNew=editing==='new',readOnly=!canManage,close=()=>open(null);
  const submit=async()=>{
    if(readOnly)return close();
    if(!form.title.trim())return setError('Title is required');
    if(!form.date)return setError('Date is required');
    // A milestone that is already in the past may keep its date, but a new date cannot be in the past.
    if(form.date<today()&&(isNew||form.date!==editing.date))return setError('The date cannot be in the past');
    if(!form.customerId)return setError('Choose the customer this milestone belongs to');
    setBusy(true);setError('');
    try{await save(form,isNew?undefined:editing.id);close()}catch(e){setError(errMsg(e))}finally{setBusy(false)}
  };
  // Optional: tie the milestone to one of the chosen customer's projects; empty means the whole customer.
  const projectOptions=projects.filter(p=>p.customerId===form.customerId&&p.status!=='archived');
  const set=(k:keyof Form)=>(e:{target:{value:string}})=>setForm(f=>({...f,[k]:e.target.value}));
  return <>
    <FormModal className="milestoneModal" title={isNew?'Add Milestone':readOnly?'Milestone':'Edit Milestone'} submitLabel={readOnly?'Close':isNew?'Add Milestone':'Save changes'} hideCancel={readOnly} busy={busy} error={error} onClose={close} onSubmit={()=>void submit()}>
      <Field label="Title *" full><input value={form.title} onChange={set('title')} disabled={readOnly} required/></Field>
      <Field label="Summary" full><textarea value={form.summary} onChange={set('summary')} disabled={readOnly}/></Field>
      <Field label="Date *"><input type="date" value={form.date} min={!isNew&&editing.date<today()?editing.date:today()} onChange={set('date')} disabled={readOnly} required/></Field>
      <Field label="Customer *" hint="The milestone is shown on this customer's dashboard"><ModernSelect ariaLabel="Customer" searchable disabled={readOnly} value={form.customerId} onChange={v=>setForm(f=>({...f,customerId:v,projectCode:''}))} options={[{value:'',label:'Select customer…'},...clients.map(c=>({value:c.id,label:c.name}))]}/></Field>
      <Field label="Project" full hint="Optional. Leave empty for the whole customer"><ModernSelect ariaLabel="Project" searchable disabled={readOnly||!form.customerId} value={form.projectCode} onChange={v=>setForm(f=>({...f,projectCode:v}))} options={[{value:'',label:'Whole customer'},...projectOptions.map(p=>({value:p.id,label:p.name}))]}/></Field>
      {!readOnly&&!isNew&&<div className="full"><button type="button" className="danger" onClick={()=>setConfirm(true)}><Trash2/> Delete Milestone</button></div>}
    </FormModal>
    <ConfirmDialog open={confirm} danger title="Delete Milestone?" confirmLabel="Yes, delete" message={`"${form.title}" will be removed from the timeline and alerts.`} onCancel={()=>setConfirm(false)}
      onConfirm={()=>{setConfirm(false);if(!isNew)void remove(editing.id).then(close).catch(e=>setError(errMsg(e)))}}/>
  </>;
}
