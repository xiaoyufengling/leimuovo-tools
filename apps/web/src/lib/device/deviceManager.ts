import {
  copyReportBytes,
  formatHex,
  getHidAccess,
  reportBytesToHex,
  summarizeCollections,
  type HidAccess,
  type HidConnectionEventLike,
  type HidDeviceLike,
  type HidInputReportEventLike,
  type NavigatorWithHid,
} from "./hid";
import { EV63_HID_FILTERS, isEv63Device } from "./ev63";

export type DeviceState =
  | "unsupported"
  | "permission-required"
  | "waiting"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export interface DeviceSnapshot {
  readonly state: DeviceState;
  readonly device: HidDeviceLike | null;
  readonly error: string | null;
}

export interface HidLogEntry {
  readonly time: string;
  readonly level: "info" | "data" | "error";
  readonly message: string;
  readonly detail?: unknown;
}

export class Ev63DeviceManager extends EventTarget {
  private readonly hid: HidAccess | null;
  private activeDevice: HidDeviceLike | null = null;
  private currentState: DeviceState;
  private currentError: string | null = null;

  constructor(navigatorLike: NavigatorWithHid) {
    super();
    this.hid = getHidAccess(navigatorLike);
    this.currentState = this.hid ? "waiting" : "unsupported";
  }

  get snapshot(): DeviceSnapshot {
    return {
      state: this.currentState,
      device: this.activeDevice,
      error: this.currentError,
    };
  }

  async initialize(): Promise<void> {
    if (!this.hid) {
      this.setState("unsupported");
      this.writeLog("error", "WebHID is unavailable in this browser.");
      return;
    }

    this.hid.addEventListener("connect", this.handleConnect);
    this.hid.addEventListener("disconnect", this.handleDisconnect);

    try {
      const devices = await this.hid.getDevices();
      this.writeLog("info", `navigator.hid.getDevices() returned ${devices.length} authorized device(s).`, devices.map((device) => ({
        productName: device.productName,
        vendorId: formatHex(device.vendorId),
        productId: formatHex(device.productId),
      })));
      const ev63 = devices.find(isEv63Device);
      if (ev63) {
        await this.attachDevice(ev63, "Previously authorized EV63 found.");
      } else {
        this.setState("permission-required");
      }
    } catch (error) {
      this.fail("Unable to enumerate authorized HID devices.", error);
    }
  }

  async requestDevice(): Promise<void> {
    if (!this.hid) {
      this.setState("unsupported");
      return;
    }

    this.setState("connecting");
    this.writeLog("info", "Opening the browser HID device picker for EV63 runtime interfaces.");

    try {
      const devices = await this.hid.requestDevice({ filters: EV63_HID_FILTERS });
      const ev63 = devices.find(isEv63Device);
      if (!ev63) {
        this.setState("permission-required");
        this.writeLog("info", "No EV63 was selected. No permission was changed.");
        return;
      }
      await this.attachDevice(ev63, "EV63 selected in the browser picker.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotFoundError") {
        this.setState("permission-required");
        this.writeLog("info", "The device picker was closed without selecting an EV63.");
        return;
      }
      this.fail("Unable to request EV63 access.", error);
    }
  }

  dispose(): void {
    this.hid?.removeEventListener("connect", this.handleConnect);
    this.hid?.removeEventListener("disconnect", this.handleDisconnect);
    const device = this.activeDevice;
    device?.removeEventListener("inputreport", this.handleInputReport);
    this.activeDevice = null;
    if (device?.opened) void device.close().catch(() => undefined);
  }

  private readonly handleConnect = (event: Event): void => {
    const device = (event as HidConnectionEventLike).device;
    this.writeLog("info", `HID connect: ${device.productName || "Unnamed device"} (${formatHex(device.vendorId)} / ${formatHex(device.productId)}).`);
    if (isEv63Device(device)) void this.attachDevice(device, "EV63 connect event received.");
  };

  private readonly handleDisconnect = (event: Event): void => {
    const device = (event as HidConnectionEventLike).device;
    this.writeLog("info", `HID disconnect: ${device.productName || "Unnamed device"} (${formatHex(device.vendorId)} / ${formatHex(device.productId)}).`);
    if (this.activeDevice === device) {
      this.activeDevice?.removeEventListener("inputreport", this.handleInputReport);
      this.activeDevice = null;
      this.setState("disconnected");
    }
  };

  private readonly handleInputReport = (event: Event): void => {
    const report = event as HidInputReportEventLike;
    const bytes = copyReportBytes(report.data);
    this.writeLog("data", `Input report ${formatHex(report.reportId, 2)} · ${bytes.byteLength} byte(s)`, reportBytesToHex(bytes));
    this.dispatchEvent(new CustomEvent("inputreport", { detail: { reportId: report.reportId, bytes } }));
  };

  private async attachDevice(device: HidDeviceLike, reason: string): Promise<void> {
    this.activeDevice?.removeEventListener("inputreport", this.handleInputReport);
    this.activeDevice = device;
    this.setState("connecting");
    this.writeLog("info", reason, {
      productName: device.productName,
      vendorId: formatHex(device.vendorId),
      productId: formatHex(device.productId),
      opened: device.opened,
      collections: summarizeCollections(device.collections),
    });

    try {
      if (!device.opened) await device.open();
      device.addEventListener("inputreport", this.handleInputReport);
      this.writeLog("info", "device.open() succeeded. Listening for raw input reports.");
      this.setState("connected");
    } catch (error) {
      this.fail("EV63 was detected but device.open() failed.", error);
    }
  }

  private setState(state: DeviceState, error: string | null = null): void {
    this.currentState = state;
    this.currentError = error;
    this.dispatchEvent(new CustomEvent<DeviceSnapshot>("statechange", { detail: this.snapshot }));
  }

  private writeLog(level: HidLogEntry["level"], message: string, detail?: unknown): void {
    const entry: HidLogEntry = {
      time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
      level,
      message,
      ...(detail === undefined ? {} : { detail }),
    };
    this.dispatchEvent(new CustomEvent<HidLogEntry>("log", { detail: entry }));
  }

  private fail(message: string, error: unknown): void {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    this.writeLog("error", message, detail);
    this.setState("error", `${message} ${detail}`);
  }
}
