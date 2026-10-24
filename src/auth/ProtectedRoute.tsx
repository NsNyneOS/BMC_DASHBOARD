import{useEffect,type ReactNode}from'react';
import ChangePassword from'../components/ChangePassword';
import Loader from'../components/Loader';
import Login from'../components/Login';
import{canAccess,usePage,type Page}from'../utils/route';
import{useAuth}from'./AuthProvider';

// Gate for everything behind sign-in:
//   not signed in            -> the login screen (the URL is kept, so you return to the same page after signing in)
//   still on default password -> the set-your-password screen
//   signed in but no access   -> bounced to the dashboard (replace, so Back does not return to the refused page)
export function RequireAuth({children}:{children:ReactNode}){
  const{status,user}=useAuth();
  if(status==='loading')return <Loader screen/>;
  if(status==='unauthenticated')return <Login/>;
  if(user?.mustChangePassword)return <ChangePassword/>;
  return <>{children}</>;
}

// Renders children only if the signed-in user may open `page`.
export function ProtectedRoute({page,children}:{page:Page;children:ReactNode}){
  const{user}=useAuth(),[,go]=usePage(),allowed=canAccess(user,page);
  useEffect(()=>{if(!allowed)go('dashboard',{replace:true})},[allowed,go]);
  return allowed?<>{children}</>:null;
}
