import React,{memo,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Plus,Trash2} from 'lucide-react';
import {Button} from '../arc/button/button';
import './ideas-canvas.css';

type Note={id:string;title?:string;body:string;created:number};
type IdeasProps={s:any;dispatch:(action:any)=>void;notify:(message:string,undo?:()=>void)=>void};
const pageSize=80;
const firstLine=(body:string)=>body.split(/\r?\n/).find(line=>line.trim())?.trim().slice(0,200)||'';
const cardTitle=(note:Note)=>note.title?.trim()||firstLine(note.body)||'Untitled note';
const shortDate=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'});
const NoteCard=memo(function NoteCard({note,onOpen}:{note:Note;onOpen:(id:string)=>void}){
 return <button type="button" tabIndex={0} className="ideas-note-card" onClick={()=>onOpen(note.id)}><span className="ideas-card-title">{cardTitle(note)}</span><time dateTime={new Date(note.created).toISOString()}>{shortDate.format(note.created)}</time></button>;
});

/** The loose draft and every saved note remain in Panda's existing local state. */
export function IdeasCanvas({s,dispatch,notify}:IdeasProps){
 const [view,setView]=useState<'canvas'|'grid'>('canvas'),[shown,setShown]=useState(pageSize);
 const titleInput=useRef<HTMLInputElement>(null),bodyInput=useRef<HTMLTextAreaElement>(null),latest=useRef(s);
 const returnNote=useRef<string|null>(s.activeNoteId??null),focusAfter=useRef<'title'|'body'|null>(null),selectionAfter=useRef<{id:string;waitFor:string}|null>(null);
 const returnCaret=useRef<{start:number;end:number;scroll:number}|null>(null);
 latest.current=s;
 const notes:Note[]=s.notes??[],note=notes.find(item=>item.id===s.activeNoteId);
 const title=note?(note.title??''):(s.brainDumpTitle??'');
 const body=note?note.body:(s.brainDump??'');
 useLayoutEffect(()=>{
  if(view!=='canvas'||!bodyInput.current)return;
  const element=bodyInput.current;element.style.height='0px';element.style.height=`${Math.max(170,element.scrollHeight)}px`;
 },[view,note?.id,body]);
 useLayoutEffect(()=>{
  const pending=selectionAfter.current;if(!pending||!notes.some(item=>item.id===pending.waitFor)||!notes.some(item=>item.id===pending.id))return;
  selectionAfter.current=null;dispatch({type:'focusNote',id:pending.id});
 },[notes,dispatch]);
 useLayoutEffect(()=>{
  if(view!=='canvas'||!focusAfter.current||selectionAfter.current)return;
  const target=focusAfter.current;focusAfter.current=null;
  if(target==='title'){titleInput.current?.focus();return;}
  const element=bodyInput.current;if(!element)return;element.focus();
  const caret=returnCaret.current;if(caret){element.setSelectionRange(Math.min(caret.start,element.value.length),Math.min(caret.end,element.value.length));element.scrollTop=caret.scroll;returnCaret.current=null;}
 },[view,s.activeNoteId,notes]);
 useEffect(()=>{if(view==='grid')setShown(pageSize);},[view]);
 const storeDraft=()=>{
  const state=latest.current,hasDraft=Boolean((state.brainDump??'').trim()||(state.brainDumpTitle??'').trim());
  if(!hasDraft)return {id:null,retained:false};
  if((state.notes?.length??0)>=5000)return {id:null,retained:true};
  const id=crypto.randomUUID();dispatch({type:'saveNote',id});return {id,retained:false};
 };
 const allNotes=()=>{
  const before=note?.id??null,element=bodyInput.current;
  returnCaret.current=element?{start:element.selectionStart,end:element.selectionEnd,scroll:element.scrollTop}:null;
  const stored=storeDraft();returnNote.current=before??stored.id;
  // A retained draft can coexist with a saved note after reaching the library limit.
  if(before&&stored.id)selectionAfter.current={id:before,waitFor:stored.id};
  if(stored.retained)notify('Your draft is safe. Remove a saved note to make room.');
  setView('grid');
 };
 const back=()=>{
  const id=returnNote.current,exists=id&&latest.current.notes.some((item:Note)=>item.id===id);
  dispatch({type:'focusNote',id:exists?id:null});focusAfter.current='body';setView('canvas');
 };
 const openNote=(id:string)=>{
  if(!latest.current.notes.some((item:Note)=>item.id===id))return;
  storeDraft();selectionAfter.current=null;returnNote.current=id;returnCaret.current=null;
  dispatch({type:'focusNote',id});focusAfter.current='body';setView('canvas');
 };
 const newNote=()=>{
  const stored=storeDraft();
  if(stored.retained){notify('Remove a saved note before starting another. Your draft is safe.');return;}
  selectionAfter.current=null;returnNote.current=null;returnCaret.current=null;
  dispatch({type:'focusNote',id:null});focusAfter.current='title';setView('canvas');
 };
 const remove=()=>{
  if(!note)return;const removed=note,index=notes.findIndex(item=>item.id===removed.id);
  selectionAfter.current=null;returnNote.current=null;returnCaret.current=null;dispatch({type:'deleteNote',id:removed.id});
  notify('Note removed',()=>{
   const current=latest.current.notes as Note[];
   if(!current.some(item=>item.id===removed.id)&&current.length>=5000){notify('Remove a saved note to make room for this one.');return;}
   selectionAfter.current={id:removed.id,waitFor:removed.id};focusAfter.current='body';setView('canvas');
   dispatch({type:'restoreNote',note:removed,index});
  });
 };
 if(view==='grid')return <section className="ideas-canvas ideas-library" aria-label="All notes">
  <header className="ideas-canvas-header"><Button variant="ghost" size="sm" onClick={back}><ArrowLeft size={12}/> Back</Button><span className="ideas-library-heading">All notes</span><Button variant="ghost" size="sm" className="ideas-new-note" onClick={newNote}><Plus size={12}/> New note</Button></header>
  {notes.length?<><div className="ideas-note-grid">{notes.slice(0,shown).map(item=><NoteCard key={item.id} note={item} onOpen={openNote}/>)}</div>{shown<notes.length&&<div className="ideas-library-more"><span>{shown} of {notes.length.toLocaleString()} notes</span><Button variant="ghost" size="sm" onClick={()=>setShown(count=>count+pageSize)}>Show more</Button></div>}</>:<p className="ideas-empty-library">No notes yet.</p>}
 </section>;
 return <section className="ideas-canvas ideas-editor" aria-label="Note editor">
  <header className="ideas-canvas-header"><span className="ideas-note-heading">Note</span><div className="ideas-header-actions">{note&&<Button variant="ghost" size="sm" className="ideas-delete-note" aria-label="Delete note" onClick={remove}><Trash2 size={12}/></Button>}<Button variant="ghost" size="sm" onClick={allNotes}>All notes <ArrowRight size={12}/></Button></div></header>
  <div className="ideas-open-page"><input ref={titleInput} className="ideas-note-title" aria-label="Note title" placeholder="Untitled note" maxLength={200} value={title} onChange={event=>dispatch(note?{type:'updateNote',id:note.id,title:event.target.value}:{type:'noteDraftTitle',value:event.target.value})}/><textarea ref={bodyInput} className="ideas-note-body" aria-label="Note body" maxLength={100000} value={body} onChange={event=>dispatch(note?{type:'updateNote',id:note.id,body:event.target.value}:{type:'brainDump',value:event.target.value})}/></div>
 </section>;
}
