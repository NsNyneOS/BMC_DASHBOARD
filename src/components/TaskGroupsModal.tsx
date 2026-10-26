import{useState}from'react';
import{format}from'date-fns';
import{FormModal}from'../pages/ui';
import type{Priority,Task}from'../types/task';
import{priorityLabel,statusLabel}from'../utils/report';
import{projectColor,projectName}from'../utils/projects';
import{groupByProject}from'../utils/today';
import{ADVICE,NAME,TONE,stats,type AlertItem}from'./AlertsCarousel';

const tone:Record<Priority,string>={highest:'bad',high:'bad',medium:'warn',low:'neutral',lowest:'neutral'};

// Drill-down behind an alert: one row per task, a small project filter beside the count; click a row to open the task.
export default function TaskGroupsModal({title,tasks,alert,initialProject,onClose,onOpen,onOpenProject}:{title:string;tasks:Task[];alert?:AlertItem;initialProject?:string;onClose:()=>void;onOpen:(t:Task)=>void;onOpenProject?:(project:string,view:'activities'|'alerts')=>void}){
  const groups=groupByProject(tasks),[project,setProject]=useState<string>(initialProject&&groups.some(g=>g.code===initialProject)?initialProject:'all');
  const shown=(project==='all'?groups:groups.filter(g=>g.code===project)).flatMap(g=>g.tasks),today=format(new Date(),'yyyy-MM-dd');
  return <FormModal className="todayModal" title={title} submitLabel="Close" hideCancel onClose={onClose} onSubmit={onClose}>
    <div className="full todayDetail">
      {alert&&<div className="alertCols">
        <div className="alertBox">
          <h4>Overview</h4>
          <div className="alertStats">{stats(alert).map(x=><div key={x.label} className={'alertStat'+(x.warn?' warn':'')}><b>{x.value}</b><span>{x.label}</span></div>)}</div>
        </div>
        <div className="alertBox">
          <h4>Recommended action</h4>
          <p className="alertNote">{alert.advice??ADVICE[alert.severity]??ADVICE.info}</p>
          {alert.scope!=='global'&&onOpenProject&&<div className="alertActions">
            <button type="button" className="pill wide" onClick={()=>onOpenProject(alert.project,'activities')}>Project activities</button>
            <button type="button" className="pill wide" onClick={()=>onOpenProject(alert.project,'alerts')}>All alerts for this project</button>
          </div>}
        </div>
      </div>}
      <div className="drillBar">
        <span className="alertCaption">{shown.length} task{shown.length===1?'':'s'}</span>
        {groups.length>1&&<div className="rangeTabs alertChips" role="tablist" aria-label="Filter by project">
          <button role="tab" aria-selected={project==='all'} className={project==='all'?'active':''} onClick={()=>setProject('all')}>All<b>{tasks.length}</b></button>
          {groups.map(g=><button key={g.code} role="tab" aria-selected={project===g.code} className={project===g.code?'active':''} onClick={()=>setProject(g.code)}>{projectName(g.code)}<b>{g.count}</b></button>)}
        </div>}
      </div>
      <div className="drillList">
        {shown.map(t=>{const late=!!t.dueDate&&t.status!=='done'&&t.dueDate<today;
          return <button type="button" key={t.id} className="drillRow" onClick={()=>onOpen(t)}>
            <i className="drillDot" style={{background:projectColor(t.project)}}/>
            <span className="drillMain"><strong>{t.summary}</strong>{t.description&&<small>{t.description}</small>}</span>
            <span className="drillSide">
              <span className={'badge '+tone[t.priority]}>{priorityLabel[t.priority]}</span>
              <span className="drillMeta">{t.key} · {projectName(t.project)} · {statusLabel[t.status]}</span>
              <span className={'drillDue'+(late?' overdue':'')}>{t.dueDate?format(new Date(`${t.dueDate}T12:00:00`),'MMM d'):'No date'}</span>
            </span>
          </button>})}
      </div>
    </div>
  </FormModal>;
}
