import{importFresh}from'../utils/lazy';
import{useMemo,useState}from'react';
import{addDays,format,subDays}from'date-fns';
import MultiSelect from'./MultiSelect';
import{errMsg,Field,FormModal}from'../pages/ui';
import type{Task}from'../types/task';
import{projectColor,projectName}from'../utils/projects';
import{useTaskStore}from'../store/useTaskStore';

type Team='all'|'nyneos'|'customer';
const iso=(d:Date)=>format(d,'yyyy-MM-dd');
// The report starts from the range the timeline shows on screen (a week back, four weeks wide).
const defaults=(anchor:Date)=>({from:iso(subDays(anchor,7)),to:iso(addDays(anchor,20))});

// "Report" popup on the calendar: same view / team switches as the calendar, then a slide-deck PDF (Day, Week and Month timelines) for the chosen dates.
export default function CalendarReportModal({tasks,team:initialTeam,anchor,customerName,customerLabel,onClose}:{tasks:Task[];team:Team;anchor:Date;customerName:string;customerLabel:string;onClose:()=>void}){
  const milestones=useTaskStore(s=>s.milestones),view='timeline',[team,setTeam]=useState(initialTeam),[range,setRange]=useState(()=>defaults(anchor)),[projects,setProjects]=useState<string[]>([]),[picked,setPicked]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const byTeam=useMemo(()=>tasks.filter(t=>team==='all'?true:team==='customer'?t.team==='bmc':t.team!=='bmc'),[tasks,team]);
  const projectOptions=useMemo(()=>[...new Set(tasks.map(t=>t.project))].map(p=>({value:p,label:projectName(p)})).sort((a,b)=>a.label.localeCompare(b.label)),[tasks]);
  // Task choices follow the project filter; a task picked earlier is dropped when its project is unticked.
  const taskOptions=useMemo(()=>byTeam.filter(t=>!projects.length||projects.includes(t.project)).sort((a,b)=>a.key.localeCompare(b.key,undefined,{numeric:true})).map(t=>({value:t.key,label:`${t.key} · ${t.summary}`})),[byTeam,projects]);
  const shown=useMemo(()=>byTeam.filter(t=>(!projects.length||projects.includes(t.project))&&(!picked.length||picked.includes(t.key))),[byTeam,projects,picked]);
  const count=shown.filter(t=>t.dueDate&&t.dueDate>=range.from&&t.dueDate<=range.to).length;
  const download=async()=>{
    setBusy(true);setError('');
    try{
      const{downloadTimelineDeck}=await importFresh(()=>import('../utils/timelineDeck'));
      await downloadTimelineDeck(shown,{title:'Timeline Report',customerName,...range,teamLabel:team==='all'?'All teams':team==='nyneos'?'NyneOS':customerLabel,projectName,projectColor,
        milestones:milestones.map(m=>({title:m.title,date:m.date,customer:m.customerName}))},`timeline-${format(new Date(),'yyyy-MM-dd')}.pdf`);
      onClose();
    }catch(e){setError(errMsg(e))}finally{setBusy(false)}
  };
  const teams:[Team,string,number][]=[['all','All',tasks.length],['nyneos','NyneOS',tasks.filter(t=>t.team!=='bmc').length],['customer',customerLabel,tasks.filter(t=>t.team==='bmc').length]];
  return <FormModal className="reportModal" title="Download timeline" submitLabel="Download PDF" busy={busy} error={error} onClose={onClose} onSubmit={()=>void download()}>
    <div className="full calendarTools reportTools">
      <div className="rangeTabs" role="tablist" aria-label="Filter by team">
        {teams.map(([k,label,n])=><button type="button" key={k} role="tab" aria-selected={team===k} className={team===k?'active':''} onClick={()=>setTeam(k)}>{label}<b>{n}</b></button>)}
      </div>
    </div>
    <Field label="From"><input type="date" value={range.from} max={range.to||undefined} onChange={e=>setRange(r=>({...r,from:e.target.value}))}/></Field>
    <Field label="To"><input type="date" value={range.to} min={range.from||undefined} onChange={e=>setRange(r=>({...r,to:e.target.value}))}/></Field>
    <Field label="Project" full><MultiSelect ariaLabel="Project" placeholder="All projects" allLabel="All projects" values={projects} onChange={v=>{setProjects(v);setPicked(p=>p.filter(k=>tasks.some(t=>t.key===k&&(!v.length||v.includes(t.project)))))}} options={projectOptions}/></Field>
    <Field label="Task" full><MultiSelect ariaLabel="Task" placeholder="All tasks" allLabel="All tasks" values={picked} onChange={setPicked} options={taskOptions}/></Field>
    <p className="full reportSummary"><b>{count}</b> task{count===1?'':'s'} due in this {view} report{milestones.some(m=>m.date>=range.from&&m.date<=range.to)&&` · ${milestones.filter(m=>m.date>=range.from&&m.date<=range.to).length} milestone${milestones.filter(m=>m.date>=range.from&&m.date<=range.to).length===1?'':'s'}`}</p>
  </FormModal>;
}
