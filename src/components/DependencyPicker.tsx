import{useState}from'react';
import{X}from'lucide-react';
import type{Task}from'../types/task';
import ModernSelect from'./ModernSelect';

/** Tasks that (transitively) depend on `key` — they cannot become its dependency without a cycle. */
export function dependents(tasks:Task[],key:string){
  const found=new Set<string>(),queue=[key];
  while(queue.length){
    const current=queue.pop()!;
    for(const t of tasks)if((t.dependsOn??[]).includes(current)&&!found.has(t.key)){found.add(t.key);queue.push(t.key)}
  }
  return found;
}

export default function DependencyPicker({tasks,selected,custom,onChange,onCustomChange,disabled=false}:{
  tasks:Task[];
  selected:string[];
  custom:string[];
  onChange:(keys:string[])=>void;
  onCustomChange:(values:string[])=>void;
  disabled?:boolean;
}){
  const[draft,setDraft]=useState('');
  const label=(key:string)=>{const t=tasks.find(task=>task.key===key);return t?`${t.key} · ${t.summary}`:key};
  const available=tasks.filter(t=>!selected.includes(t.key));
  const addCustom=()=>{
    const value=draft.trim();
    if(value&&!custom.includes(value))onCustomChange([...custom,value]);
    setDraft('');
  };
  return <div className="dependencyPicker">
    {(selected.length>0||custom.length>0)&&<div className="dependencyChips">
      {selected.map(key=><span className="dependencyChip" key={key} title={label(key)}>
        <b>{key}</b><em>{tasks.find(t=>t.key===key)?.summary}</em>
        {!disabled&&<button type="button" aria-label={`Remove dependency ${key}`} onClick={()=>onChange(selected.filter(k=>k!==key))}><X/></button>}
      </span>)}
      {custom.map(value=><span className="dependencyChip custom" key={value} title={value}>
        <b>Custom</b><em>{value}</em>
        {!disabled&&<button type="button" aria-label={`Remove dependency ${value}`} onClick={()=>onCustomChange(custom.filter(v=>v!==value))}><X/></button>}
      </span>)}
    </div>}
    {!disabled&&<>
      <ModernSelect
        ariaLabel="Add task dependency"
        searchable
        value=""
        options={[{value:'',label:available.length?'Select a task from this project…':'No other tasks in this project'},...available.map(t=>({value:t.key,label:`${t.key} · ${t.summary}`}))]}
        onChange={key=>{if(key)onChange([...selected,key])}}
      />
      <div className="customDependency">
        <input
          value={draft}
          maxLength={200}
          placeholder="Or type a custom dependency (e.g. Approval from BMC Bank)"
          aria-label="Custom dependency"
          onChange={event=>setDraft(event.target.value)}
          onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();addCustom()}}}
        />
        <button type="button" className="pill" onClick={addCustom} disabled={!draft.trim()}>Add</button>
      </div>
    </>}
  </div>;
}
