// js/intro.js
//
// The first moment on the site: «Свет на камне» (2026-11-04: the owner found «Полировка» cartoonish
// and asked for a serious, premium first look; free choice). A polished slab of dark marble comes up
// out of the dark, a slow broad sheen of light glides over it, as over a slab in a showroom. In the
// middle the name, small and widely spaced, in the colour of the white veins, settles in as one
// word; under it a hairline and a quiet line: what the company makes and since when. When the fonts
// and the first photo are ready, the words go, then the slab fades into the page. Nothing jumps,
// nothing flies: one slow light, one word.
//
// The earlier ones stay in .claude/concepts/intro/ (А «Хребет», Б «Полировка», В «Вырез»).
//
// In <head>, without defer, so the slab is there before the first paint. Everything it needs is in
// this file: the letters are outlines (the logo's Unbounded, weight 800), so no font has to load for
// them; the marble is painted by the GPU from a noise texture made here, so no picture has to load.
// The quiet line under the name is in Montserrat and shows only once that font is there.
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
  // each letter are merged into one (skia-pathops), one clean edge per letter.
  const GLYPHS = {
    'А': ['M642.4 0H334.2L-1 750H247.2L304 614.8H672.6L729.4 750H977.6ZM594.5 429H382.1L488.3 176.2L594.5 429Z', 977],
    'М': ['M1190.6 0H831L628.4 519.6L424.4 0H64.8V750H286V204.2L511.6 750H743.8L969.4 202V750H1190.6Z', 1255],
    'Н': ['M64.8 0V750H297.6V470.8H649.2V750H882V0H649.2V265.2H297.6V0Z', 947],
    'О': ['M485.2 767.2Q620.4 767.2 721.8 718.2Q823.2 669.2 879.6 580.9Q936 492.6 936 375Q936 257.4 879.6 169.1Q823.2 80.8 721.8 31.8Q620.4 -17.2 485.2 -17.2Q350 -17.2 248.6 31.8Q147.2 80.8 90.8 169.1Q34.4 257.4 34.4 375Q34.4 492.6 90.8 580.9Q147.2 669.2 248.6 718.2Q350 767.2 485.2 767.2ZM485.2 559.6Q418.4 559.6 369.9 537.4Q321.4 515.2 295.3 473.8Q269.2 432.4 269.2 375Q269.2 317.6 295.3 276.2Q321.4 234.8 369.9 212.6Q418.4 190.4 485.2 190.4Q552.2 190.4 600.6 212.6Q649 234.8 675.1 276.2Q701.2 317.6 701.2 375Q701.2 432.4 675.1 473.8Q649 515.2 600.6 537.4Q552.2 559.6 485.2 559.6Z', 970],
    'Р': ['M493.8 0H64.8V750H297.6V531.6H493.8Q592.2 531.6 662.5 498.8Q732.8 466 769.9 406.1Q807 346.2 807 265.8Q807 185.4 769.9 125.5Q732.8 65.6 662.5 32.8Q592.2 0 493.8 0ZM297.6 348V183.6H479.2Q523.2 183.6 547.7 205Q572.2 226.4 572.2 265.8Q572.2 304.4 547.7 326.2Q523.2 348 479.2 348H297.6Z', 825],
    'С': ['M912.6 430.6H678.8Q669.4 475.4 642.9 506.1Q616.4 536.8 574 552.2Q531.6 567.6 474.8 567.6Q410.8 567.6 364.7 544.2Q318.6 520.8 294 477.8Q269.4 434.8 269.4 375Q269.4 315.2 294 271.8Q318.6 228.4 364.7 205.4Q410.8 182.4 474.8 182.4Q531.6 182.4 574 198.7Q616.4 215 642.9 245.6Q669.4 276.2 678.8 319.4H912.6Q901 218.4 843.3 142.8Q785.6 67.2 691.2 25Q596.8 -17.2 475 -17.2Q342.6 -17.2 243.6 31.8Q144.6 80.8 89.6 169.1Q34.6 257.4 34.6 375Q34.6 492.6 89.6 580.9Q144.6 669.2 243.6 718.2Q342.6 767.2 475 767.2Q596.8 767.2 691.2 725Q785.6 682.8 843.3 607.1Q901 531.4 912.6 430.6Z', 942],
    'Я': ['M225.6 470.8 23 750H290.4L472.5 490H574V750H806.8V0H336.8Q249 0 183.1 30.9Q117.2 61.8 80.5 116.7Q43.8 171.6 43.8 245.8Q43.8 318.4 80.5 372.4Q117.2 426.4 183.1 455.6Q203.3 464.5 225.6 470.8ZM574 327.2H371.8Q327.6 327.2 302.9 305.9Q278.2 284.6 278.2 245.8Q278.2 207 302.9 185.8Q327.6 164.6 371.8 164.6H574V327.2Z', 872],
  };
  const TRACKING = 440;           // wide: a wordmark on a slab, not the header's 0.12em
  const SPREAD = 0.07;            // the letters come in from this much wider, of the name's width
  const CAP = 750;
  const PAD = 20;                 // room around the letters in the name's svg, glyph units
  const DARK = '#0c0d0d';         // the slab before its light: what shows before the marble is ready
  const VEIN = '#e9e7e1';         // the name, the colour of the veins (--on-dark)
  const QUIET = '#a3a89f';        // the line under it (--on-dark-muted)
  const LINE = 'Изделия из натурального камня';
  const SINCE = 'с 2014 года';    // index.html, «О компании»: «Саянмрамор» с 2014 года
  const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const EASE_SOFT = 'cubic-bezier(0.22, 0.68, 0.24, 1)';   // the site's own curve (--ease)
  const EASE_FADE = 'cubic-bezier(0.65, 0, 0.35, 1)';
  const STONE_WAIT = 700;         // the show waits no longer than this for the stone to be ready
  // From the start of the show, ms. The name, then the hairline, then the quiet line; the words go
  // at HOLD at the soonest (when the page is ready), then the slab fades into the page.
  const TIMELINE = { expose: 1300, name: 250, nameMs: 1600, rule: 1000, ruleMs: 900, quiet: 1350, quietMs: 800, quietLate: 2300, hold: 2600, out: 450, fade: 850, cap: 3500 };
  const MAX_MS = 6500;
  // The light runs along sd = (x * .94 + y * .34) / sqrt(w * h): from the top-left corner on.
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

  // Where the light's path is at a point of a w x h screen.
  const sweepAt = (x, y, w, h) => (x * SWEEP[0] + y * SWEEP[1]) / Math.sqrt(w * h);

  // How far a letter starts from its place, in glyph units: away from the middle of the name, the
  // farther the more, so the word draws together around its centre.
  const spreadOf = (letter, units) => (letter.x + letter.adv / 2 - units / 2) * SPREAD;

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
    const vec3 BASE=vec3(.07,.074,.073), CLOUD=vec3(.155,.158,.152), DEEP=vec3(.04,.043,.044);
    const vec3 VEIN=vec3(.7,.695,.67), GOLD=vec3(.66,.58,.45);
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
      float fm0=dot(p,vec2(.62,.36))*1.6+.95*rv.x+.3*fv;
      float fm=fm0+.16*crinkle;
      float dm=dist(fm,fm0);
      float wmain=1.3*(.25+2.2*pow(smoothstep(.35,.9,noise(p*1.1+7.)),2.));
      float on=smoothstep(.2,.48,fbm(p*.6+13.));
      float m=vein(dm,wmain)*on*.5;
      // a few thin threads beside a main vein
      float b=vein(dist(fm*5.+.6*fv,fm0*5.+.6*fv),.22+.3*noise(p*3.+9.))*exp(-dm/(uPx*55.))*on*smoothstep(.3,.6,noise(p*1.7+41.))*.25;
      m+=b*.75;
      // the stone clouds up around a vein, and grey haze streaks lie along the veins
      float halo=exp(-dm/(uPx*(6.+wmain*12.)))*on*.025;
      vec2 dir=normalize(vec2(.62,.36));
      vec2 sp=vec2(dot(p,dir)*1.2,dot(p,vec2(-dir.y,dir.x))*7.)+rv*2.;
      halo+=pow(1.-clamp(abs(fract(fm)-.5)/.22,0.,1.),2.)*smoothstep(.3,.75,fbm(sp+71.))*on*.07;
      // finer veins branching off across them
      float fs0=dot(p,vec2(-.42,.9))*1.9+1.6*rv.y+.9*qv.x;
      float fs=fs0+.12*crinkle;
      float s=vein(dist(fs,fs0),.2+.5*noise(p*2.+3.))*smoothstep(.34,.62,fbm(p*1.15+31.))*.22;
      // hairlines along the main run, short and broken
      float fh=dot(p,vec2(.85,.1))*3.4+2.4*rv.x+1.3*qv.y;
      float h=vein(dist(fh,fh),.2)*smoothstep(.45,.7,fbm(p*1.6+51.))*.07;
      float a=clamp(m+s+h+halo,0.,1.);
      gl_FragColor=vec4(mix(VEIN,GOLD,smoothstep(.6,.8,noise(p*.9+3.))*.5),a);
    }
  `;
  const SHOW = `precision highp float;
    uniform sampler2D uStone, uVeins; uniform vec2 uRes; uniform float uLight, uExpose;
    float hash(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
    void main(){
      vec2 st=gl_FragCoord.xy/uRes;
      vec4 S=texture2D(uStone,st); vec4 V=texture2D(uVeins,st);
      vec2 uv=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/sqrt(uRes.x*uRes.y);
      vec3 col=mix(S.rgb,V.rgb,V.a);
      float lum=dot(col,vec3(.3,.59,.11));
      // the room's light from above the middle: the slab is lit there and falls off to the dark
      vec2 c=(st-vec2(.5,.56))*vec2(uRes.x/sqrt(uRes.x*uRes.y),uRes.y/sqrt(uRes.x*uRes.y));
      col*=.42+.78*exp(-dot(c,c)*2.2);
      // the sheen: a broad soft reflection of a long light gliding over the polish, brighter on the
      // dark of the stone than on its veins, with a narrower core in it; the clouds bend it a little
      float sd=dot(uv,vec2(${SWEEP[0]},${SWEEP[1]}))+(S.a-.5)*.03;
      float e=sd-uLight;
      float sheen=exp(-e*e/.06)*.07+exp(-e*e/.0045)*.045;
      col+=vec3(.93,.95,.95)*sheen*(1.-lum*.7);
      vec2 v=st-.5;
      col*=1.-dot(v,v)*.6;
      col*=uExpose;
      col+=(hash(gl_FragCoord.xy+17.)-.5)*(1.6/255.);
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
  // the stone is baked when the shaders are ready, then onReady runs. draw(light, expose) moves the
  // sheen along its path and sets how much the slab is lit, 0 to 1.
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
    let ready = false, stopped = false, readyFn = null, light = -9, expose = 0;
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
      draw(light, expose);
      if (readyFn) readyFn();
    }
    function draw(at, lit) {
      light = at;
      expose = lit;
      if (!ready || stopped) return;
      gl.uniform1f(u(show, 'uLight'), at);
      gl.uniform1f(u(show, 'uExpose'), lit);
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
    #site-intro { position: fixed; top: 0; bottom: 0; left: 0; width: 100vw; z-index: 2147483000; overflow: hidden; cursor: default; -webkit-user-select: none; user-select: none; background: ${DARK}; }
    #site-intro .si-marble { position: absolute; left: 0; top: 0; width: 100%; height: 100%; display: block; opacity: 0; }
    #site-intro .si-glow { position: absolute; left: 0; top: 0; width: 100%; height: 100%; opacity: 0; background: radial-gradient(120% 90% at 50% 56%, #1d201f, ${DARK} 72%); }
    #site-intro .si-words { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
    #site-intro svg { display: block; position: absolute; left: 0; top: 0; overflow: visible; }
    #site-intro .si-name { fill: ${VEIN}; opacity: 0; }
    #site-intro .si-rule { position: absolute; height: 1px; background: ${VEIN}; opacity: 0.34; transform: scaleX(0); }
    #site-intro .si-quiet { position: absolute; left: 0; width: 100%; margin: 0; padding: 0 16px; box-sizing: border-box; text-align: center; text-indent: 0.26em; color: ${QUIET}; opacity: 0;
      font: 500 12px/1.7 Montserrat, 'Helvetica Neue', Arial, sans-serif; letter-spacing: 0.26em; text-transform: uppercase; }
    #site-intro .si-quiet span { white-space: nowrap; }
    #site-intro .si-quiet .si-dot { padding: 0 0.7em; }
    @media (max-width: 560px) {
      #site-intro .si-quiet { font-size: 10.5px; letter-spacing: 0.22em; text-indent: 0.22em; }
      #site-intro .si-quiet span { display: block; }
      #site-intro .si-quiet .si-dot { display: none; }
    }
  `;

  const SVG = 'http://www.w3.org/2000/svg';
  function svgEl(doc, tag, attrs) {
    const node = doc.createElementNS(SVG, tag);
    Object.keys(attrs || {}).forEach(k => node.setAttribute(k, attrs[k]));
    return node;
  }
  function el(doc, tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function play(doc, win) {
    const root = doc.documentElement;
    // The whole window, the page's scrollbar included (it comes only once the page has loaded; the
    // slab runs on under it), so the marble is drawn pixel for pixel and never squeezed when it comes.
    const w = win.innerWidth, h = win.innerHeight;
    const T = TIMELINE;

    const style = doc.createElement('style');
    style.textContent = STYLE;
    doc.head.appendChild(style);
    const box = el(doc, 'div');
    box.id = 'site-intro';
    box.setAttribute('aria-hidden', 'true');

    const timers = [];
    const later = (fn, ms) => timers.push(win.setTimeout(fn, ms));
    let ended = false, leaving = false, frame = 0, t0 = 0;
    // The sheen glides from the top-left part of the slab past its middle over the whole show.
    const lightFrom = sweepAt(0, 0, w, h) + 0.1, lightTo = sweepAt(w, h, w, h) * 0.9;
    const lightAt = t => lightFrom + (lightTo - lightFrom) * Math.min(1, t / (T.cap + T.fade));
    const exposeEase = bezier(0.22, 0.68, 0.24, 1);
    const m = marble(doc, win, w, h);
    const glow = m ? null : el(doc, 'div', 'si-glow');
    if (m) {
      box.appendChild(m.canvas);
      m.draw(lightFrom, 0);
    } else {
      box.appendChild(glow);
    }

    // ---- the words: the name, a hairline, the quiet line
    const words = el(doc, 'div', 'si-words');
    const fontSize = Math.max(18, Math.min(34, w * 0.025));
    const scale = fontSize / 1000;
    const lay = layout();
    const nameW = lay.units * scale;
    const capPx = CAP * scale;
    const name = svgEl(doc, 'svg', {
      class: 'si-name',
      viewBox: (-PAD) + ' ' + (-PAD) + ' ' + (lay.units + PAD * 2) + ' ' + (CAP + PAD * 2),
      width: (lay.units + PAD * 2) * scale, height: (CAP + PAD * 2) * scale,
    });
    const nameX = (w - nameW) / 2 - PAD * scale;
    const nameTop = Math.round(h * 0.46 - capPx / 2);
    name.style.transform = 'translate(' + nameX + 'px,' + (nameTop - PAD * scale) + 'px)';
    const letters = lay.letters.map(l => {
      const g = svgEl(doc, 'g');
      g.appendChild(svgEl(doc, 'path', { d: l.d, transform: 'translate(' + l.x + ' 0)' }));
      name.appendChild(g);
      return { g, spread: spreadOf(l, lay.units) };
    });
    words.appendChild(name);

    const RULE_W = 56;
    const ruleTop = Math.round(nameTop + capPx + Math.max(20, fontSize * 0.95));
    const rule = el(doc, 'div', 'si-rule');
    rule.style.cssText = 'left:' + Math.round(w / 2 - RULE_W / 2) + 'px;top:' + ruleTop + 'px;width:' + RULE_W + 'px';
    words.appendChild(rule);

    const quiet = el(doc, 'p', 'si-quiet');
    quiet.style.top = Math.round(ruleTop + Math.max(14, fontSize * 0.6)) + 'px';
    quiet.appendChild(el(doc, 'span', '', LINE));
    quiet.appendChild(el(doc, 'span', 'si-dot', '·'));
    quiet.appendChild(el(doc, 'span', '', SINCE));
    words.appendChild(quiet);
    box.appendChild(words);

    root.classList.add('si-on');
    root.appendChild(box);

    // ---- the light: every frame while the slab is there
    const tick = now => {
      const t = now - t0;
      if (m) m.draw(lightAt(t), exposeEase(t / T.expose));
      frame = win.requestAnimationFrame(tick);
    };

    // The page and the font of the quiet line: once the document is there.
    const dom = doc.readyState === 'loading' ? new Promise(resolve => doc.addEventListener('DOMContentLoaded', resolve, { once: true })) : Promise.resolve();
    const fontOf = (spec, text) => (doc.fonts && doc.fonts.load ? doc.fonts.load(spec, text) : Promise.resolve()).catch(() => null);
    const quietFont = dom.then(() => fontOf('500 12px Montserrat', LINE + SINCE));
    const ready = dom.then(() => {
      const wait = [fontOf('800 16px Unbounded', 'САЯН'), fontOf('700 16px Unbounded', 'Изделия'), fontOf('400 16px Montserrat', 'Изделия')];
      const hero = doc.querySelector('.home-hero-picture img');
      if (hero && hero.decode) wait.push(hero.decode().catch(() => null));
      return Promise.all(wait);
    });

    // ---- the show, once the stone is ready (or STONE_WAIT has gone by)
    let begun = false;
    function begin() {
      if (begun || ended) return;
      begun = true;
      t0 = win.performance.now();
      if (m) {
        m.canvas.style.opacity = 1;
        frame = win.requestAnimationFrame(tick);
      } else {
        glow.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T.expose, easing: EASE_SOFT, fill: 'both' });
      }
      later(() => {
        name.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T.nameMs, easing: EASE_SOFT, fill: 'both' });
        letters.forEach(l => l.g.animate([{ transform: 'translateX(' + l.spread + 'px)' }, { transform: 'translateX(0)' }], { duration: T.nameMs, easing: EASE_OUT, fill: 'both' }));
      }, T.name);
      later(() => rule.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: T.ruleMs, easing: EASE_OUT, fill: 'both' }), T.rule);
      // the quiet line only in its own font: if that is late, without it
      let quietTime = false, quietReady = false;
      const showQuiet = () => {
        if (!quietTime || !quietReady || ended || leaving) return;
        if (win.performance.now() - t0 > T.quietLate) return;
        quiet.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: T.quietMs, easing: EASE_SOFT, fill: 'both' });
      };
      quietFont.then(() => { quietReady = true; showQuiet(); });
      later(() => { quietTime = true; showQuiet(); }, T.quiet);
      const held = new Promise(resolve => later(resolve, T.hold));
      Promise.all([ready, held]).then(leave);
      later(leave, T.cap);
    }
    later(begin, m ? STONE_WAIT : 150);   // no stone to wait for: at once
    if (m) m.onReady(begin);

    // ---- the end
    const listeners = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'pagehide'];
    const remove = () => {
      win.cancelAnimationFrame(frame);
      box.remove();
      style.remove();
      root.classList.remove('si-on');
      if (m) m.release();
    };
    const end = () => {
      if (ended) return;
      ended = true;
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

    // ---- the words go, then the slab fades into the page
    function leave() {
      if (leaving || ended) return;
      leaving = true;
      words.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T.out, easing: 'ease-in', fill: 'both' });
      later(() => {
        box.style.pointerEvents = 'none';
        box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T.fade, easing: EASE_FADE, fill: 'both' });
      }, T.out * 0.6);
      later(() => { end(); remove(); }, T.out * 0.6 + T.fade + 30);
    }

    later(cut, MAX_MS);
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

  return { GLYPHS, NAME, TIMELINE, MAX_MS, shouldPlay, sweepAt, spreadOf, layout, noiseData };
});
