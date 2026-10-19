import{Eye,EyeOff}from'lucide-react';

export default function VisibilityToggle({visible,onChange}:{visible:boolean;onChange:(visible:boolean)=>void}){
  return <button type="button" role="switch" aria-checked={visible} className={'visibilityToggle'+(visible?' on':'')} onClick={()=>onChange(!visible)}>
    <span className="visibilityTrack"><i/></span>
    {visible?<Eye/>:<EyeOff/>}
    <b>{visible?'VISIBLE':'NOT VISIBLE'}</b>
  </button>;
}
