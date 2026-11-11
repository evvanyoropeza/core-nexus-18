import { describe, expect, it } from "vitest";
import { getStockAlert } from "../stock-alerts";

const product = { type: "product", is_active: true, stock_current: 4, stock_min: 10 };

describe("alertas de stock mínimo", () => {
  it("avisa cuando baja del nivel de seguridad", () => {
    expect(getStockAlert(product)).toEqual({ status: "below_minimum", current: 4, minimum: 10, replenishment: 6 });
  });
  it("marca el punto de reorden al alcanzar el mínimo", () => {
    expect(getStockAlert({ ...product, stock_current: 10 })?.status).toBe("at_minimum");
  });
  it("retira el aviso al reponer por encima del mínimo", () => {
    expect(getStockAlert({ ...product, stock_current: 11 })).toBeNull();
  });
  it("no activa avisos sin mínimo configurado", () => {
    expect(getStockAlert({ ...product, stock_current: 0, stock_min: 0 })).toBeNull();
  });
  it("excluye servicios", () => {
    expect(getStockAlert({ ...product, type: "service" })).toBeNull();
  });
  it("excluye productos inactivos", () => {
    expect(getStockAlert({ ...product, is_active: false })).toBeNull();
  });
  it("calcula reposición fraccionaria sin residuos decimales", () => {
    expect(getStockAlert({ ...product, stock_current: 0.1, stock_min: 0.3 })?.replenishment).toBe(0.2);
  });
});