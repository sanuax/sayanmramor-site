// js/intro.js
//
// The first moment on the site: «Полировка» (2026-11-02, the owner chose it from three concepts,
// .claude/concepts/intro/). The screen is the raw face of a slab of white Sayan marble: grey, matte,
// the saw's grooves across it, its veins half-seen. A line of light goes over it - the polishing
// pass - and behind it the stone turns white and deep, its veins sharp, and an engraved
// «САЯНМРАМОР» shows in it, letter by letter as the light reaches it. When the fonts and the first
// photo are ready, the slab is lifted away and the name lands on the header's logo.
//
// In <head>, without defer, so the slab is there before the first paint. Everything it needs is in
// this file: the letters are outlines (the logo's Unbounded, weight 800), so no font has to load for
// them; the marble is painted by the GPU from a noise texture made here, so no picture has to load.
// The shaders are built off the main thread where the browser can (KHR_parallel_shader_compile):
// until the stone is ready the slab is its flat colour, and without WebGL it stays so. Once a session
// in a tab: not on a way in from a page of this address, not back or on reload, not to an anchor, not
// with reduced motion. A press, a key or the wheel ends it at once, and it never stays past MAX_MS.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.SiteIntro = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  const KEY = 'sayan-intro-seen';
  const NAME = 'САЯНМРАМОР';
  // Outlines in 1/1000 em, y down, the top of the capitals at 0; [path, advance]. The contours of
  // each letter are merged into one (skia-pathops), so the engraving's walls run only along its edge.
  const GLYPHS = {
    'А': ['M642.4 0H334.2L-1 750H247.2L304 614.8H672.6L729.4 750H977.6ZM594.5 429H382.1L488.3 176.2L594.5 429Z', 977],
    'М': ['M1190.6 0H831L628.4 519.6L424.4 0H64.8V750H286V204.2L511.6 750H743.8L969.4 202V750H1190.6Z', 1255],
    'Н': ['M64.8 0V750H297.6V470.8H649.2V750H882V0H649.2V265.2H297.6V0Z', 947],
    'О': ['M485.2 767.2Q620.4 767.2 721.8 718.2Q823.2 669.2 879.6 580.9Q936 492.6 936 375Q936 257.4 879.6 169.1Q823.2 80.8 721.8 31.8Q620.4 -17.2 485.2 -17.2Q350 -17.2 248.6 31.8Q147.2 80.8 90.8 169.1Q34.4 257.4 34.4 375Q34.4 492.6 90.8 580.9Q147.2 669.2 248.6 718.2Q350 767.2 485.2 767.2ZM485.2 559.6Q418.4 559.6 369.9 537.4Q321.4 515.2 295.3 473.8Q269.2 432.4 269.2 375Q269.2 317.6 295.3 276.2Q321.4 234.8 369.9 212.6Q418.4 190.4 485.2 190.4Q552.2 190.4 600.6 212.6Q649 234.8 675.1 276.2Q701.2 317.6 701.2 375Q701.2 432.4 675.1 473.8Q649 515.2 600.6 537.4Q552.2 559.6 485.2 559.6Z', 970],
    'Р': ['M493.8 0H64.8V750H297.6V531.6H493.8Q592.2 531.6 662.5 498.8Q732.8 466 769.9 406.1Q807 346.2 807 265.8Q807 185.4 769.9 125.5Q732.8 65.6 662.5 32.8Q592.2 0 493.8 0ZM297.6 348V183.6H479.2Q523.2 183.6 547.7 205Q572.2 226.4 572.2 265.8Q572.2 304.4 547.7 326.2Q523.2 348 479.2 348H297.6Z', 825],
    'С': ['M912.6 430.6H678.8Q669.4 475.4 642.9 506.1Q616.4 536.8 574 552.2Q531.6 567.6 474.8 567.6Q410.8 567.6 364.7 544.2Q318.6 520.8 294 477.8Q269.4 434.8 269.4 375Q269.4 315.2 294 271.8Q318.6 228.4 364.7 205.4Q410.8 182.4 474.8 182.4Q531.6 182.4 574 198.7Q616.4 215 642.9 245.6Q669.4 276.2 678.8 319.4H912.6Q901 218.4 843.3 142.8Q785.6 67.2 691.2 25Q596.8 -17.2 475 -17.2Q342.6 -17.2 243.6 31.8Q144.6 80.8 89.6 169.1Q34.6 257.4 34.6 375Q34.6 492.6 89.6 580.9Q144.6 669.2 243.6 718.2Q342.6 767.2 475 767.2Q596.8 767.2 691.2 725Q785.6 682.8 843.3 607.1Q901 531.4 912.6 430.6Z', 942],
    'Я': ['M225.6 470.8 23 750H290.4L472.5 490H574V750H806.8V0H336.8Q249 0 183.1 30.9Q117.2 61.8 80.5 116.7Q43.8 171.6 43.8 245.8Q43.8 318.4 80.5 372.4Q117.2 426.4 183.1 455.6Q203.3 464.5 225.6 470.8ZM574 327.2H371.8Q327.6 327.2 302.9 305.9Q278.2 284.6 278.2 245.8Q278.2 207 302.9 185.8Q327.6 164.6 371.8 164.6H574V327.2Z', 872],
  };
  const TRACKING = 120;           // the logo's letter-spacing, 0.12em
  const CAP = 750;
  const PAD = 20;                 // room around the letters in the name's svg, glyph units
  const RAW = '#b9b7b1';          // the raw face, flat: what shows before the marble is ready
  const INK = '#2c2e2a';          // the engraving
  const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const EASE_OPEN = 'cubic-bezier(0.76, 0, 0.24, 1)';
  const EASE_FLY = 'cubic-bezier(0.32, 0.72, 0, 1)';    // the name leaves at once and settles slowly
  const PASS_AT = 200;            // the pass starts no sooner than this,
  const PASS_WAIT = 700;          // and waits no longer than this for the stone to be ready
  const PASS_MS = 1300;
  const HOLD_MS = 300;            // the polished slab is seen still for a moment before it is lifted
  const CAP_MS = 3400;            // the slab is lifted by then, ready or not
  const OPEN_MS = 1000;
  const MAX_MS = 6000;
  // The pass runs along sd = (x * .94 + y * .34) / sqrt(w * h): from the top-left corner on.
  const SWEEP = [0.94, 0.34];

  function shouldPlay({ reduced, canAnimate, hash, navigationType, seen, fromThisAddress }) {
    return !reduced && !!canAnimate && !hash && navigationType !== 'back_forward' && navigationType !== 'reload' && !seen && !fromThisAddress;
  }

  // The same «random» every time: the same stone.
  function random(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Where the polishing line is at a point of a w x h screen.
  const sweepAt = (x, y, w, h) => (x * SWEEP[0] + y * SWEEP[1]) / Math.sqrt(w * h);

  // The letters of the name laid out in glyph units: x of each, the width of the whole.
  function layout() {
    let x = 0;
    const letters = NAME.split('').map(ch => {
      const at = x;
      x += GLYPHS[ch][1] + TRACKING;
      return { ch, x: at, adv: GLYPHS[ch][1], d: GLYPHS[ch][0] };
    });
    return { letters, units: x - TRACKING };
  }

  // A cubic-bezier for values driven from script.
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = t => ((ax * t + bx) * t + cx) * t;
    const sy = t => ((ay * t + by) * t + cy) * t;
    const dx = t => (3 * ax * t + 2 * bx) * t + cx;
    return x => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 6; i++) { const d = dx(t); if (Math.abs(d) < 1e-6) break; t -= (sx(t) - x) / d; }
      return sy(Math.max(0, Math.min(1, t)));
    };
  }

  // ---------------------------------------------------------------- the marble
  // Smooth value noise, 32 x 32 cells repeating, 16 texels to a cell, 16 bits in red and green.
  // Noise from arithmetic in the shader took Chrome on Windows (ANGLE, D3D) over a second to compile.
  function noiseData() {
    const N = 512, CELLS = 32, PER = N / CELLS;
    const rnd = random(1);
    const lattice = new Float32Array(CELLS * CELLS).map(() => rnd());
    const at = (i, j) => lattice[((j + CELLS) % CELLS) * CELLS + ((i + CELLS) % CELLS)];
    const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
    const data = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y++) {
      const v = y / PER, j = Math.floor(v), fy = fade(v - j);
      for (let x = 0; x < N; x++) {
        const u = x / PER, i = Math.floor(u), fx = fade(u - i);
        const a = at(i, j) + (at(i + 1, j) - at(i, j)) * fx;
        const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * fx;
        const n = Math.round((a + (b - a) * fy) * 65535);
        const o = (y * N + x) * 4;
        data[o] = n >> 8;
        data[o + 1] = n & 255;
        data[o + 3] = 255;
      }
    }
    return { N, data };
  }

  // Two passes. Baked once: the stone's clouds (rgb, and the cloud field in alpha), at half the
  // resolution since they are soft, and the veins (their colour, and how much vein in alpha) at full.
  // Shown every frame: the two mixed, with the polishing pass. uv = pixel / sqrt(w * h), y down.
  const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const BAKE = `#extension GL_OES_standard_derivatives : enable
    precision highp float;
    uniform vec2 uRes; uniform float uMode, uPx; uniform sampler2D uNoise;
    const vec3 BASE=vec3(.94,.93,.905), CLOUD=vec3(.875,.866,.838), DEEP=vec3(.95,.942,.918);
    const vec3 VEIN=vec3(.5,.5,.48), GOLD=vec3(.66,.56,.4);
    float noise(vec2 p){vec4 t=texture2D(uNoise,(p+.03125)/32.);return t.r*.99611+t.g*.003891;}
    const mat2 R=mat2(1.6,1.2,-1.2,1.6);
    float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<6;i++){v+=a*noise(p);p=R*p;a*=.5;}return v;}
    float fbm3(vec2 p){float v=0.,a=.5;for(int i=0;i<3;i++){v+=a*noise(p);p=R*p;a*=.5;}return v/.875;}
    // How far this pixel is from the line where the field crosses .5 of a unit, in device pixels;
    // the steepness is read from the field's smooth part (the texture's fine octaves are linear
    // between texels, and their slope would jump from one texel to the next).
    float dist(float field,float smooth){return abs(fract(field)-.5)/max(fwidth(smooth),1e-6);}
    // A vein of half-width w css px: the same thickness wherever the field runs flat or steep.
    float vein(float d,float w){float wp=w*uPx;return clamp(max(wp,.5)+.5-d,0.,1.)*min(1.,2.*wp);}
    void main(){
      vec2 uv=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/sqrt(uRes.x*uRes.y);
      vec2 p=uv*1.8+vec2(11.3,2.9);
      if(uMode<.5){
        vec2 q=vec2(fbm(p),fbm(p+vec2(5.2,1.3)));
        vec2 r=vec2(fbm(p+2.*q+vec2(1.7,9.2)),fbm(p+2.*q+vec2(8.3,2.8)));
        float f=fbm(p+1.5*r);
        vec3 col=mix(BASE,CLOUD,smoothstep(.3,.9,f));
        col=mix(col,DEEP,smoothstep(.55,.2,q.y)*.55);
        gl_FragColor=vec4(col,f);
        return;
      }
      // the veins' own warp: smoother than the clouds', a vein bends but does not fray
      vec2 qv=vec2(fbm3(p*.8),fbm3(p*.8+vec2(5.2,1.3)));
      vec2 rv=vec2(fbm3(p+1.8*qv+vec2(1.7,9.2)),fbm3(p+1.8*qv+vec2(8.3,2.8)));
      float fv=fbm3(p*1.3+1.2*rv);
      // main veins: level lines of a warped slanted field, coming and going along their way
      float crinkle=fbm(p*4.5+21.)-.5;
      float fm0=dot(p,vec2(.62,.36))*1.6+1.4*rv.x+.35*fv;
      float fm=fm0+.16*crinkle;
      float dm=dist(fm,fm0);
      float wmain=1.3*(.25+2.2*pow(smoothstep(.35,.9,noise(p*1.1+7.)),2.));
      float on=smoothstep(.2,.48,fbm(p*.6+13.));
      float m=vein(dm,wmain)*on*.75;
      // a few thin threads beside a main vein
      float b=vein(dist(fm*5.+.6*fv,fm0*5.+.6*fv),.22+.3*noise(p*3.+9.))*exp(-dm/(uPx*55.))*on*smoothstep(.3,.6,noise(p*1.7+41.))*.25;
      m+=b*.75;
      // the stone clouds up around a vein, and grey haze streaks lie along the veins
      float halo=exp(-dm/(uPx*(6.+wmain*12.)))*on*.1;
      vec2 dir=normalize(vec2(.62,.36));
      vec2 sp=vec2(dot(p,dir)*1.2,dot(p,vec2(-dir.y,dir.x))*7.)+rv*2.;
      halo+=pow(1.-clamp(abs(fract(fm)-.5)/.22,0.,1.),2.)*smoothstep(.3,.75,fbm(sp+71.))*on*.4;
      // finer veins branching off across them
      float fs0=dot(p,vec2(-.42,.9))*1.9+1.6*rv.y+.9*qv.x;
      float fs=fs0+.12*crinkle;
      float s=vein(dist(fs,fs0),.2+.5*noise(p*2.+3.))*smoothstep(.34,.62,fbm(p*1.15+31.))*.4;
      // hairlines along the main run, short and broken
      float fh=dot(p,vec2(.85,.1))*3.4+2.4*rv.x+1.3*qv.y;
      float h=vein(dist(fh,fh),.2)*smoothstep(.45,.7,fbm(p*1.6+51.))*.2;
      float a=clamp(m+s+h+halo,0.,1.);
      gl_FragColor=vec4(mix(VEIN,GOLD,smoothstep(.6,.8,noise(p*.9+3.))*.5),a);
    }
  `;
  const SHOW = `precision highp float;
    uniform sampler2D uStone, uVeins; uniform vec2 uRes; uniform float uPolishAt, uEdge;
    const vec3 MATTE=vec3(.69,.685,.665);
    float hash(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
    void main(){
      vec2 st=gl_FragCoord.xy/uRes;
      vec4 S=texture2D(uStone,st); vec4 V=texture2D(uVeins,st);
      vec2 uv=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/sqrt(uRes.x*uRes.y);
      vec3 col=mix(S.rgb,V.rgb,V.a);
      // behind the pass polished stone, ahead of it the raw face: grey and flat, the veins only
      // hinted, the saw's grooves across it
      float sd=dot(uv,vec2(${SWEEP[0]},${SWEEP[1]}));
      float pol=smoothstep(uPolishAt+.012,uPolishAt-.012,sd+(S.a-.5)*.05);
      float lum=dot(col,vec3(.3,.59,.11));
      float saw=sin(gl_FragCoord.y/uRes.y*900.+S.a*6.)*.5+.5;
      vec3 raw=mix(mix(col,vec3(lum),.8),MATTE,.62)*(1.-.035*saw)+(hash(gl_FragCoord.xy*.73)-.5)*.06;
      col=mix(raw,col,pol);
      // the front of the pass: a soft line of light, and wet gloss behind it drying off
      float e=sd-uPolishAt;
      float wet=e<0.?exp(e/.09):0.;
      col+=vec3(1.,.985,.96)*(exp(-e*e/.0003)*.08+exp(-e*e/.006)*.05+wet*.06)*uEdge;
      vec2 c=st-.5;
      col*=1.-dot(c,c)*.35;
      col+=(hash(gl_FragCoord.xy+17.)-.5)*(1.2/255.);
      gl_FragColor=vec4(col,1.);
    }
  `;

  function program(gl, frag) {
    const p = gl.createProgram();
    [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, frag]].forEach(([type, src]) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      gl.attachShader(p, s);
    });
    gl.bindAttribLocation(p, 0, 'a');
    gl.linkProgram(p);   // only asked for: with KHR_parallel_shader_compile it is done off the main thread
    return p;
  }

  // A canvas of marble, w x h css px, or null without WebGL. It comes back at once, transparent;
  // the stone is baked when the shaders are ready, then onReady runs. draw(at, edge) moves the pass.
  function marble(doc, win, w, h) {
    let dpr = Math.min(win.devicePixelRatio || 1, 2);
    dpr = Math.min(dpr, 4096 / w, 4096 / h);
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    const canvas = doc.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    canvas.className = 'si-marble';
    let gl = null;
    try {
      gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
    } catch (e) { gl = null; }
    if (!gl || !gl.getExtension('OES_standard_derivatives')) return null;
    const parallel = gl.getExtension('KHR_parallel_shader_compile');
    const bake = program(gl, BAKE);
    const show = program(gl, SHOW);
    let ready = false, stopped = false, readyFn = null, polishAt = -9, edge = 1;
    const u = (p, name) => gl.getUniformLocation(p, name);

    function setup() {
      if (stopped || gl.isContextLost() || !gl.getProgramParameter(bake, gl.LINK_STATUS) || !gl.getProgramParameter(show, gl.LINK_STATUS)) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      const texture = (tw, th, filter, wrap, data) => {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, filter));
        [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, wrap));
        return tex;
      };
      const target = (tw, th, filter) => {
        const tex = texture(tw, th, filter, gl.CLAMP_TO_EDGE, null);
        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        return { tex, fb, w: tw, h: th };
      };
      const stone = target(Math.ceil(W / 2), Math.ceil(H / 2), gl.LINEAR);
      const veins = target(W, H, gl.NEAREST);
      const noise = noiseData();
      gl.activeTexture(gl.TEXTURE2);
      texture(noise.N, noise.N, gl.LINEAR, gl.REPEAT, noise.data);
      gl.useProgram(bake);
      gl.uniform1i(u(bake, 'uNoise'), 2);
      gl.uniform1f(u(bake, 'uPx'), dpr);
      [[stone, 0], [veins, 1]].forEach(([t, mode]) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
        gl.viewport(0, 0, t.w, t.h);
        gl.uniform2f(u(bake, 'uRes'), t.w, t.h);
        gl.uniform1f(u(bake, 'uMode'), mode);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      });
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.useProgram(show);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, stone.tex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, veins.tex);
      gl.uniform1i(u(show, 'uStone'), 0);
      gl.uniform1i(u(show, 'uVeins'), 1);
      gl.uniform2f(u(show, 'uRes'), W, H);
      ready = true;
      draw(polishAt, edge);
      if (readyFn) readyFn();
    }
    function draw(at, withEdge) {
      polishAt = at;
      edge = withEdge;
      if (!ready || stopped) return;
      gl.uniform1f(u(show, 'uPolishAt'), at);
      gl.uniform1f(u(show, 'uEdge'), withEdge);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    if (parallel) {
      const poll = () => {
        if (stopped || gl.isContextLost()) return;
        if (gl.getProgramParameter(bake, parallel.COMPLETION_STATUS_KHR) && gl.getProgramParameter(show, parallel.COMPLETION_STATUS_KHR)) setup();
        else win.requestAnimationFrame(poll);
      };
      win.requestAnimationFrame(poll);
    } else {
      // built here on the main thread (Firefox): only after the flat slab has been painted
      win.requestAnimationFrame(() => win.setTimeout(setup, 0));
    }
    return {
      canvas, draw,
      onReady: fn => { if (ready) fn(); else readyFn = fn; },
      // the GPU let go as soon as the slab is gone
      release: () => {
        stopped = true;
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      },
    };
  }

  const STYLE = `
    html.si-on .site-logo { visibility: hidden; }
    #site-intro { position: fixed; top: 0; bottom: 0; left: 0; width: 100vw; z-index: 2147483000; overflow: hidden; cursor: default; -webkit-user-select: none; user-select: none; background: ${RAW}; }
    #site-intro .si-slab { position: absolute; left: 0; top: 0; width: 100%; height: 100%; background: ${RAW}; will-change: transform;
      box-shadow: 0 1px 0 rgba(255, 255, 255, 0.6), 0 26px 60px -10px rgba(40, 34, 26, 0.38), 0 8px 18px rgba(40, 34, 26, 0.18); }
    #site-intro .si-marble { position: absolute; left: 0; top: 0; width: 100%; height: 100%; display: block; opacity: 0; }
    #site-intro svg { display: block; position: absolute; left: 0; top: 0; overflow: visible; }
    #site-intro .si-name { transform-origin: 0 0; fill: ${INK}; will-change: transform; }
  `;

  const SVG = 'http://www.w3.org/2000/svg';
  function svgEl(doc, tag, attrs) {
    const node = doc.createElementNS(SVG, tag);
    Object.keys(attrs || {}).forEach(k => node.setAttribute(k, attrs[k]));
    return node;
  }

  // The engraving: the cut dark, its upper wall in shadow, its lower lip catching the light.
  function engraving(doc, px) {
    const filter = svgEl(doc, 'filter', { id: 'si-engrave', x: '-2%', y: '-10%', width: '104%', height: '120%', 'color-interpolation-filters': 'sRGB' });
    [
      ['feOffset', { in: 'SourceAlpha', dy: 1.6 * px, result: 'dn' }],
      ['feComposite', { in: 'SourceAlpha', in2: 'dn', operator: 'out', result: 'topband' }],
      ['feGaussianBlur', { in: 'topband', stdDeviation: 0.8 * px, result: 'topsoft' }],
      ['feFlood', { 'flood-color': '#000', 'flood-opacity': 0.55, result: 'black' }],
      ['feComposite', { in: 'black', in2: 'topsoft', operator: 'in', result: 'shade' }],
      ['feComposite', { in: 'shade', in2: 'SourceAlpha', operator: 'in', result: 'shadeIn' }],
      ['feOffset', { in: 'SourceAlpha', dy: -1.2 * px, result: 'up' }],
      ['feComposite', { in: 'SourceAlpha', in2: 'up', operator: 'out', result: 'lowband' }],
      ['feFlood', { 'flood-color': '#fffdf6', 'flood-opacity': 0.75, result: 'white' }],
      ['feComposite', { in: 'white', in2: 'lowband', operator: 'in', result: 'lip' }],
    ].forEach(([tag, attrs]) => filter.appendChild(svgEl(doc, tag, attrs)));
    const merge = svgEl(doc, 'feMerge');
    ['SourceGraphic', 'shadeIn', 'lip'].forEach(n => merge.appendChild(svgEl(doc, 'feMergeNode', { in: n })));
    filter.appendChild(merge);
    return filter;
  }

  function play(doc, win) {
    const root = doc.documentElement;
    // The whole window, the page's scrollbar included (it comes only once the page has loaded; the
    // slab runs on under it), so the marble is drawn pixel for pixel and never squeezed when it comes.
    const w = win.innerWidth, h = win.innerHeight;

    const style = doc.createElement('style');
    style.textContent = STYLE;
    doc.head.appendChild(style);
    const box = doc.createElement('div');
    box.id = 'site-intro';
    box.setAttribute('aria-hidden', 'true');
    const slab = doc.createElement('div');
    slab.className = 'si-slab';
    box.appendChild(slab);

    const t0 = win.performance.now();
    const timers = [];
    let ended = false;
    const sweepFrom = sweepAt(0, 0, w, h) - 0.08, sweepTo = sweepAt(w, h, w, h) + 0.08;
    const m = marble(doc, win, w, h);
    // The pass waits for the stone, so that it is seen whole; on a slow device not past PASS_WAIT.
    let passStart = 0, passDone;
    const passed = new Promise(resolve => { passDone = resolve; });
    const startPass = () => {
      if (passStart || ended) return;
      passStart = win.performance.now();
      timers.push(win.setTimeout(passDone, PASS_MS + HOLD_MS));
    };
    timers.push(win.setTimeout(startPass, m ? PASS_WAIT : PASS_AT));
    if (m) {
      slab.appendChild(m.canvas);
      m.draw(sweepFrom, 1);
      m.onReady(() => {
        m.canvas.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out', fill: 'both' });
        timers.push(win.setTimeout(startPass, Math.max(0, PASS_AT - (win.performance.now() - t0))));
      });
    }

    // The name, engraved in the middle of the slab.
    const fontSize = Math.max(22, Math.min(64, w * 0.056));
    const scale = fontSize / 1000;
    const lay = layout();
    const name = svgEl(doc, 'svg', {
      class: 'si-name',
      viewBox: (-PAD) + ' ' + (-PAD) + ' ' + (lay.units + PAD * 2) + ' ' + (CAP + PAD * 2),
      width: (lay.units + PAD * 2) * scale, height: (CAP + PAD * 2) * scale,
    });
    const defs = svgEl(doc, 'defs');
    defs.appendChild(engraving(doc, 1 / scale));
    name.appendChild(defs);
    const engraved = svgEl(doc, 'g', { filter: 'url(#si-engrave)' });
    name.appendChild(engraved);
    const nameW = lay.units * scale;
    const nameX = (w - nameW) / 2 - PAD * scale;
    const nameY = Math.round(h * 0.5 - CAP * scale / 2) - PAD * scale;
    name.style.transform = 'translate(' + nameX + 'px,' + nameY + 'px)';
    // each letter, faint on the raw face, shows when the line of light reaches its middle
    const letters = lay.letters.map(l => {
      const g = svgEl(doc, 'g', { opacity: 0.1 });
      g.appendChild(svgEl(doc, 'path', { d: l.d, transform: 'translate(' + l.x + ' 0)' }));
      engraved.appendChild(g);
      return { g, at: sweepAt(nameX + (PAD + l.x + l.adv / 2) * scale, nameY + (PAD + CAP / 2) * scale, w, h), shown: false };
    });
    box.appendChild(name);

    root.classList.add('si-on');
    root.appendChild(box);

    // ---- the pass of the polisher
    const passEase = bezier(0.55, 0.05, 0.4, 1);
    let frame = 0;
    const tick = now => {
      if (!passStart) { frame = win.requestAnimationFrame(tick); return; }
      const t = now - passStart;
      const at = sweepFrom + (sweepTo - sweepFrom) * passEase(t / PASS_MS);
      letters.forEach(l => {
        if (l.shown || at < l.at) return;
        l.shown = true;
        l.g.animate([{ opacity: 0.1 }, { opacity: 1 }], { duration: 380, easing: EASE_OUT, fill: 'both' });
      });
      if (m) m.draw(at, 1);
      if (t < PASS_MS + 50) frame = win.requestAnimationFrame(tick);
    };
    frame = win.requestAnimationFrame(tick);

    // ---- the end
    const listeners = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'pagehide'];
    const remove = () => {
      box.remove();
      style.remove();
      root.classList.remove('si-on');
      if (m) m.release();
    };
    const end = () => {
      if (ended) return;
      ended = true;
      win.cancelAnimationFrame(frame);
      timers.forEach(t => win.clearTimeout(t));
      listeners.forEach(type => win.removeEventListener(type, cut, true));
      win.removeEventListener('resize', onResize);
    };
    // Cut short: it steps aside at once. The press that did it does not reach what lay under the slab.
    function cut() {
      if (ended) return;
      end();
      box.style.pointerEvents = 'none';
      box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-out', fill: 'both' }).onfinish = remove;
    }
    function onResize() { if (Math.abs(win.innerWidth - w) > 2) cut(); }
    listeners.forEach(type => win.addEventListener(type, cut, { capture: true, passive: true }));
    win.addEventListener('resize', onResize);

    // ---- the slab is lifted away; the name goes to the header
    let opened = false;
    function open() {
      if (opened || ended) return;
      opened = true;
      win.cancelAnimationFrame(frame);
      letters.forEach(l => { if (!l.shown) { l.shown = true; l.g.setAttribute('opacity', 1); } });
      if (m) m.draw(99, 0);
      box.style.pointerEvents = 'none';
      box.style.background = 'transparent';
      slab.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(calc(-100% - 90px))' }], { duration: OPEN_MS, easing: EASE_OPEN, fill: 'both' });
      // The name lands on the header's: same letters, same size, same line.
      const logo = doc.querySelector('.site-logo');
      const range = logo && doc.createRange();
      if (range) range.selectNodeContents(logo);
      const rect = range && range.getBoundingClientRect();
      const from = 'translate(' + nameX + 'px,' + nameY + 'px)';
      if (rect && rect.width) {
        const css = win.getComputedStyle(logo);
        const size = parseFloat(css.fontSize);
        const s = size / fontSize;
        // The real baseline of the header's line, whatever font metrics this browser goes by.
        const probe = doc.createElement('span');
        probe.style.cssText = 'display:inline-block;width:0;height:0';
        logo.appendChild(probe);
        const baseline = probe.getBoundingClientRect().bottom;
        probe.remove();
        // Its width too: the browser kerns the real letters a touch closer than these advances.
        const sx = (rect.width - parseFloat(css.letterSpacing || 0)) / nameW;
        const toX = rect.left - PAD * scale * sx;
        const toY = baseline - size * CAP / 1000 - PAD * scale * s;
        // out of the stone it is no longer cut into it: plain ink, as in the header
        engraved.removeAttribute('filter');
        name.animate([
          { transform: from + ' scale(1)', fill: INK },
          { transform: 'translate(' + toX + 'px,' + toY + 'px) scale(' + sx + ',' + s + ')', fill: css.color },
        ], { duration: OPEN_MS, easing: EASE_FLY, fill: 'both' });
      } else {
        name.animate([{ opacity: 1 }, { opacity: 0 }], { duration: OPEN_MS * 0.6, easing: 'ease-out', fill: 'both' });
      }
      timers.push(win.setTimeout(() => { end(); remove(); }, OPEN_MS + 30));
    }

    timers.push(win.setTimeout(cut, MAX_MS));
    timers.push(win.setTimeout(open, CAP_MS));
    const dom = doc.readyState === 'loading' ? new Promise(resolve => doc.addEventListener('DOMContentLoaded', resolve, { once: true })) : Promise.resolve();
    const ready = dom.then(() => {
      const wait = [];
      if (doc.fonts && doc.fonts.load) {
        wait.push(doc.fonts.load('800 16px Unbounded', 'САЯН'), doc.fonts.load('700 16px Unbounded', 'Изделия'), doc.fonts.load('400 16px Montserrat', 'Изделия'));
      }
      const hero = doc.querySelector('.home-hero-picture img');
      if (hero && hero.decode) wait.push(hero.decode());
      return Promise.all(wait.map(p => p.catch(() => null)));
    });
    Promise.all([ready, passed]).then(open);
  }

  function start(doc, win) {
    let seen = false;
    try {
      seen = !!win.sessionStorage.getItem(KEY);
      win.sessionStorage.setItem(KEY, '1');
    } catch (e) { /* no storage: the way in from this address still stops it repeating */ }
    const navigation = win.performance && win.performance.getEntriesByType ? win.performance.getEntriesByType('navigation')[0] : null;
    if (!shouldPlay({
      reduced: win.matchMedia('(prefers-reduced-motion: reduce)').matches,
      canAnimate: typeof win.Element !== 'undefined' && !!win.Element.prototype.animate,
      hash: win.location.hash,
      navigationType: navigation && navigation.type,
      seen,
      fromThisAddress: doc.referrer.indexOf(win.location.origin + '/') === 0,
    })) return;
    try {
      play(doc, win);
    } catch (e) {
      const left = doc.getElementById('site-intro');
      if (left) left.remove();
      doc.documentElement.classList.remove('si-on');
    }
  }
  if (typeof document !== 'undefined' && typeof window !== 'undefined') start(document, window);

  return { GLYPHS, NAME, shouldPlay, sweepAt, layout, noiseData };
});
