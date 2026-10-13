import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/docs/roles")({
  head: () => ({ meta: [{ title: "Roles y permisos · Manual" }] }),
  component: () => (
    <>
      <h1>Roles y permisos</h1>
      <p>
        Cada usuario tiene un rol <strong>por empresa</strong>. Una misma persona puede ser
        administradora en una empresa y vendedora en otra; al cambiar de empresa, el menú y
        los permisos se ajustan automáticamente.
      </p>

      <h2>Perfiles disponibles</h2>
      <ul>
        <li><strong>Superadmin / Administrador</strong>: acceso total, incluido Equipo, Configuración, Facturación y Actividad.</li>
        <li><strong>Ventas</strong>: Clientes, Cotizaciones, Pipeline, Órdenes, Analíticas y Reportes. Sin costos ni márgenes.</li>
        <li><strong>Operaciones</strong>: Productos, Órdenes y Reportes.</li>
        <li><strong>Almacén</strong>: Productos, inventario y surtido de Órdenes. Sin costos ni márgenes.</li>
        <li><strong>Finanzas</strong>: Clientes, Cotizaciones, Órdenes, Analíticas, Reportes y Facturación.</li>
        <li><strong>Observador</strong>: solo consulta del panel y reportes.</li>
      </ul>

      <h2>Accesos restringidos</h2>
      <p>
        Si alguien abre una sección que no le corresponde, verá un aviso de{" "}
        <strong>Acceso restringido</strong> con un botón para volver al panel.
      </p>

      <h2>Invitar a un colaborador</h2>
      <ol>
        <li>Ve a <strong>Equipo → Invitar usuario</strong>.</li>
        <li>Escribe su correo y elige su rol.</li>
        <li>Copia el link de invitación que aparece y compártelo.</li>
        <li>La persona abre el link y se registra con ese mismo correo.</li>
      </ol>
      <p>
        Importante: si alguien se registra por su cuenta sin link, se crea una empresa nueva y
        separada; no entrará a la tuya.
      </p>

      <h2>Cambiar el rol</h2>
      <p>
        En <strong>Equipo → Miembros</strong>, cambia el rol con el selector de la fila. Aplica
        de inmediato.
      </p>
    </>
  ),
});
