import{ArrowLeft,Home}from'lucide-react';
import{goHome}from'../utils/route';

// "404" with the zero drawn as a magnifying glass that found nothing. Colours come from the theme, so it follows light/dark.
function Illustration(){
  return <svg className="nfArt" viewBox="0 0 460 300" role="img" aria-label="A magnifying glass searching an empty page" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="nfGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={{stopColor:'var(--accent)'}}/><stop offset="1" style={{stopColor:'#a9161a'}}/></linearGradient>
    </defs>
    <ellipse cx="230" cy="268" rx="150" ry="14" className="nfShadow"/>
    <circle cx="230" cy="140" r="122" className="nfBlob"/>
    {/* floating bits */}
    <g className="nfFloat nfF1"><circle cx="64" cy="70" r="7" className="nfDot"/></g>
    <g className="nfFloat nfF2"><circle cx="410" cy="96" r="10" className="nfDotSoft"/></g>
    <g className="nfFloat nfF3"><path d="M396 214v16M388 222h16" className="nfPlus"/></g>
    <g className="nfFloat nfF2"><path d="M58 196v12M52 202h12" className="nfPlus"/></g>
    <g className="nfFloat nfF1"><path d="M96 258c20-14 40 14 60 0" className="nfSquiggle"/></g>
    {/* 4 */}
    <g className="nfDigit"><path d="M118 214V84L58 176h94" transform="translate(-10 0)"/></g>
    <g className="nfDigit nfDigit2"><path d="M402 214V84L342 176h94" transform="translate(-12 0)"/></g>
    {/* the 0: a lens + handle */}
    <g className="nfLens">
      <circle cx="230" cy="148" r="62" className="nfLensFill"/>
      <circle cx="230" cy="148" r="62" className="nfLensRing"/>
      <path d="M186 118a52 52 0 0 1 28-24" className="nfShine"/>
      <path d="M276 196l40 40" className="nfHandle"/>
      <text x="230" y="170" textAnchor="middle" className="nfQ">?</text>
    </g>
  </svg>;
}

export default function NotFoundPage(){
  const where=location.pathname.replace(/^\//,'')||location.hash.replace(/^#/,'');
  return <section className="notFound" aria-labelledby="nf-title">
    <Illustration/>
    <p className="nfCode">Error 404</p>
    <h1 id="nf-title">Page not found</h1>
    <p className="nfText">We looked everywhere but couldn't find that page. It may have been moved, or the address might be mistyped.</p>
    {where&&<code className="nfPath" title="The address you opened">{where.length>60?where.slice(0,60)+'…':where}</code>}
    <div className="nfActions">
      <button className="primary nfBtn" onClick={goHome}><Home size={17}/> Go to dashboard</button>
      <button className="pill wide nfBack" onClick={()=>history.back()}><ArrowLeft size={16}/> Go back</button>
    </div>
  </section>;
}
