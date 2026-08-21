import { describe, expect, it } from "vitest";
import {
  EV63_HID_FILTERS,
  EV63_INTERNAL_LAYERS,
  EV63_PRIMARY_PRODUCT_ID,
  EV63_VENDOR_ID,
  countEv63Keys,
  isEv63Device,
} from "./ev63";

describe("EV63 hardware identity", () => {
  it("keeps the official runtime interface as the primary WebHID filter", () => {
    expect(EV63_HID_FILTERS[0]).toMatchObject({
      vendorId: EV63_VENDOR_ID,
      productId: EV63_PRIMARY_PRODUCT_ID,
      usagePage: 0xff60,
      usage: 0x61,
    });
  });

  it("accepts the confirmed runtime identity and rejects unrelated devices", () => {
    const base = { productName: "IQUNIX EV63", collections: [] };
    expect(isEv63Device({ ...base, vendorId: 0x3869, productId: 0x63e1 })).toBe(true);
    expect(isEv63Device({ ...base, vendorId: 0x1234, productId: 0x63e1 })).toBe(false);
  });
});

describe("EV63 visual model evidence", () => {
  it("contains the verified 64-key ANSI layout", () => {
    expect(countEv63Keys()).toBe(64);
  });

  it("keeps every official exploded-view layer in the visual model", () => {
    expect(EV63_INTERNAL_LAYERS).toHaveLength(9);
    expect(EV63_INTERNAL_LAYERS).toContain("Gen-3 Hall sensor PCB");
    expect(EV63_INTERNAL_LAYERS).toContain("CNC aluminum case");
  });
});
