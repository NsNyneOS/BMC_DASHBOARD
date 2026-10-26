import{toast}from'../store/useToast';
import{useEffect,useMemo,useState}from'react';
import{Plus,Trash2}from'lucide-react';
import{api,type Permission}from'../api/client';
import{useCan}from'../store/useAuthStore';
import ModernSelect from'../components/ModernSelect';
import Loader from'../components/Loader';
import{Badge,Empty,errMsg,Field,FormModal,PageHead,useLoad}from'./ui';

// Customer (external) roles can only hold Board, Project and Task permissions; the rest is NyneOS-only.
const externalModules=['Board','Projects','Tasks'],hiddenForExternal=['project.internal.view'];

export default function RolesPage(){
  const canManage=useCan('role.manage'),roles=useLoad(()=>api.roles()),perms=useLoad(()=>api.permissions()),
    [selected,setSelected]=useState(''),[draft,setDraft]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false),
    [creating,setCreating]=useState(false),[form,setForm]=useState({name:'',description:'',userType:'external'}),[formError,setFormError]=useState('');
  const list=roles.data??[],role=list.find(r=>r.id===selected)??list[0],locked=!canManage||role?.code==='NYNEOS_ADMIN';
  useEffect(()=>{if(role){setSelected(role.id);setDraft(role.permissions);setSaved(false);setError('')}},[role?.id,roles.data]);// eslint-disable-line react-hooks/exhaustive-deps
  const modules=useMemo(()=>{const m=new Map<string,Permission[]>();for(const p of perms.data??[])m.set(p.module,[...(m.get(p.module)??[]),p]);return[...m]},[perms.data]);
  const shown=useMemo(()=>role?.userType==='external'?modules.filter(([m])=>externalModules.includes(m)).map(([m,items])=>[m,items.filter(p=>!hiddenForExternal.includes(p.code))] as [string,Permission[]]):modules,[modules,role?.userType]);
  const dirty=!!role&&[...draft].sort().join()!==[...role.permissions].sort().join();
  const toggle=(code:string)=>{setSaved(false);setDraft(d=>d.includes(code)?d.filter(c=>c!==code):[...d,code])};
  const save=async()=>{
    if(!role)return;setBusy(true);setError('');
    try{await api.updateRole(role.id,{permissions:draft});setSaved(true);toast('Permissions saved');roles.reload()}catch(e){setError(errMsg(e))}finally{setBusy(false)}
  };
  const remove=async()=>{
    if(!role||!confirm(`Delete the role "${role.name}"?`))return;
    try{await api.deleteRole(role.id);toast('Role deleted');setSelected('');roles.reload()}catch(e){setError(errMsg(e))}
  };
  const create=async()=>{
    setBusy(true);setFormError('');
    try{const r=await api.createRole({...form,permissions:[]});toast('Role created');setCreating(false);setSelected(r.id);roles.reload()}catch(e){setFormError(errMsg(e))}finally{setBusy(false)}
  };
  return <>
    <PageHead title="Roles & Permissions"
      action={canManage&&<button className="primary" onClick={()=>{setForm({name:'',description:'',userType:'external'});setFormError('');setCreating(true)}}><Plus size={16}/> New role</button>}/>
    {(roles.error||perms.error)&&<p className="loginError">{roles.error||perms.error}</p>}
    {roles.loading&&!roles.data&&<Loader/>}
    {role&&<div className="rolesLayout">
      <nav className="card roleList" aria-label="Roles">{list.map(r=><button key={r.id} className={r.id===role.id?'active':''} onClick={()=>setSelected(r.id)}>
        <strong>{r.name}</strong><span>{r.userType==='internal'?'Internal':'External'} · {r.userCount} user{r.userCount===1?'':'s'}</span>
      </button>)}</nav>
      <section className="card rolePanel">
        <div className="roleHead"><h2>{role.name}</h2>
          <div><Badge tone={role.userType==='internal'?'info':'neutral'}>{role.userType==='internal'?'Internal':'External'}</Badge></div></div>
        <div className="permGrid">{shown.map(([module,items])=><fieldset key={module}><legend>{module}</legend>
          {items.map(p=><label key={p.code} className="checkline"><input type="checkbox" checked={draft.includes(p.code)} disabled={locked} onChange={()=>toggle(p.code)}/> {p.name}</label>)}
        </fieldset>)}</div>
        {error&&<p className="loginError" role="alert">{error}</p>}
        {canManage&&<div className="roleActions">
          {!role.isSystem&&<button className="pill wide dangerText" onClick={()=>void remove()}><Trash2 size={15}/> Delete role</button>}
          {saved&&!dirty&&<span className="muted">Saved</span>}
          <button className="primary" disabled={!dirty||busy||locked} onClick={()=>void save()}>{busy?'Saving…':'Save permissions'}</button>
        </div>}
      </section>
    </div>}
    {creating&&<FormModal title="New role" submitLabel="Create role" busy={busy} error={formError} onClose={()=>setCreating(false)} onSubmit={()=>void create()}>
      <Field label="Role name *" full><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required/></Field>
      <Field label="Applies to"><ModernSelect ariaLabel="Applies to" value={form.userType} onChange={v=>setForm(f=>({...f,userType:v}))} options={[{value:'external',label:'External (customer users)'},{value:'internal',label:'Internal (NyneOS staff)'}]}/></Field>
      <Field label="Description" full><input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/></Field>
    </FormModal>}
  </>;
}
