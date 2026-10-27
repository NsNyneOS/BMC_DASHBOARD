import{Component,type ErrorInfo,type ReactNode}from'react';

// Catches an unexpected crash while a screen is drawing, so the user sees a short message instead of a blank page.
export default class ErrorBoundary extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return{failed:true}}
  componentDidCatch(error:Error,info:ErrorInfo){console.error(error,info.componentStack)}
  render(){
    if(!this.state.failed)return this.props.children;
    return <div className="crashPage" role="alert">
      <h1>Something went wrong</h1>
      <p>The page hit an unexpected problem. Reloading usually fixes it.</p>
      <button className="primary" onClick={()=>location.reload()}>Reload page</button>
    </div>;
  }
}
