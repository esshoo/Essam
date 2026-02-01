// Simple WebAudio tones (no external files)
// Browsers require a user gesture before audio can play reliably.

let ctx = null;

function getCtx(){
  if(ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC();
  return ctx;
}

export async function primeAudio(){
  try{
    const c = getCtx();
    if(c.state === "suspended") await c.resume();
  }catch{}
}

function tone(freq=880, dur=0.12, type="sine", vol=0.06){
  const c = getCtx();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;

  const now = c.currentTime;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(vol, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  o.connect(g);
  g.connect(c.destination);
  o.start(now);
  o.stop(now + dur + 0.02);
}

export function beep(){
  try{ tone(880, 0.10, "sine", 0.05); tone(1320, 0.08, "sine", 0.035); }catch{}
}

export function pop(){
  try{ tone(520, 0.08, "triangle", 0.05); }catch{}
}

export function errorBeep(){
  try{ tone(220, 0.14, "sawtooth", 0.05); tone(180, 0.14, "sawtooth", 0.04); }catch{}
}

// A short ringtone pattern (~2s). Returns a stop() function.
export function ring(){
  let stopped = false;
  let timer = null;

  const seq = [
    [784, 0.16],[0,0.07],[784,0.16],[0,0.07],[784,0.16],[0,0.20],
    [660,0.18],[0,0.07],[660,0.18],[0,0.07],[660,0.18],[0,0.20],
  ];

  const play = async ()=>{
    await primeAudio();
    let t = 0;
    for(const [f,d] of seq){
      if(stopped) return;
      if(f>0) tone(f,d,"sine",0.06);
      t += (d*1000);
      await new Promise(r=>{ timer=setTimeout(r, d*1000); });
    }
    if(!stopped) timer=setTimeout(play, 250); // loop
  };

  play();

  return ()=>{ stopped=true; try{ clearTimeout(timer); }catch{} };
}
