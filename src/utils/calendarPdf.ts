import{addDays,addMonths,endOfMonth,format,isBefore,parseISO,startOfDay,startOfMonth}from'date-fns';
import type{Task}from'../types/task';

export type CalendarView='timeline'|'month'|'week';
export interface CalendarPdfMeta{view:CalendarView;from:string;to:string;title:string;subtitle:string;teamLabel:string;projectName:(code:string)=>string;projectColor:(code:string)=>string;customerLabel?:string}

// Built-in PDF fonts only cover Latin-1, so swap common typographic characters and drop the rest.
const clean=(s:string)=>s.replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/…/g,'...').replace(/[^\x09\x0A\x20-\x7E\xA0-\xFF]/g,'');
const iso=(d:Date)=>format(d,'yyyy-MM-dd');
const rgb=(hex:string):[number,number,number]=>{const m=/^#?([0-9a-f]{6})$/i.exec(hex.trim());if(!m)return[212,86,16];const n=parseInt(m[1],16);return[(n>>16)&255,(n>>8)&255,n&255]};
// Same colour rules as the on-screen calendar: dependent task = red, customer-side task = green, otherwise the project colour.
type RGB=[number,number,number];
const GREEN='#08783e',RED='#b4141a';
const hasDep=(t:Task)=>(t.dependsOn?.length??0)+(t.customDependencies?.length??0)>0;
const tint=(t:Task,color:(c:string)=>string):RGB=>rgb(hasDep(t)?RED:t.team==='bmc'?GREEN:color(t.project));
const mix=(c:RGB,pct:number):RGB=>[Math.round(c[0]*pct+255*(1-pct)),Math.round(c[1]*pct+255*(1-pct)),Math.round(c[2]*pct+255*(1-pct))];
const WEEKEND:RGB=[228,230,232]; // --muted at 18% over white, the grey used for weekend columns on screen
const lateCustomer=(t:Task)=>t.team==='bmc'&&t.status!=='done'&&!!t.dueDate&&isBefore(parseISO(t.dueDate),startOfDay(new Date()));
const progress=(t:Task)=>({todo:0,in_progress:20,developing:35,testing:50,review:60,completed:70,in_review:85,rework:35,done:100}[t.status]??0);

// Draws the Timeline / Month / Week calendar for a date range as a landscape A4 PDF, coloured exactly like the screen. Loaded on demand.
export async function downloadCalendarPdf(tasks:Task[],meta:CalendarPdfMeta,fileName:string){
  const{jsPDF}=await import('jspdf');
  const doc=new jsPDF({orientation:'landscape',unit:'pt',format:'a4'});
  const W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight(),M=36,DARK:RGB=[24,24,28],MUTED:RGB=[110,110,120],ORANGE:RGB=[212,86,16];
  const from=startOfDay(parseISO(meta.from)),to=startOfDay(parseISO(meta.to)),today=iso(new Date());
  const heading=(sub:string)=>{
    doc.setFont('helvetica','bold');doc.setFontSize(18);doc.setTextColor(...DARK);doc.text(clean(meta.title),M,M+12);
    doc.setFont('helvetica','normal');doc.setFontSize(9.5);doc.setTextColor(...MUTED);doc.text(clean(`${meta.subtitle}   |   ${sub}`),M,M+28);
    return M+44;
  };
  const range=`${format(from,'d MMM yyyy')} to ${format(to,'d MMM yyyy')}   |   ${meta.teamLabel}`;
  const customer=meta.customerLabel||'Customer';
  const tag=(t:Task)=>t.team==='bmc'?customer:'NyneOS';
  // Colour key under the heading; every view uses the same colours.
  const legend=(y:number)=>{
    let x=M;doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setLineDashPattern([],0);
    const item=(label:string,draw:(x:number)=>void)=>{draw(x);doc.setTextColor(...MUTED);doc.text(clean(label),x+20,y+7);x+=20+doc.getTextWidth(clean(label))+16};
    const chip=(c:RGB,dash=false)=>(cx:number)=>{doc.setFillColor(...mix(c,.28));doc.roundedRect(cx,y,14,9,3,3,'F');doc.setDrawColor(...c);doc.setLineWidth(.8);doc.setLineDashPattern(dash?[2,1.5]:[],0);doc.roundedRect(cx,y,14,9,3,3,'S');doc.setLineDashPattern([],0)};
    item('NyneOS task (project colour)',chip(rgb(meta.projectColor('')||'#c95b12')));
    item(`${customer} task`,chip(rgb(GREEN)));
    item('Dependent task (dashed)',chip(rgb(RED),true));
    if(meta.view==='timeline')item('Red line: from the task that must finish first to the dependent task',cx=>{doc.setDrawColor(...rgb(RED));doc.setLineWidth(1);doc.line(cx,y+4.5,cx+14,y+4.5)});
    return y+16;
  };
  const border=(t:Task,c:RGB)=>{
    if(lateCustomer(t)){doc.setDrawColor(...rgb(RED));doc.setLineWidth(1.4);doc.setLineDashPattern([],0)}
    else{doc.setDrawColor(...c);doc.setLineWidth(.8);doc.setLineDashPattern(hasDep(t)?[2.5,2]:[],0)}
  };

  if(meta.view==='timeline'){
    const days:Date[]=[];
    for(let d=from;d<=to;d=addDays(d,1))days.push(d); // weekends are kept and shaded grey, like the screen
    const LABEL=200,colW=days.length?(W-2*M-LABEL)/days.length:0,ROW=18,HEAD=30;
    const dated=tasks.filter(t=>t.startDate&&t.dueDate&&t.dueDate>=meta.from&&t.startDate<=meta.to);
    const groups=[...new Set(dated.map(t=>t.project))];
    let y=legend(heading(`Timeline  |  ${range}`));
    const geo=new Map<string,{page:number;y:number;x:number;w:number;t:Task}>();
    const weekendCols=(top:number,h:number)=>{doc.setFillColor(...WEEKEND);days.forEach((d,i)=>{if(d.getDay()===0||d.getDay()===6)doc.rect(M+LABEL+i*colW,top,colW,h,'F')})};
    const header=()=>{
      doc.setFillColor(245,235,228);doc.rect(M,y,W-2*M,HEAD,'F');weekendCols(y,HEAD);
      doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(...DARK);doc.text('Project / task',M+6,y+18);
      const step=Math.max(1,Math.ceil(14/Math.max(colW,1)));
      days.forEach((d,i)=>{
        const x=M+LABEL+i*colW;
        if(iso(d)===today){doc.setFillColor(0,0,0);doc.rect(x,y,colW,HEAD,'F');doc.setTextColor(255,255,255)}else doc.setTextColor(...DARK);
        if(i%step===0){doc.setFontSize(Math.min(8,Math.max(4,colW-1)));doc.text(format(d,'d'),x+colW/2,y+12,{align:'center'});doc.setFontSize(5.5);doc.text(format(d,'EEEEE'),x+colW/2,y+20,{align:'center'})}
        if(i===0||days[i-1].getMonth()!==d.getMonth()){doc.setFontSize(6);doc.text(format(d,'MMM'),x+colW/2,y+27,{align:'center'})}
      });
      y+=HEAD;
    };
    header();
    const room=(h:number)=>{if(y+h>H-M-14){doc.addPage();y=M;header()}};
    if(!dated.length){doc.setFont('helvetica','italic');doc.setFontSize(10);doc.setTextColor(...MUTED);doc.text('No dated tasks fall in this range.',M,y+16)}
    for(const p of groups){
      room(ROW*2);
      doc.setFillColor(248,244,241);doc.rect(M,y,W-2*M,ROW,'F');doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(...DARK);doc.text(clean(meta.projectName(p)),M+6,y+12);y+=ROW;
      for(const t of dated.filter(x=>x.project===p).sort((a,b)=>a.startDate!.localeCompare(b.startDate!))){
        room(ROW);
        weekendCols(y,ROW);
        doc.setDrawColor(230,230,235);doc.setLineWidth(.4);doc.setLineDashPattern([],0);doc.line(M,y+ROW,W-M,y+ROW);
        const c=tint(t,meta.projectColor);
        doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(...DARK);
        doc.text(clean(doc.splitTextToSize(`${t.key}  ${t.summary}`,LABEL-62)[0]),M+6,y+12);
        doc.setFont('helvetica','bold');doc.setFontSize(6);doc.setTextColor(...(t.team==='bmc'?rgb(GREEN):MUTED));doc.text(clean(doc.splitTextToSize(tag(t),48)[0]),M+LABEL-6,y+11.5,{align:'right'});doc.setFont('helvetica','normal');
        const startIdx=days.findIndex(d=>iso(d)>=t.startDate!),endIdx=days.map(d=>iso(d)<=t.dueDate!).lastIndexOf(true);
        if(startIdx>=0&&endIdx>=startIdx){
          const x=M+LABEL+startIdx*colW+1,w=(endIdx-startIdx+1)*colW-2;
          doc.setFillColor(...mix(c,.24));doc.roundedRect(x,y+3,w,ROW-6,3,3,'F');
          const pc=progress(t);if(pc>0){doc.setFillColor(...mix(c,.4));doc.roundedRect(x,y+3,Math.max(3,w*pc/100),ROW-6,3,3,'F')}
          border(t,c);doc.roundedRect(x,y+3,w,ROW-6,3,3,'S');doc.setLineDashPattern([],0);
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
      const x1=pre.x+pre.w,x2=g.x,mid=Math.max(x1,x2-6)+(x2>x1+8?0:6);
      const pts:[number,number][]=x2>x1+8?[[x1,pre.y],[x1+4,pre.y],[x1+4,g.y],[x2-2,g.y]]:[[x1,pre.y],[x1+5,pre.y],[x1+5,(pre.y+g.y)/2],[x2-5,(pre.y+g.y)/2],[x2-5,g.y],[x2-2,g.y]];
      void mid;
      for(let i=1;i<pts.length;i++)doc.line(pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1]);
      doc.setLineDashPattern([],0);doc.triangle(x2,g.y,x2-4,g.y-2.5,x2-4,g.y+2.5,'F');
    }
    doc.setLineDashPattern([],0);
  }else{
    // Month and Week mirror the screen: equal columns (whole months, or Week 1-4 of a month), tasks as coloured pills by due date, 10 to a page.
    const PER=8,PILL=42,GAP=6,CW=(W-2*M-3*12)/4;
    const dueIn=(a:Date,z:Date)=>{
      const lo=iso(a<from?from:a),hi=iso(z>to?to:z);
      return tasks.filter(t=>t.dueDate&&t.dueDate>=lo&&t.dueDate<=hi).sort((x,y)=>x.dueDate!.localeCompare(y.dueDate!)||x.key.localeCompare(y.key));
    };
    type Col={title:string;sub:string;list:Task[];current:boolean};
    const group=(cols:Col[],sub:string,first:boolean)=>{
      const pages=Math.max(1,...cols.map(c=>Math.ceil(c.list.length/PER)));
      for(let pg=0;pg<pages;pg++){
        if(!(first&&pg===0))doc.addPage();
        const top=legend(heading(sub+(pages>1?`  |  page ${pg+1} of ${pages}`:'')));
        const colH=H-M-20-top;
        cols.forEach((col,i)=>{
          const x=M+i*(CW+12);
          doc.setFillColor(244,245,247);doc.roundedRect(x,top,CW,colH,8,8,'F');
          if(col.current){doc.setDrawColor(242,106,27);doc.setLineWidth(1.4);doc.setLineDashPattern([],0);doc.roundedRect(x,top,CW,colH,8,8,'S')}
          doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(...DARK);doc.text(clean(col.title),x+10,top+18);
          doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(...MUTED);doc.text(clean(col.sub),x+10,top+29);
          doc.setFillColor(255,255,255);doc.circle(x+CW-18,top+18,9,'F');doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(...DARK);doc.text(String(col.list.length),x+CW-18,top+21,{align:'center'});
          const items=col.list.slice(pg*PER,(pg+1)*PER);
          if(!col.list.length){doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...MUTED);doc.text('No tasks due',x+CW/2,top+52,{align:'center'})}
          items.forEach((t,j)=>{
            const py=top+40+j*(PILL+GAP),c=tint(t,meta.projectColor);
            doc.setFillColor(...mix(c,.28));doc.roundedRect(x+8,py,CW-16,PILL,PILL/2.4,PILL/2.4,'F');
            border(t,c);doc.roundedRect(x+8,py,CW-16,PILL,PILL/2.4,PILL/2.4,'S');doc.setLineDashPattern([],0);
            doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(90,90,95);doc.text(clean(`${t.key} - ${format(parseISO(t.dueDate!),'MMM d')}`),x+16,py+11);
            doc.setFontSize(8);doc.setTextColor(0,0,0);doc.text(clean(doc.splitTextToSize(t.summary,CW-34)[0]),x+16,py+22);
            // Section tag (which side the task belongs to) on the right, and the dependency on the bottom line.
            doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(...(t.team==='bmc'?rgb(GREEN):MUTED));doc.text(clean(tag(t)),x+CW-16,py+11,{align:'right'});
            const deps=[...(t.dependsOn??[]),...(t.customDependencies??[])];
            doc.setFontSize(6.5);
            if(deps.length){doc.setTextColor(...rgb(RED));doc.text(clean(doc.splitTextToSize(`> dependent on ${deps.join(', ')}`,CW-34)[0]),x+16,py+34)}
            else{doc.setFont('helvetica','normal');doc.setTextColor(...MUTED);doc.text(clean(meta.projectName(t.project)),x+16,py+34)}
          });
        });
      }
    };
    const monthStart=startOfMonth(from);
    if(meta.view==='month'){
      let first=true;
      for(let m=monthStart;m<=to;m=addMonths(m,4)){
        const cols:Col[]=[0,1,2,3].map(i=>{const a=addMonths(m,i);return{title:format(a,'MMMM'),sub:format(a,'yyyy'),list:dueIn(a,endOfMonth(a)),current:iso(a)===iso(startOfMonth(new Date()))}});
        group(cols,`Months from ${format(m,'MMMM yyyy')}  |  ${range}`,first);first=false;
      }
    }else{
      let first=true;
      for(let m=monthStart;m<=to;m=addMonths(m,1)){
        const last=endOfMonth(m);
        const cols:Col[]=[0,1,2,3].map(i=>{const a=addDays(m,i*7),z=i===3?last:addDays(a,6);return{title:`Week ${i+1}`,sub:`${format(a,'MMM d')} - ${format(z,'MMM d')}`,list:dueIn(a,z),current:today>=iso(a)&&today<=iso(z)}});
        group(cols,`${format(m,'MMMM yyyy')}  |  ${meta.teamLabel}`,first);first=false;
      }
    }
  }
  const pages=doc.getNumberOfPages();
  for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(140,140,150);
    doc.text(`Page ${i} of ${pages}`,W-M,H-16,{align:'right'});doc.text(clean(meta.title),M,H-16);doc.setFillColor(...ORANGE);doc.rect(0,0,W,3,'F')}
  doc.save(fileName);
}
