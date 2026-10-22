import{useEffect,useMemo,useState,type ReactNode}from'react';
import{ArrowDown,ArrowUp,ChevronLeft,ChevronRight,Download,RefreshCw,Search}from'lucide-react';
import ModernSelect from'./ModernSelect';

export interface Column<T>{
  key:string;
  label:string;
  /** Makes the header sortable; return the value to compare (numbers compare numerically). */
  sort?:(row:T)=>string|number;
  cell:(row:T)=>ReactNode;
  /** Plain-text value for the CSV download (defaults to the sort value). Omit both to leave the column out. */
  csv?:(row:T)=>string|number;
  /** Action columns have no header text, sorting or export. */
  actions?:boolean;
}

const PAGE_SIZES=[8,25,50,100];

const csvCell=(v:string|number)=>{const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};

// A table with refresh / CSV download / search in the header, sortable columns, striped rows and pagination.
export default function DataTable<T>({rows,columns,rowKey,searchText,onRefresh,loading=false,filename,empty='Nothing to show.',filters}:{
  rows:T[];columns:Column<T>[];rowKey:(row:T)=>string;searchText:(row:T)=>string;onRefresh?:()=>void;loading?:boolean;filename:string;empty?:string;
  /** Dropdown filters shown beside the search box. */
  filters?:ReactNode;
}){
  const[q,setQ]=useState(''),[sort,setSort]=useState<{key:string;dir:1|-1}|null>(null),[page,setPage]=useState(0),[size,setSize]=useState(PAGE_SIZES[0]);
  const needle=q.trim().toLowerCase();
  const view=useMemo(()=>{
    let list=needle?rows.filter(r=>searchText(r).toLowerCase().includes(needle)):rows;
    const col=sort&&columns.find(c=>c.key===sort.key);
    if(col?.sort&&sort){
      const get=col.sort,dir=sort.dir;
      list=[...list].sort((a,b)=>{const x=get(a),y=get(b);return(typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),undefined,{numeric:true,sensitivity:'base'}))*dir});
    }
    return list;
  },[rows,needle,sort,columns,searchText]);
  const pages=Math.max(1,Math.ceil(view.length/size)),current=Math.min(page,pages-1);
  useEffect(()=>{setPage(0)},[needle,sort,size,rows.length]);
  const visible=view.slice(current*size,(current+1)*size),from=view.length?current*size+1:0,to=Math.min(view.length,(current+1)*size);
  const toggleSort=(key:string)=>setSort(s=>!s||s.key!==key?{key,dir:1}:s.dir===1?{key,dir:-1}:null);
  const download=()=>{
    const cols=columns.filter(c=>!c.actions&&(c.csv||c.sort));
    const value=(c:Column<T>,r:T)=>(c.csv??c.sort)!(r);
    const text=[cols.map(c=>csvCell(c.label)).join(','),...view.map(r=>cols.map(c=>csvCell(value(c,r))).join(','))].join('\n');
    const url=URL.createObjectURL(new Blob(['﻿'+text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
    a.href=url;a.download=`${filename}-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
  };
  return <div className="tableWrap">
    <div className="tableBar">
      <div className="tableBarActions">
        {onRefresh&&<button className={'icon'+(loading?' spinning':'')} onClick={onRefresh} aria-label="Refresh" title="Refresh"><RefreshCw/></button>}
        <button className="icon" onClick={download} aria-label="Download CSV" title="Download CSV" disabled={view.length===0}><Download/></button>
      </div>
      <div className="tableBarFind">
      {filters}
      <label className="tableSearch"><Search size={17}/><input type="search" aria-label="Search" placeholder="Search" value={q} onChange={e=>setQ(e.target.value)}/></label>
      </div>
    </div>
    <div className="card tableCard">
    <div className="tableScroll"><table className="dataTable">
      <thead><tr>{columns.map(c=><th key={c.key} aria-sort={sort?.key===c.key?(sort.dir===1?'ascending':'descending'):undefined}>
        {c.sort?<button className="sortBtn" onClick={()=>toggleSort(c.key)}>{c.label}{sort?.key===c.key&&sort.dir===-1?<ArrowDown size={15}/>:<ArrowUp size={15} className={sort?.key===c.key?'on':''}/>}</button>:c.label}
      </th>)}</tr></thead>
      <tbody>{visible.map(r=><tr key={rowKey(r)}>{columns.map(c=><td key={c.key} data-label={c.actions?undefined:c.label} className={c.actions?'rowActions':undefined}>{c.cell(r)}</td>)}</tr>)}</tbody>
    </table></div>
    {view.length===0&&<p className="emptyNote">{rows.length===0?empty:'No results match your search.'}</p>}
    <div className="tableFoot">
      <div className="pageSize"><span>Show</span><ModernSelect className="pageSizeSelect" ariaLabel="Rows per page" value={String(size)} onChange={v=>setSize(Number(v))} options={PAGE_SIZES.map(n=>({value:String(n),label:String(n)}))}/><span>entries</span></div>
      <div className="pageNav">
        <button className="pageBtn" disabled={current===0} onClick={()=>setPage(current-1)}><ChevronLeft size={15}/> Previous</button>
        <span>Page <b>{current+1}</b> of <b>{pages}</b></span>
        <button className="pageBtn" disabled={current>=pages-1} onClick={()=>setPage(current+1)}>Next <ChevronRight size={15}/></button>
      </div>
      <span className="pageInfo">Showing <b>{from}</b> to <b>{to}</b> of <b>{view.length}</b> entries</span>
    </div>
    </div>
  </div>;
}
