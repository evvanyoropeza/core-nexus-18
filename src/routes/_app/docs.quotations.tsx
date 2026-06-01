import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/docs/quotations")({
  component: () => (
    <>
      <h1>Cotizaciones</h1>
      <p>
        Las cotizaciones son la base del flujo comercial: desde un borrador interno hasta
        una propuesta enviada al cliente y, eventualmente, una orden de venta.
      </p>

      <h2>Crear una cotización</h2>
      <ol>
        <li>
          Ve a <strong>Cotizaciones → Nueva</strong>.
        </li>
        <li>Selecciona el cliente y captura validez, moneda y notas.</li>
        <li>
          Agrega partidas desde el catálogo de <strong>productos</strong>. Puedes ajustar
          cantidad, descuento y precio por línea.
        </li>
        <li>Guarda como borrador. Los totales se recalculan automáticamente.</li>
      </ol>

      <h2>Estados</h2>
      <ul>
        <li><strong>Borrador</strong>: editable libremente.</li>
        <li><strong>Enviada</strong>: el documento se versiona y queda registrado.</li>
        <li><strong>Aceptada</strong>: lista para convertirse en orden de venta.</li>
        <li><strong>Rechazada / Vencida</strong>: cerrada sin conversión.</li>
      </ul>

      <h2>Acciones disponibles</h2>
      <ul>
        <li>
          <strong>PDF</strong>: genera un PDF profesional con folio, partidas y totales.
        </li>
        <li>
          <strong>Duplicar</strong>: crea una copia editable como nuevo borrador.
        </li>
        <li>
          <strong>Compartir por link</strong>: genera una URL pública (<code>/q/&lt;token&gt;</code>)
          para que el cliente vea la cotización sin necesidad de cuenta. Puedes revocar el
          acceso en cualquier momento.
        </li>
        <li>
          <strong>Historial</strong>: cada vez que cambia de estado o marcas un snapshot
          manual, se guarda una versión inmutable.
        </li>
        <li>
          <strong>Convertir a orden</strong>: cuando el cliente acepta, genera una orden de
          venta con todos los datos copiados.
        </li>
      </ul>
    </>
  ),
});
