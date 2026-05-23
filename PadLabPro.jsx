import { useState, useEffect, useRef, useCallback } from "react"

const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

const ALL_DRUMS = [
  { id:'kickD',  name:'Kick Deep',   type:'kick',  freq:60,   decay:0.5,  pitchDrop:35  },
  { id:'subK',   name:'Sub Kick',    type:'kick',  freq:40,   decay:0.7,  pitchDrop:20  },
  { id:'clap1',  name:'Clap',        type:'noise', freq:1200, decay:0.18, filter:1800   },
  { id:'snr808', name:'Snare 808',   type:'noise', freq:700,  decay:0.22, filter:900    },
  { id:'clapS',  name:'Clap Soft',   type:'noise', freq:900,  decay:0.12, filter:1400   },
  { id:'hihatC', name:'Hi-Hat Cl.',  type:'noise', freq:9000, decay:0.04, filter:10000  },
  { id:'hihatO', name:'Hi-Hat Op.',  type:'noise', freq:7000, decay:0.25, filter:8000   },
  { id:'tomH',   name:'Tom High',    type:'tom',   freq:210,  decay:0.32, pitchDrop:100 },
  { id:'tomM',   name:'Tom Mid',     type:'tom',   freq:155,  decay:0.40, pitchDrop:75  },
  { id:'tomL',   name:'Tom Low',     type:'tom',   freq:100,  decay:0.48, pitchDrop:50  },
  { id:'rimshot',name:'Rimshot',     type:'wood',  freq:1300, decay:0.07, pitchDrop:200 },
  { id:'wood1',  name:'Wood Block',  type:'wood',  freq:850,  decay:0.09, pitchDrop:55  },
  { id:'tumb1',  name:'Tumb',        type:'noise', freq:320,  decay:0.11, filter:520    },
  { id:'crash',  name:'Crash',       type:'noise', freq:5000, decay:0.60, filter:7000   },
  { id:'ride',   name:'Ride',        type:'noise', freq:4000, decay:0.35, filter:6000   },
  { id:'perc1',  name:'Perc 1',      type:'wood',  freq:600,  decay:0.05, pitchDrop:80  },
]

const TIMBRES = [
  { id:'p1',  name:'Pad Padrão',  kit:'Drum Kit 1',      color:'#7c5cbf' },
  { id:'sh1', name:'Pad Shimmer', kit:'Worship Kit v2',  color:'#4a9abf' },
  { id:'wp1', name:'Worship Pro', kit:'Worship Ambient', color:'#e8a44a' },
  { id:'an1', name:'Analog Pad',  kit:'Vintage Synth',   color:'#bf7a4a' },
  { id:'dk1', name:'Dark Pad',    kit:'Cinematic Kit',   color:'#5a4a8a' },
]

const NOTE_FREQ = {
  C:261.63,'C#':277.18,D:293.66,'D#':311.13,E:329.63,
  F:349.23,'F#':369.99,G:392.00,'G#':415.30,A:440.00,'A#':466.16,B:493.88,
}

const TIMBRE_PRESET = {
  p1: { wave:'sawtooth', detune:7,  fc:800,  Q:2   },
  sh1:{ wave:'sine',     detune:12, fc:3000, Q:1   },
  wp1:{ wave:'sine',     detune:8,  fc:2500, Q:1.5 },
  an1:{ wave:'sawtooth', detune:3,  fc:600,  Q:5   },
  dk1:{ wave:'square',   detune:0,  fc:400,  Q:8   },
}

const DRUM_COLOR = { kick:'#e05555', noise:'#55a0e0', tom:'#55c8a0', wood:'#e0a055' }

function makeNotePads() {
  return NOTES.map(n => ({ note:n, audioBuffer:null, fileName:null }))
}
function makeDrumPads() {
  return ALL_DRUMS.slice(0,8).map(d => ({ ...d, audioBuffer:null, fileName:null }))
}

export default function PadLabPro() {
  const [notePads,  setNotePads]  = useState(makeNotePads)
  const [drumPads,  setDrumPads]  = useState(makeDrumPads)
  const [selNote,   setSelNote]   = useState(null)
  const [flashDrum, setFlashDrum] = useState(null)
  const [timbre,    setTimbre]    = useState(TIMBRES[0])
  const [isTimbreOpen,    setIsTimbreOpen]    = useState(false)
  const [editingPad,      setEditingPad]      = useState(null)
  const [ripples,         setRipples]         = useState([])
  const [isPlaying,       setIsPlaying]       = useState(false)
  const [bpm,             setBpm]             = useState(120)
  const [metVol,          setMetVol]          = useState(80)
  const [pan,             setPan]             = useState(50)
  const [timeSig,         setTimeSig]         = useState('4/4')
  const [activeBeat,      setActiveBeat]      = useState(-1)
  const [tapTimes,        setTapTimes]        = useState([])
  const [showMetSettings, setShowMetSettings] = useState(false)

  const rippleId      = useRef(0)
  const audioCtxRef   = useRef(null)
  const synthNodes    = useRef({})
  const uploadNodes   = useRef({})
  const metroRef      = useRef(null)
  const beatCount     = useRef(0)
  const fileInputRef  = useRef(null)
  const editingPadRef = useRef(null)
  const notePadsRef   = useRef(notePads)
  const drumPadsRef   = useRef(drumPads)
  const lastClickTime = useRef({})

  useEffect(() => { editingPadRef.current = editingPad }, [editingPad])
  useEffect(() => { notePadsRef.current   = notePads   }, [notePads])
  useEffect(() => { drumPadsRef.current   = drumPads   }, [drumPads])

  const getCtx = useCallback(() => {
    if (!audioCtxRef.current)
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
    return audioCtxRef.current
  }, [])

  const addRipple = useCallback(id => {
    const rid = rippleId.current++
    setRipples(r => [...r, { id:rid, target:id }])
    setTimeout(() => setRipples(r => r.filter(x => x.id !== rid)), 700)
  }, [])

  // ── Synth ─────────────────────────────────────────────────────────────────
  const playSynth = useCallback((note, t) => {
    const ctx = getCtx()
    const now = ctx.currentTime
    const pr  = TIMBRE_PRESET[t.id] || TIMBRE_PRESET.p1
    const hz  = NOTE_FREQ[note]
    if (synthNodes.current[note]) {
      try {
        synthNodes.current[note].g.gain.setTargetAtTime(0, now, 0.08)
        const { o1, o2 } = synthNodes.current[note]
        setTimeout(() => { try { o1.stop(); o2.stop() } catch(_){} }, 350)
      } catch(_) {}
      delete synthNodes.current[note]
    }
    const o1=ctx.createOscillator(), o2=ctx.createOscillator()
    const flt=ctx.createBiquadFilter(), g=ctx.createGain()
    o1.type=pr.wave; o1.frequency.value=hz
    o2.type='sine'; o2.frequency.value=hz*1.005; o2.detune.value=pr.detune
    flt.type='lowpass'
    flt.frequency.setValueAtTime(180,now)
    flt.frequency.linearRampToValueAtTime(pr.fc,now+0.12)
    flt.frequency.exponentialRampToValueAtTime(pr.fc*0.38,now+2.6)
    flt.Q.value=pr.Q
    g.gain.setValueAtTime(0,now); g.gain.linearRampToValueAtTime(0.3,now+0.06)
    o1.connect(flt); o2.connect(flt); flt.connect(g); g.connect(ctx.destination)
    o1.start(now); o2.start(now)
    synthNodes.current[note]={o1,o2,g}
  }, [getCtx])

  const stopSynth = useCallback(note => {
    const ctx=getCtx(), now=ctx.currentTime
    const n=synthNodes.current[note]; if(!n) return
    try {
      n.g.gain.setTargetAtTime(0,now,0.3)
      const {o1,o2}=n
      setTimeout(()=>{ try{o1.stop();o2.stop()}catch(_){} },1200)
    } catch(_) {}
    delete synthNodes.current[note]
  }, [getCtx])

  // ── Uploaded audio ────────────────────────────────────────────────────────
  const playUploaded = useCallback((buffer, key) => {
    const ctx=getCtx(), now=ctx.currentTime
    if (uploadNodes.current[key]) {
      try {
        uploadNodes.current[key].g.gain.setTargetAtTime(0,now,0.1)
        const s=uploadNodes.current[key].src
        setTimeout(()=>{ try{s.stop()}catch(_){} },500)
      } catch(_) {}
      delete uploadNodes.current[key]
    }
    const src=ctx.createBufferSource(); src.buffer=buffer; src.loop=true
    const g=ctx.createGain(); g.gain.setValueAtTime(0,now); g.gain.linearRampToValueAtTime(0.85,now+0.1)
    src.connect(g); g.connect(ctx.destination); src.start(now)
    uploadNodes.current[key]={src,g}
  }, [getCtx])

  const stopUploaded = useCallback(key => {
    const ctx=getCtx(), now=ctx.currentTime
    const n=uploadNodes.current[key]; if(!n) return
    try {
      n.g.gain.setTargetAtTime(0,now,0.35)
      const s=n.src
      setTimeout(()=>{ try{s.stop()}catch(_){} },1400)
    } catch(_) {}
    delete uploadNodes.current[key]
  }, [getCtx])

  // ── Note click ────────────────────────────────────────────────────────────
  const handleNoteClick = useCallback(index => {
    const now=Date.now(), key='n'+index
    if (now-(lastClickTime.current[key]||0)<300) return
    lastClickTime.current[key]=now
    setNotePads(pads => {
      const pad=pads[index], note=pad.note
      setSelNote(prev => {
        if (prev===note) {
          pad.audioBuffer ? stopUploaded(note) : stopSynth(note)
          return null
        }
        if (prev!==null) {
          const prevPad=pads.find(p=>p.note===prev)
          if (prevPad) prevPad.audioBuffer ? stopUploaded(prev) : stopSynth(prev)
        }
        pad.audioBuffer ? playUploaded(pad.audioBuffer,note) : playSynth(note,timbre)
        addRipple(key)
        return note
      })
      return pads
    })
  }, [stopSynth,stopUploaded,playSynth,playUploaded,addRipple,timbre])

  // ── Drum ──────────────────────────────────────────────────────────────────
  const playDrumSound = useCallback(pad => {
    const ctx=getCtx(), now=ctx.currentTime
    const master=ctx.createGain(); master.gain.value=0.8; master.connect(ctx.destination)
    if (pad.audioBuffer) {
      const src=ctx.createBufferSource(); src.buffer=pad.audioBuffer
      const g=ctx.createGain(); g.gain.setValueAtTime(0.9,now)
      src.connect(g); g.connect(master); src.start(now); return
    }
    if (pad.type==='kick') {
      const o=ctx.createOscillator(),g=ctx.createGain()
      o.type='sine'
      o.frequency.setValueAtTime(pad.freq*3.5,now)
      o.frequency.exponentialRampToValueAtTime(pad.pitchDrop||40,now+0.05)
      o.frequency.exponentialRampToValueAtTime(pad.freq,now+pad.decay)
      g.gain.setValueAtTime(1,now); g.gain.exponentialRampToValueAtTime(0.001,now+pad.decay)
      o.connect(g); g.connect(master); o.start(now); o.stop(now+pad.decay+0.02)
    } else if (pad.type==='noise') {
      const size=ctx.sampleRate*0.4, buf=ctx.createBuffer(1,size,ctx.sampleRate)
      const d=buf.getChannelData(0); for(let i=0;i<size;i++) d[i]=Math.random()*2-1
      const src=ctx.createBufferSource(); src.buffer=buf
      const flt=ctx.createBiquadFilter(); flt.type='bandpass'
      flt.frequency.value=pad.filter||pad.freq; flt.Q.value=1.8
      const g=ctx.createGain()
      g.gain.setValueAtTime(1,now); g.gain.exponentialRampToValueAtTime(0.001,now+pad.decay)
      src.connect(flt); flt.connect(g); g.connect(master); src.start(now); src.stop(now+pad.decay+0.02)
    } else if (pad.type==='tom') {
      const o=ctx.createOscillator(),g=ctx.createGain()
      o.type='sine'
      o.frequency.setValueAtTime(pad.freq,now)
      o.frequency.exponentialRampToValueAtTime(pad.pitchDrop||50,now+pad.decay)
      g.gain.setValueAtTime(0.9,now); g.gain.exponentialRampToValueAtTime(0.001,now+pad.decay)
      o.connect(g); g.connect(master); o.start(now); o.stop(now+pad.decay+0.02)
    } else if (pad.type==='wood') {
      const o=ctx.createOscillator(),g=ctx.createGain()
      o.type='triangle'
      o.frequency.setValueAtTime(pad.freq,now)
      o.frequency.exponentialRampToValueAtTime(pad.pitchDrop||50,now+pad.decay)
      g.gain.setValueAtTime(0.8,now); g.gain.exponentialRampToValueAtTime(0.001,now+pad.decay)
      o.connect(g); g.connect(master); o.start(now); o.stop(now+pad.decay+0.02)
    }
  }, [getCtx])

  const handleDrumClick = useCallback((pad, index) => {
    playDrumSound(pad)
    addRipple('d'+index)
    setFlashDrum(pad.id)
    setTimeout(()=>setFlashDrum(null),150)
  }, [playDrumSound,addRipple])

  // ── Metronome ─────────────────────────────────────────────────────────────
  const playClick = useCallback((isDown,vol) => {
    const ctx=getCtx(), now=ctx.currentTime
    const o=ctx.createOscillator(),g=ctx.createGain()
    o.type='sine'; o.frequency.value=isDown?1200:800
    g.gain.setValueAtTime((vol/100)*0.45,now)
    g.gain.exponentialRampToValueAtTime(0.001,now+0.05)
    o.connect(g); g.connect(ctx.destination); o.start(now); o.stop(now+0.07)
  }, [getCtx])

  useEffect(()=>{
    if (isPlaying) {
      const beats=parseInt(timeSig.split('/')[0])
      const interval=(60/bpm)*1000
      beatCount.current=0
      const tick=()=>{
        playClick(beatCount.current%beats===0,metVol)
        setActiveBeat(beatCount.current%beats)
        beatCount.current++
      }
      tick(); metroRef.current=setInterval(tick,interval)
    } else { clearInterval(metroRef.current); setActiveBeat(-1) }
    return ()=>clearInterval(metroRef.current)
  },[isPlaying,bpm,timeSig,metVol,playClick])

  const handleTap=()=>{
    const now=Date.now()
    const taps=[...tapTimes.filter(t=>now-t<3000),now]
    setTapTimes(taps)
    if(taps.length>=2){
      const avg=taps.slice(1).map((t,i)=>t-taps[i]).reduce((a,b)=>a+b)/(taps.length-1)
      setBpm(Math.round(60000/avg))
    }
  }

  // ── File upload ───────────────────────────────────────────────────────────
  const handleFileChange = async e => {
    const file=e.target.files?.[0]
    e.target.value=''
    if (!file) return
    let audioBuffer
    try {
      const ctx=getCtx()
      audioBuffer=await ctx.decodeAudioData(await file.arrayBuffer())
    } catch(err) { console.error('Audio decode failed:',err); return }
    const ep=editingPadRef.current; if(!ep) return
    if (ep.type==='note') {
      setNotePads(pads=>{ const u=[...pads]; u[ep.index]={...u[ep.index],audioBuffer,fileName:file.name}; return u })
    } else if (ep.type==='drum') {
      setDrumPads(pads=>{ const u=[...pads]; u[ep.index]={...u[ep.index],audioBuffer,fileName:file.name}; return u })
    }
  }

  const triggerUpload=()=>fileInputRef.current?.click()

  const removeNoteAudio=index=>{
    const note=notePadsRef.current[index]?.note
    if(note){ stopUploaded(note); setSelNote(prev=>prev===note?null:prev) }
    setNotePads(p=>{ const u=[...p]; u[index]={...u[index],audioBuffer:null,fileName:null}; return u })
  }
  const removeDrumAudio=index=>{
    setDrumPads(p=>{ const u=[...p]; u[index]={...u[index],audioBuffer:null,fileName:null}; return u })
  }

  const ac=timbre.color
  const beats=parseInt(timeSig.split('/')[0])

  return (
    <div className="min-h-screen bg-[#06050f] flex justify-center items-center p-3"
      style={{fontFamily:"'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif"}}>

      <style>{`
        @keyframes ripple{0%{transform:scale(1);opacity:.7}100%{transform:scale(3);opacity:0}}
        @keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes waveBar{0%,100%{transform:scaleY(.2)}50%{transform:scaleY(1)}}
        @keyframes beatFlash{0%{opacity:1;transform:scale(1.2)}100%{opacity:.3;transform:scale(1)}}
        .ripple-ring{animation:ripple .65s cubic-bezier(.2,.8,.4,1) forwards;pointer-events:none}
        .sheet-up{animation:slideUp .28s cubic-bezier(.32,.72,0,1) forwards}
        .fade-in{animation:fadeIn .18s ease forwards}
        .beat-active{animation:beatFlash .13s ease forwards}
        input[type=range]{-webkit-appearance:none;height:3px;border-radius:2px;outline:none}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#fff;cursor:pointer;box-shadow:0 0 6px rgba(0,0,0,.5)}
        ::-webkit-scrollbar{width:0}
        .nb:active{transform:scale(.92);}
        .db:active{transform:scale(.88);}
        .ei{opacity:0;transition:opacity .12s}
        .nb:hover .ei,.db:hover .ei{opacity:1}
      `}</style>

      <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileChange}/>

      {/* Phone shell */}
      <div className="w-full max-w-[390px] flex flex-col relative overflow-hidden text-white"
        style={{
          height:860,
          background:'linear-gradient(180deg,#0e0b1e 0%,#09071a 60%,#0c0918 100%)',
          borderRadius:42,
          border:'1px solid rgba(255,255,255,0.06)',
          boxShadow:`0 0 0 1px rgba(255,255,255,0.03),0 50px 100px rgba(0,0,0,.95),0 0 80px ${ac}15`,
        }}>

        <div className="absolute top-0 inset-x-0 h-60 pointer-events-none"
          style={{background:`radial-gradient(ellipse at 50% -5%,${ac}20 0%,transparent 65%)`}}/>

        {/* Header */}
        <div className="relative z-10 px-4 pt-4 pb-2 flex justify-between items-center">
          <button className="w-9 h-9 flex flex-col justify-center gap-[5px] items-start pl-2 hover:bg-white/5 rounded-xl transition">
            <span className="w-[18px] h-[2px] rounded-full bg-zinc-400"/>
            <span className="w-3 h-[2px] rounded-full bg-zinc-600"/>
            <span className="w-[14px] h-[2px] rounded-full bg-zinc-600"/>
          </button>
          <div className="flex items-end gap-[3px]">
            {[10,16,22,14,8,18].map((h,i)=>(
              <div key={i} className="w-[5px] rounded-t-sm transition-all duration-500"
                style={{height:h,background:(i===2||i===5)?ac:`rgba(255,255,255,${.1+i*.08})`}}/>
            ))}
          </div>
          <button onClick={()=>setIsTimbreOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition active:scale-95 hover:bg-white/5"
            style={{border:`1px solid ${ac}33`}}>
            <div className="w-1.5 h-1.5 rounded-full" style={{background:ac,boxShadow:`0 0 5px ${ac}`}}/>
            <span className="text-[11px] font-semibold text-zinc-300">{timbre.name}</span>
            <span className="text-zinc-600 text-[9px]">▼</span>
          </button>
        </div>

        {/* Metronome bar */}
        <div className="relative z-10 mx-4 mb-2 rounded-2xl overflow-hidden"
          style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)'}}>
          <div className="flex items-center gap-2 px-3 py-2.5">
            <button onClick={()=>setIsPlaying(p=>!p)}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition active:scale-90"
              style={{background:isPlaying?'#c0392b':ac,boxShadow:isPlaying?'0 0 14px #c0392b55':`0 0 14px ${ac}55`}}>
              <span className="text-white text-[13px] font-bold">{isPlaying?'■':'▶'}</span>
            </button>
            <div className="flex items-center gap-1">
              <button onClick={()=>setBpm(b=>Math.max(40,b-1))}
                className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-zinc-400 text-sm font-bold hover:bg-white/10 transition active:scale-90">−</button>
              <div className="text-center w-14">
                <div className="text-xl font-bold tabular-nums leading-none" style={{color:ac}}>{bpm}</div>
                <div className="text-[8px] text-zinc-600 uppercase tracking-widest">BPM</div>
              </div>
              <button onClick={()=>setBpm(b=>Math.min(240,b+1))}
                className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-zinc-400 text-sm font-bold hover:bg-white/10 transition active:scale-90">+</button>
            </div>
            <div className="flex gap-1.5 items-center flex-1 justify-center">
              {Array.from({length:beats}).map((_,i)=>{
                const isLit=activeBeat===i
                return (
                  <div key={i} className={isLit?'beat-active':''}
                    style={{
                      width:i===0?10:7, height:i===0?10:7, borderRadius:'50%',
                      background:isLit?(i===0?'#fff':ac):'rgba(255,255,255,0.1)',
                      boxShadow:isLit?`0 0 10px ${i===0?'#ffffffaa':ac}`:'none',
                      transition:'background .05s',
                    }}/>
                )
              })}
            </div>
            <button onClick={handleTap}
              className="text-[10px] font-semibold px-2 py-1.5 rounded-lg transition active:scale-90"
              style={{background:`${ac}18`,color:ac,border:`1px solid ${ac}33`}}>TAP</button>
            <button onClick={()=>setShowMetSettings(s=>!s)}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/5 transition"
              style={{color:showMetSettings?ac:'#4a4a5a'}}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4">
                <circle cx="7" cy="7" r="2.5"/>
                <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.9 2.9l1.1 1.1M10 10l1.1 1.1M10 4l1.1-1.1M2.9 11.1L4 10"/>
              </svg>
            </button>
          </div>
          {showMetSettings && (
            <div className="px-3 pb-3 border-t border-white/5 pt-2.5 space-y-2.5">
              <div>
                <input type="range" min="40" max="240" value={bpm}
                  onChange={e=>setBpm(parseInt(e.target.value))}
                  className="w-full" style={{accentColor:ac,background:'#1a1530'}}/>
                <div className="flex justify-between text-[9px] text-zinc-700 mt-0.5"><span>40</span><span>240</span></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex justify-between text-[10px] text-zinc-500 mb-1"><span>Volume</span><span>{metVol}%</span></div>
                  <input type="range" min="0" max="100" value={metVol}
                    onChange={e=>setMetVol(parseInt(e.target.value))}
                    className="w-full" style={{accentColor:ac,background:'#1a1530'}}/>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-zinc-500 mb-1"><span>Pan</span><span className="text-zinc-700">L·C·R</span></div>
                  <input type="range" min="0" max="100" value={pan}
                    onChange={e=>setPan(parseInt(e.target.value))}
                    className="w-full" style={{accentColor:'rgba(255,255,255,0.3)',background:'#1a1530'}}/>
                </div>
              </div>
              <div className="flex gap-1.5">
                {['4/4','3/4','6/8'].map(s=>(
                  <button key={s} onClick={()=>setTimeSig(s)}
                    className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition"
                    style={{
                      background:timeSig===s?ac:'rgba(255,255,255,0.05)',
                      color:timeSig===s?'#fff':'rgba(255,255,255,0.35)',
                      border:`1px solid ${timeSig===s?ac:'rgba(255,255,255,0.07)'}`,
                    }}>{s}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pads 50/50 */}
        <div className="relative z-10 flex-1 flex flex-col px-4 pb-4 gap-2.5 overflow-hidden">

          {/* Note pads */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="text-[8px] uppercase tracking-[.15em] mb-1.5 flex items-center gap-2" style={{color:`${ac}60`}}>
              <span>Ambient Pads</span>
              <div className="flex-1 h-px" style={{background:`${ac}18`}}/>
              <span className="text-zinc-700">2× clique p/ editar</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 flex-1">
              {notePads.map((pad,index)=>{
                const isOn=selNote===pad.note, hasAudio=!!pad.audioBuffer
                const hasRipple=ripples.some(r=>r.target==='n'+index)
                return (
                  <button key={index}
                    className="nb rounded-2xl relative overflow-hidden flex flex-col items-center justify-center transition-all duration-100"
                    style={{
                      background:isOn?`linear-gradient(145deg,${ac}cc,${ac}66)`:hasAudio?`linear-gradient(145deg,${ac}28,${ac}0e)`:'rgba(255,255,255,0.04)',
                      border:`1px solid ${isOn?ac+'aa':hasAudio?ac+'44':'rgba(255,255,255,0.07)'}`,
                      color:isOn?'#fff':hasAudio?ac:'rgba(255,255,255,0.4)',
                      boxShadow:isOn?`0 0 18px ${ac}44,inset 0 1px 0 rgba(255,255,255,0.2)`:'none',
                    }}
                    onClick={()=>handleNoteClick(index)}
                    onDoubleClick={()=>setEditingPad({type:'note',index})}>
                    {hasRipple&&<div className="ripple-ring absolute inset-0 rounded-2xl" style={{border:`2px solid ${ac}`}}/>}
                    {isOn&&<div className="absolute inset-0 opacity-15 pointer-events-none" style={{background:'radial-gradient(circle at 50% 15%,white,transparent 55%)'}}/>}
                    <div className="flex flex-col items-center gap-0.5 relative z-10">
                      {hasAudio&&<span className="text-[13px]" style={{filter:`drop-shadow(0 0 4px ${ac})`}}>🎵</span>}
                      <span className={`font-bold tracking-wide ${hasAudio?'text-[10px]':'text-[13px]'}`}>{pad.note}</span>
                      {hasAudio&&<span className="text-[7px] truncate max-w-[44px] leading-none text-center opacity-70">{pad.fileName?.replace(/\.[^.]+$/,'').slice(0,8)}</span>}
                    </div>
                    {isOn&&(
                      <div className="absolute bottom-1.5 flex gap-[2px] items-end pointer-events-none">
                        {[.3,.6,.9,.5,.75].map((s,i)=>(
                          <div key={i} className="w-[2px] bg-white rounded-full"
                            style={{height:5,transformOrigin:'bottom',animation:`waveBar ${.36+i*.06}s ease-in-out ${i*.04}s infinite alternate`,opacity:.6}}/>
                        ))}
                      </div>
                    )}
                    <button className="ei absolute top-1 right-1 w-4 h-4 rounded flex items-center justify-center"
                      style={{background:'rgba(0,0,0,0.5)',fontSize:7}}
                      onClick={e=>{e.stopPropagation();setEditingPad({type:'note',index})}}>✏️</button>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Drum pads */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="text-[8px] uppercase tracking-[.15em] mb-1.5 flex items-center gap-2 text-zinc-700">
              <span>Drum Kit</span><div className="flex-1 h-px bg-white/5"/>
            </div>
            <div className="grid grid-cols-4 gap-1.5 flex-1">
              {drumPads.map((pad,index)=>{
                const isFlash=flashDrum===pad.id
                const hasRipple=ripples.some(r=>r.target==='d'+index)
                const dc=DRUM_COLOR[pad.type]||'#888'
                const hasAudio=!!pad.audioBuffer
                return (
                  <button key={pad.id+index}
                    className="db rounded-[14px] relative overflow-hidden flex flex-col justify-between p-2 transition-all duration-75"
                    style={{
                      background:isFlash?`linear-gradient(145deg,${dc}cc,${dc}77)`:hasAudio?`${dc}14`:'rgba(255,255,255,0.04)',
                      border:`1px solid ${isFlash?dc:hasAudio?dc+'44':'rgba(255,255,255,0.07)'}`,
                      boxShadow:isFlash?`0 0 16px ${dc}55,inset 0 1px 0 rgba(255,255,255,0.2)`:'none',
                    }}
                    onClick={()=>handleDrumClick(pad,index)}
                    onDoubleClick={()=>setEditingPad({type:'drum',index})}>
                    {hasRipple&&<div className="ripple-ring absolute inset-0 rounded-[14px]" style={{border:`1.5px solid ${dc}`}}/>}
                    <div className="flex justify-between items-start">
                      <div className="w-1.5 h-1.5 rounded-full mt-0.5" style={{background:isFlash?'rgba(255,255,255,0.6)':dc,opacity:isFlash?1:0.6}}/>
                      <button className="ei w-4 h-4 rounded flex items-center justify-center"
                        style={{background:'rgba(0,0,0,0.45)',fontSize:7}}
                        onClick={e=>{e.stopPropagation();setEditingPad({type:'drum',index})}}>⚙</button>
                    </div>
                    <div>
                      {hasAudio&&<span className="text-[7px] block mb-0.5" style={{color:isFlash?'white':dc,opacity:.7}}>🎵 custom</span>}
                      <div className="text-[8px] uppercase tracking-wider" style={{color:isFlash?'rgba(255,255,255,0.55)':dc,opacity:isFlash?1:0.55}}>{pad.type}</div>
                      <div className="text-[10px] font-semibold leading-tight truncate" style={{color:isFlash?'#fff':'rgba(255,255,255,0.45)'}}>{pad.name}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Sheet: Edit Pad */}
        {editingPad&&(
          <div className="absolute inset-0 z-50 flex items-end fade-in"
            style={{background:'rgba(0,0,0,0.85)',backdropFilter:'blur(14px)'}}
            onClick={()=>setEditingPad(null)}>
            <div className="w-full rounded-t-[28px] p-5 sheet-up overflow-y-auto"
              style={{background:'#12102a',border:'1px solid rgba(255,255,255,0.09)',borderBottom:'none',maxHeight:'85%'}}
              onClick={e=>e.stopPropagation()}>
              <div className="w-10 h-1 rounded-full mx-auto mb-4 cursor-pointer" style={{background:'rgba(255,255,255,0.15)'}} onClick={()=>setEditingPad(null)}/>
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h3 className="text-[14px] font-semibold text-zinc-100">
                    {editingPad.type==='note'?'Editar Pad de Nota':'Editar Drum Pad'}
                    <span className="ml-2 text-xs font-normal" style={{color:ac}}>#{editingPad.index+1}</span>
                  </h3>
                  <p className="text-[10px] text-zinc-600 mt-0.5">Upload de áudio · Trocar som</p>
                </div>
                <button onClick={()=>setEditingPad(null)} className="text-xs text-zinc-600 hover:text-zinc-300 px-2 py-1 rounded-lg hover:bg-white/5 transition">Fechar</button>
              </div>

              {/* Upload */}
              <div className="mb-4">
                <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{color:ac}}>🎵 Áudio Personalizado (MP3 / WAV)</div>
                {editingPad.type==='note'&&notePads[editingPad.index]?.fileName&&(
                  <div className="flex items-center justify-between p-3 rounded-xl mb-2" style={{background:`${ac}14`,border:`1px solid ${ac}44`}}>
                    <div>
                      <div className="text-[11px] font-semibold" style={{color:ac}}>✓ Carregado</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5 truncate max-w-[200px]">{notePads[editingPad.index].fileName}</div>
                    </div>
                    <button onClick={()=>removeNoteAudio(editingPad.index)} className="text-[10px] px-2 py-1 rounded-lg text-red-400 hover:bg-red-500/10 transition">Remover</button>
                  </div>
                )}
                {editingPad.type==='drum'&&drumPads[editingPad.index]?.fileName&&(
                  <div className="flex items-center justify-between p-3 rounded-xl mb-2"
                    style={{background:`${DRUM_COLOR[drumPads[editingPad.index].type]||'#888'}18`,border:`1px solid ${DRUM_COLOR[drumPads[editingPad.index].type]||'#888'}44`}}>
                    <div>
                      <div className="text-[11px] font-semibold text-zinc-200">✓ Carregado</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5 truncate max-w-[200px]">{drumPads[editingPad.index].fileName}</div>
                    </div>
                    <button onClick={()=>removeDrumAudio(editingPad.index)} className="text-[10px] px-2 py-1 rounded-lg text-red-400 hover:bg-red-500/10 transition">Remover</button>
                  </div>
                )}
                <button onClick={triggerUpload}
                  className="w-full py-4 rounded-xl flex flex-col items-center gap-1.5 transition active:scale-[0.97]"
                  style={{background:`${ac}0e`,border:`1.5px dashed ${ac}55`}}>
                  <span className="text-2xl">📂</span>
                  <span className="text-[12px] font-semibold" style={{color:ac}}>
                    {(editingPad.type==='note'?notePads[editingPad.index]?.fileName:drumPads[editingPad.index]?.fileName)?'Trocar arquivo de áudio':'Upload MP3 / WAV'}
                  </span>
                  <span className="text-[10px] text-zinc-600">Toca no lugar do som sintetizado</span>
                </button>
              </div>

              <div className="h-px w-full mb-4" style={{background:'rgba(255,255,255,0.07)'}}/>

              {/* Note selector */}
              {editingPad.type==='note'&&(
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest mb-2 text-zinc-600">Nota Musical</div>
                  <div className="grid grid-cols-4 gap-2">
                    {NOTES.map(n=>{
                      const isCurr=notePads[editingPad.index].note===n
                      return (
                        <button key={n}
                          onClick={()=>{ setNotePads(p=>{const u=[...p];u[editingPad.index]={...u[editingPad.index],note:n};return u}); setEditingPad(null) }}
                          className="py-3 rounded-xl text-[13px] font-bold transition active:scale-95"
                          style={{background:isCurr?ac:'rgba(255,255,255,0.05)',border:`1px solid ${isCurr?ac:'rgba(255,255,255,0.08)'}`,color:isCurr?'#fff':'rgba(255,255,255,0.5)',boxShadow:isCurr?`0 0 14px ${ac}44`:'none'}}>
                          {n}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Drum selector */}
              {editingPad.type==='drum'&&(
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest mb-2 text-zinc-600">Sample Sintetizado</div>
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_DRUMS.map(sample=>{
                      const isCurr=drumPads[editingPad.index].id===sample.id
                      const dc=DRUM_COLOR[sample.type]||'#888'
                      return (
                        <button key={sample.id}
                          onClick={()=>{
                            const idx=editingPad.index
                            setDrumPads(p=>{const u=[...p];const old=u[idx];u[idx]={...sample,audioBuffer:old.audioBuffer??null,fileName:old.fileName??null};return u})
                            setEditingPad(null)
                          }}
                          className="p-2.5 rounded-xl text-left transition active:scale-[0.97]"
                          style={{background:isCurr?`${dc}1e`:'rgba(255,255,255,0.04)',border:`1px solid ${isCurr?dc+'88':'rgba(255,255,255,0.07)'}`,boxShadow:isCurr?`0 0 10px ${dc}30`:'none'}}>
                          <div className="text-[8px] uppercase tracking-wider mb-0.5" style={{color:isCurr?dc:'rgba(255,255,255,0.2)'}}>{sample.type}</div>
                          <div className="text-[11px] font-semibold" style={{color:isCurr?'#fff':'rgba(255,255,255,0.45)'}}>{sample.name}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sheet: Kit */}
        {isTimbreOpen&&(
          <div className="absolute inset-0 z-40 flex items-end fade-in"
            style={{background:'rgba(0,0,0,0.75)',backdropFilter:'blur(12px)'}}
            onClick={()=>setIsTimbreOpen(false)}>
            <div className="w-full rounded-t-[28px] p-5 sheet-up"
              style={{background:'#14112c',border:'1px solid rgba(255,255,255,0.08)',borderBottom:'none'}}
              onClick={e=>e.stopPropagation()}>
              <div className="w-10 h-1 rounded-full mx-auto mb-4 cursor-pointer" style={{background:'rgba(255,255,255,0.15)'}} onClick={()=>setIsTimbreOpen(false)}/>
              <h3 className="text-[13px] font-semibold mb-3 text-zinc-300 tracking-tight">Selecionar Kit</h3>
              <div className="space-y-1">
                {TIMBRES.map(t=>(
                  <div key={t.id} onClick={()=>{setTimbre(t);setIsTimbreOpen(false)}}
                    className="flex justify-between items-center p-3 rounded-xl cursor-pointer transition active:scale-[0.98]"
                    style={{background:timbre.id===t.id?'rgba(255,255,255,0.07)':'transparent'}}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background:`${t.color}20`,border:`1px solid ${t.color}44`}}>
                        <div className="w-2 h-2 rounded-full" style={{background:t.color,boxShadow:`0 0 6px ${t.color}`}}/>
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold text-zinc-200">{t.name}</div>
                        <div className="text-[10px] text-zinc-500">{t.kit}</div>
                      </div>
                    </div>
                    {timbre.id===t.id&&(
                      <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{background:t.color}}>
                        <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5l2 2L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
