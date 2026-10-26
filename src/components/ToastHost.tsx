import{CheckCircle2,X,XCircle}from'lucide-react';
import{useToast}from'../store/useToast';

export default function ToastHost(){
  const{id,message,kind,position,hide}=useToast();
  if(!message)return null;
  return <div key={id} className={'toast appToast '+kind+(position==='top-left'?' topLeft':'')} role="status" aria-live="polite">
    {kind==='success'?<CheckCircle2 size={18}/>:<XCircle size={18}/>}
    <span>{message}</span>
    <button onClick={hide} aria-label="Dismiss"><X size={16}/></button>
  </div>;
}
