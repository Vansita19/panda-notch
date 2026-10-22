const editableSelector='input,textarea,select,[contenteditable],[role="textbox"]';
const editable=node=>!!node&&(node.isContentEditable===true||!!(node.closest?.(editableSelector)||node.parentElement?.closest?.(editableSelector)));

// Eligibility only: the caller must resolve a live, explicitly selected item in its own scope.
export function isDeleteKeyEvent(event,activeElement){
 if(!event||!['Delete','Backspace'].includes(event.key)||event.defaultPrevented||event.repeat||event.isComposing||event.keyCode===229||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return false;
 const document=event.target?.ownerDocument??event.view?.document??globalThis.document;
 const focused=activeElement===undefined?document?.activeElement:activeElement;
 return !editable(event.target)&&!editable(focused);
}
