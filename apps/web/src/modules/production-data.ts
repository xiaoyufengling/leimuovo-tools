/**
 * Deterministic, synthetic workshop data for the approved dashboard concept.
 * No connection to machines, production systems, or a live clock is implied.
 * Longer periods repeat the demo shift over the stated number of working shifts.
 */
export type MachineKind = "cnc" | "print";
export type Period = "day" | "week" | "month" | "year";
export type MachineStatus = "running" | "stopped" | "fault" | "maintenance";

export const stateLabels: Readonly<Record<MachineStatus, string>> = {
  running: "RUNNING",
  stopped: "STOPPED",
  fault: "FAULT",
  maintenance: "MAINTENANCE",
};

export const demoMetadata = {
  isDemo: true,
  label: "DEMO",
  description: "Synthetic production data. No live machine connection.",
  shiftLabel: "Shift 08:00–16:00",
  snapshotLabel: "Demo snapshot 16:00",
} as const;

export interface MachineHistory {
  readonly runMinutes: number;
  readonly stopMinutes: number;
  readonly faultMinutes: number;
  readonly maintenanceMinutes: number;
}

export interface Machine extends MachineHistory {
  readonly id: string;
  readonly name: string;
  readonly kind: MachineKind;
  readonly order: string;
  /** Status and speed belong to the demo snapshot, regardless of chart period. */
  readonly status: MachineStatus;
  readonly speed: number;
  readonly speedUnit: "rpm" | "sheets/h";
  readonly unit: "pcs" | "sheets";
  readonly program: string | null;
  readonly tool: string | null;
  readonly lastCycle: string | null;
  /** Base values describe the single eight-hour demo shift. */
  readonly output: number;
  readonly target: number;
  readonly durationMinutes: number;
  readonly buckets: readonly number[];
}

export interface TimelineSegment {
  readonly status: MachineStatus;
  readonly minutes: number;
  readonly percentage: number;
}

export interface MachinePeriod extends MachineHistory {
  readonly period: Period;
  readonly periodLabel: string;
  readonly rangeLabel: string;
  readonly summary: string;
  readonly isDemo: true;
  readonly shiftCount: number;
  readonly output: number;
  readonly target: number;
  readonly jobPercent: number;
  readonly durationMinutes: number;
  readonly buckets: readonly number[];
  readonly labels: readonly string[];
  /** A composition of recorded durations, not a chronological event log. */
  readonly timeline: readonly TimelineSegment[];
}

export interface KindSummary extends MachineHistory {
  readonly kind: MachineKind;
  readonly period: Period;
  readonly periodLabel: string;
  readonly rangeLabel: string;
  readonly summary: string;
  readonly isDemo: true;
  readonly unit: "pcs" | "sheets";
  readonly machineCount: number;
  readonly shiftCount: number;
  readonly output: number;
  readonly target: number;
  readonly jobPercent: number;
  /** Duration of the selected period for one machine. */
  readonly durationMinutes: number;
  /** Sum of all machines' durations, equal to the sum of the four histories. */
  readonly fleetDurationMinutes: number;
  readonly buckets: readonly number[];
  readonly labels: readonly string[];
}

interface PeriodDefinition {
  readonly label: string;
  readonly rangeLabel: string;
  readonly summary: string;
  readonly shifts: number;
  readonly labels: readonly string[];
  readonly weights: readonly number[];
}

const periods: Readonly<Record<Period, PeriodDefinition>> = {
  day: {
    label: "Day",
    rangeLabel: "08:00–16:00",
    summary: "One illustrative eight-hour shift · Synthetic demo data",
    shifts: 1,
    labels: ["08–09", "09–10", "10–11", "11–12", "12–13", "13–14", "14–15", "15–16"],
    weights: [],
  },
  week: {
    label: "Week",
    rangeLabel: "Demo week · Mon–Fri",
    summary: "5 illustrative eight-hour shifts · Synthetic demo data",
    shifts: 5,
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    weights: [18, 21, 20, 22, 19],
  },
  month: {
    label: "Month",
    rangeLabel: "Demo month · 4 workweeks",
    summary: "20 illustrative eight-hour shifts · Synthetic demo data",
    shifts: 20,
    labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
    weights: [22, 26, 24, 28],
  },
  year: {
    label: "Year",
    rangeLabel: "Demo year · 12 months",
    summary: "240 illustrative eight-hour shifts · Synthetic demo data",
    shifts: 240,
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    weights: [7, 7, 8, 8, 9, 9, 8, 7, 10, 10, 9, 8],
  },
};

/** Largest-remainder allocation preserves exact integer totals after rounding. */
function distribute(total: number, weights: readonly number[]): number[] {
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const exact = weights.map((weight) => (total * weight) / weightTotal);
  const result = exact.map(Math.floor);
  const missing = total - result.reduce((sum, value) => sum + value, 0);
  const priority = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of priority.slice(0, missing)) {
    result[index] = (result[index] ?? 0) + 1;
  }
  return result;
}

type HistoryTuple = readonly [run: number, stop: number, fault: number, maintenance: number];
type MachineSeed = readonly [
  output: number,
  target: number,
  status: MachineStatus,
  speed: number,
  history: HistoryTuple,
];

const cncSeeds: readonly MachineSeed[] = [
  [144, 240, "running", 6800, [336, 72, 24, 48]],
  [120, 200, "stopped", 0, [288, 96, 48, 48]],
  [180, 240, "running", 7200, [360, 48, 24, 48]],
  [96, 160, "running", 4800, [240, 144, 48, 48]],
  [132, 220, "fault", 0, [264, 120, 72, 24]],
  [168, 240, "running", 6000, [336, 96, 24, 24]],
];

const printSeeds: readonly MachineSeed[] = [
  [84000, 120000, "fault", 0, [312, 72, 72, 24]],
  [72000, 120000, "maintenance", 0, [288, 48, 24, 120]],
  [57600, 96000, "running", 12000, [288, 96, 24, 72]],
  [48000, 80000, "stopped", 0, [240, 144, 48, 48]],
  [72000, 96000, "running", 15000, [288, 72, 24, 96]],
  [36000, 60000, "stopped", 0, [192, 144, 48, 96]],
];

const cncTools = ["T06", "T04", "T08", "T02", "T05", "T03"] as const;
const cncCycles = ["02:20", "02:24", "02:00", "02:30", "02:00", "02:00"] as const;

function makeMachines(kind: MachineKind, seeds: readonly MachineSeed[]): Machine[] {
  const baseWeights = kind === "cnc" ? [10, 13, 16, 14, 12, 15, 10, 9] : [9, 11, 15, 18, 15, 12, 8, 6];
  return seeds.map(([output, target, status, speed, history], index) => {
    const name = `${kind === "cnc" ? "CNC" : "PRINT"}-${String(index + 1).padStart(2, "0")}`;
    const weights = baseWeights.map((weight, hour) => weight + ((index + hour) % 3) - 1);
    return Object.freeze({
      id: name.toLowerCase(),
      name,
      kind,
      order: `${kind === "cnc" ? "WO" : "PR"}-${(kind === "cnc" ? 101 : 201) + index}`,
      status,
      speed,
      speedUnit: kind === "cnc" ? "rpm" : "sheets/h",
      unit: kind === "cnc" ? "pcs" : "sheets",
      program: kind === "cnc" ? `O${String(1042 + index).padStart(5, "0")}` : null,
      tool: kind === "cnc" ? (cncTools[index] ?? null) : null,
      lastCycle: kind === "cnc" ? (cncCycles[index] ?? null) : null,
      output,
      target,
      runMinutes: history[0],
      stopMinutes: history[1],
      faultMinutes: history[2],
      maintenanceMinutes: history[3],
      durationMinutes: 480,
      buckets: Object.freeze(distribute(output, weights)),
    });
  });
}

export const machines: readonly Machine[] = Object.freeze([
  ...makeMachines("cnc", cncSeeds),
  ...makeMachines("print", printSeeds),
]);

export function getMachinePeriod(machine: Machine, period: Period = "day"): MachinePeriod {
  const definition = periods[period];
  const output = machine.output * definition.shifts;
  const target = machine.target * definition.shifts;
  const durationMinutes = machine.durationMinutes * definition.shifts;
  const history: MachineHistory = {
    runMinutes: machine.runMinutes * definition.shifts,
    stopMinutes: machine.stopMinutes * definition.shifts,
    faultMinutes: machine.faultMinutes * definition.shifts,
    maintenanceMinutes: machine.maintenanceMinutes * definition.shifts,
  };
  const timeline: TimelineSegment[] = [
    { status: "running", minutes: history.runMinutes, percentage: (history.runMinutes / durationMinutes) * 100 },
    { status: "stopped", minutes: history.stopMinutes, percentage: (history.stopMinutes / durationMinutes) * 100 },
    { status: "fault", minutes: history.faultMinutes, percentage: (history.faultMinutes / durationMinutes) * 100 },
    { status: "maintenance", minutes: history.maintenanceMinutes, percentage: (history.maintenanceMinutes / durationMinutes) * 100 },
  ];
  return {
    ...history,
    period,
    periodLabel: definition.label,
    rangeLabel: definition.rangeLabel,
    summary: definition.summary,
    isDemo: true,
    shiftCount: definition.shifts,
    output,
    target,
    jobPercent: target > 0 ? (output / target) * 100 : 0,
    durationMinutes,
    buckets: period === "day" ? [...machine.buckets] : distribute(output, definition.weights),
    labels: [...definition.labels],
    timeline,
  };
}

export function getKindSummary(kind: MachineKind, period: Period = "day"): KindSummary {
  const definition = periods[period];
  const records = machines.filter((machine) => machine.kind === kind).map((machine) => getMachinePeriod(machine, period));
  const sum = (key: "output" | "target" | keyof MachineHistory) => records.reduce((total, record) => total + record[key], 0);
  const output = sum("output");
  const target = sum("target");
  return {
    kind,
    period,
    periodLabel: definition.label,
    rangeLabel: definition.rangeLabel,
    summary: definition.summary,
    isDemo: true,
    unit: kind === "cnc" ? "pcs" : "sheets",
    machineCount: records.length,
    shiftCount: definition.shifts,
    output,
    target,
    jobPercent: target > 0 ? (output / target) * 100 : 0,
    runMinutes: sum("runMinutes"),
    stopMinutes: sum("stopMinutes"),
    faultMinutes: sum("faultMinutes"),
    maintenanceMinutes: sum("maintenanceMinutes"),
    durationMinutes: 480 * definition.shifts,
    fleetDurationMinutes: records.reduce((total, record) => total + record.durationMinutes, 0),
    buckets: definition.labels.map((_, index) => records.reduce((total, record) => total + (record.buckets[index] ?? 0), 0)),
    labels: [...definition.labels],
  };
}

export function getStatusCounts(selection: MachineKind | readonly Machine[] = machines): Record<MachineStatus | "total", number> {
  const records = typeof selection === "string" ? machines.filter((machine) => machine.kind === selection) : selection;
  const counts = { running: 0, stopped: 0, fault: 0, maintenance: 0, total: records.length };
  for (const machine of records) counts[machine.status] += 1;
  return counts;
}

/** Hours are intentionally unbounded for multi-shift periods. */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return "—";
  const rounded = Math.round(minutes);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export function formatNumber(value: number): string {
  return Number.isFinite(value) ? numberFormatter.format(value) : "—";
}
