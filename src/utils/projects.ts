import type{ProjectId}from'../types/task';

// Projects are data (project_master), not a fixed list: names and colours come from the API.
const fallback=['#c95b12','#c01f3a','#9b1c31','#5b4bc4','#0e7868','#1f6fd1','#a15c00','#b0368a'];
let registry:Record<string,{name:string;color:string}>={};

export const setProjectRegistry=(list:{id:string;name:string;color:string}[])=>{registry=Object.fromEntries(list.map(p=>[p.id,{name:p.name,color:p.color}]))};
const hash=(s:string)=>[...s].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,7);
export const projectName=(p:ProjectId)=>registry[p]?.name??p;
export const projectColor=(p:ProjectId)=>registry[p]?.color||fallback[hash(p)%fallback.length];
