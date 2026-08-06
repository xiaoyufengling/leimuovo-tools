export type StatusState = "up" | "down" | "degraded" | "unknown" | "not_configured";

export interface StatusCheck {
  state: StatusState;
  checkedAt: string | null;
  latencyMs: number | null;
  stale: boolean;
  message: string;
}

export interface WebsiteStatus {
  site: StatusCheck;
  https: StatusCheck;
  cloudflare: StatusCheck;
  latestDeploymentAt: string | null;
}

export type DeviceId = "home-pc" | "moonlight-host" | "nas";

export interface DeviceStatus {
  id: DeviceId;
  name: string;
  status: StatusCheck;
}

export interface VpsStatus extends StatusCheck {
  metrics: {
    cpuPercent: number | null;
    memoryPercent: number | null;
    diskPercent: number | null;
  };
}

export interface ServerStatusSnapshot {
  generatedAt: string;
  website: WebsiteStatus;
  vps: VpsStatus;
  devices: DeviceStatus[];
}

export interface StatusProvider<T> {
  check(signal?: AbortSignal): Promise<T>;
}

export function createNotConfiguredCheck(message = "尚未配置"): StatusCheck {
  return {
    state: "not_configured",
    checkedAt: null,
    latencyMs: null,
    stale: false,
    message,
  };
}

export function createServerStatusSnapshot(
  website: WebsiteStatus,
  generatedAt = new Date().toISOString(),
): ServerStatusSnapshot {
  const vpsStatus = createNotConfiguredCheck("VPS 检测尚未配置");
  return {
    generatedAt,
    website,
    vps: {
      ...vpsStatus,
      metrics: { cpuPercent: null, memoryPercent: null, diskPercent: null },
    },
    devices: [
      { id: "home-pc", name: "家里电脑", status: createNotConfiguredCheck() },
      { id: "moonlight-host", name: "Moonlight 主机", status: createNotConfiguredCheck() },
      { id: "nas", name: "NAS", status: createNotConfiguredCheck() },
    ],
  };
}

export function countAttentionStatuses(statuses: readonly StatusCheck[]): number {
  return statuses.filter((status) => status.stale || status.state === "down" || status.state === "degraded").length;
}
