import { machines, getMachinePeriod, getKindSummary, formatDuration, formatNumber, stateLabels, type Machine, type MachineKind, type Period, type MachinePeriod } from "../modules/production-data";

const rootElement = document.querySelector<HTMLElement>("[data-rem-experience]");
if (rootElement) {
  const root: HTMLElement = rootElement;
  const html = document.documentElement;
  const runway = root.querySelector<HTMLElement>("[data-console-runway]")!;
  const stage = root.querySelector<HTMLElement>("[data-console-stage]")!;
  const screen = root.querySelector<HTMLElement>("[data-monitor-screen]")!;
  const dashboard = root.querySelector<HTMLElement>("[data-console-dashboard]")!;
  const dialog = root.querySelector<HTMLDialogElement>("[data-machine-dialog]")!;
  const reduceMedia = matchMedia("(prefers-reduced-motion: reduce)");
  const pieces = [...root.querySelectorAll<HTMLElement>("[data-assembly]")];
  const periods: Record<MachineKind, Period> = { cnc: "day", print: "day" };
  let reduced = reduceMedia.matches || !html.classList.contains("rem-motion");
  let currentView = "overview";
  let kindFilter = "all";
  let query = "";
  let expanded = false;
  let frame = 0;
  let reconcileTimer:ReturnType<typeof setTimeout>|undefined;
  let progress = reduced ? 1 : 0;
  let stageTop = 0, stageTravel = 1, screenWidth = 1000, screenHeight = 560;
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const smooth = (from: number, to: number, value: number) => { const p = clamp((value - from) / (to - from)); return p * p * (3 - 2 * p); };
  const sceneNames = ["READY WHEN YOU ARE", "POWERING ON", "ASSEMBLING WORKSPACE", "WORKSPACE READY"];
  // Every seed is a part of the final interface. Docking and unfolding are
  // separate scroll phases; nothing is cloned, swapped, or time-autoplayed.
  type MorphSpec = { dock: [number,number]; open: [number,number]; seed: string; side: "left"|"right"|"top"|"bottom" };
  const recipe: Record<string, MorphSpec> = {
    nav: {dock:[.18,.35],open:[.39,.64],seed:"[data-console-view=overview]",side:"left"},
    header: {dock:[.20,.37],open:[.40,.58],seed:"h1",side:"top"},
    summary: {dock:[.24,.41],open:[.45,.65],seed:"strong",side:"right"},
    "chart-cnc": {dock:[.27,.44],open:[.48,.60],seed:"h2",side:"left"},
    "chart-print": {dock:[.29,.46],open:[.50,.62],seed:"h2",side:"right"},
    note: {dock:[.81,.87],open:[.88,.91],seed:".note-icon",side:"bottom"},
  };
  const rowElements = [...root.querySelectorAll<HTMLElement>("[data-machine-row]")];
  rowElements.forEach((row,index)=>{
    recipe[row.dataset.assembly!] = {dock:[.37+index*.009,.55+index*.009],open:[.60+index*.008,.81+index*.008],seed:".machine-identity strong",side:index<6?"left":"right"};
  });
  type Detail = { element:HTMLElement; gate:number };
  type Bounds = { x:number; y:number; w:number; h:number; seedX:number; seedY:number; seedW:number; seedH:number; row:boolean; borderX:number; borderY:number; details:Detail[] };
  const bounds = new Map<HTMLElement,Bounds>();
  const chartPoints = new Map<HTMLElement,number[][]>();
  let sidebarContentBottom=0,leftRowLift=0;
  const layoutPosition = (element:HTMLElement) => {
    let x=0,y=0,node:HTMLElement|null=element;
    while(node){x+=node.offsetLeft;y+=node.offsetTop;node=node.offsetParent as HTMLElement|null;}
    return {x,y};
  };
  // One persistent surface owns the seed and the finished component. The small
  // left/vertical expansion makes room for the icon before the long edge grows.
  function surfaceBox(box:Bounds,open:number){
    const short=box.row?smooth(0,.25,open):open;
    const left=box.seedX*(1-short),top=box.seedY*(1-short);
    const right=box.seedX+box.seedW+(box.w-box.seedX-box.seedW)*open;
    const bottom=box.seedY+box.seedH+(box.h-box.seedY-box.seedH)*short;
    return {left,top,right,bottom,width:right-left,height:bottom-top};
  }
  function measurePieces(){
    // Measure a canonical final layout synchronously, never the animated frame.
    // This class is removed before paint and preserves the same actual DOM.
    root.classList.add("is-measuring");
    const origin=layoutPosition(screen);
    for(const piece of pieces){
      if(!piece.offsetWidth)continue;
      const key=piece.dataset.assembly!,spec=recipe[key];if(!spec)continue;
      const seed=piece.querySelector<HTMLElement>(spec.seed)!;
      const p=layoutPosition(piece),pr=piece.getBoundingClientRect(),sr=seed.getBoundingClientRect();
      const computed=getComputedStyle(piece);
      const row=piece.hasAttribute("data-machine-row"),pad=row?10:6;
      const seedH=row?Math.min(22,pr.height):Math.min(pr.height,sr.height+pad*2);
      const seedX=Math.max(0,sr.left-pr.left-pad),seedY=row?(pr.height-seedH)/2:Math.max(0,sr.top-pr.top-pad);
      const box:Bounds={x:p.x-origin.x,y:p.y-origin.y,w:pr.width,h:pr.height,seedX,seedY,
        seedW:Math.min(pr.width-seedX,(key==="summary"?Math.min(85,sr.width):sr.width)+pad*2),
        seedH:Math.min(pr.height-seedY,seedH),row,borderX:parseFloat(computed.borderLeftWidth)||0,borderY:parseFloat(computed.borderTopWidth)||0,details:[]};
      let children:HTMLElement[]=[];
      if(row)children=[...piece.querySelectorAll<HTMLElement>(":scope > span, .machine-type-icon, .machine-identity small")];
      else if(key==="nav")children=[...piece.querySelectorAll<HTMLElement>(".console-brand, .sidebar-bottom, .console-nav button:not(:first-child)")];
      else if(key==="header")children=[...piece.querySelectorAll<HTMLElement>(".demo-badge, .console-toolbar-actions > *")];
      else if(key==="summary")children=[...piece.querySelectorAll<HTMLElement>(":scope > span")];
      else if(key.startsWith("chart-"))children=[...piece.querySelectorAll<HTMLElement>("header p, .chart-periods, .chart-plot")];
      else if(key==="note")children=[...piece.querySelectorAll<HTMLElement>(":scope > span:not(.note-icon)")];
      for(const child of children){
        child.dataset.morphDetail="";
        if(!child.offsetWidth)continue;
        const at=child.getBoundingClientRect();
        const left=Math.max(0,at.left-pr.left-2),top=Math.max(0,at.top-pr.top-2);
        const right=Math.min(box.w,at.right-pr.left+2);
        const bottom=Math.min(box.h,at.top-pr.top+Math.max(at.height,child.scrollHeight)+2);
        let lo=spec.open[0],hi=spec.open[1];
        // Find the first scroll position at which the whole actual control fits.
        for(let i=0;i<20;i++){
          const mid=(lo+hi)/2,opening=smooth(...spec.open,mid),b=surfaceBox(box,opening);
          const radius=Math.min(13,box.seedH/2)*(1-opening)+(key.startsWith("chart-")?5:0)*opening;
          const inside=(x:number,y:number)=>{
            if(x<b.left||x>b.right||y<b.top||y>b.bottom)return false;
            const cx=Math.max(b.left+radius,Math.min(b.right-radius,x));
            const cy=Math.max(b.top+radius,Math.min(b.bottom-radius,y));
            return Math.hypot(x-cx,y-cy)<=radius+.001;
          };
          if(inside(left,top)&&inside(right,top)&&inside(left,bottom)&&inside(right,bottom))hi=mid;else lo=mid;
        }
        box.details.push({element:child,gate:hi});
      }
      bounds.set(piece,box);
    }
    const lastNav=root.querySelector<HTMLElement>(".console-nav button:last-child")!;
    sidebarContentBottom=layoutPosition(lastNav).y-origin.y+lastNav.offsetHeight;
    const firstLeft=rowElements.find(row=>row.dataset.kind==="cnc"&&!row.hidden&&row.offsetWidth>0);
    const firstBox=firstLeft?bounds.get(firstLeft):undefined;
    leftRowLift=firstBox?Math.max(0,sidebarContentBottom+12+firstBox.seedH/2-(firstBox.y+firstBox.seedY+firstBox.seedH/2)):0;
    root.classList.remove("is-measuring");
  }
  function renderMorphs(){
    for(const piece of pieces){
      const key=piece.dataset.assembly!,spec=recipe[key],box=bounds.get(piece);if(!spec||!box)continue;
      const localDock=clamp((progress-spec.dock[0])/(spec.dock[1]-spec.dock[0]));
      const dock=smooth(...spec.dock,progress),open=smooth(...spec.open,progress),remain=1-dock;
      const surface=surfaceBox(box,open),endRadius=key.startsWith("chart-")?5:0;
      const radius=Math.min(13,box.seedH/2)*(1-open)+endRadius*open;
      piece.dataset.morphDock=dock.toFixed(4);piece.dataset.morphOpen=open.toFixed(4);
      for(const [name,value] of Object.entries({left:surface.left,top:surface.top,width:surface.width,height:surface.height,radius})){
        piece.style.setProperty(`--surface-${name}`,`${value-(name==="left"?box.borderX:name==="top"?box.borderY:0)}px`);
        piece.dataset[`surface${name[0]!.toUpperCase()+name.slice(1)}`]=value.toFixed(4);
      }
      piece.style.setProperty("--piece-clip",open>=1?"none":`inset(${surface.top}px ${Math.max(0,box.w-surface.right)}px ${Math.max(0,box.h-surface.bottom)}px ${surface.left}px round ${radius}px)`);
      let x=0,y=0;
      if(spec.side==="left")x=-(box.x+box.seedX+box.seedW+24);
      if(spec.side==="right")x=screenWidth-box.x-box.seedX+24;
      if(spec.side==="top")y=-(box.y+box.seedY+box.seedH+24);
      if(spec.side==="bottom")y=screenHeight-box.y-box.seedY+24;
      let tx=x*remain,ty=y*remain;
      if(key==="chart-cnc" || (box.row&&spec.side==="left")){
        // Cross below every sidebar label, then rise only after clearing its edge.
        // All CNC rows share the same lift, so seeds keep their vertical spacing.
        const lift=box.row?leftRowLift:Math.max(0,sidebarContentBottom+16+box.seedH/2-(box.y+box.seedY+box.seedH/2));
        tx=x*(1-smooth(0,.65,localDock));
        ty=lift*(1-smooth(.45,box.row ? .9 : 1,localDock));
      }
      piece.style.setProperty("--piece-opacity",String(smooth(spec.dock[0],spec.dock[0]+.025,progress)));
      // In-flight controls live above all docked surfaces. No tilted cut-outs.
      piece.style.setProperty("--piece-layer",String(dock<1?50:box.row?5:key==="nav"?2:4));
      piece.style.setProperty("--piece-transform",`translate3d(${tx}px,${ty}px,0)`);
      piece.style.setProperty("--morph-open",String(open));
      // Keep the growing shape visibly coherent until it has finished growing.
      const settled=smooth(spec.open[1]+.025,spec.open[1]+.055,progress);
      piece.style.setProperty("--surface-settled",String(settled));
      for(const detail of box.details){
        const reveal=smooth(detail.gate,detail.gate+.025,progress);
        detail.element.style.setProperty("--detail-opacity",String(reveal));
        detail.element.style.setProperty("--cell-reveal",String(reveal));
        detail.element.dataset.detailGate=detail.gate.toFixed(5);
      }
    }
    const header=root.querySelector<HTMLElement>("[data-table-head]")!;
    header.style.setProperty("--table-head-open",String(smooth(.64,.91,progress)));
    [...header.children].forEach((cell,index)=>(cell as HTMLElement).style.setProperty("--heading-reveal",String(smooth(.62+index*.012,.66+index*.013,progress))));
    root.style.setProperty("--table-frame",String(smooth(.92,.97,progress)));
    root.style.setProperty("--secondary-reveal",String(smooth(.94,.98,progress)));
    renderChartTraces();
  }
  function renderChartTraces(){
    for(const panel of root.querySelectorAll<HTMLElement>("[data-production-chart]")){
      const shift=panel.dataset.productionChart==="cnc"?0:.025;
      // A linear x-domain reveal, not path-length timing: both curves grow
      // rightward at the same reading speed even across steep segments.
      const draw=clamp((progress-.63-shift)/.295);
      const x=28+444*draw;
      panel.dataset.chartDraw=draw.toFixed(4);
      panel.querySelector("[data-chart-reveal]")!.setAttribute("width",String(draw>=1?454:draw<=0?0:x-24));
      const tip=panel.querySelector<SVGCircleElement>("[data-chart-tip]")!;
      const points=chartPoints.get(panel);
      if(points?.length){
        const index=Math.min(points.length-2,Math.floor(draw*(points.length-1)));
        const a=points[index]!,b=points[index+1]!,fraction=(x-a[0]!)/(b[0]!-a[0]!);
        tip.setAttribute("cx",String(x));tip.setAttribute("cy",String(a[1]!+(b[1]!-a[1]!)*fraction));
      }
      for(const marker of panel.querySelectorAll<SVGCircleElement>("[data-chart-points] circle")){
        marker.style.opacity=String(draw>=1||Number(marker.getAttribute("cx"))+4<=x?1:0);
      }
      tip.style.opacity=String(draw>0&&draw<1?smooth(0,.04,draw)*(1-smooth(.94,1,draw)):0);
    }
  }

  function measure() {
    // Layout offsets stay consistent when mobile WebKit scrolls asynchronously.
    // Mixing a compositor-updated scrollY with a stale viewport rect can move
    // the origin and leave a newly scrolled scene at its previous phase.
    stageTop = 0;
    let ancestor: HTMLElement | null = runway;
    while (ancestor) {
      stageTop += ancestor.offsetTop;
      ancestor = ancestor.offsetParent as HTMLElement | null;
    }
    stageTravel = Math.max(1, runway.offsetHeight - innerHeight);
    screenWidth = screen.clientWidth;
    screenHeight = screen.clientHeight;
    measurePieces();
    schedule();
  }
  function renderNow(){
    if(frame)cancelAnimationFrame(frame);frame=0;
    clearTimeout(reconcileTimer);reconcileTimer=undefined;
    renderScene();
  }
  function schedule(){
    if(!frame)frame=requestAnimationFrame(()=>{frame=0;renderScene();});
    clearTimeout(reconcileTimer);
    reconcileTimer=setTimeout(renderNow,80);
  }
  function renderScene() {
    progress = reduced ? 1 : clamp((scrollY - stageTop) / stageTravel);
    root.dataset.progress = progress.toFixed(4);
    root.style.setProperty("--story-progress", String(progress));
    root.style.setProperty("--power", String(reduced ? 1 : smooth(.14, .31, progress)));
    root.style.setProperty("--boot-opacity", String(reduced ? 0 : 1-smooth(.16,.29,progress)));
    root.style.setProperty("--boot-progress", String(smooth(.025,.21,progress)));
    if(progress<.98 && currentView!=="overview")selectView("overview");
    renderMorphs();
    const ready = progress >= .98 || reduced;
    if(!ready && dashboard.classList.contains("is-interactive")){
      const tableViewport=root.querySelector<HTMLElement>(".machine-table-scroll")!;
      tableViewport.scrollLeft=0;tableViewport.scrollTop=0;
    }
    dashboard.classList.toggle("is-interactive", ready);
    dashboard.inert = !ready;
    dashboard.setAttribute("aria-hidden", String(!ready));
    if (!ready) {
      if (dialog.open) dialog.close();
      for (const key of ["search", "alerts", "profile"]) {
        root.querySelector<HTMLElement>(`[data-${key}-panel]`)!.hidden = true;
        root.querySelector(`[data-${key}-toggle]`)!.setAttribute("aria-expanded", "false");
      }
    }
    if (!ready && expanded) setExpanded(false);
    const phase = progress < .02 ? 0 : progress < .27 ? 1 : progress < .98 ? 2 : 3;
    root.querySelector("[data-scene-name]")!.textContent = sceneNames[phase]!;
    root.querySelector("[data-scroll-instruction]")!.textContent = reduced ? "已减少动态效果 · 可直接操作" : ready ? "界面已就绪 · 向上滚动回放总览" : phase < 2 ? "向下滚动，开启界面" : "继续滚动，让组件归位";
    const skipButton = root.querySelector<HTMLButtonElement>(".console-scroll-guide [data-skip-intro]")!;
    skipButton.textContent = ready ? "重播演示" : "跳过动画";
    skipButton.dataset.sceneReady = String(ready);
  }
  function resetDemonstration(){
    periods.cnc="day";periods.print="day";query="";kindFilter="all";
    root.querySelector<HTMLInputElement>("[data-machine-search]")!.value="";
    dashboard.classList.remove("is-comfortable");
    root.querySelector<HTMLInputElement>("[data-comfortable]")!.checked=false;
    root.querySelectorAll<HTMLElement>("[data-kind-filter]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.kindFilter==="all")));
    updateChart("cnc");updateChart("print");selectView("overview");measure();
  }
  function skipIntro() {
    if (reduced) { root.querySelector<HTMLButtonElement>("[data-console-view=overview]")?.focus({preventScroll:true}); return; }
    window.scrollTo({ top: stageTop + stageTravel * .995, behavior: "auto" });
    renderNow();
    root.querySelector<HTMLButtonElement>("[data-console-view=overview]")?.focus({preventScroll:true});
  }
  root.querySelectorAll<HTMLElement>("[data-skip-intro], .console-skip-link").forEach(button => button.addEventListener("click", event => {
    event.preventDefault();
    closeSiteMenu();
    if (button.closest(".console-scroll-guide") && button.dataset.sceneReady === "true" && !reduced) {
      resetDemonstration();
      window.scrollTo({top:stageTop,behavior:"auto"}); renderNow();
    } else skipIntro();
  }));
  window.addEventListener("scroll", schedule, {passive:true});
  document.addEventListener("scroll", schedule, {passive:true});
  window.addEventListener("resize", measure, {passive:true});
  new ResizeObserver(measure).observe(screen);
  const setReduced = (value: boolean) => {
    reduced = value || reduceMedia.matches; root.classList.toggle("is-reduced", reduced); html.classList.toggle("rem-motion", !reduced);
    root.querySelector<HTMLInputElement>("[data-reduce-motion]")!.checked = reduced;
    root.querySelector<HTMLInputElement>("[data-reduce-motion]")!.disabled = reduceMedia.matches;
    measure(); renderNow();
  };
  reduceMedia.addEventListener("change", () => setReduced(reduceMedia.matches));
  root.querySelector<HTMLInputElement>("[data-reduce-motion]")!.addEventListener("change", e => setReduced((e.target as HTMLInputElement).checked));
  root.querySelector<HTMLInputElement>("[data-comfortable]")!.addEventListener("change", e => { dashboard.classList.toggle("is-comfortable", (e.target as HTMLInputElement).checked); measure(); renderNow(); });

  const compact = (value:number) => value >= 1_000_000 ? `${(value/1_000_000).toFixed(value>=100_000_000?1:2)}M` : formatNumber(value);
  const historySvg = (record:MachinePeriod, name:string, cssClass="") => {
    let x=0;
    return `<svg class="${cssClass}" viewBox="0 0 ${record.durationMinutes} 12" preserveAspectRatio="none" role="img" aria-label="${name} ${record.periodLabel} 状态时长分布"><title>${record.summary}</title>${record.timeline.map(segment=>{const start=x;x+=segment.minutes;return `<rect x="${start}" y="0" width="${segment.minutes}" height="12" class="history-${segment.status}"><title>${stateLabels[segment.status]}: ${formatDuration(segment.minutes)} · ${segment.percentage.toFixed(1)}%</title></rect>`;}).join("")}</svg>`;
  };
  function updateChart(kind:MachineKind) {
    const panel=root!.querySelector<HTMLElement>(`[data-production-chart=${kind}]`)!;
    const summary=getKindSummary(kind,periods[kind]);
    panel.dataset.period=periods[kind]; panel.dataset.total=String(summary.output);
    panel.querySelector("[data-chart-total]")!.textContent=compact(summary.output);
    panel.querySelector("[data-chart-total]")!.setAttribute("title",formatNumber(summary.output));
    panel.querySelector("[data-chart-inspect]")!.textContent=periods[kind]==="day"?"Hourly output":`${summary.periodLabel} · ${summary.shiftCount} demo shifts`;
    panel.querySelector("[data-chart-inspect]")!.setAttribute("title",summary.summary);
    const rawMax=Math.max(...summary.buckets);
    const step=periods[kind]==="day"?(kind==="cnc"?50:20000):Math.pow(10,Math.floor(Math.log10(rawMax)))/2;
    const max=Math.ceil(rawMax/step)*step;
    const points=summary.buckets.map((v,i)=>[28+i*444/(summary.buckets.length-1),54-v/max*46]);
    chartPoints.set(panel,points);
    panel.querySelector("[data-chart-line]")!.setAttribute("d",points.map((p,i)=>`${i?"L":"M"}${p[0]},${p[1]}`).join(" "));
    panel.querySelector("[data-chart-area]")!.setAttribute("d",`M28,54 ${points.map(p=>`L${p[0]},${p[1]}`).join(" ")} L472,54 Z`);
    panel.querySelector("[data-chart-points]")!.innerHTML=points.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3.6"/>`).join("");
    const axis=(v:number)=>v>=1_000_000?`${v/1_000_000}M`:v>=1000?`${v/1000}K`:String(v);
    panel.querySelector("[data-y-max]")!.textContent=axis(max);panel.querySelector("[data-y-mid]")!.textContent=axis(max/2);
    panel.querySelector("[data-chart-labels]")!.innerHTML=summary.labels.map((label,i)=>`<text x="${28+i*444/(summary.labels.length-1)}" y="74" text-anchor="middle">${label}</text>`).join("");
    panel.querySelector("[data-chart-cursor]")!.setAttribute("visibility","hidden");
    panel.querySelectorAll<HTMLButtonElement>("[data-chart-period]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.chartPeriod===periods[kind])));
    panel.querySelector("[data-chart-svg]")!.setAttribute("aria-label",`${kind.toUpperCase()} ${summary.periodLabel}: ${formatNumber(summary.output)} ${summary.unit}. 方向键查看各时段。`);
  }
  function updateRows() {
    dashboard.classList.toggle("has-long-period",periods.cnc!=="day"||periods.print!=="day");
    for(const machine of machines){
      const row=root!.querySelector<HTMLElement>(`[data-machine-row="${machine.id}"]`)!;
      const record=getMachinePeriod(machine,periods[machine.kind]);
      row.dataset.status=machine.status;row.dataset.period=record.period;row.dataset.output=String(record.output);row.dataset.duration=String(record.durationMinutes);
      const cell=(name:string)=>row.querySelector<HTMLElement>(`[data-cell=${name}]`)!;
      cell("output").textContent=`${compact(record.output)} ${machine.unit}`;cell("output").title=`${formatNumber(record.output)} ${machine.unit} · ${record.rangeLabel}`;
      cell("target").textContent=`${compact(record.target)} ${machine.unit}`;cell("target").title=`${formatNumber(record.target)} ${machine.unit}`;
      cell("run").textContent=formatDuration(record.runMinutes);cell("stop").textContent=formatDuration(record.stopMinutes);
      cell("run").title=`Running ${formatDuration(record.runMinutes)}`;cell("stop").title=`Stopped ${formatDuration(record.stopMinutes)}`;
      cell("fm").textContent=`${formatNumber(record.faultMinutes)} / ${formatNumber(record.maintenanceMinutes)}`;
      cell("fm").title=`Fault ${formatDuration(record.faultMinutes)} / Maintenance ${formatDuration(record.maintenanceMinutes)}`;
      cell("history").innerHTML=historySvg(record,machine.name);
      const matchQuery=`${machine.name} ${machine.order} ${machine.program??""}`.toLowerCase().includes(query);
      const matchKind=kindFilter==="all"||machine.kind===kindFilter;
      const matchView=currentView!=="activity"||machine.status!=="running";
      row.hidden=!(matchQuery&&matchKind&&matchView);
    }
    const visibleRows=[...root!.querySelectorAll<HTMLElement>("[data-machine-row]")].filter(r=>!r.hidden).length;
    for(const group of root!.querySelectorAll<HTMLElement>(".machine-row-group"))group.hidden=[...group.querySelectorAll<HTMLElement>("[data-machine-row]")].every(r=>r.hidden);
    dashboard.classList.toggle("is-filtered",visibleRows!==12);
    root!.querySelector<HTMLElement>("[data-table-empty]")!.hidden=visibleRows>0;
    root!.querySelector("[data-result-count]")!.textContent=visibleRows===12?"":`${visibleRows} shown`;
    root!.querySelector("[data-history-heading]")!.textContent=periods.cnc==="day"&&periods.print==="day"?"Shift mix (past 8 hours)":"Selected period mix";
    root!.querySelector("[data-history-note]")!.textContent=periods.cnc==="day"&&periods.print==="day"?"History 08:00–16:00":`CNC ${periods.cnc} / Print ${periods.print} · Synthetic periods`;
    root!.querySelector("[data-period-label]")!.textContent=periods.cnc==="day"&&periods.print==="day"?"Shift 08:00 – 16:00":"Selected demo periods";
    // Filters, longer totals, and alternate views must replay their current DOM geometry.
    measurePieces();renderMorphs();
  }
  root.querySelectorAll<HTMLButtonElement>("[data-chart-period]").forEach(button=>button.addEventListener("click",()=>{
    const kind=button.dataset.chartKind as MachineKind;periods[kind]=button.dataset.chartPeriod as Period;updateChart(kind);updateRows();renderChartTraces();
  }));
  for(const kind of ["cnc","print"] as const){
    const panel=root.querySelector<HTMLElement>(`[data-production-chart=${kind}]`)!;
    const svg=panel.querySelector<SVGElement>("[data-chart-svg]")!;let selected=0;
    const inspect=(index:number)=>{const summary=getKindSummary(kind,periods[kind]);selected=Math.max(0,Math.min(summary.buckets.length-1,index));const x=28+selected*444/(summary.buckets.length-1);const cursor=panel.querySelector("[data-chart-cursor]")!;cursor.setAttribute("x1",String(x));cursor.setAttribute("x2",String(x));cursor.setAttribute("visibility","visible");panel.querySelector("[data-chart-inspect]")!.textContent=`${summary.labels[selected]} · ${formatNumber(summary.buckets[selected]!)} ${summary.unit}`;};
    svg.addEventListener("pointermove",e=>{const rect=svg.getBoundingClientRect();const scale=Math.min(rect.width/500,rect.height/80);const left=(rect.width-500*scale)/2;const x=(e.clientX-rect.left-left)/scale;const count=getKindSummary(kind,periods[kind]).buckets.length;inspect(Math.round(clamp((x-28)/444)*(count-1)));},{passive:true});
    svg.addEventListener("pointerleave",()=>{panel.querySelector("[data-chart-cursor]")!.setAttribute("visibility","hidden");const summary=getKindSummary(kind,periods[kind]);panel.querySelector("[data-chart-inspect]")!.textContent=periods[kind]==="day"?"Hourly output":`${summary.periodLabel} · ${summary.shiftCount} demo shifts`;},{passive:true});
    svg.addEventListener("keydown",e=>{if(e.key==="ArrowRight"||e.key==="ArrowLeft"){e.preventDefault();inspect(selected+(e.key==="ArrowRight"?1:-1));}});
  }

  function selectView(view:string){
    currentView=view;dashboard.dataset.view=view;
    root!.querySelectorAll<HTMLButtonElement>("[data-console-view]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.consoleView===view)));
    const titles:Record<string,string>={overview:"Production overview",machines:"Machine inventory",jobs:"Work orders",activity:"Attention snapshot",settings:"Workspace settings"};
    root!.querySelector("[data-console-title]")!.textContent=titles[view]??titles.overview!;
    root!.querySelector<HTMLElement>("[data-production-charts]")!.hidden=view!=="overview";
    root!.querySelector<HTMLElement>("[data-machine-table-panel]")!.hidden=view==="settings";
    root!.querySelector<HTMLElement>("[data-console-settings]")!.hidden=view!=="settings";
    root!.querySelector<HTMLElement>("[data-machine-view-toolbar]")!.hidden=view==="overview"||view==="settings";
    root!.querySelector("[data-view-description]")!.textContent=view==="jobs"?"12 demo work orders · completion by machine":view==="activity"?"Snapshot 16:00 · stopped, fault and maintenance":"Machine inventory · current snapshot";
    updateRows();measure();schedule();
  }
  root.querySelector(".console-brand")!.addEventListener("click",event=>{event.preventDefault();selectView("overview");});
  root.querySelectorAll<HTMLButtonElement>("[data-console-view]").forEach(b=>b.addEventListener("click",()=>selectView(b.dataset.consoleView!)));
  root.querySelectorAll<HTMLButtonElement>("[data-kind-filter]").forEach(b=>b.addEventListener("click",()=>{kindFilter=b.dataset.kindFilter!;root.querySelectorAll("[data-kind-filter]").forEach(el=>el.setAttribute("aria-pressed",String(el===b)));updateRows();}));
  const searchPanel=root.querySelector<HTMLElement>("[data-search-panel]")!,searchInput=root.querySelector<HTMLInputElement>("[data-machine-search]")!;
  const searchToggle=root.querySelector<HTMLButtonElement>("[data-search-toggle]")!;
  searchToggle.addEventListener("click",()=>{searchPanel.hidden=!searchPanel.hidden;searchToggle.setAttribute("aria-expanded",String(!searchPanel.hidden));if(!searchPanel.hidden)searchInput.focus({preventScroll:true});});
  root.querySelector("[data-search-close]")!.addEventListener("click",()=>{searchPanel.hidden=true;query="";searchInput.value="";searchToggle.setAttribute("aria-expanded","false");updateRows();searchToggle.focus({preventScroll:true});});
  searchInput.addEventListener("input",()=>{query=searchInput.value.trim().toLowerCase();updateRows();});
  const closePopovers=()=>{for(const key of ["alerts","profile"]){root.querySelector<HTMLElement>(`[data-${key}-panel]`)!.hidden=true;root.querySelector(`[data-${key}-toggle]`)!.setAttribute("aria-expanded","false");}};
  for(const key of ["alerts","profile"]){root.querySelector(`[data-${key}-toggle]`)!.addEventListener("click",()=>{const panel=root.querySelector<HTMLElement>(`[data-${key}-panel]`)!;const next=panel.hidden;closePopovers();panel.hidden=!next;root.querySelector(`[data-${key}-toggle]`)!.setAttribute("aria-expanded",String(next));});}
  function setExpanded(value:boolean){expanded=value;stage.classList.toggle("is-expanded",value);const button=root!.querySelector<HTMLButtonElement>("[data-expand-console]")!;button.setAttribute("aria-pressed",String(value));button.setAttribute("aria-label",value?"退出展开界面":"展开数据界面");measure();}
  root.querySelector("[data-expand-console]")!.addEventListener("click",()=>setExpanded(!expanded));
  function showMachine(machine:Machine){
    closePopovers();const record=getMachinePeriod(machine,periods[machine.kind]);
    root!.querySelector("[data-detail-title]")!.textContent=machine.name;root!.querySelector("[data-detail-kind]")!.textContent=`${machine.kind.toUpperCase()} / ${machine.order}`;
    const extra=machine.kind==="cnc"?`<div><dt>Program</dt><dd>${machine.program}</dd></div><div><dt>Tool / last cycle</dt><dd>${machine.tool} · ${machine.lastCycle}</dd></div>`:`<div><dt>CNC-specific fields</dt><dd>Not applicable</dd></div><div><dt>Current print speed</dt><dd>${formatNumber(machine.speed)} sheets/h</dd></div>`;
    root!.querySelector("[data-detail-content]")!.innerHTML=`<div class="detail-summary"><span>${record.rangeLabel}</span><span class="machine-state state-${machine.status}"><i></i>${stateLabels[machine.status]}</span></div><dl><div><dt>Output</dt><dd>${formatNumber(record.output)} ${machine.unit}</dd></div><div><dt>Target / completion</dt><dd>${formatNumber(record.target)} · ${record.jobPercent}%</dd></div><div><dt>Running / stopped</dt><dd>${formatDuration(record.runMinutes)} / ${formatDuration(record.stopMinutes)}</dd></div><div><dt>Fault / maintenance</dt><dd>${formatDuration(record.faultMinutes)} / ${formatDuration(record.maintenanceMinutes)}</dd></div>${extra}</dl><p class="detail-history-label">Time composition · ${record.summary}</p>${historySvg(record,machine.name,"detail-timeline")}<div class="detail-history-key">${record.timeline.map(s=>`<span><i class="state-dot state-${s.status}"></i>${stateLabels[s.status]} ${(s.percentage).toFixed(1)}%</span>`).join("")}</div>`;
    if(!dialog.open)dialog.showModal();
  }
  root.addEventListener("click",event=>{
    const target=event.target as Element;
    const open=target.closest<HTMLElement>("[data-machine-open]");
    const row=target.closest<HTMLElement>("[data-machine-row]");
    const id=open?.dataset.machineOpen??row?.dataset.machineRow;
    if(id){const machine=machines.find(m=>m.id===id);if(machine)showMachine(machine);}
    if(!target.closest("[data-alerts-panel], [data-alerts-toggle], [data-profile-panel], [data-profile-toggle]"))closePopovers();
  });
  root.querySelectorAll("[data-detail-close]").forEach(b=>b.addEventListener("click",()=>dialog.close()));
  dialog.addEventListener("click",event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  const siteMenu=root.querySelector<HTMLElement>("[data-site-menu]")!,siteMenuToggle=root.querySelector<HTMLButtonElement>("[data-site-menu-toggle]")!;
  function closeSiteMenu(){siteMenu.hidden=true;siteMenuToggle.setAttribute("aria-expanded","false");}
  siteMenuToggle.addEventListener("click",()=>{siteMenu.hidden=!siteMenu.hidden;siteMenuToggle.setAttribute("aria-expanded",String(!siteMenu.hidden));});
  document.addEventListener("keydown",event=>{if(event.key!=="Escape"||dialog.open)return;closePopovers();closeSiteMenu();if(expanded)setExpanded(false);});
  document.addEventListener("pointerdown",event=>{if(!(event.target as Element).closest(".rem-site-header"))closeSiteMenu();},{passive:true});
  setReduced(reduced);
  updateChart("cnc");updateChart("print");updateRows();
  measure();renderNow();
  root.dataset.ready="true";
}
