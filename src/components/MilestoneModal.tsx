import{useEffect,useState}from'react';
import{Flag,Trash2,X}from'lucide-react';
import{useCan}from'../store/useAuthStore';
import{useTaskStore}from'../store/useTaskStore';
import{errMsg}from'../pages/ui';
import ConfirmDialog from'./ConfirmDialog';
import ModernSelect from'./ModernSelect';

const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
type Form={title:string;summary:string;date:string;customerId:string;projectCode:string};

// Add / edit / view a milestone, laid out like the task details popup: Save / Discard / delete / close at the top right.
// People without milestone.manage get a read-only view.
export default function MilestoneModal(){
  const editing=useTaskStore(s=>s.milestoneEditor),open=useTaskStore(s=>s.openMilestone),save=useTaskStore(s=>s.saveMilestone),remove=useTaskStore(s=>s.deleteMilestone),
    customers=useTaskStore(s=>s.customers),projects=useTaskStore(s=>s.projects),owner=useTaskStore(s=>s.owner),current=useTaskStore(s=>s.customer),canManage=useCan('milestone.manage');
  // "Internal" is NyneOS itself: the milestone is for the internal team and never shown to customer users.
  const clients=[...customers.filter(c=>c.type!=='internal'),...(owner?[{...owner,name:'Internal'}]:[])];
  const initial=():Form=>editing==='new'||!editing
    ?{title:'',summary:'',date:today(),customerId:clients.find(c=>c.code===current)?.id??'',projectCode:''}
    :{title:editing.title,summary:editing.summary,date:editing.date,customerId:editing.customerId,projectCode:editing.projectCode??''};
  const[form,setForm]=useState<Form>(initial),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirm,setConfirm]=useState(false);
  useEffect(()=>{setError('');setForm(initial())},[editing]);// eslint-disable-line react-hooks/exhaustive-deps
  const close=()=>open(null);
  useEffect(()=>{
    if(!editing)return;
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!confirm)close()};
    addEventListener('keydown',key);return()=>removeEventListener('keydown',key);
  });// eslint-disable-line react-hooks/exhaustive-deps
  if(!editing)return null;
  const isNew=editing==='new',readOnly=!canManage,base=initial();
  const dirty=isNew||(Object.keys(form) as (keyof Form)[]).some(k=>form[k]!==base[k]);
  const submit=async()=>{
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
    <button className="taskPopupBackdrop" onClick={close} aria-label="Close milestone"/>
    <div className="taskPopup milestonePopup" role="dialog" aria-modal="true" aria-label={isNew?'Add Milestone':'Milestone'}>
      <div className="cardHead">
        <span className="key"><i style={{background:'var(--ms, #3b82f6)'}}/><Flag size={13}/> {isNew?'New Milestone':'Milestone'}</span>
        <div className="popupHeadActions">
          {!readOnly&&<>
            {dirty&&!isNew&&<button className="pill" onClick={()=>{setForm(base);setError('')}}>Discard</button>}
            <button className="primary saveBtn" disabled={!dirty||busy} onClick={()=>void submit()}>{isNew?'Add':'Save'}</button>
            {!isNew&&<button className="icon dangerIcon" onClick={()=>setConfirm(true)} aria-label="Delete milestone" title="Delete milestone"><Trash2/></button>}
          </>}
          <button className="icon" onClick={close} aria-label="Close milestone"><X/></button>
        </div>
      </div>
      {error&&<p className="loginError">{error}</p>}
      <input className="drawerTitle" placeholder="Milestone title" value={form.title} readOnly={readOnly} onChange={set('title')} autoFocus={isNew}/>
      <textarea placeholder="Summary" value={form.summary} readOnly={readOnly} onChange={set('summary')}/>
      <div className="detailGrid">
        <label>Date
          <input type="date" value={form.date} min={!isNew&&editing.date<today()?editing.date:today()} readOnly={readOnly} disabled={readOnly} onChange={set('date')}/>
        </label>
        <label>Customer
          <ModernSelect ariaLabel="Customer" searchable disabled={readOnly} value={form.customerId} onChange={v=>setForm(f=>({...f,customerId:v,projectCode:''}))} options={[{value:'',label:'Select customer…'},...clients.map(c=>({value:c.id,label:c.name}))]}/>
        </label>
        <label className="full">Project <small className="fieldHint">Optional. Leave empty for the whole customer</small>
          <ModernSelect ariaLabel="Project" searchable disabled={readOnly||!form.customerId} value={form.projectCode} onChange={v=>setForm(f=>({...f,projectCode:v}))} options={[{value:'',label:'Whole customer'},...projectOptions.map(p=>({value:p.id,label:p.name}))]}/>
        </label>
      </div>
    </div>
    <ConfirmDialog open={confirm} danger title="Delete Milestone?" confirmLabel="Yes, delete" message={`"${form.title}" will be removed from the timeline and alerts.`} onCancel={()=>setConfirm(false)}
      onConfirm={()=>{setConfirm(false);if(!isNew)void remove(editing.id).then(close).catch(e=>setError(errMsg(e)))}}/>
  </>;
}
