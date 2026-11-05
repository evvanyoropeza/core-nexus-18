import { describe, it, expect } from "vitest";
import { needsDiscountApproval } from "../quotations";

const base = { discount_pct: 0, approval_status: "not_required", approved_discount_pct: null };
describe("aprobación de descuentos (umbral 15%)", () => {
  it("15% no requiere aprobación", () => expect(needsDiscountApproval({ ...base, discount_pct: 15 }, [])).toBe(false));
  it("más de 15% en una línea requiere aprobación", () => expect(needsDiscountApproval(base, [{ discount_pct: 16 }])).toBe(true));
  it("aprobado al 20% permite 20%", () =>
    expect(needsDiscountApproval({ discount_pct: 20, approval_status: "approved", approved_discount_pct: 20 }, [])).toBe(false));
  it("subir el descuento tras aprobar exige reaprobar", () =>
    expect(needsDiscountApproval({ discount_pct: 25, approval_status: "approved", approved_discount_pct: 20 }, [])).toBe(true));
});
