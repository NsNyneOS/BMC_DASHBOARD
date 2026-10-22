import{useState,type FormEvent}from'react';
import{Eye,EyeOff}from'lucide-react';
import{useAuthStore}from'../store/useAuthStore';
import nyneosLogo from'../../assets/nyneos_logo.png';

export default function Login(){
  const login=useAuthStore(s=>s.login),busy=useAuthStore(s=>s.busy),error=useAuthStore(s=>s.error);
  const[username,setUsername]=useState(''),[password,setPassword]=useState(''),[show,setShow]=useState(false);
  const submit=(e:FormEvent)=>{e.preventDefault();if(username.trim()&&password)void login(username.trim(),password)};
  return <div className="loginPage">
    <div className="accentStrip"/>
    <form className="card loginCard" onSubmit={submit}>
      <div className="logos"><span className="nyneos"><img src={nyneosLogo} alt="NyneOS Technologies"/></span></div>
      <h1>Project Dashboard</h1>
      <p className="eyebrow">Sign in to continue</p>
      <label>Username<input autoFocus autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)}/></label>
      <label>Password<span className="pwField"><input type={show?'text':'password'} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" className="pwToggle" onClick={()=>setShow(v=>!v)} aria-label={show?'Hide password':'Show password'} aria-pressed={show}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label>
      {error&&<p className="loginError" role="alert">{error}</p>}
      <button className="primary" disabled={busy||!username.trim()||!password}>{busy?'Signing in…':'Sign in'}</button>
    </form>
  </div>;
}
