import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/docs/orders")({
  component: () => (
    <>
      <h1>Órdenes de venta</h1>
      <p>
        Las órdenes representan compromisos firmes de entrega. Se generan a partir de una
        cotización aceptada y se gestionan hasta su cumplimiento.
      </p>

      <h2>Crear una orden</h2>
      <ol>
        <li>Abre una cotización en estado <strong>Aceptada</strong>.</li>
        <li>
          Pulsa <strong>Convertir a orden</strong>. Se copia el cliente, las partidas y los
          totales en una nueva orden con folio único (<code>SO-XXXXX</code>).
        </li>
        <li>La cotización queda enlazada como origen de la orden.</li>
      </ol>

      <h2>Estados</h2>
      <ul>
        <li><strong>Borrador</strong>: editable, sin compromiso.</li>
        <li><strong>Confirmada</strong>: el cliente confirmó la entrega.</li>
        <li><strong>En proceso</strong>: ya se está surtiendo.</li>
        <li><strong>Cumplida</strong>: cantidades surtidas = solicitadas.</li>
        <li><strong>Cancelada</strong>: no se entregará.</li>
      </ul>

      <h2>Cumplimiento por partida</h2>
      <p>
        Cada línea muestra una cantidad <em>solicitada</em> y una <em>surtida</em>. La barra
        de progreso de la orden se calcula con la suma de surtidos sobre solicitados.
        Usa <strong>Surtir todo</strong> para marcar la línea como completa en un clic.
      </p>

      <h2>Buenas prácticas</h2>
      <ul>
        <li>Confirma la orden solo cuando el inventario esté reservado.</li>
        <li>
          Si el cliente cancela, marca la orden como <strong>Cancelada</strong> en lugar de
          borrarla, para preservar la trazabilidad.
        </li>
      </ul>
    </>
  ),
});
