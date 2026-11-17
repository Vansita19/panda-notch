import {useRef} from 'react';
import {Maximize2,Minimize2} from 'lucide-react';
import {Button} from '../arc/button/button';

export function WorkspaceAction({active,onOpen,onDock}:{active:boolean;onOpen:()=>void;onDock:()=>void}){
 const start=useRef<{id:number;x:number;y:number}|null>(null);
 const suppressClick=useRef(false);
 return <Button type="button" variant="secondary" size="sm" className="workspace-action"
  aria-label={active?'Back to notch':'Pop out'}
  title={active?'Return to the notch':'Open in a window or drag down'}
  onPointerDown={event=>{
   if(!event.isPrimary||event.button!==0)return;
   suppressClick.current=false;
   if(active)return;
   start.current={id:event.pointerId,x:event.screenX,y:event.screenY};
   event.currentTarget.setPointerCapture(event.pointerId);
  }}
  onPointerUp={event=>{
   const origin=start.current;
   if(!origin||origin.id!==event.pointerId)return;
   start.current=null;
   const x=event.screenX-origin.x,y=event.screenY-origin.y;
   suppressClick.current=Math.hypot(x,y)>8;
   if(y>=48&&y>Math.abs(x))onOpen();
  }}
  onPointerCancel={()=>{start.current=null;suppressClick.current=true;}}
  onLostPointerCapture={()=>{start.current=null;}}
  onClick={event=>{
   if(event.detail!==0&&suppressClick.current)return;
   if(active)onDock();else onOpen();
  }}>
  {active?<Minimize2 size={14} strokeWidth={1.7} aria-hidden="true"/>:<Maximize2 size={14} strokeWidth={1.7} aria-hidden="true"/>}
 </Button>;
}
