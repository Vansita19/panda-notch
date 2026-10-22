// The grid's top changes as its viewport scrolls. Keep both points in grid space.
export function plannerMoveDelta(clientY,gridTop,originGridY,gridHeight,rangeDuration){
 if(![clientY,gridTop,originGridY,gridHeight,rangeDuration].every(Number.isFinite)||gridHeight<=0||rangeDuration<=0)return 0;
 return ((clientY-gridTop)-originGridY)/gridHeight*rangeDuration;
}

export function plannerHourLabel(hour,withMinutes=false){
 if(!Number.isFinite(hour)||hour<0||hour>24)return '';
 const minutes=Math.round(hour*60)%1440,hourOfDay=Math.floor(minutes/60);
 return `${hourOfDay%12||12}${withMinutes?`:${String(minutes%60).padStart(2,'0')}`:''} ${hourOfDay<12?'AM':'PM'}`;
}
