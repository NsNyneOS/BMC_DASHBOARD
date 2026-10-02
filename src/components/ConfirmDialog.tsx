import{AlertCircle,X}from'lucide-react';

export default function ConfirmDialog({
  open,title,message,confirmLabel='Confirm',danger=false,onCancel,onConfirm
}:{
  open:boolean;
  title:string;
  message:string;
  confirmLabel?:string;
  danger?:boolean;
  onCancel:()=>void;
  onConfirm:()=>void;
}){
  if(!open)return null;
  return <div className="confirmBackdrop" role="presentation" onMouseDown={event=>{
    if(event.target===event.currentTarget)onCancel();
  }}>
    <div className="confirmDialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
      <div className={danger?'confirmIcon dangerIcon':'confirmIcon'}><AlertCircle/></div>
      <button className="icon confirmClose" onClick={onCancel} aria-label="Close confirmation"><X/></button>
      <h2 id="confirm-title">{title}</h2>
      <p id="confirm-message">{message}</p>
      <div className="confirmActions">
        <button className="confirmCancel" onClick={onCancel}>Cancel</button>
        <button className={danger?'confirmDanger':'primary'} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </div>
  </div>;
}
