import{create}from'zustand';
import{api,setToken,getToken,type AuthUser}from'../api/client';
import{useTaskStore}from'./useTaskStore';

interface AuthState{user:AuthUser|null;checking:boolean;error:string;busy:boolean;login:(username:string,password:string)=>Promise<void>;logout:()=>void;restore:()=>Promise<void>}

export const useAuthStore=create<AuthState>((set)=>({
  user:null,checking:true,error:'',busy:false,
  login:async(username,password)=>{
    set({busy:true,error:''});
    try{const{token,user}=await api.login(username,password);setToken(token);set({user,busy:false,checking:false})}
    catch(e){set({busy:false,error:e instanceof Error?e.message:'Unable to sign in'})}
  },
  logout:()=>{setToken(null);useTaskStore.getState().clear();set({user:null,error:''})},
  restore:async()=>{
    if(!getToken()){set({checking:false});return}
    try{set({user:await api.me(),checking:false})}catch{setToken(null);set({user:null,checking:false})}
  }
}));
