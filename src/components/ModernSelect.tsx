import{useEffect,useId,useRef,useState}from'react';
import{createPortal}from'react-dom';
import{Check,ChevronDown,Search}from'lucide-react';

export interface SelectOption{value:string;label:string}

export default function ModernSelect({
  value,options,onChange,ariaLabel,className='',disabled=false,searchable=false
}:{
  value:string;
  options:SelectOption[];
  onChange:(value:string)=>void;
  ariaLabel:string;
  className?:string;
  disabled?:boolean;
  /** Adds a search box at the top of the menu that filters the options by label. */
  searchable?:boolean;
}){
  const[open,setOpen]=useState(false);
  const[activeIndex,setActiveIndex]=useState(()=>Math.max(0,options.findIndex(option=>option.value===value)));
  const root=useRef<HTMLDivElement>(null);
  const menu=useRef<HTMLDivElement>(null);
  const[pos,setPos]=useState<{left:number;top:number;width:number;maxHeight:number;up:boolean}|null>(null);
  const searchRef=useRef<HTMLInputElement>(null);
  const[query,setQuery]=useState('');
  const listId=useId();
  const selected=options.find(option=>option.value===value)??options[0];
  const needle=query.trim().toLowerCase();
  // The empty-value entry is the prompt ("Select a task…"), so it is not a search result.
  const visible=searchable&&needle?options.filter(option=>option.value!==''&&option.label.toLowerCase().includes(needle)):options;

  useEffect(()=>{
    const close=(event:MouseEvent)=>{const t=event.target as Node;if(!root.current?.contains(t)&&!menu.current?.contains(t))setOpen(false)};
    document.addEventListener('mousedown',close);
    return()=>document.removeEventListener('mousedown',close);
  },[]);

  useEffect(()=>{
    setActiveIndex(Math.max(0,options.findIndex(option=>option.value===value)));
  },[value,options]);

  useEffect(()=>{
    if(!open)return;
    const place=()=>{
      const r=root.current?.getBoundingClientRect();
      if(!r)return;
      const below=window.innerHeight-r.bottom-18;
      const above=r.top-18;
      const up=below<200&&above>below;
      setPos({left:r.left,top:up?r.top-8:r.bottom+8,width:r.width,maxHeight:Math.max(120,Math.min(260,up?above:below)),up});
    };
    place();
    const onScroll=(e:Event)=>{if(!menu.current?.contains(e.target as Node))place()};
    window.addEventListener('resize',place);
    window.addEventListener('scroll',onScroll,true);
    return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',onScroll,true)};
  },[open]);

  useEffect(()=>{setOpen(false)},[value]);

  useEffect(()=>{
    if(!open||!searchable)return;
    setQuery('');
    const id=setTimeout(()=>searchRef.current?.focus(),0);
    return()=>clearTimeout(id);
  },[open,searchable]);

  useEffect(()=>{if(searchable)setActiveIndex(0)},[query,searchable]);

  useEffect(()=>{if(disabled)setOpen(false)},[disabled]);

  const choose=(index:number)=>{
    const option=visible[index];
    if(!option||disabled)return;
    setOpen(false);
    setActiveIndex(index);
    onChange(option.value);
  };

  const handleKey=(event:React.KeyboardEvent<HTMLElement>)=>{
    if(disabled)return;
    if(event.key==='Escape'){setOpen(false);return}
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();
      if(!open){setOpen(true);return}
      setActiveIndex(current=>{
        const direction=event.key==='ArrowDown'?1:-1;
        return visible.length?(current+direction+visible.length)%visible.length:0;
      });
    }
    if((event.key==='Enter'||event.key===' ')&&open){
      event.preventDefault();
      choose(activeIndex);
    }
  };

  return <div className={`modernSelect ${disabled?'disabled ':''}${className}`} ref={root} onPointerDown={event=>event.stopPropagation()}>
    <button
      type="button"
      disabled={disabled}
      className={open?'modernSelectTrigger open':'modernSelectTrigger'}
      aria-label={ariaLabel}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={listId}
      onClick={()=>{if(!disabled)setOpen(current=>!current)}}
      onKeyDown={handleKey}
    >
      <span>{selected?.label}</span>
      <ChevronDown/>
    </button>
    {open&&!disabled&&pos&&createPortal(<div ref={menu} className="modernSelectMenu" style={{position:'fixed',zIndex:2000,left:pos.left,width:pos.width,maxHeight:pos.maxHeight,top:pos.up?'auto':pos.top,bottom:pos.up?window.innerHeight-pos.top:'auto'}} id={listId} role="listbox" aria-label={ariaLabel}>
      {searchable&&<div className="modernSelectSearch">
        <Search/>
        <input
          ref={searchRef}
          value={query}
          placeholder="Search…"
          aria-label={`Search ${ariaLabel}`}
          onChange={event=>setQuery(event.target.value)}
          onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'||event.key==='Enter'||event.key==='Escape')handleKey(event)}}
        />
      </div>}
      {searchable&&visible.length===0&&<p className="modernSelectEmpty">No matches</p>}
      {visible.map((option,index)=><button type="button" role="option" aria-selected={option.value===value} className={option.value===value?'modernSelectOption selected':index===activeIndex?'modernSelectOption active':'modernSelectOption'} key={option.value} onMouseEnter={()=>setActiveIndex(index)} onClick={event=>{event.stopPropagation();choose(index)}}>
        <span>{option.label}</span>{option.value===value&&<Check/>}
      </button>)}
    </div>,document.body)}
  </div>;
}
