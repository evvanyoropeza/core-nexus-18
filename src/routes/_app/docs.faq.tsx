import { createFileRoute } from "@tanstack/react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/_app/docs/faq")({
  component: FaqPage,
});

const items = [
  {
    q: "¿Puedo trabajar con varias empresas (tenants)?",
    a: "Sí. Tu usuario puede pertenecer a varias empresas. Usa el selector en la parte superior del menú lateral para cambiar entre ellas. Los datos están completamente aislados.",
  },
  {
    q: "¿Cómo invito a un compañero de equipo?",
    a: "Ve a Equipo → Invitar usuario, escribe su correo y elige su rol. Se mostrará un link de invitación para copiar y compartir; la persona debe abrirlo y registrarse con ese mismo correo para entrar a tu empresa.",
  },
  {
    q: "¿Cómo cambio el rol de un colaborador?",
    a: "En Equipo, sección Miembros, usa el selector de la columna Rol. El cambio aplica de inmediato; el usuario verá su nuevo menú al refrescar la página.",
  },
  {
    q: "¿Qué pasa si no hay stock suficiente al surtir una orden?",
    a: "El sistema no permite surtir más de lo disponible. Registra una entrada de inventario en el producto y vuelve a intentarlo.",
  },
  {
    q: "¿Cómo exporto o imprimo un reporte?",
    a: "En Reportes elige el tipo, aplica filtros y usa 'Exportar CSV' para Excel o 'Imprimir' para obtener un PDF.",
  },
  {
    q: "¿Qué pasa si edito una cotización ya enviada?",
    a: "Al cambiar de estado a 'Enviada' se guarda un snapshot inmutable. Puedes seguir editando, pero el historial conserva la versión original con la que se compartió al cliente.",
  },
  {
    q: "¿El link público de cotización expira?",
    a: "Permanece activo hasta que lo revoques manualmente desde el diálogo 'Compartir'. Cada visita queda registrada con un contador.",
  },
  {
    q: "¿Puedo recuperar un cliente o producto borrado?",
    a: "Recomendamos desactivar en lugar de borrar. Los registros desactivados conservan su historial y pueden reactivarse en cualquier momento.",
  },
  {
    q: "¿Dónde veo el historial de cambios?",
    a: "En 'Actividad' (menú lateral) tienes un registro auditable de todas las acciones realizadas por miembros del equipo.",
  },
  {
    q: "¿Cómo cambio el logo o datos fiscales de la empresa?",
    a: "Desde Configuración. Esos datos se imprimen automáticamente en los PDFs de cotización.",
  },
];

function FaqPage() {
  return (
    <>
      <h1>Preguntas frecuentes</h1>
      <Accordion type="single" collapsible className="not-prose">
        {items.map((item, i) => (
          <AccordionItem key={i} value={`item-${i}`}>
            <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
            <AccordionContent>{item.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </>
  );
}
