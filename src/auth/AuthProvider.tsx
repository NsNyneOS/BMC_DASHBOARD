import{createContext,useContext,useEffect,useMemo,type ReactNode}from'react';
import type{AuthUser}from'../api/client';
import{useAuthStore}from'../store/useAuthStore';

export type AuthStatus='loading'|'authenticated'|'unauthenticated';

interface AuthContextValue{
  user:AuthUser|null;
  status:AuthStatus;
  busy:boolean;
  error:string;
  login:(username:string,password:string)=>Promise<void>;
  logout:()=>void;
  can:(permission:string)=>boolean;
}

const AuthContext=createContext<AuthContextValue|null>(null);
const TOKEN_KEY='bmb_token_v1';

// Owns the session: restores it on load, signs out when the server rejects the token (401) or when the token
// is cleared in another tab, and clears the URL on sign-out so the next person does not land on the last page.
export function AuthProvider({children}:{children:ReactNode}){
  const user=useAuthStore(s=>s.user),checking=useAuthStore(s=>s.checking),busy=useAuthStore(s=>s.busy),error=useAuthStore(s=>s.error),
    login=useAuthStore(s=>s.login),storeLogout=useAuthStore(s=>s.logout),restore=useAuthStore(s=>s.restore);
  const logout=useMemo(()=>()=>{storeLogout();try{history.replaceState(null,'',location.pathname+location.search)}catch{/* ignore */}},[storeLogout]);

  useEffect(()=>{void restore()},[restore]);
  useEffect(()=>{
    const unauthorized=()=>logout();
    const storage=(e:StorageEvent)=>{if(e.key===TOKEN_KEY&&!e.newValue)logout()};
    addEventListener('bmb:unauthorized',unauthorized);
    addEventListener('storage',storage);
    return()=>{removeEventListener('bmb:unauthorized',unauthorized);removeEventListener('storage',storage)};
  },[logout]);

  const value=useMemo<AuthContextValue>(()=>({
    user,busy,error,login,logout,
    status:checking?'loading':user?'authenticated':'unauthenticated',
    can:(p:string)=>!!user?.permissions.includes(p)
  }),[user,checking,busy,error,login,logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth():AuthContextValue{
  const ctx=useContext(AuthContext);
  if(!ctx)throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
