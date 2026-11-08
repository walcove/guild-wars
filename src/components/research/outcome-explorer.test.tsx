// @vitest-environment jsdom
import {afterEach,expect,it} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {OutcomeExplorer} from './outcome-explorer';
afterEach(cleanup);
it('explains cap and downside with independently worked down/flat/rally results before a chart',()=>{
 render(<OutcomeExplorer/>);
 expect(screen.getByText('Hypothetical example',{exact:true})).toBeTruthy();
 expect(within(screen.getByRole('region',{name:'Falls to $80'})).getByText('Loss −$18.10')).toBeTruthy();
 expect(within(screen.getByRole('region',{name:'Stays at $100'})).getByText('Gain +$1.90')).toBeTruthy();
 expect(within(screen.getByRole('region',{name:'Rallies to $130'})).getByText('Gain +$11.90')).toBeTruthy();
 expect(screen.getByRole('radio',{name:'Keep holding SOL'})).toBeTruthy();
});
it('updates numeric results without charts and retains invalid user text with a clear error',()=>{
 render(<OutcomeExplorer/>);
 const input=screen.getByRole('textbox',{name:'Ending SOL price in USD'});
 fireEvent.change(input,{target:{value:'0'}});fireEvent.click(screen.getByRole('button',{name:'Compare this ending price'}));
 expect(within(screen.getByRole('region',{name:'Your ending price'})).getByText('Loss −$98.10')).toBeTruthy();
 fireEvent.change(input,{target:{value:'-5'}});fireEvent.click(screen.getByRole('button',{name:'Compare this ending price'}));
 expect((input as HTMLInputElement).value).toBe('-5');expect(screen.getByRole('alert').textContent).toContain('nonnegative');
});
