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
  const recipe: Record<string, readonly [number, number, number, number, number, number, number, number]> = {
    nav: [.20,.49,-.57,.06,0,-48,-8,.58],
    header: [.23,.52,.05,-.74,52,0,3,.72],
    summary: [.29,.57,.24,-.54,34,-14,4,.68],
    "chart-cnc": [.30,.65,-.44,-.25,32,24,-9,.56],
    "chart-print": [.33,.68,.43,-.22,32,-24,9,.56],
    "table-head": [.39,.72,.04,.63,-30,0,-2,.70],
    "rows-0": [.43,.76,-.36,.69,-38,18,-6,.70],
    "rows-1": [.47,.79,.34,.77,-34,-18,5,.72],
    "rows-2": [.51,.82,-.29,.85,-30,14,-4,.74],
    "rows-3": [.55,.85,.25,.94,-26,-14,4,.76],
    note: [.61,.88,0,.97,-15,0,0,.82],
  };

  function measure() {
    stageTop = runway.getBoundingClientRect().top + scrollY;
    stageTravel = Math.max(1, runway.offsetHeight - innerHeight);
    screenWidth = screen.clientWidth;
    screenHeight = screen.clientHeight;
    schedule();
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(renderScene); }
  function renderScene() {
    frame = 0;
    progress = reduced ? 1 : clamp((scrollY - stageTop) / stageTravel);
    root.dataset.progress = progress.toFixed(4);
    root.style.setProperty("--story-progress", String(progress));
    root.style.setProperty("--power", String(reduced ? 1 : smooth(.14, .31, progress)));
    root.style.setProperty("--boot-opacity", String(reduced ? 0 : smooth(.015,.065,progress)*(1-smooth(.19,.30,progress))));
    root.style.setProperty("--boot-progress", String(smooth(.025,.21,progress)));
    for (const piece of pieces) {
      const spec = recipe[piece.dataset.assembly ?? ""];
      if (!spec) continue;
      const [start,end,x,y,rx,ry,rz,scale] = spec;
      const local = reduced ? 1 : clamp((progress-start)/(end-start));
      const eased = 1 - Math.pow(1-local,3);
      const remaining = 1-eased;
      piece.style.setProperty("--piece-opacity", String(smooth(0,.18,local)));
      piece.style.setProperty("--piece-shadow", String(.16*remaining));
      piece.style.setProperty("--piece-transform", `perspective(1100px) translate3d(${x*screenWidth*remaining}px,${y*screenHeight*remaining}px,${-90*remaining}px) rotateX(${rx*remaining}deg) rotateY(${ry*remaining}deg) rotateZ(${rz*remaining}deg) scale(${scale+(1-scale)*eased})`);
    }
    const ready = progress >= .885 || reduced;
    dashboard.classList.toggle("is-interactive", ready);
    dashboard.inert = !ready;
    dashboard.setAttribute("aria-hidden", String(!ready));
    if (!ready && dialog.open) dialog.close();
    if (!ready && expanded) setExpanded(false);
    const phase = progress < .02 ? 0 : progress < .27 ? 1 : progress < .885 ? 2 : 3;
    root.querySelector("[data-scene-name]")!.textContent = sceneNames[phase]!;
    root.querySelector("[data-scroll-instruction]")!.textContent = reduced ? "已减少动态效果 · 可直接操作" : ready ? "界面已就绪 · 向上滚动可回放" : phase < 2 ? "向下滚动，开启界面" : "继续滚动，让组件归位";
    const skipButton = root.querySelector<HTMLButtonElement>(".console-scroll-guide [data-skip-intro]")!;
    skipButton.textContent = ready ? "回到开头" : "跳过动画";
    skipButton.dataset.sceneReady = String(ready);
  }
  function skipIntro() {
    if (reduced) { root.querySelector<HTMLButtonElement>("[data-console-view=overview]")?.focus(); return; }
    window.scrollTo({ top: stageTop + stageTravel * .96, behavior: "auto" });
    renderScene();
  }
  root.querySelectorAll<HTMLElement>("[data-skip-intro], .console-skip-link").forEach(button => button.addEventListener("click", event => {
    event.preventDefault();
    closeSiteMenu();
    if (button.closest(".console-scroll-guide") && button.dataset.sceneReady === "true" && !reduced) {
      window.scrollTo({top:stageTop,behavior:"auto"}); renderScene();
    } else skipIntro();
  }));
  window.addEventListener("scroll", schedule, {passive:true});
  window.addEventListener("resize", measure, {passive:true});
  new ResizeObserver(measure).observe(screen);
  const setReduced = (value: boolean) => {
    reduced = value; root.classList.toggle("is-reduced", reduced); html.classList.toggle("rem-motion", !reduced);
    root.querySelector<HTMLInputElement>("[data-reduce-motion]")!.checked = reduced;
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
    const points=summary.buckets.map((v,i)=>[28+i*444/(summary.buckets.length-1),74-v/max*60]);
    panel.querySelector("[data-chart-line]")!.setAttribute("d",points.map((p,i)=>`${i?"L":"M"}${p[0]},${p[1]}`).join(" "));
    panel.querySelector("[data-chart-area]")!.setAttribute("d",`M28,74 ${points.map(p=>`L${p[0]},${p[1]}`).join(" ")} L472,74 Z`);
    panel.querySelector("[data-chart-points]")!.innerHTML=points.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3.6"/>`).join("");
    const axis=(v:number)=>v>=1_000_000?`${v/1_000_000}M`:v>=1000?`${v/1000}K`:String(v);
    panel.querySelector("[data-y-max]")!.textContent=axis(max);panel.querySelector("[data-y-mid]")!.textContent=axis(max/2);
    panel.querySelector("[data-chart-labels]")!.innerHTML=summary.labels.map((label,i)=>`<text x="${28+i*444/(summary.labels.length-1)}" y="94" text-anchor="middle">${label}</text>`).join("");
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
    const kind=button.dataset.chartKind as MachineKind;periods[kind]=button.dataset.chartPeriod as Period;updateChart(kind);updateRows();
  }));
  for(const kind of ["cnc","print"] as const){
    const panel=root.querySelector<HTMLElement>(`[data-production-chart=${kind}]`)!;
    const svg=panel.querySelector<SVGElement>("[data-chart-svg]")!;let selected=0;
    const inspect=(index:number)=>{const summary=getKindSummary(kind,periods[kind]);selected=Math.max(0,Math.min(summary.buckets.length-1,index));const x=28+selected*444/(summary.buckets.length-1);const cursor=panel.querySelector("[data-chart-cursor]")!;cursor.setAttribute("x1",String(x));cursor.setAttribute("x2",String(x));cursor.setAttribute("visibility","visible");panel.querySelector("[data-chart-inspect]")!.textContent=`${summary.labels[selected]} · ${formatNumber(summary.buckets[selected]!)} ${summary.unit}`;};
    svg.addEventListener("pointermove",e=>{const rect=svg.getBoundingClientRect();const count=getKindSummary(kind,periods[kind]).buckets.length;inspect(Math.round(clamp(((e.clientX-rect.left)/rect.width*500-28)/444)*(count-1)));},{passive:true});
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
    updateRows();schedule();
  }
  root.querySelectorAll<HTMLButtonElement>("[data-console-view]").forEach(b=>b.addEventListener("click",()=>selectView(b.dataset.consoleView!)));
  root.querySelectorAll<HTMLButtonElement>("[data-kind-filter]").forEach(b=>b.addEventListener("click",()=>{kindFilter=b.dataset.kindFilter!;root.querySelectorAll("[data-kind-filter]").forEach(el=>el.setAttribute("aria-pressed",String(el===b)));updateRows();}));
  const searchPanel=root.querySelector<HTMLElement>("[data-search-panel]")!,searchInput=root.querySelector<HTMLInputElement>("[data-machine-search]")!;
  const searchToggle=root.querySelector<HTMLButtonElement>("[data-search-toggle]")!;
  searchToggle.addEventListener("click",()=>{searchPanel.hidden=!searchPanel.hidden;searchToggle.setAttribute("aria-expanded",String(!searchPanel.hidden));if(!searchPanel.hidden)searchInput.focus();});
  root.querySelector("[data-search-close]")!.addEventListener("click",()=>{searchPanel.hidden=true;query="";searchInput.value="";searchToggle.setAttribute("aria-expanded","false");updateRows();searchToggle.focus();});
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
  document.addEventListener("keydown",event=>{if(event.key!=="Escape")return;closePopovers();closeSiteMenu();if(expanded)setExpanded(false);});
  document.addEventListener("pointerdown",event=>{if(!(event.target as Element).closest(".rem-site-header"))closeSiteMenu();},{passive:true});
  root.dataset.ready="true";
  setReduced(reduced);
  updateChart("cnc");updateChart("print");updateRows();
  measure();renderScene();
}
