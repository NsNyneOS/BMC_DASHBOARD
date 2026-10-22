// Three growing dots. `screen` centres it in the viewport; otherwise it centres inside its container.
export default function Loader({screen=false}:{screen?:boolean}){
  return <div className={screen?'loader loaderScreen':'loader loaderBlock'} role="status" aria-label="Loading"><i/><i/><i/></div>;
}
