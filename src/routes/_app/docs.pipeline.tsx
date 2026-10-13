import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/docs/pipeline")({
  head: () => ({ meta: [{ title: "Pipeline comercial · Manual" }] }),
  component: () => (
    <>
      <h1>Pipeline comercial</h1>
      <p>
        El pipeline muestra tus cotizaciones en un tablero Kanban, una columna por etapa, para
        visualizar el avance comercial de un vistazo.
      </p>

      <h2>Etapas</h2>
      <ul>
        <li><strong>Borrador</strong>: propuestas en preparación.</li>
        <li><strong>Enviada</strong>: compartidas con el cliente.</li>
        <li><strong>Aceptada</strong>: listas para convertirse en orden.</li>
        <li><strong>Rechazada</strong>: cerradas sin venta.</li>
      </ul>

      <h2>Mover cotizaciones</h2>
      <p>
        Arrastra una tarjeta a otra columna para cambiar su estado. El cambio queda registrado
        en el historial de la cotización.
      </p>

      <h2>Totales por etapa</h2>
      <p>
        Cada columna muestra el número de cotizaciones y el importe acumulado, útil para
        estimar ventas futuras.
      </p>
    </>
  ),
});
