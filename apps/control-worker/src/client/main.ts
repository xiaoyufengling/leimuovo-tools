import { countAttentionStatuses, type ServerStatusSnapshot, type StatusCheck } from "@leimuovo/control-core";
import {
  ArrowRight,
  Check,
  CircleHelp,
  Cloud,
  Cpu,
  createIcons,
  Database,
  Eye,
  EyeOff,
  Gamepad2,
  GitCommitHorizontal,
  Globe2,
  HardDrive,
  Lock,
  LockKeyhole,
  LogOut,
  MemoryStick,
  Minus,
  Monitor,
  Moon,
  PanelTop,
  Radio,
  RefreshCw,
  Server,
  ServerCrash,
  ShieldCheck,
  Sun,
  TriangleAlert,
  Wifi,
  X,
} from "lucide";
import "./control.css";

interface SessionResponse {
  authenticated: boolean;
  accessEmail: string;
  expiresAt?: string;
}

interface LoginResponse extends SessionResponse {}

interface LogoutResponse {
  authenticated: false;
  logoutUrl: string;
}

interface ErrorResponse {
  error?: { code?: string; message?: string };
}

class ApiFailure extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const icons = {
  ArrowRight,
  Check,
  CircleHelp,
  Cloud,
  Cpu,
  Database,
  Eye,
  EyeOff,
  Gamepad2,
  GitCommitHorizontal,
  Globe2,
  HardDrive,
  Lock,
  LockKeyhole,
  LogOut,
  MemoryStick,
  Minus,
  Monitor,
  Moon,
  PanelTop,
  Radio,
  RefreshCw,
  Server,
  ServerCrash,
  ShieldCheck,
  Sun,
  TriangleAlert,
  Wifi,
  X,
};

const app = required<HTMLElement>("[data-control-app]");
const loadingView = required<HTMLElement>("[data-loading-view]");
const loginView = required<HTMLElement>("[data-login-view]");
const dashboardView = required<HTMLElement>("[data-dashboard-view]");
const dashboardActions = required<HTMLElement>("[data-dashboard-actions]");
const loginForm = required<HTMLFormElement>("[data-login-form]");
const loginError = required<HTMLElement>("[data-login-error]");
const loginButton = required<HTMLButtonElement>("[data-login-submit]");
const refreshButton = required<HTMLButtonElement>("[data-refresh]");
const statusNotice = required<HTMLElement>("[data-status-notice]");
const summary = required<HTMLElement>("[data-summary]");
const lastRefresh = required<HTMLElement>("[data-last-refresh]");
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

let currentRefresh: AbortController | null = null;
let lastServerSnapshot: ServerStatusSnapshot | null = null;
let lastNetworkChecks: StatusCheck[] = [];
let refreshTimer: number | null = null;

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing control UI element: ${selector}`);
  return element;
}

function renderIcons(): void {
  createIcons({ icons, attrs: { "stroke-width": 1.75 } });
}

function resolvedTheme(): "light" | "dark" {
  const selected = document.documentElement.dataset.theme;
  if (selected === "light" || selected === "dark") return selected;
  return systemDark.matches ? "dark" : "light";
}

function syncThemeButton(): void {
  const next = resolvedTheme() === "dark" ? "浅色" : "深色";
  for (const button of document.querySelectorAll<HTMLElement>("[data-theme-toggle]")) {
    button.setAttribute("aria-label", `切换为${next}外观`);
    button.setAttribute("title", `切换为${next}外观`);
  }
}

function setView(view: "loading" | "login" | "dashboard"): void {
  app.dataset.view = view;
  loadingView.hidden = view !== "loading";
  loginView.hidden = view !== "login";
  dashboardView.hidden = view !== "dashboard";
  dashboardActions.hidden = view !== "dashboard";
}

async function api<T>(pathname: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(pathname, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json", ...init.headers },
  });
  const value = await response.json().catch(() => ({})) as T & ErrorResponse;
  if (!response.ok) throw new ApiFailure(response.status, value.error?.message ?? "请求失败，请稍后重试");
  return value;
}

function formatCheckedAt(value: string | null): string {
  if (!value) return "尚未检测";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

const statePresentation: Record<StatusCheck["state"], { label: string; icon: string }> = {
  up: { label: "可用", icon: "check" },
  down: { label: "异常", icon: "x" },
  degraded: { label: "需注意", icon: "triangle-alert" },
  unknown: { label: "未知", icon: "circle-help" },
  not_configured: { label: "未配置", icon: "minus" },
};

function renderStatus(key: string, status: StatusCheck): void {
  const root = document.querySelector<HTMLElement>(`[data-status-card="${key}"]`);
  if (!root) return;
  root.dataset.state = status.state;
  const presentation = statePresentation[status.state];
  const stateLabel = root.querySelector<HTMLElement>("[data-state-label]");
  const message = root.querySelector<HTMLElement>("[data-message]");
  const latency = root.querySelector<HTMLElement>("[data-latency]");
  const checkedAt = root.querySelector<HTMLElement>("[data-checked-at]");
  const icon = root.querySelector<HTMLElement>("[data-status-icon]");
  if (stateLabel) stateLabel.textContent = status.stale ? "已过期" : presentation.label;
  if (message) message.textContent = status.message;
  if (latency) latency.textContent = status.latencyMs === null ? "延迟 --" : `延迟 ${Math.round(status.latencyMs)} ms`;
  if (checkedAt) checkedAt.textContent = formatCheckedAt(status.checkedAt);
  if (icon) icon.outerHTML = `<i data-status-icon data-lucide="${status.stale ? "triangle-alert" : presentation.icon}" aria-hidden="true"></i>`;
}

function stale(status: StatusCheck): StatusCheck {
  return { ...status, stale: true, message: `${status.message}（上次结果）` };
}

function renderServer(snapshot: ServerStatusSnapshot, useStale = false): StatusCheck[] {
  const mapped = (status: StatusCheck) => useStale ? stale(status) : status;
  renderStatus("website-site", mapped(snapshot.website.site));
  renderStatus("website-https", mapped(snapshot.website.https));
  renderStatus("website-cloudflare", mapped(snapshot.website.cloudflare));
  renderStatus("vps", snapshot.vps);
  for (const device of snapshot.devices) renderStatus(`device-${device.id}`, device.status);
  return [
    mapped(snapshot.website.site),
    mapped(snapshot.website.https),
    mapped(snapshot.website.cloudflare),
    snapshot.vps,
    ...snapshot.devices.map((device) => device.status),
  ];
}

function renderSummary(serverChecks: StatusCheck[], serverUnavailable = false): void {
  const attention = countAttentionStatuses([...lastNetworkChecks, ...serverChecks]);
  summary.dataset.tone = attention > 0 || serverUnavailable ? "attention" : "normal";
  if (serverUnavailable && serverChecks.length === 0) summary.textContent = "部分状态暂时无法获取";
  else summary.textContent = attention === 0 ? "当前状态平稳" : `有 ${attention} 项需要注意`;
}

async function probeNetwork(label: "IPv4" | "IPv6", endpoint: string, parentSignal: AbortSignal): Promise<StatusCheck> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  parentSignal.addEventListener("abort", abort, { once: true });
  const timeout = window.setTimeout(() => controller.abort(), 4_000);
  const startedAt = performance.now();
  const checkedAt = new Date().toISOString();

  try {
    const response = await fetch(endpoint, {
      cache: "no-store",
      credentials: "omit",
      mode: "cors",
      signal: controller.signal,
    });
    void response.body?.cancel();
    if (!response.ok) throw new Error("probe failed");
    return {
      state: "up",
      checkedAt,
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      stale: false,
      message: `${label} 连接可用`,
    };
  } catch {
    return {
      state: "down",
      checkedAt,
      latencyMs: null,
      stale: false,
      message: navigator.onLine ? `${label} 连接不可用` : "当前设备已离线",
    };
  } finally {
    window.clearTimeout(timeout);
    parentSignal.removeEventListener("abort", abort);
  }
}

async function refreshDashboard(): Promise<void> {
  currentRefresh?.abort();
  const controller = new AbortController();
  currentRefresh = controller;
  refreshButton.disabled = true;
  refreshButton.setAttribute("aria-busy", "true");

  const serverRequest = api<ServerStatusSnapshot>("/api/control/status", { signal: controller.signal })
    .then((value) => ({ ok: true as const, value }))
    .catch((failure: unknown) => ({ ok: false as const, failure }));
  const [serverResult, ipv4, ipv6] = await Promise.all([
    serverRequest,
    probeNetwork("IPv4", "https://api4.ipify.org?format=json", controller.signal),
    probeNetwork("IPv6", "https://api6.ipify.org?format=json", controller.signal),
  ]);

  if (currentRefresh !== controller) return;
  lastNetworkChecks = [ipv4, ipv6];
  renderStatus("ipv4", ipv4);
  renderStatus("ipv6", ipv6);

  let serverChecks: StatusCheck[] = [];
  if (serverResult.ok) {
    lastServerSnapshot = serverResult.value;
    serverChecks = renderServer(serverResult.value);
    statusNotice.hidden = true;
  } else if (serverResult.failure instanceof ApiFailure && serverResult.failure.status === 401) {
    showLogin({ authenticated: false, accessEmail: required<HTMLElement>("[data-access-email]").textContent ?? "" });
    return;
  } else if (lastServerSnapshot) {
    serverChecks = renderServer(lastServerSnapshot, true);
    statusNotice.hidden = false;
  } else {
    statusNotice.hidden = false;
  }

  renderSummary(serverChecks, !serverResult.ok);
  lastRefresh.textContent = `更新于 ${new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date())}`;
  renderIcons();
  refreshButton.disabled = false;
  refreshButton.removeAttribute("aria-busy");
}

function startRefreshTimer(): void {
  if (refreshTimer !== null) window.clearInterval(refreshTimer);
  refreshTimer = window.setInterval(() => {
    if (!document.hidden) void refreshDashboard();
  }, 30_000);
}

function showLogin(session: SessionResponse): void {
  currentRefresh?.abort();
  if (refreshTimer !== null) window.clearInterval(refreshTimer);
  refreshTimer = null;
  required<HTMLElement>("[data-login-email]").textContent = session.accessEmail;
  loginError.hidden = true;
  setView("login");
  required<HTMLInputElement>('input[name="username"]').focus();
}

function showDashboard(session: SessionResponse): void {
  required<HTMLElement>("[data-access-email]").textContent = session.accessEmail;
  setView("dashboard");
  startRefreshTimer();
  void refreshDashboard();
}

async function initialize(): Promise<void> {
  try {
    const session = await api<SessionResponse>("/api/control/session");
    if (session.authenticated) showDashboard(session);
    else showLogin(session);
  } catch (failure) {
    loadingView.innerHTML = `<div class="lm-state" data-state-variant="server-error">
      <span class="lm-state__icon" aria-hidden="true"><i data-lucide="server-crash"></i></span>
      <p class="lm-state__eyebrow">控制中心</p>
      <h1>暂时无法确认访问状态。</h1>
      <p class="lm-state__description" data-loading-error-message></p>
      <div class="lm-state__actions"><button class="lm-button lm-button--primary" type="button" data-retry>重新尝试<i data-lucide="refresh-cw" aria-hidden="true"></i></button></div>
    </div>`;
    const loadingErrorMessage = loadingView.querySelector<HTMLElement>("[data-loading-error-message]");
    if (loadingErrorMessage) {
      loadingErrorMessage.textContent = failure instanceof Error
        ? failure.message
        : "请稍后重试，控制中心不会保存离线状态。";
    }
    renderIcons();
    loadingView.querySelector<HTMLButtonElement>("[data-retry]")?.addEventListener("click", () => window.location.reload());
  }
}

for (const button of document.querySelectorAll<HTMLElement>("[data-theme-toggle]")) {
  button.addEventListener("click", () => {
    const next = resolvedTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { window.localStorage.setItem("leimuovo-theme", next); } catch { /* Session-only fallback. */ }
    syncThemeButton();
  });
}
systemDark.addEventListener?.("change", syncThemeButton);

required<HTMLButtonElement>("[data-password-toggle]").addEventListener("click", (event) => {
  const button = event.currentTarget as HTMLButtonElement;
  const input = required<HTMLInputElement>("[data-password]");
  const revealing = input.type === "password";
  input.type = revealing ? "text" : "password";
  button.setAttribute("aria-label", revealing ? "隐藏密码" : "显示密码");
  button.setAttribute("title", revealing ? "隐藏密码" : "显示密码");
  button.innerHTML = `<i data-lucide="${revealing ? "eye-off" : "eye"}" aria-hidden="true"></i>`;
  renderIcons();
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(loginForm);
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!username || !password) {
    loginError.textContent = "请输入用户名和密码";
    loginError.hidden = false;
    return;
  }

  loginButton.disabled = true;
  loginButton.setAttribute("aria-busy", "true");
  loginButton.innerHTML = '<span>正在验证</span><span class="lm-button__spinner" aria-hidden="true"></span>';
  loginError.hidden = true;
  try {
    const session = await api<LoginResponse>("/api/control/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    loginForm.reset();
    showDashboard(session);
  } catch (failure) {
    loginError.textContent = failure instanceof Error ? failure.message : "登录失败，请稍后重试";
    loginError.hidden = false;
  } finally {
    loginButton.disabled = false;
    loginButton.removeAttribute("aria-busy");
    loginButton.innerHTML = '<span>进入控制中心</span><i data-lucide="arrow-right" aria-hidden="true"></i>';
    renderIcons();
  }
});

refreshButton.addEventListener("click", () => void refreshDashboard());
required<HTMLButtonElement>("[data-logout]").addEventListener("click", async () => {
  try {
    const result = await api<LogoutResponse>("/api/control/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    window.location.assign(result.logoutUrl);
  } catch {
    window.location.assign("/");
  }
});

window.addEventListener("online", () => {
  if (app.dataset.view === "dashboard") void refreshDashboard();
});

renderIcons();
syncThemeButton();
void initialize();
