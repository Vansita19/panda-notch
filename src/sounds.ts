import {host,native} from './bridge';
export type PandaSound='tap'|'tap2'|'reminder'|'timer';
let player:HTMLAudioElement|null=null,lastPlayed=0;
export function playPandaSound(kind:PandaSound){
 if(native){host('sound',{kind});return;}
 const now=Date.now();if(kind!=='timer'&&now-lastPlayed<160)return;lastPlayed=now;
 player??=new Audio();player.pause();player.src=`audio/${kind}.wav`;player.volume=kind==='timer'?.6:.45;
 // Browser previews may require an initial click; the Mac app plays locally through NSSound.
 void player.play().catch(()=>{});
}
