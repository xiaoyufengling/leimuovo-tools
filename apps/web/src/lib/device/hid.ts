export interface HidDeviceFilter {
  readonly vendorId?: number;
  readonly productId?: number;
  readonly usagePage?: number;
  readonly usage?: number;
}

export interface HidReportInfo {
  readonly reportId: number;
  readonly items?: readonly unknown[];
}

export interface HidCollectionInfo {
  readonly usagePage: number;
  readonly usage: number;
  readonly type?: number;
  readonly children?: readonly HidCollectionInfo[];
  readonly inputReports?: readonly HidReportInfo[];
  readonly outputReports?: readonly HidReportInfo[];
  readonly featureReports?: readonly HidReportInfo[];
}

export interface HidDeviceLike extends EventTarget {
  readonly opened: boolean;
  readonly productName: string;
  readonly vendorId: number;
  readonly productId: number;
  readonly collections: readonly HidCollectionInfo[];
  open(): Promise<void>;
  close(): Promise<void>;
}

export interface HidAccess extends EventTarget {
  getDevices(): Promise<readonly HidDeviceLike[]>;
  requestDevice(options: { readonly filters: readonly HidDeviceFilter[] }): Promise<readonly HidDeviceLike[]>;
}

export interface HidConnectionEventLike extends Event {
  readonly device: HidDeviceLike;
}

export interface HidInputReportEventLike extends Event {
  readonly device: HidDeviceLike;
  readonly reportId: number;
  readonly data: DataView;
}

export interface HidCollectionSummary {
  readonly usagePage: string;
  readonly usage: string;
  readonly type: number | null;
  readonly inputReports: readonly number[];
  readonly outputReports: readonly number[];
  readonly featureReports: readonly number[];
  readonly children: readonly HidCollectionSummary[];
}

export type NavigatorWithHid = Navigator & { readonly hid?: HidAccess };

export function getHidAccess(navigatorLike: NavigatorWithHid): HidAccess | null {
  return navigatorLike.hid ?? null;
}

export function formatHex(value: number, width = 4): string {
  return `0x${value.toString(16).toUpperCase().padStart(width, "0")}`;
}

export function copyReportBytes(view: DataView): Uint8Array {
  return new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
}

export function reportBytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join(" ");
}

export function summarizeCollections(collections: readonly HidCollectionInfo[]): readonly HidCollectionSummary[] {
  return collections.map((collection) => ({
    usagePage: formatHex(collection.usagePage),
    usage: formatHex(collection.usage),
    type: collection.type ?? null,
    inputReports: collection.inputReports?.map((report) => report.reportId) ?? [],
    outputReports: collection.outputReports?.map((report) => report.reportId) ?? [],
    featureReports: collection.featureReports?.map((report) => report.reportId) ?? [],
    children: summarizeCollections(collection.children ?? []),
  }));
}
