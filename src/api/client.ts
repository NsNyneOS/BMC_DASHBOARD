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

export interface AuthUser{id:string;username:string;name:string;initials:string;userType:'internal'|'external';role:string;roleName:string;customerId:string|null;customerCode:string;customerName:string;customerLogo:string;permissions:string[];canManageBoard:boolean;mustChangePassword:boolean}
export interface ProjectAlert{id:string;message:string;severity:'info'|'warning'|'critical';taskKey:string|null}
export type ProjectStatus='active'|'on_hold'|'completed'|'archived';
export interface ProjectMeta{id:string;uuid:string;name:string;description:string;color:string;status:ProjectStatus;startDate:string|null;endDate:string|null;internalOnly:boolean;customerId:string;customerCode:string;customerName:string;customerType:'client'|'internal';taskCount:number;alerts:ProjectAlert[]}
export interface Customer{id:string;code:string;name:string;shortName:string;type:'internal'|'client';logoUrl:string;contactName:string;contactEmail:string;contactPhone:string;address:string;status:'active'|'inactive';projectCount:number;userCount:number;createdAt:string}
export interface UserRow{id:string;username:string;name:string;initials:string;email:string;userType:'internal'|'external';roleId:string;roleCode:string;roleName:string;customerId:string|null;customerName:string;isActive:boolean;projectCodes:string[];createdAt:string}
export interface Role{id:string;code:string;name:string;description:string;userType:'internal'|'external';isSystem:boolean;userCount:number;permissions:string[]}
export interface Assignee{id:string;name:string;initials:string;username:string;userType:'internal'|'external'}
export interface Permission{code:string;module:string;name:string}
export type TaskPatch=Partial<Pick<Task,'summary'|'description'|'status'|'priority'|'startDate'|'dueDate'|'order'|'dependsOn'|'customDependencies'|'clientVisible'|'team'>&{assigneeIds:string[];reportingToId:string}>;

// no argument = everything the user may see; 'all' = the customers' combined view (without the owner's internal projects)
const q=(customer?:string)=>customer?`?customer=${encodeURIComponent(customer)}`:'';

// A backend that predates the owner_team -> team rename still sends "ownerTeam"; read either so the team colouring never disappears.
const norm=<T extends Task>(t:T):T=>({...t,team:t.team??(t as unknown as {ownerTeam?:Task['team']}).ownerTeam??'nyneos',dependsOn:t.dependsOn??[],customDependencies:t.customDependencies??[]});

export const api={
  login:(username:string,password:string)=>request<{token:string;user:AuthUser}>('/api/auth/login',{method:'POST',body:JSON.stringify({username,password})}),
  me:()=>request<AuthUser>('/api/auth/me'),
  changePassword:(currentPassword:string,newPassword:string)=>request<void>('/api/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword,newPassword})}),
  tasks:(customer?:string)=>request<Task[]>('/api/tasks'+q(customer)).then(list=>list.map(norm)),
  allTasks:()=>request<Task[]>('/api/tasks?all=1').then(list=>list.map(norm)),
  myTasks:(kind:'assigned'|'reviewing'='assigned')=>request<Task[]>('/api/tasks?'+(kind==='reviewing'?'reviewer=me':'assignee=me')).then(list=>list.map(norm)),
  projects:(customer?:string)=>request<ProjectMeta[]>('/api/projects'+q(customer)),
  updateProject:(id:string,patch:Partial<Pick<ProjectMeta,'name'|'description'|'color'|'status'|'internalOnly'>&{startDate:string;endDate:string}>)=>request<void>(`/api/projects/${id}`,{method:'PATCH',body:JSON.stringify(patch)}),
  createProject:(data:Record<string,unknown>)=>request<{id:string;uuid:string}>('/api/projects',{method:'POST',body:JSON.stringify(data)}),
  owner:()=>request<Customer>('/api/owner'),
  assignees:(project:string)=>request<Assignee[]>('/api/assignees?project='+encodeURIComponent(project)),
  customers:()=>request<Customer[]>('/api/customers'),
  createCustomer:(data:Record<string,unknown>)=>request<Customer>('/api/customers',{method:'POST',body:JSON.stringify(data)}),
  updateCustomer:(id:string,data:Record<string,unknown>)=>request<Customer>(`/api/customers/${id}`,{method:'PATCH',body:JSON.stringify(data)}),
  users:()=>request<UserRow[]>('/api/users'),
  createUser:(data:Record<string,unknown>)=>request<UserRow>('/api/users',{method:'POST',body:JSON.stringify(data)}),
  updateUser:(id:string,data:Record<string,unknown>)=>request<UserRow>(`/api/users/${id}`,{method:'PATCH',body:JSON.stringify(data)}),
  audit:()=>request<AuditEntry[]>('/api/audit'),
  roles:()=>request<Role[]>('/api/roles'),
  createRole:(data:Record<string,unknown>)=>request<Role>('/api/roles',{method:'POST',body:JSON.stringify(data)}),
  updateRole:(id:string,data:Record<string,unknown>)=>request<Role>(`/api/roles/${id}`,{method:'PATCH',body:JSON.stringify(data)}),
  deleteRole:(id:string)=>request<void>(`/api/roles/${id}`,{method:'DELETE'}),
  permissions:()=>request<Permission[]>('/api/permissions'),
  createTask:(data:unknown)=>request<Task>('/api/tasks',{method:'POST',body:JSON.stringify(data)}).then(norm),
  updateTask:(id:string,patch:TaskPatch)=>request<Task>(`/api/tasks/${id}`,{method:'PATCH',body:JSON.stringify(patch)}),
  deleteTask:(id:string)=>request<void>(`/api/tasks/${id}`,{method:'DELETE'})
};

export interface AuditEntry{id:string;userName:string;action:'create'|'update'|'delete';entity:string;entityId:string;label:string;detail:Record<string,unknown>;createdAt:string}
