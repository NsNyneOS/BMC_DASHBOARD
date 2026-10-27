import{importFresh}from'../utils/lazy';
import{useMemo,useState}from'react';
import{addDays,addMonths,endOfMonth,format,startOfMonth,subDays}from'date-fns';
import{errMsg,Field,FormModal}from'../pages/ui';
import type{Task}from'../types/task';
import{projectColor,projectName}from'../utils/projects';
import type{CalendarView}from'../utils/calendarPdf';

type Team='all'|'nyneos'|'customer';
const iso=(d:Date)=>format(d,'yyyy-MM-dd');
// The range each view shows on screen, starting from the date the calendar is on.
const defaults=(view:CalendarView,anchor:Date)=>view==='timeline'
  ?{from:iso(subDays(anchor,7)),to:iso(addDays(anchor,20))}
  :view==='month'?{from:iso(startOfMonth(anchor)),to:iso(endOfMonth(addMonths(anchor,3)))}
  :{from:iso(startOfMonth(anchor)),to:iso(endOfMonth(anchor))};

// "Report" popup on the calendar: same view / team switches as the calendar, then a PDF of that view for the chosen dates.
export default function CalendarReportModal({tasks,view:initial,team:initialTeam,anchor,customerName,customerLabel,onClose}:{tasks:Task[];view:CalendarView;team:Team;anchor:Date;customerName:string;customerLabel:string;onClose:()=>void}){
  const[view,setView]=useState(initial),[team,setTeam]=useState(initialTeam),[range,setRange]=useState(()=>defaults(initial,anchor)),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const shown=useMemo(()=>tasks.filter(t=>team==='all'?true:team==='customer'?t.team==='bmc':t.team!=='bmc'),[tasks,team]);
  const count=shown.filter(t=>t.dueDate&&t.dueDate>=range.from&&t.dueDate<=range.to).length;
  const pick=(v:CalendarView)=>{setView(v);setRange(defaults(v,anchor))};
  const download=async()=>{
    setBusy(true);setError('');
    try{
      const{downloadCalendarPdf}=await importFresh(()=>import('../utils/calendarPdf'));
      await downloadCalendarPdf(shown,{view,...range,title:`Calendar report - ${view[0].toUpperCase()+view.slice(1)}`,subtitle:`${customerName}   |   Generated ${format(new Date(),'dd MMM yyyy, HH:mm')}`,
        teamLabel:team==='all'?'All teams':team==='nyneos'?'NyneOS':customerLabel,projectName,projectColor,customerLabel},`calendar-${view}-${format(new Date(),'yyyy-MM-dd')}.pdf`);
      onClose();
    }catch(e){setError(errMsg(e))}finally{setBusy(false)}
  };
  const teams:[Team,string,number][]=[['all','All',tasks.length],['nyneos','NyneOS',tasks.filter(t=>t.team!=='bmc').length],['customer',customerLabel,tasks.filter(t=>t.team==='bmc').length]];
  return <FormModal className="reportModal" title="Download calendar" submitLabel="Download PDF" busy={busy} error={error} onClose={onClose} onSubmit={()=>void download()}>
    <div className="full calendarTools reportTools">
      <div className="rangeTabs" role="tablist" aria-label="Filter by team">
        {teams.map(([k,label,n])=><button type="button" key={k} role="tab" aria-selected={team===k} className={team===k?'active':''} onClick={()=>setTeam(k)}>{label}<b>{n}</b></button>)}
      </div>
      <div className="segments">
        {(['timeline','month','week'] as const).map(v=><button type="button" key={v} className={view===v?'active':''} onClick={()=>pick(v)}>{v}</button>)}
      </div>
    </div>
    <Field label="From"><input type="date" value={range.from} max={range.to||undefined} onChange={e=>setRange(r=>({...r,from:e.target.value}))}/></Field>
    <Field label="To"><input type="date" value={range.to} min={range.from||undefined} onChange={e=>setRange(r=>({...r,to:e.target.value}))}/></Field>
    <p className="full reportSummary"><b>{count}</b> task{count===1?'':'s'} due in this {view} report</p>
  </FormModal>;
}
