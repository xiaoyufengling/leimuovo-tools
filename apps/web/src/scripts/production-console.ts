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
    "chart-cnc": {dock:[.27,.44],open:[.48,.68],seed:"h2",side:"left"},
    "chart-print": {dock:[.29,.46],open:[.50,.70],seed:"h2",side:"right"},
    note: {dock:[.81,.89],open:[.90,.95],seed:".note-icon",side:"bottom"},
  };
  const rowElements = [...root.querySelectorAll<HTMLElement>("[data-machine-row]")];
  rowElements.forEach((row,index)=>{
    recipe[row.dataset.assembly!] = {dock:[.37+index*.009,.55+index*.009],open:[.60+index*.008,.81+index*.008],seed:".machine-identity strong",side:index<6?"left":"right"};
  });
  type Bounds = { x:number; y:number; w:number; h:number; seedX:number; seedY:number; seedW:number; seedH:number; children:HTMLElement[] };
  const bounds = new Map<HTMLElement,Bounds>();
  const chartPoints = new Map<HTMLElement,number[][]>();
  const layoutPosition = (element:HTMLElement) => {
    let x=0,y=0,node:HTMLElement|null=element;
    while(node){x+=node.offsetLeft;y+=node.offsetTop;node=node.offsetParent as HTMLElement|null;}
    return {x,y};
  };
  function measurePieces(){
    const origin=layoutPosition(screen);
    for(const piece of pieces){
      if(!piece.offsetWidth)continue;
      const spec=recipe[piece.dataset.assembly!];if(!spec)continue;
      const seed=piece.querySelector<HTMLElement>(spec.seed)!;
      const p=layoutPosition(piece),s=layoutPosition(seed);
      const isRow=piece.hasAttribute("data-machine-row"),isNav=piece.dataset.assembly==="nav";
      const pad=isRow?10:6;
      const seedX=Math.max(0,s.x-p.x-pad),seedY=isRow?0:Math.max(0,s.y-p.y-pad);
      bounds.set(piece,{x:p.x-origin.x,y:p.y-origin.y,w:piece.offsetWidth,h:piece.offsetHeight,
        seedX,seedY,seedW:Math.min(piece.offsetWidth-seedX,(piece.dataset.assembly==="summary"?Math.min(85,seed.offsetWidth):seed.offsetWidth)+pad*2),
        seedH:isRow?piece.offsetHeight:Math.min(piece.offsetHeight-seedY,seed.offsetHeight+pad*2),
        children:isRow?[...piece.children].slice(1) as HTMLElement[]:isNav?[...piece.querySelectorAll<HTMLElement>(".console-nav button")].slice(1):[]});
    }
  }
  function renderMorphs(){
    for(const piece of pieces){
      const spec=recipe[piece.dataset.assembly!],box=bounds.get(piece);if(!spec||!box)continue;
      const dock=smooth(...spec.dock,progress),open=smooth(...spec.open,progress),remain=1-dock;
      const isRow=piece.hasAttribute("data-machine-row");
      piece.dataset.morphDock=dock.toFixed(4);piece.dataset.morphOpen=open.toFixed(4);
      const sx=box.seedX*(1-open),sy=box.seedY*(1-open);
      const right=(box.w-box.seedX-box.seedW)*(1-open),bottom=(box.h-box.seedY-box.seedH)*(1-open);
      piece.style.setProperty("--piece-clip",open>=1?"none":`inset(${sy}px ${Math.max(0,right)}px ${Math.max(0,bottom)}px ${sx}px round ${isRow?11*(1-open):6*(1-open)}px)`);
      let x=0,y=0;
      if(spec.side==="left")x=-(box.x+box.seedX+box.seedW+24);
      if(spec.side==="right")x=screenWidth-box.x-box.seedX+24;
      if(spec.side==="top")y=-(box.y+box.seedY+box.seedH+24);
      if(spec.side==="bottom")y=screenHeight-box.y-box.seedY+24;
      if(isRow)y=16*(spec.side==="left"?-1:1);
      piece.style.setProperty("--piece-opacity",String(smooth(spec.dock[0],spec.dock[0]+.025,progress)));
      piece.style.setProperty("--piece-shadow",String(.10*(1-open)));
      piece.style.setProperty("--piece-transform",`translate3d(${x*remain}px,${y*remain}px,0) rotate(${(spec.side==="left"?-2:2)*remain}deg)`);
      piece.style.setProperty("--morph-open",String(open));
      piece.style.setProperty("--morph-detail",String(smooth(.08,.50,open)));
      if(isRow){
        for(const [index,cell] of box.children.entries()){
          const local=smooth(.06+index*.052,.24+index*.06,open);
          cell.style.setProperty("--cell-reveal",String(local));
        }
      }else if(piece.dataset.assembly==="nav"){
        box.children.forEach((button,index)=>button.style.setProperty("--nav-reveal",String(smooth(.13+index*.13,.34+index*.16,open))));
      }
    }
    const header=root.querySelector<HTMLElement>("[data-table-head]")!;
    header.style.setProperty("--table-head-open",String(smooth(.63,.87,progress)));
    [...header.children].forEach((cell,index)=>(cell as HTMLElement).style.setProperty("--heading-reveal",String(smooth(.60+index*.012,.70+index*.013,progress))));
    root.style.setProperty("--table-frame",String(smooth(.89,.95,progress)));
    root.style.setProperty("--secondary-reveal",String(smooth(.70,.94,progress)));
    renderChartTraces();
  }
  function renderChartTraces(){
    for(const panel of root.querySelectorAll<HTMLElement>("[data-production-chart]")){
      const shift=panel.dataset.productionChart==="cnc"?0:.025;
      // A linear x-domain reveal, not path-length timing: both curves grow
      // rightward at the same reading speed even across steep segments.
      const draw=clamp((progress-.56-shift)/.34);
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
  function schedule() { if (!frame) frame = requestAnimationFrame(renderScene); }
  function renderScene() {
    frame = 0;
    progress = reduced ? 1 : clamp((scrollY - stageTop) / stageTravel);
    root.dataset.progress = progress.toFixed(4);
    root.style.setProperty("--story-progress", String(progress));
    root.style.setProperty("--power", String(reduced ? 1 : smooth(.14, .31, progress)));
    root.style.setProperty("--boot-opacity", String(reduced ? 0 : 1-smooth(.16,.29,progress)));
    root.style.setProperty("--boot-progress", String(smooth(.025,.21,progress)));
    renderMorphs();
    const ready = progress >= .95 || reduced;
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
    const phase = progress < .02 ? 0 : progress < .27 ? 1 : progress < .95 ? 2 : 3;
    root.querySelector("[data-scene-name]")!.textContent = sceneNames[phase]!;
    root.querySelector("[data-scroll-instruction]")!.textContent = reduced ? "已减少动态效果 · 可直接操作" : ready ? "界面已就绪 · 向上滚动可回放" : phase < 2 ? "向下滚动，开启界面" : "继续滚动，让组件归位";
    const skipButton = root.querySelector<HTMLButtonElement>(".console-scroll-guide [data-skip-intro]")!;
    skipButton.textContent = ready ? "回到开头" : "跳过动画";
    skipButton.dataset.sceneReady = String(ready);
  }
  function skipIntro() {
    if (reduced) { root.querySelector<HTMLButtonElement>("[data-console-view=overview]")?.focus({preventScroll:true}); return; }
    window.scrollTo({ top: stageTop + stageTravel * .98, behavior: "auto" });
    renderScene();
    root.querySelector<HTMLButtonElement>("[data-console-view=overview]")?.focus({preventScroll:true});
  }
  root.querySelectorAll<HTMLElement>("[data-skip-intro], .console-skip-link").forEach(button => button.addEventListener("click", event => {
    event.preventDefault();
    closeSiteMenu();
    if (button.closest(".console-scroll-guide") && button.dataset.sceneReady === "true" && !reduced) {
      window.scrollTo({top:stageTop,behavior:"auto"}); renderScene();
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
    measure(); renderScene();
  };
  reduceMedia.addEventListener("change", () => setReduced(reduceMedia.matches));
  root.querySelector<HTMLInputElement>("[data-reduce-motion]")!.addEventListener("change", e => setReduced((e.target as HTMLInputElement).checked));
  root.querySelector<HTMLInputElement>("[data-comfortable]")!.addEventListener("change", e => dashboard.classList.toggle("is-comfortable", (e.target as HTMLInputElement).checked));

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
    for(const machine of machines){
      const row=root!.querySelector<HTMLElement>(`[data-machine-row="${machine.id}"]`)!;
      const record=getMachinePeriod(machine,periods[machine.kind]);
      row.dataset.status=machine.status;row.dataset.period=record.period;row.dataset.output=String(record.output);row.dataset.duration=String(record.durationMinutes);
      const cell=(name:string)=>row.querySelector<HTMLElement>(`[data-cell=${name}]`)!;
      cell("output").textContent=`${compact(record.output)} ${machine.unit}`;cell("output").title=`${formatNumber(record.output)} ${machine.unit} · ${record.rangeLabel}`;
      cell("target").textContent=`${compact(record.target)} ${machine.unit}`;cell("target").title=`${formatNumber(record.target)} ${machine.unit}`;
      cell("run").textContent=formatDuration(record.runMinutes);cell("stop").textContent=formatDuration(record.stopMinutes);
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
  root.dataset.ready="true";
  setReduced(reduced);
  updateChart("cnc");updateChart("print");updateRows();
  measure();renderScene();
}
