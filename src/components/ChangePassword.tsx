import{useState,type FormEvent}from'react';
import{api}from'../api/client';
import{useAuthStore}from'../store/useAuthStore';
import nyneosLogo from'../../assets/nyneos_logo.png';

// Shown instead of the app while a user is still on the default password.
export default function ChangePassword(){
  const user=useAuthStore(s=>s.user),logout=useAuthStore(s=>s.logout),done=useAuthStore(s=>s.passwordChanged);
  const[current,setCurrent]=useState(''),[next,setNext]=useState(''),[again,setAgain]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const submit=async(e:FormEvent)=>{
    e.preventDefault();
    if(next.length<8){setError('New password must be at least 8 characters');return}
    if(next!==again){setError('The new passwords do not match');return}
    setBusy(true);setError('');
    try{await api.changePassword(current,next);done()}
    catch(err){setError(err instanceof Error?err.message:'Could not change password')}
    finally{setBusy(false)}
  };
  return <div className="loginPage">
    <div className="accentStrip"/>
    <form className="card loginCard" onSubmit={e=>void submit(e)}>
      <div className="logos"><span className="nyneos"><img src={nyneosLogo} alt="NyneOS Technologies"/></span></div>
      <h1>Set your password</h1>
      <p className="eyebrow">Hi {user?.name}, you are using the default password. Choose your own to continue.</p>
      <label>Current password<input type="password" autoFocus autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)}/></label>
      <label>New password<input type="password" autoComplete="new-password" value={next} onChange={e=>setNext(e.target.value)}/></label>
      <label>Repeat new password<input type="password" autoComplete="new-password" value={again} onChange={e=>setAgain(e.target.value)}/></label>
      {error&&<p className="loginError" role="alert">{error}</p>}
      <button className="primary" disabled={busy||!current||!next||!again}>{busy?'Saving…':'Save and continue'}</button>
      <button type="button" className="textButton centerLink" onClick={logout}>Sign out</button>
    </form>
  </div>;
}
