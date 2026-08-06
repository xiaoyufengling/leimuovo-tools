import { describe, expect, it } from "vitest";
import {
  countAttentionStatuses,
  createServerStatusSnapshot,
  type StatusCheck,
  type WebsiteStatus,
} from "../src/index";

const checkedAt = "2026-08-06T08:30:00.000Z";

function check(state: StatusCheck["state"], stale = false): StatusCheck {
  return { state, checkedAt, latencyMs: 42, stale, message: "测试状态" };
}

describe("control status model", () => {
  it("builds a stable placeholder shape for unconfigured infrastructure", () => {
    const website: WebsiteStatus = {
      site: check("up"),
      https: check("up"),
      cloudflare: check("up"),
      latestDeploymentAt: null,
    };

    const snapshot = createServerStatusSnapshot(website, checkedAt);

    expect(snapshot.generatedAt).toBe(checkedAt);
    expect(snapshot.vps).toMatchObject({
      state: "not_configured",
      latencyMs: null,
      metrics: { cpuPercent: null, memoryPercent: null, diskPercent: null },
    });
    expect(snapshot.devices.map(({ id, name, status }) => ({ id, name, state: status.state }))).toEqual([
      { id: "home-pc", name: "家里电脑", state: "not_configured" },
      { id: "moonlight-host", name: "Moonlight 主机", state: "not_configured" },
      { id: "nas", name: "NAS", state: "not_configured" },
    ]);
  });

  it("counts only actionable or stale status results", () => {
    expect(countAttentionStatuses([
      check("up"),
      check("not_configured"),
      check("unknown"),
      check("degraded"),
      check("down"),
      check("up", true),
    ])).toBe(3);
  });
});
