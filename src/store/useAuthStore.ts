import{create}from'zustand';
import{api,setToken,getToken,type AuthUser}from'../api/client';
import{useTaskStore}from'./useTaskStore';

interface AuthState{user:AuthUser|null;checking:boolean;error:string;busy:boolean;login:(username:string,password:string)=>Promise<void>;logout:()=>void;restore:()=>Promise<void>;passwordChanged:()=>void}

export const useCan=(permission:string)=>useAuthStore(s=>!!s.user?.permissions.includes(permission));
export const useIsInternal=()=>useAuthStore(s=>s.user?.userType==='internal');

export const useAuthStore=create<AuthState>((set)=>({
  passwordChanged:()=>set(s=>({user:s.user?{...s.user,mustChangePassword:false}:s.user})),
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
