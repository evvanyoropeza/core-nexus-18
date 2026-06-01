import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/docs/products")({
  component: () => (
    <>
      <h1>Productos</h1>
      <p>
        El catálogo de productos define todo lo que tu empresa vende: bienes físicos,
        servicios o partidas configurables.
      </p>

      <h2>Crear un producto</h2>
      <ol>
        <li>
          Ve a <strong>Productos → Nuevo</strong>.
        </li>
        <li>
          Define <strong>SKU</strong>, nombre, unidad de medida y precio base.
        </li>
        <li>
          Asigna una <strong>categoría</strong> (puedes administrarlas en{" "}
          <em>Productos → Categorías</em>).
        </li>
        <li>Guarda. El producto aparecerá disponible al armar cotizaciones.</li>
      </ol>

      <h2>Categorías</h2>
      <p>
        Las categorías te permiten agrupar productos para reportes y filtros. Cada producto
        puede pertenecer a una sola categoría.
      </p>

      <h2>Precios e impuestos</h2>
      <p>
        El precio capturado es el <strong>precio unitario sin IVA</strong>. Los impuestos se
        aplican a nivel de cotización según la configuración fiscal del cliente.
      </p>
    </>
  ),
});
