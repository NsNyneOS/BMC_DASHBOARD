import{useEffect,useId,useRef,useState}from'react';
import{createPortal}from'react-dom';
import{Check,ChevronDown,Search}from'lucide-react';
import type{SelectOption}from'./ModernSelect';

// Same look as ModernSelect, but several options can be ticked; the menu stays open while you pick.
export default function MultiSelect({values,options,onChange,ariaLabel,placeholder='None',emptyText='Nothing to choose',searchable=true,disabled=false}:{
  values:string[];options:SelectOption[];onChange:(values:string[])=>void;ariaLabel:string;placeholder?:string;emptyText?:string;searchable?:boolean;disabled?:boolean;
}){
  const[open,setOpen]=useState(false),[query,setQuery]=useState('');
  const root=useRef<HTMLDivElement>(null),menu=useRef<HTMLDivElement>(null),searchRef=useRef<HTMLInputElement>(null);
  const[pos,setPos]=useState<{left:number;top:number;width:number;maxHeight:number;up:boolean}|null>(null);
  const listId=useId();
  const chosen=options.filter(o=>values.includes(o.value));
  const needle=query.trim().toLowerCase(),visible=needle?options.filter(o=>o.label.toLowerCase().includes(needle)):options;

  useEffect(()=>{
    const close=(e:MouseEvent)=>{const t=e.target as Node;if(!root.current?.contains(t)&&!menu.current?.contains(t))setOpen(false)};
    document.addEventListener('mousedown',close);
    return()=>document.removeEventListener('mousedown',close);
  },[]);
  useEffect(()=>{
    if(!open)return;
    const place=()=>{
      const r=root.current?.getBoundingClientRect();if(!r)return;
      const below=window.innerHeight-r.bottom-18,above=r.top-18,up=below<220&&above>below;
      setPos({left:r.left,top:up?r.top-8:r.bottom+8,width:r.width,maxHeight:Math.max(140,Math.min(300,up?above:below)),up});
    };
    place();
    const onScroll=(e:Event)=>{if(!menu.current?.contains(e.target as Node))place()};
    window.addEventListener('resize',place);window.addEventListener('scroll',onScroll,true);
    return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',onScroll,true)};
  },[open]);
  useEffect(()=>{if(open&&searchable){setQuery('');const id=setTimeout(()=>searchRef.current?.focus(),0);return()=>clearTimeout(id)}},[open,searchable]);
  useEffect(()=>{if(disabled)setOpen(false)},[disabled]);

  const toggle=(v:string)=>onChange(values.includes(v)?values.filter(x=>x!==v):[...values,v]);
  const onKey=(e:React.KeyboardEvent)=>{if(e.key==='Escape'&&open){e.stopPropagation();setOpen(false)}};

  return <div className={'modernSelect'+(disabled?' disabled':'')} ref={root} onPointerDown={e=>e.stopPropagation()}>
    <button type="button" disabled={disabled} className={open?'modernSelectTrigger open':'modernSelectTrigger'} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} onClick={()=>{if(!disabled)setOpen(o=>!o)}} onKeyDown={onKey}>
      {chosen.length===0?<span className="placeholderText">{placeholder}</span>:<span className="msChips">{chosen.slice(0,2).map(o=><i key={o.value} className="msChip">{o.label}</i>)}{chosen.length>2&&<i className="msChip more">+{chosen.length-2}</i>}</span>}<ChevronDown/>
    </button>
    {open&&!disabled&&pos&&createPortal(<div ref={menu} id={listId} role="listbox" aria-multiselectable="true" aria-label={ariaLabel} className="modernSelectMenu" onKeyDown={onKey} style={{position:'fixed',zIndex:2000,left:pos.left,width:pos.width,maxHeight:pos.maxHeight,top:pos.up?'auto':pos.top,bottom:pos.up?window.innerHeight-pos.top:'auto'}}>
      {searchable&&<div className="modernSelectSearch"><Search/><input ref={searchRef} value={query} placeholder="Search…" aria-label={`Search ${ariaLabel}`} onChange={e=>setQuery(e.target.value)} onKeyDown={onKey}/></div>}
      {options.length===0&&<p className="modernSelectEmpty">{emptyText}</p>}
      {options.length>0&&visible.length===0&&<p className="modernSelectEmpty">No matches</p>}
      {visible.map(o=>{const on=values.includes(o.value);return <button type="button" role="option" aria-selected={on} key={o.value} className={on?'modernSelectOption selected':'modernSelectOption'} onClick={e=>{e.stopPropagation();toggle(o.value)}}>
        <span className={'msBox'+(on?' on':'')}>{on&&<Check/>}</span><span className="msLabel">{o.label}</span>
      </button>})}
      {values.length>0&&<button type="button" className="multiClear" onClick={()=>onChange([])}>Clear selection</button>}
    </div>,document.body)}
  </div>;
}
