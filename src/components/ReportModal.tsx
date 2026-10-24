import{useMemo,useState}from'react';
import{format}from'date-fns';
import ModernSelect from'./ModernSelect';
import MultiSelect from'./MultiSelect';
import{errMsg,Field,FormModal}from'../pages/ui';
import type{ProjectMeta}from'../api/client';
import type{Task}from'../types/task';
import{buildReport,periodRange,priorityLabel,statusLabel,type Period,type ReportFilters}from'../utils/report';

const periods:{value:Period;label:string}[]=[{value:'all',label:'All time'},{value:'today',label:'Today'},{value:'week',label:'This week'},{value:'month',label:'This month'},{value:'custom',label:'Custom range'}];
const opts=<K extends string>(m:Record<K,string>)=>(Object.keys(m) as K[]).map(k=>({value:k,label:m[k]}));
const teamLabel=(t:ReportFilters['team'],customer:string)=>t==='all'?'All teams':t==='nyneos'?'NyneOS':customer;

// "Report" popup on the dashboard: pick what to include, get a PDF (accomplished items, items per stage, progress).
export default function ReportModal({tasks,projects,customerName,onClose}:{tasks:Task[];projects:ProjectMeta[];customerName:string;onClose:()=>void}){
  const[f,setF]=useState<ReportFilters>({period:'month',...periodRange('month'),projects:[],priority:[],status:[],team:'all'}),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const name=(code:string)=>projects.find(p=>p.id===code)?.name??code;
  const set=<K extends keyof ReportFilters>(k:K,v:ReportFilters[K])=>setF(x=>({...x,[k]:v}));
  const report=useMemo(()=>buildReport(tasks,f,name),[tasks,f,projects]);// eslint-disable-line react-hooks/exhaustive-deps
  const customerSide=projects[0]?.customerName||'Customer';

  const download=async()=>{
    setBusy(true);setError('');
    try{
      const{downloadReportPdf}=await import('../utils/reportPdf');
      const range=f.from||f.to?`${f.from||'start'} to ${f.to||'today'}`:'All time';
      const lines=[
        `Period: ${periods.find(p=>p.value===f.period)?.label}${f.period==='all'?'':` (${range})`}`,
        `Projects: ${f.projects.length?f.projects.map(name).join(', '):'All'}   |   Priority: ${f.priority.length?f.priority.map(p=>priorityLabel[p as keyof typeof priorityLabel]).join(', '):'All'}   |   Status: ${f.status.length?f.status.map(s=>statusLabel[s as keyof typeof statusLabel]).join(', '):'All'}   |   Team: ${teamLabel(f.team,customerSide)}`
      ];
      await downloadReportPdf(report,{title:'Project Status Report',subtitle:`${customerName}   |   Generated ${format(new Date(),'dd MMM yyyy, HH:mm')}`,filterLines:lines,
        accomplishedLabel:report.accomplishedBy==='bmc'?customerSide:'NyneOS',projectName:name},`project-report-${format(new Date(),'yyyy-MM-dd')}.pdf`);
      onClose();
    }catch(e){setError(errMsg(e))}finally{setBusy(false)}
  };

  return <FormModal className="reportModal" title="Download report" submitLabel="Download PDF" busy={busy} error={error} onClose={onClose} onSubmit={()=>void download()}>
    <Field label="Date period"><ModernSelect ariaLabel="Date period" searchable={false} value={f.period} onChange={v=>setF(x=>({...x,period:v as Period,...(v==='custom'?{}:periodRange(v as Period))}))} options={periods}/></Field>
    <Field label="Team"><ModernSelect ariaLabel="Team" value={f.team} onChange={v=>set('team',v as ReportFilters['team'])} options={[{value:'all',label:'All teams'},{value:'nyneos',label:'NyneOS'},{value:'bmc',label:customerSide}]}/></Field>
    <Field label="From"><input type="date" value={f.from} max={f.to||undefined} onChange={e=>setF(x=>({...x,from:e.target.value,period:'custom'}))}/></Field>
    <Field label="To"><input type="date" value={f.to} min={f.from||undefined} onChange={e=>setF(x=>({...x,to:e.target.value,period:'custom'}))}/></Field>
    <Field label="Project" full><MultiSelect ariaLabel="Project" placeholder="All projects" allLabel="All projects" values={f.projects} onChange={v=>set('projects',v)} options={projects.filter(p=>p.status!=='archived').map(p=>({value:p.id,label:p.name}))}/></Field>
    <Field label="Priority"><MultiSelect ariaLabel="Priority" placeholder="All priorities" allLabel="All priorities" searchable={false} values={f.priority} onChange={v=>set('priority',v)} options={opts(priorityLabel)}/></Field>
    <Field label="Status"><MultiSelect ariaLabel="Status" placeholder="All statuses" allLabel="All statuses" searchable={false} values={f.status} onChange={v=>set('status',v)} options={opts(statusLabel)}/></Field>
    <p className="full reportSummary"><b>{report.tasks.length}</b> task{report.tasks.length===1?'':'s'} in this report &middot; <b>{report.accomplished.length}</b> accomplished by {report.accomplishedBy==='bmc'?customerSide:'NyneOS'}</p>
  </FormModal>;
}
