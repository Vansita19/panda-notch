const validEvent=event=>event&&typeof event.title==='string'&&!!event.title.trim()&&Number.isFinite(event.start)&&Number.isFinite(event.end)&&event.end>event.start&&Number.isFinite(new Date(event.start).getTime())&&Number.isFinite(new Date(event.end).getTime());

/** One local calendar day supplies both the tile's total and its remaining event rows. */
export function deriveMenuUpcoming(events,now=Date.now(),{limit=3}={}){
 if(!Array.isArray(events)||!Number.isFinite(now)||!Number.isFinite(new Date(now).getTime()))return null;
 const valid=events.filter(validEvent),remaining=valid.filter(event=>event.end>now).sort((a,b)=>a.start-b.start);
 if(!remaining.length)return null;
 const first=remaining[0],day=new Date(first.start<=now?now:first.start);day.setHours(0,0,0,0);
 const following=new Date(day);following.setDate(following.getDate()+1);
 const start=+day,end=+following,overlaps=event=>event.start<end&&event.end>start;
 const count=Math.max(1,Math.min(3,Math.trunc(limit)||3));
 return {date:start,eventCount:valid.filter(overlaps).length,events:remaining.filter(overlaps).slice(0,count)};
}
