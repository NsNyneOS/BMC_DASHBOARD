import type{Task}from'../types/task';

export const API_BASE_URL=(import.meta.env.VITE_API_BASE_URL as string|undefined)?.replace(/\/$/,'')||'http://localhost:8080';
const TOKEN_KEY='bmb_token_v1';

export const getToken=()=>{try{return localStorage.getItem(TOKEN_KEY)}catch{return null}};
export const setToken=(token:string|null)=>{try{token?localStorage.setItem(TOKEN_KEY,token):localStorage.removeItem(TOKEN_KEY)}catch{/* storage unavailable */}};

export class ApiError extends Error{constructor(public status:number,message:string){super(message)}}

async function request<T>(path:string,init:RequestInit={}):Promise<T>{
  const token=getToken();
  const res=await fetch(API_BASE_URL+path,{...init,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{}),...init.headers}});
  if(res.status===401&&token&&path!=='/api/auth/login'){setToken(null);dispatchEvent(new Event('bmb:unauthorized'))}
  if(!res.ok){const body=await res.json().catch(()=>({}));throw new ApiError(res.status,body.error||res.statusText)}
  return res.status===204?undefined as T:res.json();
}

export interface AuthUser{id:string;username:string;name:string;initials:string;role:'nyneos'|'bmc';canManageBoard:boolean}
export interface ProjectAlert{id:string;message:string;severity:'info'|'warning'|'critical';taskKey:string|null}
export interface ProjectMeta{id:string;name:string;startDate:string|null;endDate:string|null;alerts:ProjectAlert[]}
export type TaskPatch=Partial<Pick<Task,'summary'|'description'|'status'|'priority'|'startDate'|'dueDate'|'order'>>;

export const api={
  login:(username:string,password:string)=>request<{token:string;user:AuthUser}>('/api/auth/login',{method:'POST',body:JSON.stringify({username,password})}),
  me:()=>request<AuthUser>('/api/auth/me'),
  tasks:()=>request<Task[]>('/api/tasks'),
  projects:()=>request<ProjectMeta[]>('/api/projects'),
  updateProject:(id:string,dates:{startDate:string;endDate:string})=>request<void>(`/api/projects/${id}`,{method:'PATCH',body:JSON.stringify(dates)}),
  createTask:(data:unknown)=>request<Task>('/api/tasks',{method:'POST',body:JSON.stringify(data)}),
  updateTask:(id:string,patch:TaskPatch)=>request<Task>(`/api/tasks/${id}`,{method:'PATCH',body:JSON.stringify(patch)}),
  deleteTask:(id:string)=>request<void>(`/api/tasks/${id}`,{method:'DELETE'})
};
