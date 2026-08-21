import { Ev63DeviceManager, type DeviceSnapshot, type DeviceState, type HidLogEntry } from "../device/deviceManager";
import { formatHex, summarizeCollections, type NavigatorWithHid } from "../device/hid";
import { createEv63Scene, type Ev63ScenePhase } from "./scene";

const STATE_COPY: Record<DeviceState, { readonly eyebrow: string; readonly title: string; readonly detail: string }> = {
  unsupported: {
    eyebrow: "WEBHID UNAVAILABLE",
    title: "需要 Chromium 浏览器",
    detail: "真实设备连接仅支持具备 WebHID 的安全上下文。演示序列仍可运行。",
  },
  "permission-required": {
    eyebrow: "DEVICE / NOT AUTHORIZED",
    title: "等待 EV63",
    detail: "点击连接后，在浏览器设备选择窗口中授权 IQUNIX EV63。",
  },
  waiting: {
    eyebrow: "DEVICE / SCANNING",
    title: "正在检查设备",
    detail: "正在查询已授权的 HID 设备。",
  },
  connecting: {
    eyebrow: "HID / HANDSHAKE",
    title: "正在建立连接",
    detail: "验证设备身份并尝试打开 Vendor-defined HID 接口。",
  },
  connected: {
    eyebrow: "IQUNIX EV63 / ONLINE",
    title: "设备已接入",
    detail: "真实 HID 状态正在驱动当前空间序列。",
  },
  disconnected: {
    eyebrow: "DEVICE / DISCONNECTED",
    title: "EV63 已断开",
    detail: "插回设备时，浏览器会通过 connect 事件重新进入序列。",
  },
  error: {
    eyebrow: "HID / ERROR",
    title: "连接没有完成",
    detail: "打开 HID 日志查看浏览器返回的原始错误。",
  },
};

const PHASE_COPY: Record<Ev63ScenePhase, string> = {
  waiting: "WAITING FOR DEVICE",
  handshake: "NEGOTIATING HID INTERFACE",
  materialize: "MATERIALIZING EV63",
  inspect: "OPTICAL STRUCTURE SCAN",
  explode: "EXPLODED ARCHITECTURE",
  ready: "DEVICE SYNCHRONIZED",
  offline: "SIGNAL LOST",
};

function requiredElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing EV63 lab element: ${selector}`);
  return element;
}

function stringifyDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  try {
    return JSON.stringify(detail, null, 2);
  } catch {
    return String(detail);
  }
}

export function mountEv63Lab(root: HTMLElement): () => void {
  const canvas = requiredElement<HTMLCanvasElement>(root, "[data-ev63-canvas]");
  const eyebrow = requiredElement<HTMLElement>(root, "[data-device-eyebrow]");
  const title = requiredElement<HTMLElement>(root, "[data-device-title]");
  const detail = requiredElement<HTMLElement>(root, "[data-device-detail]");
  const phaseLabel = requiredElement<HTMLElement>(root, "[data-phase-label]");
  const connectButton = requiredElement<HTMLButtonElement>(root, "[data-connect-device]");
  const demoButton = requiredElement<HTMLButtonElement>(root, "[data-run-demo]");
  const assembledButton = requiredElement<HTMLButtonElement>(root, "[data-view-assembled]");
  const explodedButton = requiredElement<HTMLButtonElement>(root, "[data-view-exploded]");
  const logButton = requiredElement<HTMLButtonElement>(root, "[data-log-toggle]");
  const logPanel = requiredElement<HTMLElement>(root, "[data-log-panel]");
  const logList = requiredElement<HTMLElement>(root, "[data-log-list]");
  const logClose = requiredElement<HTMLButtonElement>(root, "[data-log-close]");
  const vendorValue = requiredElement<HTMLElement>(root, "[data-vendor-id]");
  const productValue = requiredElement<HTMLElement>(root, "[data-product-id]");
  const interfaceValue = requiredElement<HTMLElement>(root, "[data-interface]");
  const collectionsValue = requiredElement<HTMLElement>(root, "[data-collections]");
  const webglFallback = requiredElement<HTMLElement>(root, "[data-webgl-fallback]");

  let disposed = false;
  let logEntries: readonly HidLogEntry[] = [];

  let scene: ReturnType<typeof createEv63Scene> | null = null;
  try {
    scene = createEv63Scene(canvas, {
      onPhaseChange(phase) {
        root.dataset.phase = phase;
        phaseLabel.textContent = PHASE_COPY[phase];
        const layersActive = phase === "explode";
        assembledButton.setAttribute("aria-pressed", String(!layersActive));
        explodedButton.setAttribute("aria-pressed", String(layersActive));
      },
    });
  } catch (error) {
    webglFallback.hidden = false;
    canvas.hidden = true;
    console.error("EV63 WebGL scene failed to initialize", error);
  }

  const manager = new Ev63DeviceManager(navigator as NavigatorWithHid);

  const setDeviceInfo = (snapshot: DeviceSnapshot) => {
    const device = snapshot.device;
    vendorValue.textContent = device ? formatHex(device.vendorId) : "0x3869";
    productValue.textContent = device ? formatHex(device.productId) : "0x63E1";
    interfaceValue.textContent = device?.opened ? "OPEN / READ-ONLY" : "VENDOR HID / EXPECTED";
    collectionsValue.textContent = device ? stringifyDetail(summarizeCollections(device.collections)) : "等待实机授权后读取 collections";
  };

  const renderState = (snapshot: DeviceSnapshot, source: "hardware" | "demo" = "hardware") => {
    const hardwareState = source === "demo" ? manager.snapshot.state : snapshot.state;
    const copy = source === "demo"
      ? { eyebrow: "DEMO / SIMULATED SIGNAL", title: "EV63 演示序列", detail: "这是视觉演示，不代表浏览器已连接实体设备。" }
      : STATE_COPY[snapshot.state];
    root.dataset.deviceState = source === "demo" ? "demo" : snapshot.state;
    root.dataset.source = source;
    eyebrow.textContent = copy.eyebrow;
    title.textContent = copy.title;
    detail.textContent = snapshot.error ?? copy.detail;
    connectButton.disabled = hardwareState === "connecting" || hardwareState === "unsupported" || hardwareState === "connected";
    connectButton.textContent = hardwareState === "connected" ? "EV63 CONNECTED" : hardwareState === "connecting" ? "CONNECTING…" : "CONNECT EV63";
    demoButton.textContent = source === "demo" ? "REPLAY SEQUENCE" : "RUN DEMO";
    const sceneInteractive = source === "demo" || snapshot.state === "connected";
    assembledButton.disabled = !sceneInteractive;
    explodedButton.disabled = !sceneInteractive;
    setDeviceInfo(snapshot);
  };

  const renderLogs = () => {
    const fragment = document.createDocumentFragment();
    logEntries.forEach((entry) => {
      const item = document.createElement("li");
      item.dataset.level = entry.level;
      const header = document.createElement("div");
      const time = document.createElement("time");
      time.textContent = entry.time;
      const level = document.createElement("span");
      level.textContent = entry.level.toUpperCase();
      header.append(time, level);
      const message = document.createElement("p");
      message.textContent = entry.message;
      item.append(header, message);
      if (entry.detail !== undefined) {
        const pre = document.createElement("pre");
        pre.textContent = stringifyDetail(entry.detail);
        item.append(pre);
      }
      fragment.append(item);
    });
    logList.replaceChildren(fragment);
    logList.scrollTop = logList.scrollHeight;
  };

  const handleStateChange = (event: Event) => {
    const snapshot = (event as CustomEvent<DeviceSnapshot>).detail;
    renderState(snapshot);
    if (snapshot.state === "connected") scene?.setState("connected");
    else if (snapshot.state === "connecting") scene?.setState("connecting");
    else if (snapshot.state === "disconnected" || snapshot.state === "error") scene?.setState("disconnected");
    else scene?.setState("idle");
  };

  const handleLog = (event: Event) => {
    const entry = (event as CustomEvent<HidLogEntry>).detail;
    logEntries = [...logEntries.slice(-79), entry];
    renderLogs();
  };

  const handleInputReport = () => {
    scene?.pulseInput();
  };

  const handleConnectClick = () => {
    void manager.requestDevice();
  };

  const handleDemoClick = () => {
    renderState(manager.snapshot, "demo");
    scene?.setState("connected");
  };

  const setLogOpen = (open: boolean) => {
    logPanel.hidden = !open;
    logButton.setAttribute("aria-expanded", String(open));
    root.dataset.logOpen = String(open);
  };

  const handleLogToggle = () => setLogOpen(Boolean(logPanel.hidden));
  const handleLogClose = () => setLogOpen(false);
  const handleAssembled = () => {
    scene?.setExploded(false);
    assembledButton.setAttribute("aria-pressed", "true");
    explodedButton.setAttribute("aria-pressed", "false");
  };
  const handleExploded = () => {
    scene?.setExploded(true);
    assembledButton.setAttribute("aria-pressed", "false");
    explodedButton.setAttribute("aria-pressed", "true");
  };

  manager.addEventListener("statechange", handleStateChange);
  manager.addEventListener("log", handleLog);
  manager.addEventListener("inputreport", handleInputReport);
  connectButton.addEventListener("click", handleConnectClick);
  demoButton.addEventListener("click", handleDemoClick);
  assembledButton.addEventListener("click", handleAssembled);
  explodedButton.addEventListener("click", handleExploded);
  logButton.addEventListener("click", handleLogToggle);
  logClose.addEventListener("click", handleLogClose);

  renderState(manager.snapshot);
  void manager.initialize();

  return () => {
    if (disposed) return;
    disposed = true;
    manager.dispose();
    scene?.dispose();
    manager.removeEventListener("statechange", handleStateChange);
    manager.removeEventListener("log", handleLog);
    manager.removeEventListener("inputreport", handleInputReport);
    connectButton.removeEventListener("click", handleConnectClick);
    demoButton.removeEventListener("click", handleDemoClick);
    assembledButton.removeEventListener("click", handleAssembled);
    explodedButton.removeEventListener("click", handleExploded);
    logButton.removeEventListener("click", handleLogToggle);
    logClose.removeEventListener("click", handleLogClose);
  };
}
