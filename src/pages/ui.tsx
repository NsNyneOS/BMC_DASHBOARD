import{friendlyError}from'../api/client';
import{useCallback,useEffect,useRef,useState,type FormEvent,type ReactNode}from'react';
import{Check,ImagePlus,Trash2,X}from'lucide-react';

export const errMsg=(e:unknown)=>friendlyError(e);

export function PageHead({title,action}:{title:string;action?:ReactNode}){
  return <div className="pageHead">
    <h1>{title}</h1>
    {action&&<div className="pageActions">{action}</div>}
  </div>;
}

export function Badge({tone='neutral',children}:{tone?:'neutral'|'ok'|'warn'|'bad'|'info';children:ReactNode}){
  return <span className={'badge '+tone}>{children}</span>;
}

export function Field({label,children,full=false,hint}:{label:string;children:ReactNode;full?:boolean;hint?:string}){
  return <label className={full?'full':undefined}>{label}{children}{hint&&<small className="fieldHint">{hint}</small>}</label>;
}

// Runs a loader on mount (and when deps change); reload() refetches after a save.
export function useLoad<T>(load:()=>Promise<T>,deps:unknown[]=[]){
  const[data,setData]=useState<T|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run=useCallback(()=>{setLoading(true);load().then(d=>{setData(d);setError('')}).catch(e=>setError(errMsg(e))).finally(()=>setLoading(false))},deps);
  useEffect(()=>{run()},[run]);
  return{data,error,loading,reload:run};
}

export function FormModal({title,onClose,onSubmit,busy=false,error='',submitLabel='Save',className='',hideCancel=false,headerStyle=false,headerActions,children}:{
  /** Task-popup layout: Save (and any extra action buttons) sit in the header beside the close button; no footer. */
  headerStyle?:boolean;headerActions?:ReactNode;className?:string;hideCancel?:boolean;title:string;onClose:()=>void;onSubmit:()=>void;busy?:boolean;error?:string;submitLabel?:string;children:ReactNode;
}){
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};
    addEventListener('keydown',key);document.body.style.overflow='hidden';
    return()=>{removeEventListener('keydown',key);document.body.style.overflow=''};
  },[onClose]);
  const submit=(e:FormEvent)=>{e.preventDefault();if(!busy)onSubmit()};
  return <div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <div className={"modal compactModal adminModal "+className} role="dialog" aria-modal="true" aria-label={title}>
      <header><h2>{title}</h2>
        <div className="popupHeadActions">
          {headerStyle&&!hideCancel&&<button type="button" className="primary saveBtn" disabled={busy} aria-busy={busy} onClick={()=>{if(!busy)onSubmit()}}>{busy?'Saving…':submitLabel}</button>}
          {headerStyle&&headerActions}
          <button type="button" className="icon" onClick={onClose} aria-label="Close"><X/></button>
        </div></header>
      <form onSubmit={submit}>
        <div className="formGrid">{children}</div>
        {error&&<p className="loginError formError" role="alert">{error}</p>}
        {!headerStyle&&<footer className="simpleFooter">
          {!hideCancel&&<button type="button" className="pill" onClick={onClose}>Cancel</button>}
          <button className="primary" disabled={busy}>{busy?'Saving…':submitLabel}</button>
        </footer>}
        {headerStyle&&<button type="submit" hidden aria-hidden tabIndex={-1}/>}
      </form>
    </div>
  </div>;
}

export function Empty({children}:{children:ReactNode}){return <p className="emptyNote">{children}</p>}

// Round colour swatches plus a custom picker (the browser's own colour input is a squashed bar).
const SWATCHES=['#c95b12','#c01f3a','#9b1c31','#5b4bc4','#0e7868','#1f6fd1','#a15c00','#b0368a'];

export function ColorField({value,onChange}:{value:string;onChange:(color:string)=>void}){
  const preset=SWATCHES.includes(value.toLowerCase());
  return <div className="colorField" role="group" aria-label="Colour">
    {SWATCHES.map(c=><button type="button" key={c} className="colorDot" style={{background:c}} aria-label={'Colour '+c} aria-pressed={value.toLowerCase()===c} onClick={()=>onChange(c)}>{value.toLowerCase()===c&&<Check size={16}/>}</button>)}
    <label className={'colorDot custom'+(preset?'':' picked')} style={preset?undefined:{background:value}} title="Custom colour">
      <input type="color" aria-label="Custom colour" value={/^#[0-9a-f]{6}$/i.test(value)?value:'#c95b12'} onChange={e=>onChange(e.target.value)}/>
      {!preset&&<Check size={16}/>}
    </label>
  </div>;
}

// Downscales an uploaded image to a small PNG data URL so it can be stored with the customer (SVG is kept as is).
const readLogo=(file:File):Promise<string>=>new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onerror=()=>reject(new Error('Could not read the file'));
  reader.onload=()=>{
    const src=String(reader.result);
    if(file.type==='image/svg+xml'){file.size>200_000?reject(new Error('SVG logo must be under 200 KB')):resolve(src);return}
    const img=new Image();
    img.onerror=()=>reject(new Error('That file is not a valid image'));
    img.onload=()=>{
      const scale=Math.min(1,320/img.width,160/img.height),c=document.createElement('canvas');
      c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));
      c.getContext('2d')!.drawImage(img,0,0,c.width,c.height);
      resolve(c.toDataURL('image/png'));
    };
    img.src=src;
  };
  reader.readAsDataURL(file);
});

// Logo upload with a live preview; the value is an image URL / data URL (empty = no logo).
export function LogoField({value,onChange,name}:{value:string;onChange:(logo:string)=>void;name?:string}){
  const input=useRef<HTMLInputElement>(null),[error,setError]=useState('');
  const pick=async(file?:File)=>{
    if(!file)return;
    setError('');
    if(!/^image\/(png|jpe?g|svg\+xml|webp|gif)$/.test(file.type)){setError('Choose a PNG, JPG, SVG or WebP image');return}
    if(file.size>5_000_000){setError('Image must be under 5 MB');return}
    try{onChange(await readLogo(file))}catch(e){setError(errMsg(e))}
  };
  return <div className="logoField">
    <span className="logoPreview">{value?<img src={value} alt={name?name+' logo':'Customer logo'}/>:<ImagePlus size={22}/>}</span>
    <div className="logoActions">
      <input ref={input} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif" hidden onChange={e=>{void pick(e.target.files?.[0]);e.target.value=''}}/>
      <button type="button" className="pill wide" onClick={()=>input.current?.click()}><ImagePlus size={15}/> {value?'Change logo':'Upload logo'}</button>
      {value&&<button type="button" className="pill wide" onClick={()=>onChange('')}><Trash2 size={15}/> Remove</button>}
    </div>
    <small className="fieldHint">{error?<span className="logoError">{error}</span>:'PNG, JPG, SVG or WebP. Shown in the header beside the NyneOS logo.'}</small>
  </div>;
}
