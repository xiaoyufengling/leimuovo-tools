import type { HidCollectionInfo, HidDeviceFilter, HidDeviceLike } from "./hid";

export const EV63_VENDOR_ID = 0x3869;
export const EV63_PRIMARY_PRODUCT_ID = 0x63e1;
export const EV63_RUNTIME_PRODUCT_IDS = [0x63e1, 0x7c18, 0x72f3] as const;
export const EV63_VENDOR_USAGE_PAGE = 0xff60;
export const EV63_VENDOR_USAGE = 0x61;

export const EV63_HID_FILTERS: readonly HidDeviceFilter[] = EV63_RUNTIME_PRODUCT_IDS.map((productId) => ({
  vendorId: EV63_VENDOR_ID,
  productId,
  usagePage: EV63_VENDOR_USAGE_PAGE,
  usage: EV63_VENDOR_USAGE,
}));

export interface Ev63KeyDefinition {
  readonly label: string;
  readonly units?: number;
  readonly accent?: boolean;
}

export const EV63_KEY_ROWS: readonly (readonly Ev63KeyDefinition[])[] = [
  [
    { label: "ESC", accent: true },
    ..."1234567890".split("").map((label) => ({ label })),
    { label: "−" },
    { label: "+" },
    { label: "BACKSPACE", units: 2 },
  ],
  [
    { label: "TAB", units: 1.5 },
    ..."QWERTYUIOP".split("").map((label) => ({ label })),
    { label: "[" },
    { label: "]" },
    { label: "\\", units: 1.5 },
  ],
  [
    { label: "CAPSLOCK", units: 1.75 },
    ..."ASDFGHJKL".split("").map((label) => ({ label })),
    { label: ";" },
    { label: "'" },
    { label: "ENTER", units: 2.25, accent: true },
  ],
  [
    { label: "SHIFT", units: 1.75 },
    ..."ZXCVBNM".split("").map((label) => ({ label })),
    { label: "," },
    { label: "." },
    { label: "/" },
    { label: "SUPER" },
    { label: "△" },
    { label: "DEL" },
  ],
  [
    { label: "CTRL", units: 1.25 },
    { label: "WIN", units: 1.25 },
    { label: "ALT", units: 1.25 },
    { label: "", units: 6.25 },
    { label: "ALT" },
    { label: "FN" },
    { label: "◁" },
    { label: "▽" },
    { label: "▷" },
  ],
] as const;

export const EV63_INTERNAL_LAYERS = [
  "Double-shot PBT keycaps",
  "Magnetic X Pro switches",
  "Aluminum plate",
  "Poron PCB foam",
  "PET switch sheet",
  "Gen-3 Hall sensor PCB",
  "Poron bottom case foam",
  "PET bottom case pad",
  "CNC aluminum case",
] as const;

function hasVendorCollection(collections: readonly HidCollectionInfo[]): boolean {
  return collections.some((collection) => (
    (collection.usagePage === EV63_VENDOR_USAGE_PAGE && collection.usage === EV63_VENDOR_USAGE)
    || hasVendorCollection(collection.children ?? [])
  ));
}

export function isKnownEv63RuntimeDevice(device: Pick<HidDeviceLike, "vendorId" | "productId">): boolean {
  return device.vendorId === EV63_VENDOR_ID
    && EV63_RUNTIME_PRODUCT_IDS.some((productId) => productId === device.productId);
}

export function isEv63Device(device: Pick<HidDeviceLike, "vendorId" | "productId" | "productName" | "collections">): boolean {
  if (device.vendorId !== EV63_VENDOR_ID) return false;
  if (isKnownEv63RuntimeDevice(device)) return true;
  return /EV63/i.test(device.productName) && hasVendorCollection(device.collections);
}

export function countEv63Keys(): number {
  return EV63_KEY_ROWS.reduce((count, row) => count + row.length, 0);
}
