import{create}from'zustand';

export type ToastKind='success'|'error';
interface ToastState{id:number;message:string;kind:ToastKind;show:(message:string,kind?:ToastKind)=>void;hide:()=>void}

let timer:ReturnType<typeof setTimeout>|undefined;

// One app-wide toast: call toast('Task created') from anywhere (components or plain functions).
export const useToast=create<ToastState>()(set=>({
  id:0,message:'',kind:'success',
  show:(message,kind='success')=>{clearTimeout(timer);set(s=>({id:s.id+1,message,kind}));timer=setTimeout(()=>set({message:''}),3500)},
  hide:()=>{clearTimeout(timer);set({message:''})}
}));
export const toast=(message:string,kind:ToastKind='success')=>useToast.getState().show(message,kind);
