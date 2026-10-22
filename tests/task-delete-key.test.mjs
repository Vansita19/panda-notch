import test from 'node:test';
import assert from 'node:assert/strict';

function element(tag='div',attrs={},parentElement=null){
 return {tag,parentElement,closest(selector){
  const matched=selector.split(',').some(part=>{const token=part.trim();return token===tag||token==='[contenteditable]'&&Object.hasOwn(attrs,'contenteditable')||/^\[role=["']?textbox["']?\]$/.test(token)&&attrs.role==='textbox';});
  return matched?this:parentElement?.closest(selector)??null;
 }};
}
const key=(key='Delete',patch={})=>({key,target:element(),defaultPrevented:false,repeat:false,isComposing:false,metaKey:false,ctrlKey:false,altKey:false,shiftKey:false,...patch});

test('Delete and the Mac Backspace key are eligible without consuming the event',async()=>{
 const {isDeleteKeyEvent}=await import('../src/task-delete-key.mjs');
 for(const name of ['Delete','Backspace']){const event=key(name);assert.equal(isDeleteKeyEvent(event),true);assert.equal(event.defaultPrevented,false);}
 for(const name of ['Enter','Escape','d','Del',' '])assert.equal(isDeleteKeyEvent(key(name)),false);
 assert.equal(isDeleteKeyEvent(null),false);
});
test('handled, held, composed, and modified keys never request deletion',async()=>{
 const {isDeleteKeyEvent}=await import('../src/task-delete-key.mjs');
 for(const name of ['Delete','Backspace'])for(const patch of [{defaultPrevented:true},{repeat:true},{isComposing:true},{keyCode:229},{metaKey:true},{ctrlKey:true},{altKey:true},{shiftKey:true}])assert.equal(isDeleteKeyEvent(key(name,patch)),false,`${name}: ${JSON.stringify(patch)}`);
});
test('editing targets and descendants keep their native Delete and Backspace behavior',async()=>{
 const {isDeleteKeyEvent}=await import('../src/task-delete-key.mjs');
 for(const target of [element('input'),element('textarea'),element('select'),element('div',{contenteditable:''}),element('div',{contenteditable:'false'}),element('div',{role:'textbox'}),element('span',{},element('div',{contenteditable:'true'})),{isContentEditable:true}]){
  assert.equal(isDeleteKeyEvent(key('Delete',{target})),false);assert.equal(isDeleteKeyEvent(key('Backspace',{target})),false);
 }
 assert.equal(isDeleteKeyEvent(key('Delete',{target:{parentElement:element('div',{contenteditable:'true'})}})),false);
});
test('an editable activeElement blocks deletion even if the event target is outside it',async()=>{
 const {isDeleteKeyEvent}=await import('../src/task-delete-key.mjs'),target=element(),active=element('span',{},element('div',{role:'textbox'}));
 target.ownerDocument={activeElement:active};assert.equal(isDeleteKeyEvent(key('Delete',{target})),false);
 assert.equal(isDeleteKeyEvent(key('Delete'),element('input')),false);
 assert.equal(isDeleteKeyEvent(key('Delete'),element('button')),true);
});
