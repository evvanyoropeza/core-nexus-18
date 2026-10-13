import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/docs/reports")({
  head: () => ({ meta: [{ title: "Reportes · Manual" }] }),
  component: () => (
    <>
      <h1>Reportes</h1>
      <p>
        El centro de reportes reúne consultas listas para revisar, exportar o imprimir.
      </p>

      <h2>Tipos de reporte</h2>
      <ul>
        <li><strong>Clientes</strong>: cartera, actividad y estatus.</li>
        <li><strong>Productos</strong>: catálogo por categoría y precios.</li>
        <li><strong>Inventario</strong>: existencias y movimientos del kardex.</li>
        <li><strong>Cotizaciones</strong>: emitidas por estado y periodo.</li>
        <li><strong>Ventas</strong>: órdenes e ingresos por periodo.</li>
      </ul>

      <h2>Filtros</h2>
      <p>
        Filtra por rango de fechas, estado o categoría. Los totales se recalculan con cada filtro.
      </p>

      <h2>Exportar e imprimir</h2>
      <ul>
        <li><strong>Exportar CSV</strong>: abre el resultado en Excel u otra hoja de cálculo.</li>
        <li><strong>Imprimir</strong>: formato optimizado; elige "Guardar como PDF" para un archivo.</li>
      </ul>
    </>
  ),
});
