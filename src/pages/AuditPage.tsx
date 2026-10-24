import{useState}from'react';
import{format}from'date-fns';
import{api,type AuditEntry}from'../api/client';
import DataTable,{type Column}from'../components/DataTable';
import ModernSelect from'../components/ModernSelect';
import Loader from'../components/Loader';
import{FormModal,Badge,PageHead,useLoad}from'./ui';

const tone={create:'ok',update:'info',delete:'bad'}as const;
const entityLabel:Record<string,string>={tasks:'Task',projects:'Project',customers:'Customer',users:'User',roles:'Role',auth:'Account'};
const when=(d:string)=>format(new Date(d),'MMM d, yyyy HH:mm:ss');
const show=(v:unknown)=>typeof v==='string'?v:JSON.stringify(v);
const pairs=(e:AuditEntry)=>Object.entries(e.detail??{});
const target=(e:AuditEntry)=>e.label||(e.entityId?e.entityId.slice(0,8):'—');

// Who changed what and when. Every create / update / delete made through the API is listed, newest first.
export default function AuditPage(){
  const log=useLoad(()=>api.audit()),[entity,setEntity]=useState('all'),[open,setOpen]=useState<AuditEntry|null>(null);
  const rows=(log.data??[]).filter(e=>entity==='all'||e.entity===entity);
  const columns:Column<AuditEntry>[]=[
    {key:'when',label:'When',sort:e=>e.createdAt,csv:e=>e.createdAt,cell:e=><span className="nowrap">{when(e.createdAt)}</span>},
    {key:'user',label:'User',sort:e=>e.userName,cell:e=>e.userName||'—'},
    {key:'action',label:'Action',sort:e=>e.action,cell:e=><Badge tone={tone[e.action]}>{e.action}</Badge>},
    {key:'entity',label:'Area',sort:e=>entityLabel[e.entity]??e.entity,cell:e=>entityLabel[e.entity]??e.entity},
    {key:'target',label:'Record',sort:target,cell:e=><strong>{target(e)}</strong>},
    {key:'detail',label:'Details',csv:e=>pairs(e).map(([k,v])=>`${k}: ${show(v)}`).join('; '),cell:e=>{const p=pairs(e);return p.length?<span className="auditSummary">{p.slice(0,3).map(([k])=>k).join(', ')}{p.length>3?` +${p.length-3}`:''}</span>:'—'}},
    {key:'actions',label:'',actions:true,cell:e=><button className="pill wide" onClick={()=>setOpen(e)}>View</button>}
  ];
  return <>
    <PageHead title="Audit"/>
    {log.error&&<p className="loginError">{log.error}</p>}
    {log.loading&&!log.data&&<Loader/>}
    {log.data&&<DataTable filters={<ModernSelect className="pageFilter" ariaLabel="Filter by area" value={entity} onChange={setEntity} options={[{value:'all',label:'All areas'},...Object.entries(entityLabel).map(([value,label])=>({value,label}))]}/>} rows={rows} rowKey={e=>e.id} filename="audit" onRefresh={log.reload} loading={log.loading} empty="Nothing has been recorded yet." searchText={e=>`${e.userName} ${e.action} ${entityLabel[e.entity]??e.entity} ${target(e)} ${JSON.stringify(e.detail)}`} columns={columns}/>}
    {open&&<FormModal title="Audit detail" submitLabel="Close" onClose={()=>setOpen(null)} onSubmit={()=>setOpen(null)}>
      <dl className="auditDetail full">
        <dt>When</dt><dd>{when(open.createdAt)}</dd>
        <dt>User</dt><dd>{open.userName||'—'}</dd>
        <dt>Action</dt><dd>{open.action} · {entityLabel[open.entity]??open.entity} · {target(open)}</dd>
        {pairs(open).map(([k,v])=><div key={k} className="auditRow"><dt>{k}</dt><dd>{show(v)}</dd></div>)}
        {pairs(open).length===0&&<><dt>Changes</dt><dd>No field data was recorded.</dd></>}
      </dl>
    </FormModal>}
  </>;
}
