import test from 'node:test';
import assert from 'node:assert/strict';

test('compact height replaces the retained calendar workspace with the complete task contents',async()=>{
 const {plannerCompactHeight}=await import('../src/planner-layout.mjs');
 assert.equal(plannerCompactHeight({panelHeight:612,workspaceHeight:487,headingHeight:28,headingGap:10,listHeight:160,availableHeight:800}),323);
 // A taller retained calendar must not change the same compact checklist target.
 assert.equal(plannerCompactHeight({panelHeight:825,workspaceHeight:700,headingHeight:28,headingGap:10,listHeight:160,availableHeight:900}),323);
});
test('a long scrolling list uses its full content height then stops at the display limit',async()=>{
 const {plannerCompactHeight}=await import('../src/planner-layout.mjs');
 const measured={panelHeight:612,workspaceHeight:487,headingHeight:28,headingGap:10,listHeight:1200};
 assert.equal(plannerCompactHeight({...measured,availableHeight:800}),800);
 assert.equal(plannerCompactHeight({...measured,availableHeight:2000}),1363);
});
test('empty and short checklists keep the same four-row floor while compacting',async()=>{
 const {plannerCompactHeight}=await import('../src/planner-layout.mjs');
 const measured={panelHeight:612,workspaceHeight:487,headingHeight:28,headingGap:10,minimumListHeight:156,availableHeight:800};
 assert.equal(plannerCompactHeight({...measured,listHeight:38}),319);
 assert.equal(plannerCompactHeight({...measured,listHeight:115}),319);
 assert.equal(plannerCompactHeight({...measured,listHeight:240}),403);
 assert.equal(plannerCompactHeight({...measured,listHeight:38,availableHeight:280}),280);
});
test('manual height wins over checklist content while respecting the available screen',async()=>{
 const {plannerCompactHeight}=await import('../src/planner-layout.mjs');
 const measured={panelHeight:612,workspaceHeight:487,headingHeight:28,headingGap:10,listHeight:160,availableHeight:800};
 assert.equal(plannerCompactHeight({...measured,manualHeight:550}),550);
 assert.equal(plannerCompactHeight({...measured,manualHeight:1000}),800);
 assert.equal(plannerCompactHeight({...measured,manualHeight:250.25}),251);
 assert.equal(plannerCompactHeight({...measured,manualHeight:null}),323);
});
test('fractional geometry rounds up only after the final bounded height is computed',async()=>{
 const {plannerCompactHeight}=await import('../src/planner-layout.mjs');
 assert.equal(plannerCompactHeight({panelHeight:500.25,workspaceHeight:400.1,headingHeight:27.25,headingGap:9.5,listHeight:100.25,availableHeight:800}),238);
 assert.equal(plannerCompactHeight({panelHeight:600,workspaceHeight:400,headingHeight:28,headingGap:10,listHeight:300,availableHeight:500.25}),500.25);
});
test('bad or negative geometry never produces a negative or nonfinite native height',async()=>{
 const {plannerCompactHeight}=await import('../src/planner-layout.mjs');
 assert.equal(plannerCompactHeight({panelHeight:100,workspaceHeight:487,headingHeight:28,headingGap:10,listHeight:160,availableHeight:800}),198);
 assert.equal(plannerCompactHeight({panelHeight:100,workspaceHeight:100,headingHeight:-2,headingGap:NaN,listHeight:40,availableHeight:800}),40);
 assert.equal(plannerCompactHeight({panelHeight:100,workspaceHeight:100,headingHeight:28,headingGap:10,listHeight:40,availableHeight:0}),0);
 assert.equal(plannerCompactHeight({panelHeight:100,workspaceHeight:100,headingHeight:28,headingGap:10,listHeight:40,availableHeight:800,manualHeight:-1}),78);
});
