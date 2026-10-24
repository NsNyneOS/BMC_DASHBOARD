import type{Task}from'../types/task';
import{priorityLabel,statusLabel,statusOrder,type Report}from'./report';

// Built-in PDF fonts only cover Latin-1, so swap common typographic characters and drop the rest.
const clean=(s:string)=>s.replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/…/g,'...').replace(/[^\x09\x0A\x20-\x7E\xA0-\xFF]/g,'');

export interface PdfMeta{title:string;subtitle:string;filterLines:string[];accomplishedLabel:string;projectName:(code:string)=>string}

const names=(t:Task)=>clean((t.assignees??[]).map(a=>a.name).join(', ')||'-');
const day=(d:string|null|undefined)=>d?d.slice(0,10):'-';

// Loaded on demand so the PDF library stays out of the main bundle.
export async function downloadReportPdf(r:Report,meta:PdfMeta,fileName:string){
  const[{jsPDF},{default:autoTable}]=await Promise.all([import('jspdf'),import('jspdf-autotable')]);
  const doc=new jsPDF({orientation:'landscape',unit:'pt',format:'a4'});
  const W=doc.internal.pageSize.getWidth(),M=36,ORANGE:[number,number,number]=[212,86,16],DARK:[number,number,number]=[24,24,28];
  let y=M;

  doc.setFont('helvetica','bold');doc.setFontSize(20);doc.setTextColor(...DARK);doc.text(clean(meta.title),M,y+14);
  doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(110,110,120);
  doc.text(clean(meta.subtitle),M,y+32);
  y+=48;
  meta.filterLines.forEach(l=>{doc.text(clean(l),M,y);y+=13});
  y+=6;

  const after=()=>((doc as unknown as{lastAutoTable?:{finalY:number}}).lastAutoTable?.finalY??y);
  const section=(n:number,title:string,note?:string)=>{
    if(y>doc.internal.pageSize.getHeight()-120){doc.addPage();y=M}
    doc.setFillColor(...ORANGE);doc.roundedRect(M,y,W-2*M,24,4,4,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(255,255,255);doc.text(`${n}. ${clean(title)}`,M+10,y+16);
    y+=32;
    if(note){doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(110,110,120);doc.text(clean(note),M,y);y+=12}
  };
  const table=(head:string[],body:(string|number)[][],opts:{foot?:boolean;empty?:string}={})=>{
    // Keep a header row together with at least a few rows: start a fresh page when there is no room.
    if(body.length&&y>doc.internal.pageSize.getHeight()-110){doc.addPage();y=M}
    if(!body.length){doc.setFont('helvetica','italic');doc.setFontSize(10);doc.setTextColor(110,110,120);doc.text(opts.empty??'Nothing to show.',M,y+10);y+=26;return}
    autoTable(doc,{startY:y,head:[head],body:body.map(r=>r.map(c=>typeof c==='string'?clean(c):c)),margin:{left:M,right:M},theme:'grid',
      styles:{font:'helvetica',fontSize:9,cellPadding:5,lineColor:[225,225,230],lineWidth:.5,textColor:DARK,overflow:'linebreak'},
      headStyles:{fillColor:[245,235,228],textColor:DARK,fontStyle:'bold'},alternateRowStyles:{fillColor:[252,248,245]},
      didParseCell:d=>{if(opts.foot&&d.section==='body'&&d.row.index===body.length-1){d.cell.styles.fontStyle='bold';d.cell.styles.fillColor=[245,235,228]}}});
    y=after()+16;
  };

  // 1. Items accomplished by NyneOS
  section(1,`Items accomplished by ${meta.accomplishedLabel}`,`${r.accomplished.length} completed item${r.accomplished.length===1?'':'s'} in this period`);
  table(['Key','Summary','Project','Assignees','Priority','Completed on'],
    r.accomplished.map(t=>[t.key,t.summary,meta.projectName(t.project),names(t),priorityLabel[t.priority],day(t.completedAt??t.dueDate)]),{empty:'No items were completed in this period.'});

  // 2. Items at different stages
  section(2,'Items at different stages',`${r.tasks.length} item${r.tasks.length===1?'':'s'} in total`);
  table(['Stage','Items'],statusOrder.map(s=>[statusLabel[s],r.stageCounts[s]]));
  const open=r.stages.flatMap(s=>s.tasks.map(t=>[statusLabel[s.status],t.key,t.summary,meta.projectName(t.project),names(t),priorityLabel[t.priority],day(t.dueDate)]));
  table(['Stage','Key','Summary','Project','Assignees','Priority','Due'],open,{empty:'No items are open at any stage.'});

  // 3. Progress
  section(3,'Progress','Share of items completed, per project');
  table(['Project','Total','New','In Progress','Developing','Testing','Review','Completed','Deploying','Rework','Finished','% complete','Overdue'],
    [...r.progress,r.total].map(p=>[p.project,p.total,p.byStatus.todo,p.byStatus.in_progress,p.byStatus.developing,p.byStatus.testing,p.byStatus.review,p.byStatus.completed,p.byStatus.in_review,p.byStatus.rework,p.byStatus.done,`${p.percent}%`,p.overdue]),{foot:true,empty:'No items match the selected filters.'});

  const pages=doc.getNumberOfPages();
  for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(140,140,150);
    doc.text(`Page ${i} of ${pages}`,W-M,doc.internal.pageSize.getHeight()-16,{align:'right'});doc.text(clean(meta.title),M,doc.internal.pageSize.getHeight()-16)}
  doc.save(fileName);
}
