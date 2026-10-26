import{toast}from'../store/useToast';
import{useState}from'react';
import{Pencil,Plus}from'lucide-react';
import{api,type UserRow}from'../api/client';
import{useAuthStore,useCan}from'../store/useAuthStore';
import ModernSelect from'../components/ModernSelect';
import Loader from'../components/Loader';
import DataTable,{type Column}from'../components/DataTable';
import{Badge,errMsg,Field,FormModal,PageHead,useLoad}from'./ui';

const blank={username:'',name:'',email:'',password:'',userType:'internal' as 'internal'|'external',roleId:'',customerId:'',isActive:true,resetPassword:false,projectCodes:[] as string[]};

export default function UsersPage(){
  const me=useAuthStore(s=>s.user),canManage=useCan('user.manage'),
    users=useLoad(()=>api.users()),roles=useLoad(()=>api.roles()),customers=useLoad(()=>api.customers()),projects=useLoad(()=>api.projects()),
    [filter,setFilter]=useState('all'),
    [editing,setEditing]=useState<UserRow|'new'|null>(null),[form,setForm]=useState(blank),[busy,setBusy]=useState(false),[formError,setFormError]=useState('');
  const roleList=roles.data??[],external=form.userType==='external',typeRoles=roleList.filter(r=>r.userType===form.userType),
    clients=(customers.data??[]).filter(c=>c.type!=='internal'),
    customerProjects=(projects.data??[]).filter(p=>p.customerId===form.customerId&&!p.internalOnly);
  const shown=(users.data??[]).filter(u=>filter==='all'||(filter==='internal'?u.userType==='internal':u.customerId===filter));
  const defaultInternalRole=()=>roleList.find(r=>r.code==='NYNEOS_MEMBER')?.id??roleList.find(r=>r.userType==='internal')?.id??'';
  const pickType=(t:string)=>setForm(f=>({...f,userType:t as 'internal'|'external',roleId:t==='internal'?defaultInternalRole():'',customerId:'',projectCodes:[]}));
  const open=(u:UserRow|'new')=>{
    setEditing(u);setFormError('');
    setForm(u==='new'?{...blank,roleId:defaultInternalRole()}:{userType:u.userType,username:u.username,name:u.name,email:u.email,password:'',roleId:u.roleId,customerId:u.customerId??'',isActive:u.isActive,resetPassword:false,projectCodes:u.projectCodes});
  };
  const columns:Column<UserRow>[]=[
    {key:'name',label:'User',sort:u=>u.name,csv:u=>`${u.name} (@${u.username})`,cell:u=><><span className="avatar sm">{u.initials}</span> <strong>{u.name}</strong> <span className="muted">@{u.username}</span></>},
    {key:'type',label:'Type',sort:u=>u.userType,cell:u=><Badge tone={u.userType==='internal'?'info':'neutral'}>{u.userType==='internal'?'Internal':'External'}</Badge>},
    {key:'role',label:'Role',sort:u=>u.roleName,cell:u=>u.roleName},
    {key:'customer',label:'Customer',sort:u=>u.customerName||'All customers',csv:u=>(u.customerName||'All customers')+(u.projectCodes.length?' · '+u.projectCodes.join(' '):''),cell:u=><>{u.customerName||'All customers'}{u.projectCodes.length>0&&<span className="muted"> · {u.projectCodes.join(', ')}</span>}</>},
    {key:'status',label:'Status',sort:u=>u.isActive?'Active':'Inactive',cell:u=><Badge tone={u.isActive?'ok':'bad'}>{u.isActive?'Active':'Inactive'}</Badge>},
    {key:'actions',label:'',actions:true,cell:u=>canManage&&<button className="icon" aria-label={'Edit '+u.name} onClick={()=>open(u)}><Pencil/></button>}
  ];
  const save=async()=>{
    if(external&&!form.customerId){setFormError('Choose the customer this user belongs to');return}
    if(!form.roleId){setFormError('Choose a role');return}
    setBusy(true);setFormError('');
    try{
      const body={name:form.name,email:form.email,roleId:form.roleId,customerId:external?form.customerId:null,projectCodes:external?form.projectCodes:[]};
      if(editing==='new')await api.createUser({...body,username:form.username,...(form.password?{password:form.password}:{})});
      else if(editing)await api.updateUser(editing.id,{...body,isActive:form.isActive,resetPassword:form.resetPassword,...(form.password?{password:form.password}:{})});
      toast(editing==='new'?'User created':'User saved');setEditing(null);users.reload();roles.reload();
    }catch(e){setFormError(errMsg(e))}finally{setBusy(false)}
  };
  const toggleProject=(code:string)=>setForm(f=>({...f,projectCodes:f.projectCodes.includes(code)?f.projectCodes.filter(c=>c!==code):[...f.projectCodes,code]}));
  return <>
    <PageHead title="Users & Access"
      action={<>
        {canManage&&<button className="primary" onClick={()=>open('new')}><Plus size={16}/> New user</button>}
      </>}/>
    {users.error&&<p className="loginError">{users.error}</p>}
    {users.loading&&!users.data&&<Loader/>}
    {users.data&&<DataTable filters={<ModernSelect className="pageFilter" ariaLabel="Filter users" searchable value={filter} onChange={setFilter} options={[{value:'all',label:'All users'},{value:'internal',label:'Internal (NyneOS)'},...clients.map(c=>({value:c.id,label:c.name}))]}/>} rows={shown} rowKey={u=>u.id} filename="users" onRefresh={users.reload} loading={users.loading} empty="No users to show." searchText={u=>`${u.name} ${u.username} ${u.email} ${u.roleName} ${u.customerName}`} columns={columns}/>}
    {editing&&<FormModal title={editing==='new'?'New user':'Edit '+editing.name} submitLabel={editing==='new'?'Create user':'Save changes'} busy={busy} error={formError} onClose={()=>setEditing(null)} onSubmit={()=>void save()}>
      <Field label="Full name *"><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required/></Field>
      <Field label="Username *" hint={editing==='new'?'Letters, digits, . _ -':'The username cannot be changed'}><input value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))} disabled={editing!=='new'} required/></Field>
      <Field label="Email"><input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></Field>
      <Field label={editing==='new'?'Password':'New password'} hint={editing==='new'?'Leave blank to use the default password NEWPASSWORD — the user must change it at first sign-in':'Leave blank to keep the current password'}><input type="password" autoComplete="new-password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} minLength={8}/></Field>
      <Field label="User type *"><ModernSelect ariaLabel="User type" value={form.userType} onChange={pickType} options={[{value:'internal',label:'Internal (NyneOS staff)'},{value:'external',label:'External (customer user)'}]}/></Field>
      {external&&<Field label="Customer *"><ModernSelect ariaLabel="Customer" searchable value={form.customerId} onChange={v=>setForm(f=>({...f,customerId:v,roleId:'',projectCodes:[]}))} options={[{value:'',label:'Select customer…'},...clients.map(c=>({value:c.id,label:c.name}))]}/></Field>}
      {(!external||form.customerId)&&<Field label="Role *"><ModernSelect ariaLabel="Role" searchable value={form.roleId} onChange={v=>setForm(f=>({...f,roleId:v}))} options={[{value:'',label:'Select role…'},...typeRoles.map(r=>({value:r.id,label:r.name}))]}/></Field>}
      {external&&form.customerId&&<fieldset className="full projectAccess"><legend>Project access</legend>
        <p className="muted">Leave all unchecked to give access to every project of this customer.</p>
        {customerProjects.length===0&&<p className="muted">This customer has no projects yet.</p>}
        {customerProjects.map(p=><label key={p.uuid} className="checkline"><input type="checkbox" checked={form.projectCodes.includes(p.id)} onChange={()=>toggleProject(p.id)}/> {p.name} <span className="muted">{p.id}</span></label>)}
      </fieldset>}
      {editing!=='new'&&<label className="full checkline"><input type="checkbox" checked={form.resetPassword} onChange={e=>setForm(f=>({...f,resetPassword:e.target.checked}))}/> Reset to the default password (NEWPASSWORD) — the user must change it at next sign-in</label>}
      {editing!=='new'&&<label className="full checkline"><input type="checkbox" checked={form.isActive} disabled={editing.id===me?.id} onChange={e=>setForm(f=>({...f,isActive:e.target.checked}))}/> Active — can sign in</label>}
    </FormModal>}
  </>;
}
