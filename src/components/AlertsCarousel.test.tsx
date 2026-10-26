import{fireEvent,render,screen}from'@testing-library/react';
import{describe,expect,it,vi}from'vitest';
import AlertsCarousel,{type AlertItem}from'./AlertsCarousel';

const item=(id:string,severity:string,message:string):AlertItem=>({id,project:'A',projectName:'Alpha',color:'#c95b12',meta:'10% complete',severity,message,tasks:[]});

describe('AlertsCarousel',()=>{
  it('says so when there are no alerts',()=>{
    render(<AlertsCarousel alerts={[]} onViewTasks={vi.fn()}/>);
    expect(screen.getByText(/no alerts right now/i)).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });
  it('shows three alerts per page, pages with next, filters by severity and opens details on click',()=>{
    const open=vi.fn();
    render(<AlertsCarousel alerts={[item('1','critical','One'),item('2','warning','Two'),item('3','info','Three'),item('4','info','Four')]} onViewTasks={open}/>);
    expect(screen.getByText('Three')).toBeInTheDocument();
    expect(screen.queryByText('Four')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(screen.getByText('Four')).toBeInTheDocument();
    expect(screen.queryByText('One')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab',{name:/warning/i}));
    expect(screen.getByText('Two')).toBeInTheDocument();
    expect(screen.queryByLabelText('Next page')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Two'));
    expect(open).toHaveBeenCalledWith(expect.objectContaining({id:'2'}));
  });
});
