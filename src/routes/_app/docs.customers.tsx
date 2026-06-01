import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/docs/customers")({
  component: () => (
    <>
      <h1>Clientes</h1>
      <p>
        El módulo de clientes centraliza la información comercial y fiscal de las empresas o
        personas a las que vendes.
      </p>

      <h2>Dar de alta un cliente</h2>
      <ol>
        <li>
          Ve a <strong>Clientes → Nuevo cliente</strong>.
        </li>
        <li>
          Completa los datos generales (nombre comercial, RFC/Tax ID, contacto).
        </li>
        <li>
          Agrega al menos una <strong>dirección</strong> de facturación o envío.
        </li>
        <li>
          Guarda. El cliente queda disponible para cotizaciones y órdenes.
        </li>
      </ol>

      <h2>Editar o desactivar</h2>
      <p>
        Desde el detalle del cliente puedes editar todos sus datos. Para deshabilitarlo sin
        perder su historial, cambia su estatus a <em>Inactivo</em>; ya no aparecerá en los
        selectores de cotización.
      </p>

      <h2>Buenas prácticas</h2>
      <ul>
        <li>Usa nombres comerciales consistentes para facilitar la búsqueda.</li>
        <li>Captura el RFC correctamente; se imprime en cotizaciones y PDFs.</li>
        <li>Si el cliente tiene varias sucursales, usa direcciones distintas.</li>
      </ul>
    </>
  ),
});
