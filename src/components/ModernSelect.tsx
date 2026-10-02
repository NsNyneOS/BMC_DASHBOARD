import{useEffect,useId,useRef,useState}from'react';
import{Check,ChevronDown}from'lucide-react';

export interface SelectOption{value:string;label:string}

export default function ModernSelect({
  value,options,onChange,ariaLabel,className='',disabled=false
}:{
  value:string;
  options:SelectOption[];
  onChange:(value:string)=>void;
  ariaLabel:string;
  className?:string;
  disabled?:boolean;
}){
  const[open,setOpen]=useState(false);
  const[activeIndex,setActiveIndex]=useState(()=>Math.max(0,options.findIndex(option=>option.value===value)));
  const root=useRef<HTMLDivElement>(null);
  const listId=useId();
  const selected=options.find(option=>option.value===value)??options[0];

  useEffect(()=>{
    const close=(event:MouseEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};
    document.addEventListener('mousedown',close);
    return()=>document.removeEventListener('mousedown',close);
  },[]);

  useEffect(()=>{
    setActiveIndex(Math.max(0,options.findIndex(option=>option.value===value)));
  },[value,options]);

  useEffect(()=>{setOpen(false)},[value]);

  useEffect(()=>{if(disabled)setOpen(false)},[disabled]);

  const choose=(index:number)=>{
    const option=options[index];
    if(!option||disabled)return;
    setOpen(false);
    setActiveIndex(index);
    onChange(option.value);
  };

  const handleKey=(event:React.KeyboardEvent<HTMLButtonElement>)=>{
    if(disabled)return;
    if(event.key==='Escape'){setOpen(false);return}
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();
      if(!open){setOpen(true);return}
      setActiveIndex(current=>{
        const direction=event.key==='ArrowDown'?1:-1;
        return(current+direction+options.length)%options.length;
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
    {open&&!disabled&&<div className="modernSelectMenu" id={listId} role="listbox" aria-label={ariaLabel}>
      {options.map((option,index)=><button type="button" role="option" aria-selected={option.value===value} className={option.value===value?'modernSelectOption selected':index===activeIndex?'modernSelectOption active':'modernSelectOption'} key={option.value} onMouseEnter={()=>setActiveIndex(index)} onClick={event=>{event.stopPropagation();choose(index)}}>
        <span>{option.label}</span>{option.value===value&&<Check/>}
      </button>)}
    </div>}
  </div>;
}
