(function(){
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- particles ---------- */
  var cv = document.getElementById("sky"), cx = cv.getContext("2d");
  var motes = [], W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  function resize(){
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr,0,0,dpr,0,0);
    var n = Math.round(Math.min(90, (W*H)/16000));
    motes = [];
    for (var i=0;i<n;i++) motes.push({
      x: Math.random()*W, y: Math.random()*H,
      r: Math.random()*1.7+.4, a: Math.random()*.5+.12,
      vx:(Math.random()-.5)*.18, vy:-(Math.random()*.22+.05),
      ph: Math.random()*Math.PI*2
    });
  }
  function ink(){ return getComputedStyle(document.documentElement).getPropertyValue("--accent-2").trim() || "#b9863f"; }
  var accent = ink(), tSky = 0;
  function draw(){
    tSky += 0.016;
    cx.clearRect(0,0,W,H);
    for (var i=0;i<motes.length;i++){
      var m = motes[i];
      m.x += m.vx + Math.sin(tSky + m.ph)*0.16;
      m.y += m.vy;
      if (m.y < -8){ m.y = H + 8; m.x = Math.random()*W; }
      if (m.x < -8) m.x = W+8; if (m.x > W+8) m.x = -8;
      cx.globalAlpha = m.a * (0.6 + 0.4*Math.sin(tSky*1.4 + m.ph));
      cx.fillStyle = accent;
      cx.beginPath(); cx.arc(m.x, m.y, m.r, 0, Math.PI*2); cx.fill();
    }
    cx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }
  window.addEventListener("resize", resize);
  resize(); if (!reduce) draw(); else { resize(); }

  /* ---------- open the envelope ---------- */
  var env = document.getElementById("envelope"),
      letter = document.getElementById("letter"),
      hint = document.getElementById("hint");
  var opened = false;
  function open(){
    if (opened) return; opened = true;
    env.classList.add("open");
    hint.style.transition = "opacity .4s"; hint.style.opacity = "0";
    setTimeout(function(){
      env.style.display = "none"; hint.style.display = "none";
      letter.classList.add("show");
    }, 620);
  }
  env.addEventListener("click", open);
  env.addEventListener("keydown", function(e){
    if (e.key === "Enter" || e.key === " "){ e.preventDefault(); open(); }
  });

  /* ---------- 3D tilt + parallax aura ---------- */
  var aura = document.getElementById("aura");
  var tx = 0, ty = 0, cxp = 0, cyp = 0;
  function onMove(e){
    var px = (e.clientX / window.innerWidth) - .5;
    var py = (e.clientY / window.innerHeight) - .5;
    tx = px; ty = py;
  }
  window.addEventListener("mousemove", onMove);
  window.addEventListener("deviceorientation", function(e){
    if (e.gamma == null) return;
    tx = Math.max(-.5, Math.min(.5, e.gamma/45));
    ty = Math.max(-.5, Math.min(.5, (e.beta-45)/60));
  });
  (function tilt(){
    cxp += (tx - cxp)*0.07; cyp += (ty - cyp)*0.07;
    if (!reduce && letter.classList.contains("show")){
      letter.style.transform =
        "rotateY(" + (cxp*7).toFixed(2) + "deg) rotateX(" + (-cyp*5).toFixed(2) + "deg) translateZ(0)";
    }
    aura.style.transform = "translate(-50%,-50%) translate(" + (cxp*46).toFixed(1) + "px," + (cyp*46).toFixed(1) + "px)";
    requestAnimationFrame(tilt);
  })();

  /* ---------- 8D audio: a pad that physically orbits your head ---------- */
  var ctxA = null, master = null, panner = null, nodes = [], rafA = 0, angle = 0;
  var btn = document.getElementById("audioBtn"), readout = document.getElementById("readout");

  function buildAudio(){
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctxA = new AC();

    master = ctxA.createGain();
    master.gain.value = 0;
    master.connect(ctxA.destination);

    // gentle low-pass so the pad stays in the background
    var lp = ctxA.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 1400; lp.Q.value = 0.6;
    lp.connect(master);

    // HRTF panner = the actual "8D" part: the source moves in 3D space
    panner = ctxA.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    panner.refDistance = 1;
    panner.maxDistance = 12;
    panner.rolloffFactor = 1.1;
    panner.connect(lp);

    // a soft consonant chord — F major 9-ish, quiet and slow
    var freqs = [174.61, 261.63, 349.23, 392.00, 523.25];
    var mix = ctxA.createGain(); mix.gain.value = 0.16; mix.connect(panner);
    freqs.forEach(function(f, i){
      var o = ctxA.createOscillator();
      o.type = i % 2 ? "sine" : "triangle";
      o.frequency.value = f;
      // slow detune drift keeps it from sounding synthetic
      var lfo = ctxA.createOscillator(); lfo.frequency.value = 0.05 + i*0.017;
      var lfoG = ctxA.createGain(); lfoG.gain.value = 2.4;
      lfo.connect(lfoG); lfoG.connect(o.detune);
      var g = ctxA.createGain(); g.gain.value = 1 / freqs.length;
      o.connect(g); g.connect(mix);
      o.start(); lfo.start();
      nodes.push(o, lfo);
    });
    return true;
  }

  function orbit(){
    angle += 0.0062;                        // ~17 s per revolution
    var r = 3.1 + Math.sin(angle*0.7)*0.9;  // distance breathes a little
    var x = Math.sin(angle) * r;
    var z = Math.cos(angle) * r;
    var y = Math.sin(angle*1.9) * 0.8;      // and it rises/dips — the 8 in 8D
    if (panner.positionX){
      var now = ctxA.currentTime;
      panner.positionX.setTargetAtTime(x, now, 0.03);
      panner.positionY.setTargetAtTime(y, now, 0.03);
      panner.positionZ.setTargetAtTime(z, now, 0.03);
    } else {
      panner.setPosition(x, y, z);
    }
    var deg = Math.round(((angle * 180/Math.PI) % 360 + 360) % 360);
    readout.textContent = deg + "°";
    aura.style.opacity = String(0.75 + 0.25*Math.cos(angle));
    rafA = requestAnimationFrame(orbit);
  }

  btn.addEventListener("click", function(){
    var on = btn.getAttribute("aria-pressed") === "true";
    if (!on){
      if (!ctxA && !buildAudio()){ readout.textContent = "n/a"; return; }
      ctxA.resume();
      master.gain.cancelScheduledValues(ctxA.currentTime);
      master.gain.setTargetAtTime(0.5, ctxA.currentTime, 1.2);   // slow fade in
      btn.setAttribute("aria-pressed","true");
      cancelAnimationFrame(rafA); orbit();
    } else {
      master.gain.setTargetAtTime(0.0001, ctxA.currentTime, 0.7);
      btn.setAttribute("aria-pressed","false");
      readout.textContent = "—";
      setTimeout(function(){ cancelAnimationFrame(rafA); }, 1400);
    }
  });

  /* ---------- theme ---------- */
  var themeBtn = document.getElementById("themeBtn");
  themeBtn.addEventListener("click", function(){
    var cur = document.documentElement.getAttribute("data-theme");
    var dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var next = cur ? (cur === "dark" ? "light" : "dark") : (dark ? "light" : "dark");
    document.documentElement.setAttribute("data-theme", next);
    accent = ink();
    try { localStorage.setItem("apology-theme", next); } catch(e){}
  });
  try {
    var saved = localStorage.getItem("apology-theme");
    if (saved) { document.documentElement.setAttribute("data-theme", saved); accent = ink(); }
  } catch(e){}
})();