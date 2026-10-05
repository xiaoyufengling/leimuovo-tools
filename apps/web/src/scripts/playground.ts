/** Native scrolling; one interruptible frame loop, no wheel interception or scroll timers. */
const root = document.querySelector<HTMLElement>("[data-playground]");
if (root) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const motionButton = root.querySelector<HTMLButtonElement>("[data-motion-toggle]")!;
  let paused = reduced.matches;
  let visible = !document.hidden;
  let time = 0;
  let last = performance.now();
  let pointerX = 0, pointerY = 0;
  let currentX = 0, currentY = 0;
  let material = 0, currentMaterial = 0;
  let shape = .35, currentShape = .35;
  let fieldMode = 0, currentField = 0;
  let spread = .55, currentSpread = .55;
  let fieldX = .55, fieldY = .55;
  let needsFrame = true;
  let frame = 0;
  const hero = root.querySelector<HTMLElement>(".pg-hero")!;
  const sculpture = root.querySelector<HTMLElement>("[data-sculpture]")!;
  const liquid = root.querySelector<HTMLCanvasElement>("[data-liquid-canvas]")!;
  const field = root.querySelector<HTMLCanvasElement>("[data-flow-canvas]")!;
  const glass = root.querySelector<HTMLElement>("[data-glass-stage]")!;
  const flowSection = root.querySelector<HTMLElement>(".pg-flow")!;
  let heroVisible = true, fieldVisible = false, glassVisible = false;

  const syncMotion = () => {
    root.classList.toggle("is-paused", paused);
    motionButton.setAttribute("aria-pressed", String(paused));
    root.querySelector("[data-motion-label]")!.textContent = paused ? "开启动效" : "暂停动效";
    root.querySelector(".pg-motion-icon")!.textContent = paused ? "▷" : "Ⅱ";
    if (paused) { glass.style.setProperty("--tilt-x", "0deg"); glass.style.setProperty("--tilt-y", "0deg"); }
    schedule();
  };
  motionButton.addEventListener("click", () => { paused = !paused; syncMotion(); });
  reduced.addEventListener("change", () => { paused = reduced.matches; syncMotion(); });
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; last = performance.now(); if (visible) schedule(); });
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.target === hero) heroVisible = entry.isIntersecting;
      if (entry.target === flowSection) fieldVisible = entry.isIntersecting;
      if (entry.target === glass) glassVisible = entry.isIntersecting;
    }
    schedule();
  }, { rootMargin: "80px" });
  [hero, flowSection, glass].forEach(el => observer.observe(el));

  root.querySelectorAll<HTMLButtonElement>("[data-material]").forEach(button => {
    button.addEventListener("click", () => {
      material = Number(button.dataset.material);
      root.querySelectorAll("[data-material]").forEach(el => el.setAttribute("aria-pressed", String(el === button)));
      const fallback = root.querySelector<HTMLElement>(".pg-sculpture-fallback")!;
      fallback.style.borderColor = ["#8bb3f6", "#b8c8d8", "#d8adc9"][material]!;
      if (paused) currentMaterial = material;
      schedule();
    });
  });
  const shapeInput = root.querySelector<HTMLInputElement>("[data-shape-control]")!;
  shapeInput.addEventListener("input", () => {
    shape = Number(shapeInput.value) / 100;
    root.querySelector("#shape-value")!.textContent = shapeInput.value;
    root.querySelector<HTMLElement>(".pg-sculpture-fallback")!.style.borderRadius = `${50 - shape * 18}%`;
    if (paused) currentShape = shape;
    schedule();
  });
  root.querySelectorAll<HTMLButtonElement>("[data-field]").forEach(button => {
    button.addEventListener("click", () => {
      fieldMode = Number(button.dataset.field);
      root.querySelectorAll("[data-field]").forEach(el => el.setAttribute("aria-pressed", String(el === button)));
      if (paused) currentField = fieldMode;
      schedule();
    });
  });
  const spaceInput = root.querySelector<HTMLInputElement>("[data-space-control]")!;
  const setSpread = (value: number) => {
    spread = value / 100; spaceInput.value = String(value);
    root.querySelector("#space-value")!.textContent = `${value}%`;
    if (paused) currentSpread = spread;
    schedule();
  };
  spaceInput.addEventListener("input", () => setSpread(Number(spaceInput.value)));
  root.querySelectorAll<HTMLButtonElement>("[data-space-preset]").forEach(button => button.addEventListener("click", () => setSpread(Number(button.dataset.spacePreset))));
  hero.addEventListener("pointermove", e => {
    if (e.pointerType === "touch") return;
    const r = hero.getBoundingClientRect(); pointerX = (e.clientX-r.left)/r.width-.5; pointerY = (e.clientY-r.top)/r.height-.5; schedule();
  }, { passive: true });
  hero.addEventListener("pointerleave", () => { pointerX = pointerY = 0; schedule(); }, { passive: true });
  const moveField = (e: PointerEvent) => {
    const r = field.getBoundingClientRect(); fieldX = Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)); fieldY = Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));
    root.querySelector("[data-coordinate-x]")!.textContent = fieldX.toFixed(2);
    root.querySelector("[data-coordinate-y]")!.textContent = fieldY.toFixed(2);
    schedule();
  };
  field.addEventListener("pointermove", e => { if (e.pointerType !== "touch") moveField(e); }, { passive: true });
  field.addEventListener("pointerdown", moveField, { passive: true });
  glass.addEventListener("pointermove", e => {
    if (paused || e.pointerType === "touch") return;
    const r = glass.getBoundingClientRect();
    glass.style.setProperty("--tilt-y", `${((e.clientX-r.left)/r.width-.5)*9}deg`);
    glass.style.setProperty("--tilt-x", `${-((e.clientY-r.top)/r.height-.5)*7}deg`);
  }, { passive: true });
  glass.addEventListener("pointerleave", () => { glass.style.setProperty("--tilt-y","0deg"); glass.style.setProperty("--tilt-x","0deg"); }, { passive:true });

  // Self-contained ray-marched sculpture. No remote libraries or texture downloads.
  const gl = liquid.getContext("webgl", { alpha: true, antialias: false, powerPreference: "low-power", premultipliedAlpha: false });
  let program: WebGLProgram | null = null;
  let uniforms: Record<string, WebGLUniformLocation | null> = {};
  const vertex = `attribute vec2 position; void main(){gl_Position=vec4(position,0.,1.);}`;
  const fragment = `precision highp float;
    uniform vec2 resolution; uniform float time; uniform vec2 pointer; uniform float material; uniform float shape;
    mat2 rot(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}
    float scene(vec3 p){
      p.xz=rot(-.42+pointer.x*.44+sin(time*.19)*.08)*p.xz;
      p.yz=rot(.65+pointer.y*.4)*p.yz; p.xy=rot(-.37)*p.xy;
      float angle=atan(p.y,p.x); float wave=sin(angle*3.+time*.18)*(.03+shape*.12);
      vec2 q=vec2(length(p.xy)-.99-wave,p.z);
      q=rot(angle*1.5+shape*1.7)*q;
      return length(q*vec2(1.,1.1+shape*.4))-(.34+shape*.08);
    }
    vec3 normal(vec3 p){vec2 e=vec2(.002,0.); return normalize(vec3(scene(p+e.xyy)-scene(p-e.xyy),scene(p+e.yxy)-scene(p-e.yxy),scene(p+e.yyx)-scene(p-e.yyx)));}
    vec3 environment(vec3 d){
      vec3 sky=mix(vec3(.06,.19,.42),vec3(.83,.93,1.),smoothstep(-.6,.8,d.y));
      float bands=pow(max(0.,sin(d.x*3.+d.y*2.1)),14.);
      sky+=vec3(.6,.76,1.)*bands;
      sky+=vec3(1.)*pow(max(dot(d,normalize(vec3(-1.,1.4,1.4))),0.),28.)*1.4;
      sky*=.68+.32*smoothstep(-.22,-.05,d.x);
      return sky;
    }
    void main(){
      vec2 uv=(gl_FragCoord.xy*2.-resolution)/min(resolution.x,resolution.y);
      vec3 ro=vec3(0.,0.,4.6); vec3 rd=normalize(vec3(uv*1.48,-4.6));
      float t=0.; float d=0.;
      for(int i=0;i<72;i++){d=scene(ro+rd*t);if(d<.0015||t>7.)break;t+=d*.82;}
      if(t>7.){gl_FragColor=vec4(0.);return;}
      vec3 p=ro+rd*t;vec3 n=normal(p);vec3 refl=reflect(rd,n);
      float fres=pow(1.-max(dot(-rd,n),0.),3.);
      vec3 blue=vec3(.22,.49,.86);vec3 pearl=vec3(.72,.79,.86);vec3 pink=vec3(.74,.46,.68);
      vec3 tint=mix(blue,pearl,clamp(material,0.,1.));tint=mix(tint,pink,clamp(material-1.,0.,1.));
      float diffuse=max(dot(n,normalize(vec3(-.5,1.,2.))),0.);
      vec3 color=tint*(.32+.65*diffuse)+environment(refl)*(.32+fres*.45);
      float spec=pow(max(dot(refl,normalize(vec3(-1.,1.4,2.))),0.),55.);
      color+=vec3(.75,.87,1.)*spec*.8;
      color=mix(color,vec3(.9,.96,1.),fres*.32);
      color=pow(color,vec3(.94)); gl_FragColor=vec4(color,1.);
    }`;
  if (gl) {
    try {
      const compile = (source: string, type: number) => {
        const shader = gl.createShader(type)!; gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "Shader compilation failed");
        return shader;
      };
      program=gl.createProgram()!; gl.attachShader(program,compile(vertex,gl.VERTEX_SHADER)); gl.attachShader(program,compile(fragment,gl.FRAGMENT_SHADER));gl.linkProgram(program);
      if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error("Shader link failed");
      gl.useProgram(program); const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      const pos=gl.getAttribLocation(program,"position");gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
      uniforms=Object.fromEntries(["resolution","time","pointer","material","shape"].map(name=>[name,gl.getUniformLocation(program!,name)]));
      sculpture.classList.add("is-rendered");
    } catch (error) { program=null; console.warn("Sculpture uses its static fallback:",error); }
  }
  liquid.addEventListener("webglcontextlost", () => { program=null;sculpture.classList.remove("is-rendered");root.querySelector("[data-render-label]")!.textContent="STATIC / 001"; });
  if (!program) root.querySelector("[data-render-label]")!.textContent="STATIC / 001";
  const ctx=field.getContext("2d");
  let fw=0, fh=0;
  const resize = () => {
    const dpr=Math.min(devicePixelRatio||1,1.5);
    const rect=liquid.getBoundingClientRect();liquid.width=Math.round(rect.width*dpr*.85);liquid.height=Math.round(rect.height*dpr*.85);
    const fr=field.getBoundingClientRect();fw=fr.width;fh=fr.height;field.width=Math.round(fw*dpr);field.height=Math.round(fh*dpr);ctx?.setTransform(dpr,0,0,dpr,0,0);schedule();
  };
  new ResizeObserver(resize).observe(root);
  const drawField = () => {
    if(!ctx)return;ctx.clearRect(0,0,fw,fh);
    const gradient=ctx.createLinearGradient(0,fh*.45,fw,fh*.7);gradient.addColorStop(0,"#2e599411");gradient.addColorStop(.3,"#497ecb80");gradient.addColorStop(.62,"#a5d5ff");gradient.addColorStop(.83,"#5185dcaa");gradient.addColorStop(1,"#557add11");
    ctx.strokeStyle=gradient;ctx.lineWidth=.85;
    const modeA=Math.floor(currentField), blend=currentField-modeA;
    const point = (x:number, line:number, mode:number): [number,number] => {
      const phase=line/68, nx=x/fw;
      if(mode===1){const a=nx*Math.PI*2;const radius=60+phase*Math.min(fw,fh)*.57;return [fw*(.57+(fieldX-.5)*.13)+Math.cos(a+time*.04)*radius,fh*.56+Math.sin(a)*radius*.44+Math.sin(a*3+phase*5+time*.3)*23];}
      if(mode===2){const a=nx*Math.PI*2;const radius=45+phase*Math.min(fw,fh)*.62;return [fw*.57+Math.cos(a)*radius,fh*.58+Math.sin(a)*radius*.31+Math.cos(a*2+phase*3+time*.22)*60+(fieldY-.5)*Math.sin(a)*70];}
      const influence=Math.exp(-Math.pow((nx-fieldX)*3,2));
      return [x,fh*.62+(phase-.5)*fh*.35+Math.sin(nx*5.8+phase*2.8+time*.32)*fh*.12+Math.sin(nx*10-phase*4+time*.16)*30-influence*(fieldY-.5)*150];
    };
    for(let line=0;line<68;line++){
      ctx.beginPath();for(let x=0;x<=fw;x+=7){const a=point(x,line,modeA),b=point(x,line,Math.min(2,modeA+1));const px=a[0]+(b[0]-a[0])*blend,py=a[1]+(b[1]-a[1])*blend;if(x===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.stroke();
    }
  };
  function schedule(){needsFrame=true;if(!frame&&visible)frame=requestAnimationFrame(render);}
  function render(now:number){
    frame=0;if(!visible)return;const dt=Math.min((now-last)/1000,.045);last=now;const ease=1-Math.exp(-dt*10);
    if(!paused)time+=dt;
    currentX+=(pointerX-currentX)*ease;currentY+=(pointerY-currentY)*ease;currentMaterial+=(material-currentMaterial)*ease;currentShape+=(shape-currentShape)*ease;currentField+=(fieldMode-currentField)*ease;currentSpread+=(spread-currentSpread)*ease;
    if(heroVisible&&gl&&program){gl.viewport(0,0,liquid.width,liquid.height);gl.uniform2f(uniforms.resolution ?? null,liquid.width,liquid.height);gl.uniform1f(uniforms.time ?? null,time);gl.uniform2f(uniforms.pointer ?? null,paused?0:currentX,paused?0:currentY);gl.uniform1f(uniforms.material ?? null,currentMaterial);gl.uniform1f(uniforms.shape ?? null,currentShape);gl.drawArrays(gl.TRIANGLES,0,6);}
    if(fieldVisible||needsFrame)drawField();
    if(glassVisible||needsFrame)glass.style.setProperty("--spread",currentSpread.toFixed(4));
    needsFrame=false;
    const unsettled=Math.abs(currentMaterial-material)+Math.abs(currentShape-shape)+Math.abs(currentField-fieldMode)+Math.abs(currentSpread-spread)>.001;
    if((!paused&&(heroVisible||fieldVisible))||unsettled)frame=requestAnimationFrame(render);
  }
  resize();syncMotion();
}
