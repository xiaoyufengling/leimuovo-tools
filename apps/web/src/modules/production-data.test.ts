import { describe, expect, it } from "vitest";
import {
  demoMetadata,
  formatDuration,
  formatNumber,
  getKindSummary,
  getMachinePeriod,
  getStatusCounts,
  machines,
  stateLabels,
} from "./production-data";
import type { MachineKind, Period } from "./production-data";

const periodNames: readonly Period[] = ["day", "week", "month", "year"];
const kinds: readonly MachineKind[] = ["cnc", "print"];
const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

describe("approved twelve-machine demo dataset", () => {
  it("includes exactly six CNC and six print machines with stable names and orders", () => {
    expect(machines).toHaveLength(12);
    expect(new Set(machines.map((machine) => machine.id)).size).toBe(12);
    expect(machines.filter((machine) => machine.kind === "cnc").map((machine) => machine.order))
      .toEqual(["WO-101", "WO-102", "WO-103", "WO-104", "WO-105", "WO-106"]);
    expect(machines.filter((machine) => machine.kind === "print").map((machine) => machine.order))
      .toEqual(["PR-201", "PR-202", "PR-203", "PR-204", "PR-205", "PR-206"]);
  });

  it("preserves every approved day output, target, speed and state", () => {
    expect(machines.map((machine) => machine.output)).toEqual([144, 120, 180, 96, 132, 168, 84000, 72000, 57600, 48000, 72000, 36000]);
    expect(machines.map((machine) => machine.target)).toEqual([240, 200, 240, 160, 220, 240, 120000, 120000, 96000, 80000, 96000, 60000]);
    expect(machines.map((machine) => machine.speed)).toEqual([6800, 0, 7200, 4800, 0, 6000, 0, 0, 12000, 0, 15000, 0]);
    expect(machines.map((machine) => machine.status)).toEqual([
      "running", "stopped", "running", "running", "fault", "running",
      "fault", "maintenance", "running", "stopped", "running", "stopped",
    ]);
    expect(getKindSummary("cnc", "day").output).toBe(840);
    expect(getKindSummary("print", "day").output).toBe(369600);
    expect(getKindSummary("cnc", "day").target).toBe(1300);
    expect(getKindSummary("print", "day").target).toBe(572000);
  });

  it("preserves all four approved history durations for every machine", () => {
    expect(machines.map((machine) => [machine.runMinutes, machine.stopMinutes, machine.faultMinutes, machine.maintenanceMinutes])).toEqual([
      [336, 72, 24, 48], [288, 96, 48, 48], [360, 48, 24, 48],
      [240, 144, 48, 48], [264, 120, 72, 24], [336, 96, 24, 24],
      [312, 72, 72, 24], [288, 48, 24, 120], [288, 96, 24, 72],
      [240, 144, 48, 48], [288, 72, 24, 96], [192, 144, 48, 96],
    ]);
  });

  it("derives the approved 6 running / 3 stopped / 2 fault / 1 maintenance counts", () => {
    expect(getStatusCounts()).toEqual({ running: 6, stopped: 3, fault: 2, maintenance: 1, total: 12 });
    expect(getStatusCounts("cnc")).toEqual({ running: 4, stopped: 1, fault: 1, maintenance: 0, total: 6 });
    expect(getStatusCounts("print")).toEqual({ running: 2, stopped: 2, fault: 1, maintenance: 1, total: 6 });
    expect(getStatusCounts([])).toEqual({ running: 0, stopped: 0, fault: 0, maintenance: 0, total: 0 });
    expect(Object.values(stateLabels)).toEqual(["RUNNING", "STOPPED", "FAULT", "MAINTENANCE"]);
  });

  it("keeps CNC-only telemetry applicable only to CNC rows", () => {
    const cnc = machines.filter((machine) => machine.kind === "cnc");
    expect(cnc.map((machine) => machine.program)).toEqual(["O01042", "O01043", "O01044", "O01045", "O01046", "O01047"]);
    expect(cnc.map((machine) => machine.tool)).toEqual(["T06", "T04", "T08", "T02", "T05", "T03"]);
    expect(cnc.map((machine) => machine.lastCycle)).toEqual(["02:20", "02:24", "02:00", "02:30", "02:00", "02:00"]);
    for (const machine of machines.filter((row) => row.kind === "print")) {
      expect([machine.program, machine.tool, machine.lastCycle]).toEqual([null, null, null]);
      expect(machine.speedUnit).toBe("sheets/h");
    }
  });

  it("provides eight exact hourly buckets for the 08:00–16:00 day", () => {
    for (const machine of machines) {
      const day = getMachinePeriod(machine, "day");
      expect(day.labels).toEqual(["08–09", "09–10", "10–11", "11–12", "12–13", "13–14", "14–15", "15–16"]);
      expect(day.buckets).toHaveLength(8);
      expect(sum(day.buckets)).toBe(machine.output);
      expect(day.buckets.every((value) => Number.isInteger(value) && value >= 0)).toBe(true);
      expect(day.durationMinutes).toBe(480);
    }
  });
});

describe.each(periodNames)("coherent %s aggregation", (period) => {
  it("makes each row's durations and timeline percentages fill the chosen period", () => {
    for (const machine of machines) {
      const record = getMachinePeriod(machine, period);
      expect(record.durationMinutes).toBe(480 * record.shiftCount);
      expect(record.runMinutes + record.stopMinutes + record.faultMinutes + record.maintenanceMinutes).toBe(record.durationMinutes);
      expect(sum(record.timeline.map((segment) => segment.minutes))).toBe(record.durationMinutes);
      expect(sum(record.timeline.map((segment) => segment.percentage))).toBeCloseTo(100, 12);
      expect(record.timeline.map((segment) => segment.status)).toEqual(["running", "stopped", "fault", "maintenance"]);
      expect(record.output).toBe(machine.output * record.shiftCount);
      expect(record.target).toBe(machine.target * record.shiftCount);
      expect(record.jobPercent).toBeCloseTo((record.output / record.target) * 100);
      expect(sum(record.buckets)).toBe(record.output);
      expect(record.buckets).toHaveLength(record.labels.length);
      expect(record.buckets.every((value) => Number.isInteger(value) && value >= 0)).toBe(true);
    }
  });

  it("derives every chart bucket, total, target and duration from machine records", () => {
    for (const kind of kinds) {
      const summary = getKindSummary(kind, period);
      const records = machines.filter((machine) => machine.kind === kind).map((machine) => getMachinePeriod(machine, period));
      expect(summary.output).toBe(sum(records.map((record) => record.output)));
      expect(summary.target).toBe(sum(records.map((record) => record.target)));
      expect(sum(summary.buckets)).toBe(summary.output);
      expect(summary.buckets).toEqual(summary.labels.map((_, index) => sum(records.map((record) => record.buckets[index] ?? 0))));
      expect(summary.fleetDurationMinutes).toBe(sum(records.map((record) => record.durationMinutes)));
      expect(summary.fleetDurationMinutes).toBe(summary.durationMinutes * 6);
      for (const key of ["runMinutes", "stopMinutes", "faultMinutes", "maintenanceMinutes"] as const) {
        expect(summary[key]).toBe(sum(records.map((record) => record[key])));
      }
      expect(summary.runMinutes + summary.stopMinutes + summary.faultMinutes + summary.maintenanceMinutes).toBe(summary.fleetDurationMinutes);
      expect(summary.isDemo).toBe(true);
      expect(summary.summary).toContain("Synthetic demo data");
      expect(summary.rangeLabel.length).toBeGreaterThan(0);
      expect(summary.period).toBe(period);
    }
  });
});

describe("predictable presentation helpers and independent period selection", () => {
  it("uses distinct, explicitly synthetic working-shift periods", () => {
    expect(periodNames.map((period) => getKindSummary("cnc", period).shiftCount)).toEqual([1, 5, 20, 240]);
    expect(periodNames.map((period) => getKindSummary("cnc", period).buckets.length)).toEqual([8, 5, 4, 12]);
    expect(periodNames.map((period) => getKindSummary("print", period).output)).toEqual([369600, 1848000, 7392000, 88704000]);
    expect(demoMetadata.isDemo).toBe(true);
    expect(demoMetadata.description).toContain("No live machine connection");
  });

  it("does not let one chart's period or returned arrays affect another chart", () => {
    const cncDay = getKindSummary("cnc", "day");
    const printYear = getKindSummary("print", "year");
    getKindSummary("cnc", "month");
    getKindSummary("print", "week");
    expect(getKindSummary("cnc", "day")).toEqual(cncDay);
    expect(getKindSummary("print", "year")).toEqual(printYear);
    (cncDay.buckets as number[])[0] = -1;
    (cncDay.labels as string[])[0] = "changed";
    expect(getKindSummary("cnc", "day").buckets[0]).toBeGreaterThan(0);
    expect(getKindSummary("cnc", "day").labels[0]).toBe("08–09");
    const first = machines[0];
    if (!first) throw new Error("Expected a CNC machine");
    const day = getMachinePeriod(first, "day");
    (day.buckets as number[])[0] = -1;
    expect(getMachinePeriod(first, "day").buckets[0]).toBeGreaterThan(0);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.buckets)).toBe(true);
  });

  it("formats h:mm durations and grouped output with stable English formatting", () => {
    expect(formatDuration(336)).toBe("5:36");
    expect(formatDuration(72)).toBe("1:12");
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(480 * 240)).toBe("1920:00");
    expect(formatDuration(-1)).toBe("—");
    expect(formatDuration(Number.NaN)).toBe("—");
    expect(formatNumber(369600)).toBe("369,600");
    expect(formatNumber(6800)).toBe("6,800");
    expect(formatNumber(65.75)).toBe("65.8");
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe("—");
  });
});
