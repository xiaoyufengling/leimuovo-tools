/** Native scrolling; one interruptible frame loop, no wheel interception or scroll timers. */
const root = document.querySelector<HTMLElement>("[data-playground]");
if (root) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const motionButton = root.querySelector<HTMLButtonElement>("[data-motion-toggle]")!;
  let paused = reduced.matches;
  let visible = !document.hidden;
  let time = 0;
  let last = performance.now();
  let fieldMode = 0, currentField = 0;
  let spread = .55, currentSpread = .55;
  let fieldX = .55, fieldY = .55;
  let needsFrame = true;
  let frame = 0;
  const field = root.querySelector<HTMLCanvasElement>("[data-flow-canvas]")!;
  const glass = root.querySelector<HTMLElement>("[data-glass-stage]")!;
  const flowSection = root.querySelector<HTMLElement>(".pg-flow")!;
  let fieldVisible = false, glassVisible = false;

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
      if (entry.target === flowSection) fieldVisible = entry.isIntersecting;
      if (entry.target === glass) glassVisible = entry.isIntersecting;
    }
    schedule();
  }, { rootMargin: "80px" });
  [flowSection, glass].forEach(el => observer.observe(el));

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

  const ctx=field.getContext("2d");
  let fw=0, fh=0;
  const resize = () => {
    const dpr=Math.min(devicePixelRatio||1,1.5);
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
    currentField+=(fieldMode-currentField)*ease;currentSpread+=(spread-currentSpread)*ease;
    if(fieldVisible||needsFrame)drawField();
    if(glassVisible||needsFrame)glass.style.setProperty("--spread",currentSpread.toFixed(4));
    needsFrame=false;
    const unsettled=Math.abs(currentField-fieldMode)+Math.abs(currentSpread-spread)>.001;
    if((!paused&&fieldVisible)||unsettled)frame=requestAnimationFrame(render);
  }
  resize();syncMotion();
}

export {};
