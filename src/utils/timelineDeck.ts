import{addDays,addMonths,differenceInCalendarDays,endOfMonth,format,parseISO,startOfDay,startOfMonth,startOfWeek}from'date-fns';
import type{Task}from'../types/task';
import coverUrl from'../../assets/report/deck_cover.jpg';
import thanksUrl from'../../assets/report/deck_thanks.jpg';
import footerUrl from'../../assets/report/deck_footer.jpg';
import logoUrl from'../../assets/report/deck_logo.png';

export interface TimelineDeckMeta{title:string;customerName:string;teamLabel:string;from:string;to:string;projectName:(code:string)=>string;projectColor:(code:string)=>string;milestones?:{title:string;date:string;customer:string}[]}

type RGB=[number,number,number];
// Built-in PDF fonts only cover Latin-1, so swap common typographic characters and drop the rest.
const clean=(s:string)=>s.replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/…/g,'...').replace(/[^\x09\x0A\x20-\x7E\xA0-\xFF]/g,'');
const iso=(d:Date)=>format(d,'yyyy-MM-dd');
const rgb=(hex:string):RGB=>{const m=/^#?([0-9a-f]{6})$/i.exec(hex.trim());if(!m)return[24,134,89];const n=parseInt(m[1],16);return[(n>>16)&255,(n>>8)&255,n&255]};
const progress=(t:Task)=>({todo:0,in_progress:20,developing:35,testing:50,review:60,completed:70,in_review:85,rework:35,done:100}[t.status]??0);
const load=async(url:string)=>{try{const b=await(await fetch(url)).blob();return await new Promise<string>((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result));r.onerror=no;r.readAsDataURL(b)})}catch{return null}};

// Slide geometry (points). The 16:9 slide is the NyneOS "TimelineView" template: 960 x 540.
const SW=960,SH=540,FOOT=23.8,FOOT_Y=SH-FOOT;
const LABEL_X=22,GRID_X=170,GRID_R=24,GRID_TOP=82,GRID_H=420,COLS=14,ROW_TOP=GRID_TOP+52,ROW=31,BAR=20;
const PITCH=(SW-GRID_X-GRID_R)/COLS,COL_W=PITCH-7.2;
const ROWS_PER_SLIDE=Math.floor((GRID_TOP+GRID_H-ROW_TOP)/ROW);
const DARK:RGB=[3,20,13],GREEN:RGB=[24,134,89],RED:RGB=[190,24,32],MUTED:RGB=[110,110,120];

type View='day'|'week'|'month';
interface Period{start:Date;end:Date;days:number}

// The timeline report as a slide deck, laid out like the NyneOS template: cover, Day / Week / Month timeline slides, Thank You.
export async function downloadTimelineDeck(tasks:Task[],meta:TimelineDeckMeta,fileName:string){
  const{jsPDF}=await import('jspdf');
  const[cover,thanks,footer,logo]=await Promise.all([load(coverUrl),load(thanksUrl),load(footerUrl),load(logoUrl)]);
  const doc=new jsPDF({orientation:'landscape',unit:'pt',format:[SW,SH]});
  const gs=(o:number)=>doc.setGState(new(doc as unknown as{GState:new(x:{opacity:number})=>object}).GState({opacity:o}) as never);
  const from=startOfDay(parseISO(meta.from)),to=startOfDay(parseISO(meta.to)),today=startOfDay(new Date());
  const dated=tasks.filter(t=>t.startDate&&t.dueDate&&t.dueDate>=meta.from&&t.startDate<=meta.to)
    .sort((a,b)=>meta.projectName(a.project).localeCompare(meta.projectName(b.project))||a.startDate!.localeCompare(b.startDate!)||a.key.localeCompare(b.key,undefined,{numeric:true}));
  const ms=(meta.milestones??[]).filter(m=>m.date>=meta.from&&m.date<=meta.to).sort((a,b)=>a.date.localeCompare(b.date));
  const range=`${format(from,'d MMM yyyy')} to ${format(to,'d MMM yyyy')}`;

  const copyright=(onPhoto:boolean)=>{
    doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(255,255,255);
    if(onPhoto){gs(.45);doc.setTextColor(0,0,0);doc.text('Copyright and Confidential:  NyneOS Technologies Pvt. Ltd.',SW-13,SH-13.5,{align:'right'});gs(1);doc.setTextColor(255,255,255)}
    doc.text('Copyright and Confidential:  NyneOS Technologies Pvt. Ltd.',SW-14,SH-14.5,{align:'right'});
  };
  const shadowText=(t:string,x:number,y:number,opts?:{align?:'center'|'left'|'right'})=>{gs(.4);doc.setTextColor(0,0,0);doc.text(t,x+1.5,y+1.5,opts);gs(1);doc.setTextColor(255,255,255);doc.text(t,x,y,opts)};
  const photo=(img:string|null,type:'JPEG'|'PNG',fallback:RGB)=>{if(img)doc.addImage(img,type,0,0,SW,SH);else{doc.setFillColor(...fallback);doc.rect(0,0,SW,SH,'F')}};

  // 1. Cover
  photo(cover,'JPEG',[20,30,70]);
  // Rounded title panel: a diagonal red-to-deep-blue gradient built from thin parallelogram strips (jsPDF has no gradient fill).
  const panel=(x:number,y:number,w:number,h:number,r:number)=>{
    doc.saveGraphicsState();
    doc.roundedRect(x,y,w,h,r,r,null);(doc as unknown as{clip:()=>void}).clip();(doc as unknown as{discardPath:()=>void}).discardPath();
    const n=80,total=w+h;
    for(let i=0;i<n;i++){
      const k=i/(n-1),s0=(i/n)*total,s1=((i+1)/n)*total+1;
      doc.setFillColor(Math.round(171*(1-k)+4*k),Math.round(15*(1-k)+22*k),Math.round(18*(1-k)+105*k));
      doc.lines([[s1-s0,0],[-h,-h],[-(s1-s0),0]],x+s0,y+h,[1,1],'F',true);
    }
    doc.restoreGraphicsState();
  };
  panel(44.9,118.8,487.4,325.8,28);
  doc.setFont('helvetica','bold');doc.setFontSize(30);doc.setTextColor(235,235,240);
  const titleLines=doc.splitTextToSize(clean(meta.customerName||'Project Timeline'),430) as string[];
  doc.text(titleLines.slice(0,2),44.9+487.4/2,118.8+325.8/2-8,{align:'center'});
  doc.setFont('helvetica','normal');doc.setFontSize(14);doc.setTextColor(215,215,225);
  doc.text(clean(meta.title),44.9+487.4/2,118.8+325.8/2+30,{align:'center'});
  doc.setFontSize(10.5);doc.text(clean(`${range}   |   ${meta.teamLabel}`),44.9+487.4/2,118.8+325.8/2+50,{align:'center'});
  if(logo)doc.addImage(logo,'PNG',730.8,153.7,92.2,92.2);
  doc.setFont('helvetica','bold');doc.setFontSize(54);shadowText('NYNEOS',781,272,{align:'center'});
  doc.setFontSize(17);doc.setCharSpace(5);shadowText('TECHNOLOGIES',781,306,{align:'center'});doc.setCharSpace(0);
  copyright(true);

  // Timeline slides
  const periodsFor=(view:View):Period[]=>{
    const out:Period[]=[];
    if(view==='day')for(let d=from;d<=to;d=addDays(d,1))out.push({start:d,end:d,days:1});
    else if(view==='week')for(let w=startOfWeek(from,{weekStartsOn:1});w<=to;w=addDays(w,7))out.push({start:w,end:addDays(w,6),days:7});
    else for(let m=startOfMonth(from);m<=to;m=addMonths(m,1)){const e=endOfMonth(m);out.push({start:m,end:e,days:differenceInCalendarDays(e,m)+1})}
    return out;
  };
  // x of a date inside the window; `after` puts the point at the end of that day (bar ends, milestone centres use half a day).
  const xAt=(ps:Period[],date:Date,after:number)=>{
    if(date<ps[0].start)return GRID_X;
    const last=ps[ps.length-1];if(date>last.end)return GRID_X+(ps.length-1)*PITCH+COL_W;
    const i=ps.findIndex(p=>date>=p.start&&date<=p.end),p=ps[i],frac=(differenceInCalendarDays(date,p.start)+after)/p.days;
    return GRID_X+i*PITCH+frac*COL_W;
  };
  const header=(view:View,ps:Period[],first:number,pageNote:string)=>{
    doc.setFillColor(250,250,250);doc.rect(0,0,SW,SH,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(17);doc.setTextColor(0,0,0);
    const a=ps[0].start,b=ps[ps.length-1].end;
    const title=view==='week'?`Timeline - Week View   Week ${first+1} Starting Date: ${format(a,'do MMM yyyy')}`:view==='day'?`Timeline - Day View   ${format(a,'d MMM yyyy')} to ${format(b,'d MMM yyyy')}`:`Timeline - Month View   ${format(a,'MMM yyyy')} to ${format(b,'MMM yyyy')}`;
    doc.text(clean(title),LABEL_X,32);
    doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(...MUTED);
    doc.text(clean(`${meta.customerName}   |   ${meta.teamLabel}${pageNote}`),SW-GRID_R,24,{align:'right'});
    doc.setFillColor(255,255,0);doc.roundedRect(SW-GRID_R-300,31,9,9,2,2,'F');doc.setTextColor(...MUTED);doc.text('Milestone',SW-GRID_R-287,38.5);
    doc.setDrawColor(...RED);doc.setLineWidth(1);doc.line(SW-GRID_R-228,35.5,SW-GRID_R-214,35.5);doc.text('Dependency',SW-GRID_R-209,38.5);
    doc.setFillColor(...GREEN);doc.roundedRect(SW-GRID_R-140,31,14,9,2,2,'F');doc.text('Progress',SW-GRID_R-122,38.5);
    ps.forEach((p,i)=>{
      const x=GRID_X+i*PITCH,weekend=view==='day'&&(p.start.getDay()===0||p.start.getDay()===6),now=today>=p.start&&today<=p.end;
      doc.setFillColor(...(view==='day'?(weekend?[128,128,128]:[255,255,255]):[217,217,217]) as RGB);
      doc.setDrawColor(...DARK);doc.setLineWidth(.7);doc.roundedRect(x,GRID_TOP,COL_W,GRID_H,8,8,'FD');
      if(now){doc.setDrawColor(242,106,27);doc.setLineWidth(1.8);doc.roundedRect(x,GRID_TOP,COL_W,GRID_H,8,8,'S')}
      const cx=x+COL_W/2;doc.setTextColor(0,0,0);doc.setFont('helvetica',now?'bold':'normal');
      if(view==='day'){doc.setFontSize(9);doc.text(format(p.start,'EEE'),cx,GRID_TOP-24,{align:'center'});doc.setFontSize(11);doc.text(format(p.start,'d'),cx,GRID_TOP-12,{align:'center'});
        if(p.start.getDate()===1||i===0){doc.setFontSize(7);doc.setTextColor(...MUTED);doc.text(format(p.start,'MMM'),cx,GRID_TOP-2,{align:'center'})}}
      else if(view==='week'){doc.setFontSize(9);doc.text('Week',cx,GRID_TOP-24,{align:'center'});doc.setFontSize(11);doc.text(String(first+i+1),cx,GRID_TOP-12,{align:'center'});doc.setFontSize(6.5);doc.setTextColor(...MUTED);doc.text(format(p.start,'d MMM'),cx,GRID_TOP-2,{align:'center'})}
      else{doc.setFontSize(11);doc.text(format(p.start,'MMM'),cx,GRID_TOP-14,{align:'center'});doc.setFontSize(7);doc.setTextColor(...MUTED);doc.text(format(p.start,'yyyy'),cx,GRID_TOP-4,{align:'center'})}
    });
    if(footer)doc.addImage(footer,'JPEG',0,FOOT_Y,SW,FOOT);else{doc.setFillColor(40,20,60);doc.rect(0,FOOT_Y,SW,FOOT,'F')}
    copyright(false);
  };
  const slides=(view:View)=>{
    const all=periodsFor(view);
    for(let w0=0;w0<all.length;w0+=COLS){
      const ps=all.slice(w0,w0+COLS),a=ps[0].start,b=ps[ps.length-1].end;
      const inWin=dated.filter(t=>t.startDate!<=iso(b)&&t.dueDate!>=iso(a));
      const pages=Math.max(1,Math.ceil(inWin.length/ROWS_PER_SLIDE));
      for(let pg=0;pg<pages;pg++){
        doc.addPage([SW,SH],'landscape');
        header(view,ps,w0,pages>1?`   |   slide ${pg+1} of ${pages}`:'');
        const rows=inWin.slice(pg*ROWS_PER_SLIDE,(pg+1)*ROWS_PER_SLIDE),bottom=ROW_TOP+Math.max(rows.length,1)*ROW;
        // Milestones: yellow label with a stem down to the last row (labels stack when they would overlap).
        const taken:[number,number,number][]=[];
        ms.filter(m=>m.date>=iso(a)&&m.date<=iso(b)).forEach(m=>{
          const cx=xAt(ps,parseISO(m.date),.5);doc.setFont('helvetica','normal');doc.setFontSize(8);
          const label=clean(m.title),w=Math.min(150,doc.getTextWidth(label)+12),x=Math.max(GRID_X,Math.min(cx-w/2,SW-GRID_R-w));
          let level=0;while(taken.some(([l,x0,x1])=>l===level&&x<x1+3&&x+w>x0-3)&&level<2)level++;
          taken.push([level,x,x+w]);const y=GRID_TOP+6+level*15;
          doc.setFillColor(255,255,0);doc.setDrawColor(...DARK);doc.setLineWidth(.4);
          doc.roundedRect(cx-4.5,y+13,9,bottom-y-13+4,3,3,'FD');doc.rect(x,y,w,13,'FD');
          doc.setTextColor(0,0,0);doc.text(doc.splitTextToSize(label,w-8)[0],x+w/2,y+9.5,{align:'center'});
        });
        const geo=new Map<string,{y:number;x0:number;x1:number;t:Task}>();
        rows.forEach((t,r)=>{
          const y=ROW_TOP+r*ROW,x0=xAt(ps,parseISO(t.startDate!),0),x1=Math.max(x0+8,xAt(ps,parseISO(t.dueDate!),1)),pc=progress(t);
          doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(0,0,0);
          const [pr,pg2,pb]=rgb(meta.projectColor(t.project));doc.setFillColor(pr,pg2,pb);doc.circle(LABEL_X+3,y+BAR/2,2.6,'F');
          // The whole name is shown: it wraps onto the next line(s) of the row (smaller type if needed) instead of being cut off.
          const textX=LABEL_X+10,textW=GRID_X-textX-8,full=clean(`${t.key}  ${t.summary}`);
          let fs=7.5,lines:string[]=[];
          for(;fs>=5.5;fs-=.5){doc.setFont('helvetica','normal');doc.setFontSize(fs);lines=doc.splitTextToSize(full,textW) as string[];if(lines.length<=Math.floor((ROW-3)/(fs*1.15)))break}
          const maxLines=Math.max(1,Math.floor((ROW-3)/(fs*1.15)));
          if(lines.length>maxLines){lines=lines.slice(0,maxLines);lines[maxLines-1]=lines[maxLines-1].replace(/\s*\S{0,2}$/,'')+'...'}
          const lh=fs*1.15,top=y+BAR/2-(lines.length*lh)/2+fs*.85;
          lines.forEach((ln,i)=>{
            if(i===0){const k=clean(t.key);doc.setFont('helvetica','bold');doc.text(k,textX,top);const kw=doc.getTextWidth(k+'  ');doc.setFont('helvetica','normal');doc.text(ln.slice(k.length).trimStart(),textX+kw,top)}
            else{doc.setFont('helvetica','normal');doc.text(ln,textX,top+i*lh)}
          });
          doc.setFillColor(255,255,255);doc.setDrawColor(...DARK);doc.setLineWidth(.7);doc.roundedRect(x0,y,x1-x0,BAR,3.5,3.5,'FD');
          if(pc>0){doc.setFillColor(...GREEN);doc.roundedRect(x0,y,Math.max(5,(x1-x0)*pc/100),BAR,3.5,3.5,'FD')}
          geo.set(t.key,{y:y+BAR/2,x0,x1,t});
        });
        // Dependency connectors between bars on this slide.
        doc.setDrawColor(...RED);doc.setFillColor(...RED);doc.setLineWidth(1);
        for(const g of geo.values())for(const k of g.t.dependsOn??[]){
          const pre=geo.get(k);if(!pre)continue;
          const late=pre.t.status!=='done'&&!!pre.t.dueDate&&!!g.t.startDate&&pre.t.dueDate>g.t.startDate;
          doc.setLineDashPattern(late?[3,2]:[],0);
          const ahead=g.x0>pre.x1+8,pts:[number,number][]=ahead?[[pre.x1,pre.y],[pre.x1+4,pre.y],[pre.x1+4,g.y],[g.x0-2,g.y]]:[[pre.x1,pre.y],[pre.x1+5,pre.y],[pre.x1+5,(pre.y+g.y)/2],[g.x0-5,(pre.y+g.y)/2],[g.x0-5,g.y],[g.x0-2,g.y]];
          for(let i=1;i<pts.length;i++)doc.line(pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1]);
          doc.setLineDashPattern([],0);doc.triangle(g.x0,g.y,g.x0-4,g.y-2.5,g.x0-4,g.y+2.5,'F');
        }
        doc.setLineDashPattern([],0);
        if(!rows.length){doc.setFont('helvetica','italic');doc.setFontSize(10);doc.setTextColor(...MUTED);doc.text('No dated tasks fall in this period.',GRID_X+10,ROW_TOP+14)}
      }
    }
  };
  slides('day');slides('week');slides('month');

  // Thank You
  doc.addPage([SW,SH],'landscape');photo(thanks,'JPEG',[8,10,24]);
  if(logo)doc.addImage(logo,'PNG',730.8,153.7,92.2,92.2);
  doc.setFont('helvetica','bold');doc.setFontSize(80);shadowText('Thank You',480,262,{align:'center'});
  doc.setDrawColor(255,255,255);doc.setLineWidth(.5);gs(.5);doc.line(157.5,317.3,802.5,317.3);gs(1);
  doc.setFontSize(14);doc.setCharSpace(4);shadowText('NYNEOS TECHNOLOGIES',480,344,{align:'center'});doc.setCharSpace(0);
  copyright(true);

  doc.save(fileName);
}
