import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {renderToStaticMarkup} from 'react-dom/server';

const bundled=await build({entryPoints:['src/components/CalendarNotice.tsx'],bundle:true,write:false,platform:'node',format:'esm',loader:{'.css':'empty'}});
const {CalendarNotice}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const now=new Date(2026,9,22,9).getTime();
const notice=(alert,actions={})=>CalendarNotice({alert,now,onDismiss:()=>{},onSnooze:()=>{},...actions});

test('a calendar reminder exposes the full title and AM/PM time without the old expanded card',()=>{
 const title='Review the portfolio & application with the design team';
 const markup=renderToStaticMarkup(notice({kind:'event',title,start:now+30*60*1000}));
 assert.match(markup,/class="calendar-notice" role="status"/);
 assert.match(markup,/title="Review the portfolio &amp; application with the design team"/);
 assert.match(markup,/9:30\s*AM/);
 assert.doesNotMatch(markup,/ON YOUR CALENDAR|Got it|alert-card|<h[1-6]/);
 assert.equal((markup.match(/<button/g)||[]).length,2);
});

test('due task reminders and events already in progress show Now',()=>{
 for(const alert of [{kind:'task',title:'Send application'},{kind:'event',title:'Design review',start:now-1000}]){
  const markup=renderToStaticMarkup(notice(alert));
  assert.match(markup,/class="calendar-notice-time">Now<\/span>/);
  assert.match(markup,new RegExp(`aria-label="Dismiss ${alert.kind==='task'?'task':'calendar'} reminder"`));
 }
});

test('Snooze and dismiss stay independent and do not bubble into notch controls',()=>{
 const calls=[];
 const tree=notice({kind:'event',title:'Review',start:now},{onSnooze:()=>calls.push('snooze'),onDismiss:()=>calls.push('dismiss')});
 const buttons=tree.props.children.filter(child=>child.type==='button');
 const event={stopPropagation(){calls.push('stop');}};
 buttons[0].props.onClick(event);assert.deepEqual(calls,['stop','snooze']);
 buttons[1].props.onClick(event);assert.deepEqual(calls,['stop','snooze','stop','dismiss']);
 assert.ok(buttons.every(button=>button.props.type==='button'&&button.props.tabIndex===0));
});
