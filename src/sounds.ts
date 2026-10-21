import {host,native} from './bridge';
export type PandaSound='tap'|'tap2'|'reminder'|'timer'|'select';
let player:HTMLAudioElement|null=null,lastPlayed=0;
export function playPandaSound(kind:PandaSound){
 if(native){host('sound',{kind});return;}
 const now=Date.now();if(kind!=='timer'&&now-lastPlayed<160)return;lastPlayed=now;
 player??=new Audio();player.pause();player.src=`audio/${kind}.wav`;player.volume=kind==='select'?1:['timer','reminder'].includes(kind)?.85:.45;
 // Browser previews may require an initial click; the Mac app plays locally through NSSound.
 void player.play().catch(()=>{});
}
