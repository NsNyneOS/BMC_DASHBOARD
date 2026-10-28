import{addDays,format,isBefore,parseISO,startOfDay}from'date-fns';
import type{Task}from'../types/task';

export interface PdfMilestone{id:string;title:string;date:string;projectCode:string}
export interface CalendarPdfMeta{from:string;to:string;title:string;subtitle:string;teamLabel:string;projectName:(code:string)=>string;projectColor:(code:string)=>string;customerLabel?:string;milestones?:PdfMilestone[]}

// Built-in PDF fonts only cover Latin-1, so swap common typographic characters and drop the rest.
const clean=(s:string)=>s.replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/…/g,'...').replace(/[^\x09\x0A\x20-\x7E\xA0-\xFF]/g,'');
const iso=(d:Date)=>format(d,'yyyy-MM-dd');
type RGB=[number,number,number];
const rgb=(hex:string):RGB=>{const m=/^#?([0-9a-f]{6})$/i.exec(hex.trim());if(!m)return[212,86,16];const n=parseInt(m[1],16);return[(n>>16)&255,(n>>8)&255,n&255]};
// Same colour rules as the on-screen timeline: dependent task = red, customer-side task = green, otherwise the project colour.
const GREEN='#08783e',RED='#b4141a',BLUE:RGB=[59,130,246];
const hasDep=(t:Task)=>(t.dependsOn?.length??0)+(t.customDependencies?.length??0)>0;
const tint=(t:Task,color:(c:string)=>string):RGB=>rgb(hasDep(t)?RED:t.team==='bmc'?GREEN:color(t.project));
const mix=(c:RGB,pct:number):RGB=>[Math.round(c[0]*pct+255*(1-pct)),Math.round(c[1]*pct+255*(1-pct)),Math.round(c[2]*pct+255*(1-pct))];
const WEEKEND:RGB=[228,230,232]; // the grey used for weekend columns on screen
const lateCustomer=(t:Task)=>t.team==='bmc'&&t.status!=='done'&&!!t.dueDate&&isBefore(parseISO(t.dueDate),startOfDay(new Date()));
const progress=(t:Task)=>({todo:0,in_progress:20,developing:35,testing:50,review:60,completed:70,in_review:85,rework:35,done:100}[t.status]??0);

// Draws the timeline for a date range as a landscape A4 PDF, coloured like the screen. Loaded on demand.
export async function downloadCalendarPdf(tasks:Task[],meta:CalendarPdfMeta,fileName:string){
  const{jsPDF}=await import('jspdf');
  const doc=new jsPDF({orientation:'landscape',unit:'pt',format:'a4'});
  const W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight(),M=36,DARK:RGB=[24,24,28],MUTED:RGB=[110,110,120],ORANGE:RGB=[212,86,16];
  const from=startOfDay(parseISO(meta.from)),to=startOfDay(parseISO(meta.to)),today=iso(new Date());
  const customer=meta.customerLabel||'Customer';
  const tag=(t:Task)=>t.team==='bmc'?customer:'NyneOS';
  const range=`${format(from,'d MMM yyyy')} to ${format(to,'d MMM yyyy')}   |   ${meta.teamLabel}`;

  doc.setFont('helvetica','bold');doc.setFontSize(18);doc.setTextColor(...DARK);doc.text(clean(meta.title),M,M+12);
  doc.setFont('helvetica','normal');doc.setFontSize(9.5);doc.setTextColor(...MUTED);doc.text(clean(`${meta.subtitle}   |   ${range}`),M,M+28);
  // Colour key
  let kx=M;const ky=M+40;doc.setFontSize(7.5);
  const item=(label:string,draw:(x:number)=>void)=>{draw(kx);doc.setTextColor(...MUTED);doc.text(clean(label),kx+20,ky+7);kx+=20+doc.getTextWidth(clean(label))+16};
  const chip=(c:RGB,dash=false)=>(cx:number)=>{doc.setFillColor(...mix(c,.28));doc.roundedRect(cx,ky,14,9,3,3,'F');doc.setDrawColor(...c);doc.setLineWidth(.8);doc.setLineDashPattern(dash?[2,1.5]:[],0);doc.roundedRect(cx,ky,14,9,3,3,'S');doc.setLineDashPattern([],0)};
  item('NyneOS task (project colour)',chip(rgb(meta.projectColor('')||'#c95b12')));
  item(`${customer} task`,chip(rgb(GREEN)));
  item('Dependent task (dashed)',chip(rgb(RED),true));
  item('Red line: dependency',cx=>{doc.setDrawColor(...rgb(RED));doc.setLineWidth(1);doc.line(cx,ky+4.5,cx+14,ky+4.5)});
  if((meta.milestones?.length??0)>0)item('Milestone',cx=>diamond(cx+7,ky+4.5,4.5));
  function diamond(cx:number,cy:number,r:number){doc.setFillColor(...BLUE);doc.triangle(cx-r,cy,cx,cy-r,cx+r,cy,'F');doc.triangle(cx-r,cy,cx,cy+r,cx+r,cy,'F')}
  const border=(t:Task,c:RGB)=>{
    if(lateCustomer(t)){doc.setDrawColor(...rgb(RED));doc.setLineWidth(1.4);doc.setLineDashPattern([],0)}
    else{doc.setDrawColor(...c);doc.setLineWidth(.8);doc.setLineDashPattern(hasDep(t)?[2.5,2]:[],0)}
  };

  const days:Date[]=[];
  for(let d=from;d<=to;d=addDays(d,1))days.push(d); // weekends are kept and shaded grey, like the screen
  const LABEL=200,colW=days.length?(W-2*M-LABEL)/days.length:0,ROW=24,HEAD=40,MROW=18;
  const dated=tasks.filter(t=>t.startDate&&t.dueDate&&t.dueDate>=meta.from&&t.startDate<=meta.to);
  const groups=[...new Set(dated.map(t=>t.project))];
  const ms=(meta.milestones??[]).filter(m=>m.date>=meta.from&&m.date<=meta.to).sort((a,b)=>a.date.localeCompare(b.date));
  const msCol=(m:PdfMilestone)=>days.findIndex(d=>iso(d)===m.date);
  const forProject=(p:string)=>ms.filter(m=>m.projectCode&&m.projectCode.toUpperCase()===p.toUpperCase());
  const wholeCustomer=ms.filter(m=>!m.projectCode);
  let y=ky+20;
  const geo=new Map<string,{page:number;y:number;x:number;w:number;t:Task}>();

  const weekendCols=(top:number,h:number)=>{doc.setFillColor(...WEEKEND);days.forEach((d,i)=>{if(d.getDay()===0||d.getDay()===6)doc.rect(M+LABEL+i*colW,top,colW,h,'F')})};
  // Light-blue column behind a block of rows at each milestone's date, like the screen.
  const msBands=(list:PdfMilestone[],top:number,h:number)=>{doc.setFillColor(...mix(BLUE,.13));list.forEach(m=>{const i=msCol(m);if(i>=0)doc.rect(M+LABEL+i*colW,top,colW,h,'F')})};

  // The date row, repeated at the top of every page: month band above, then day number and weekday letter.
  const header=()=>{
    doc.setFillColor(245,235,228);doc.rect(M,y,W-2*M,HEAD,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(...DARK);doc.text('Project / task / milestone',M+6,y+HEAD/2+3);
    weekendCols(y+14,HEAD-14);msBands(wholeCustomer,y+14,HEAD-14);
    // month band
    let s=0;
    while(s<days.length){
      let e=s;while(e+1<days.length&&days[e+1].getMonth()===days[s].getMonth())e++;
      const x=M+LABEL+s*colW,w=(e-s+1)*colW;
      doc.setFillColor(...(days[s].getMonth()%2?[236,222,212]:[240,229,220]) as RGB);doc.rect(x,y,w,14,'F');
      doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(...DARK);
      const full=format(days[s],'MMMM yyyy'),short=format(days[s],'MMM yy');
      const label=doc.getTextWidth(full)+6<=w?full:doc.getTextWidth(short)+4<=w?short:'';
      if(label)doc.text(label,x+w/2,y+9.8,{align:'center'});
      s=e+1;
    }
    const step=Math.max(1,Math.ceil(9/Math.max(colW,1))),dayY=y+14;
    days.forEach((d,i)=>{
      const x=M+LABEL+i*colW,now=iso(d)===today;
      if(now){doc.setFillColor(0,0,0);doc.rect(x,dayY,colW,HEAD-14,'F');doc.setTextColor(255,255,255)}else doc.setTextColor(...DARK);
      if(i%step===0){
        doc.setFont('helvetica',now?'bold':'normal');doc.setFontSize(Math.min(8.5,Math.max(4.5,colW-1)));doc.text(format(d,'d'),x+colW/2,dayY+10,{align:'center'});
        if(colW>=6){doc.setFontSize(6);doc.text(format(d,'EEEEE'),x+colW/2,dayY+20,{align:'center'})}
      }
    });
    doc.setDrawColor(...(MUTED));doc.setLineWidth(.4);doc.line(M,y+HEAD,W-M,y+HEAD);
    y+=HEAD;
  };
  header();
  const room=(h:number)=>{if(y+h>H-M-14){doc.addPage();y=M;header()}};
  if(!dated.length&&!ms.length){doc.setFont('helvetica','italic');doc.setFontSize(10);doc.setTextColor(...MUTED);doc.text('No dated tasks fall in this range.',M,y+16)}

  // One shared "Milestones" row per section; each milestone is a diamond with its title beside it.
  // A milestone that would overlap the previous one (same date, or a long title) goes onto an extra row.
  const milestoneRows=(list:PdfMilestone[],bandList:PdfMilestone[])=>{
    if(!list.length)return;
    // Each label goes to the right of its diamond, or to the left when it would run past the page edge, so it is never cut off.
    const lanes:[number,number][][]=[],placed:{m:PdfMilestone;lane:number;x:number;label:string;left:boolean;w:number}[]=[];
    doc.setFont('helvetica','bold');doc.setFontSize(7);
    const minX=M+LABEL,maxX=W-M;
    for(const m of list){
      const i=msCol(m);if(i<0)continue;
      const x=M+LABEL+i*colW+colW/2,label=clean(`${m.title}  ${format(parseISO(m.date),'d MMM')}`),full=doc.getTextWidth(label);
      const left=x+8+full>maxX&&(x-8-full>=minX||x-minX>maxX-x);
      const w=Math.max(20,Math.min(full,left?x-8-minX:maxX-x-8));
      const span:[number,number]=left?[x-8-w-3,x+6]:[x-6,x+8+w+3];
      let lane=lanes.findIndex(l=>l.every(([a,b])=>span[1]<a||span[0]>b));if(lane<0){lane=lanes.length;lanes.push([])}
      lanes[lane].push(span);placed.push({m,lane,x,label,left,w});
    }
    for(let r=0;r<Math.max(1,lanes.length);r++){
      room(MROW);
      msBands(bandList,y,MROW);weekendCols(y,MROW);
      doc.setFillColor(...mix(BLUE,.06));doc.rect(M,y,LABEL,MROW,'F');
      doc.setDrawColor(230,230,235);doc.setLineWidth(.4);doc.line(M,y+MROW,W-M,y+MROW);
      if(r===0){doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(...BLUE);doc.text('Milestones',M+6,y+MROW/2+3)}
      for(const p of placed.filter(q=>q.lane===r)){
        diamond(p.x,y+MROW/2,5);doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(...DARK);
        const txt=doc.splitTextToSize(p.label,Math.max(20,p.w+1))[0];
        if(p.left)doc.text(txt,p.x-8,y+MROW/2+2.5,{align:'right'});else doc.text(txt,p.x+8,y+MROW/2+2.5);
      }
      y+=MROW;
    }
  };
  milestoneRows(wholeCustomer,wholeCustomer);

  for(const p of groups){
    room(ROW*2);
    doc.setFillColor(248,244,241);doc.rect(M,y,W-2*M,MROW,'F');msBands(wholeCustomer,y,MROW);doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(...DARK);doc.text(clean(meta.projectName(p)),M+6,y+12);y+=MROW;
    const mine=forProject(p);
    milestoneRows(mine,[...wholeCustomer,...mine]);
    for(const t of dated.filter(x=>x.project===p).sort((a,b)=>a.startDate!.localeCompare(b.startDate!))){
      room(ROW);
      msBands([...wholeCustomer,...mine],y,ROW);weekendCols(y,ROW);
      doc.setDrawColor(230,230,235);doc.setLineWidth(.4);doc.setLineDashPattern([],0);doc.line(M,y+ROW,W-M,y+ROW);
      const c=tint(t,meta.projectColor);
      // The whole task name is shown: it wraps onto a second line (smaller type if needed) instead of being cut off.
      doc.setFont('helvetica','normal');doc.setTextColor(...DARK);
      let fs=7.5,lines:string[]=[];
      for(;fs>=5.5;fs-=.5){doc.setFontSize(fs);lines=doc.splitTextToSize(clean(`${t.key}  ${t.summary}`),LABEL-60) as string[];if(lines.length<=2)break}
      if(lines.length>2){lines=lines.slice(0,2);lines[1]=lines[1].replace(/\s*\S{0,2}$/,'')+'...'}
      const lh=fs*1.15,top=y+ROW/2-(lines.length*lh)/2+fs*.85;
      lines.forEach((ln,i)=>doc.text(ln,M+6,top+i*lh));
      doc.setFont('helvetica','bold');doc.setFontSize(6);doc.setTextColor(...(t.team==='bmc'?rgb(GREEN):MUTED));doc.text(clean(doc.splitTextToSize(tag(t),48)[0]),M+LABEL-6,y+ROW/2+2,{align:'right'});
      const startIdx=days.findIndex(d=>iso(d)>=t.startDate!),endIdx=days.map(d=>iso(d)<=t.dueDate!).lastIndexOf(true);
      if(startIdx>=0&&endIdx>=startIdx){
        const x=M+LABEL+startIdx*colW+1,w=(endIdx-startIdx+1)*colW-2,bh=ROW-8;
        doc.setFillColor(...mix(c,.24));doc.roundedRect(x,y+4,w,bh,3,3,'F');
        const pc=progress(t);if(pc>0){doc.setFillColor(...mix(c,.4));doc.roundedRect(x,y+4,Math.max(3,w*pc/100),bh,3,3,'F')}
        border(t,c);doc.roundedRect(x,y+4,w,bh,3,3,'S');doc.setLineDashPattern([],0);
        geo.set(t.key,{page:doc.getNumberOfPages(),y:y+ROW/2,x,w,t});
      }
      y+=ROW;
    }
  }
  // Dependency connectors: from the end of the task that must finish first to the start of the dependent task.
  const red=rgb(RED);
  for(const g of geo.values())for(const k of g.t.dependsOn??[]){
    const pre=geo.get(k);if(!pre||pre.page!==g.page)continue;
    const late=pre.t.status!=='done'&&!!pre.t.dueDate&&!!g.t.startDate&&pre.t.dueDate>g.t.startDate;
    doc.setPage(g.page);doc.setDrawColor(...red);doc.setFillColor(...red);doc.setLineWidth(1);doc.setLineDashPattern(late?[3,2]:[],0);
    const x1=pre.x+pre.w,x2=g.x;
    const pts:[number,number][]=x2>x1+8?[[x1,pre.y],[x1+4,pre.y],[x1+4,g.y],[x2-2,g.y]]:[[x1,pre.y],[x1+5,pre.y],[x1+5,(pre.y+g.y)/2],[x2-5,(pre.y+g.y)/2],[x2-5,g.y],[x2-2,g.y]];
    for(let i=1;i<pts.length;i++)doc.line(pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1]);
    doc.setLineDashPattern([],0);doc.triangle(x2,g.y,x2-4,g.y-2.5,x2-4,g.y+2.5,'F');
  }
  doc.setLineDashPattern([],0);

  const pages=doc.getNumberOfPages();
  for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(140,140,150);
    doc.text(`Page ${i} of ${pages}`,W-M,H-16,{align:'right'});doc.text(clean(meta.title),M,H-16);doc.setFillColor(...ORANGE);doc.rect(0,0,W,3,'F')}
  doc.save(fileName);
}
