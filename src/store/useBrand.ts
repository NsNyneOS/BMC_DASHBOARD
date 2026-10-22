import{useAuthStore}from'./useAuthStore';
import{useTaskStore}from'./useTaskStore';

export interface Brand{code:string;name:string;logo:string}

// The customer whose dashboard is on screen: an external user's own customer, or the one an internal user selected.
export function useBrand():Brand|null{
  const user=useAuthStore(s=>s.user),customer=useTaskStore(s=>s.customer),customers=useTaskStore(s=>s.customers),projects=useTaskStore(s=>s.projects),owner=useTaskStore(s=>s.owner);
  if(user?.userType==='external')return{code:user.customerCode,name:user.customerName,logo:user.customerLogo};
  if(customer==='all'||customer===owner?.code)return null; // the combined view and NyneOS's own projects have no customer branding
  const c=customers.find(x=>x.code===customer),p=projects.find(x=>x.customerCode===customer);
  return{code:customer,name:c?.name??p?.customerName??customer,logo:c?.logoUrl??''};
}

// Task "team" values are 'nyneos' | 'bmc'; 'bmc' stores "the client's side" for every customer, so show the customer's code.
export const useClientLabel=()=>useBrand()?.code||'Customer';

// The customer a project belongs to (the Team choice is named after it, not a generic "Client").
export function useProjectCustomer(project?:string){
  const p=useTaskStore(s=>s.projects.find(x=>x.id===project));
  return p?{name:p.customerName,code:p.customerCode,internal:p.customerType==='internal'}:null;
}

// What the internal dashboard is showing right now.
export function useViewingLabel():string{
  const brand=useBrand(),customer=useTaskStore(s=>s.customer),owner=useTaskStore(s=>s.owner);
  if(customer==='all')return'All customers';
  if(owner&&customer===owner.code)return`${owner.name} · internal projects`;
  return brand?.name??'All customers';
}
