"""Small original sounds, rendered once at build time; no runtime synthesizer."""
import math, struct, wave
from pathlib import Path
RATE=22050
out=Path(__file__).resolve().parents[1]/'assets'/'audio'
out.mkdir(parents=True,exist_ok=True)
def render(name,duration,notes):
 samples=[0.0]*int(duration*RATE)
 for start,length,f0,f1,amplitude in notes:
  phase=0.0
  for i in range(int(length*RATE)):
   t=i/RATE;u=t/length
   freq=f0+(f1-f0)*u
   phase+=2*math.pi*freq/RATE
   envelope=math.sin(math.pi*u)**2*math.exp(-1.5*u)
   sample=(math.sin(phase)+0.12*math.sin(2*phase))/1.12
   at=int(start*RATE)+i
   if at<len(samples):samples[at]+=sample*envelope*amplitude
 with wave.open(str(out/(name+'.wav')),'wb') as f:
  f.setnchannels(1);f.setsampwidth(2);f.setframerate(RATE)
  f.writeframes(b''.join(struct.pack('<h',int(max(-1,min(1,s))*32767)) for s in samples))
 print(name, 'duration',duration,'peak',round(max(abs(s) for s in samples),3))
render('tap',.23,[(0,.19,620,870,.42)])
render('tap2',.34,[(0,.13,780,1050,.35),(.13,.17,960,680,.32)])
render('reminder',.76,[(0,.32,660,660,.34),(.19,.36,880,880,.28),(.38,.34,990,990,.20)])

render('timer',1.45,[(0,.55,660,660,.46),(.27,.6,830,830,.40),(.58,.76,990,990,.38)])
