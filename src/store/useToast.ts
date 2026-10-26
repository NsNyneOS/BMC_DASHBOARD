import{create}from'zustand';

export type ToastKind='success'|'error';
export type ToastPosition='bottom-right'|'top-left';
interface ToastState{id:number;message:string;kind:ToastKind;position:ToastPosition;show:(message:string,kind?:ToastKind,position?:ToastPosition)=>void;hide:()=>void}

let timer:ReturnType<typeof setTimeout>|undefined;

// One app-wide toast: call toast('Task created') from anywhere (components or plain functions).
export const useToast=create<ToastState>()(set=>({
  id:0,message:'',kind:'success',position:'bottom-right',
  show:(message,kind='success',position='bottom-right')=>{clearTimeout(timer);set(s=>({id:s.id+1,message,kind,position}));timer=setTimeout(()=>set({message:''}),3500)},
  hide:()=>{clearTimeout(timer);set({message:''})}
}));
export const toast=(message:string,kind:ToastKind='success',position:ToastPosition='bottom-right')=>useToast.getState().show(message,kind,position);
