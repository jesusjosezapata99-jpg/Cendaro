"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

import { ScrollEntrance } from "./scroll-entrance";

const faqs = [
  {
    question: "¿Cendaro es gratuito?",
    answer:
      "Sí. El plan Starter es completamente gratuito e incluye hasta 500 productos, 1 usuario y las funciones esenciales de inventario y pedidos. No necesitas tarjeta de crédito para empezar.",
  },
  {
    question: "¿Puedo migrar mis datos desde Excel?",
    answer:
      "Absolutamente. Cendaro incluye un importador inteligente que lee tu archivo Excel, valida los datos automáticamente, detecta errores antes de importar y categoriza productos con IA. La mayoría de negocios migran en menos de 5 minutos.",
  },
  {
    question: "¿Mis datos están seguros?",
    answer:
      "Usamos Supabase como infraestructura, con cifrado en reposo y en tránsito, copias de seguridad automáticas y cumplimiento GDPR. Tus datos son tuyos — puedes exportarlos en cualquier momento.",
  },
  {
    question: "¿Qué integraciones están disponibles?",
    answer:
      "Cendaro se conecta con Stripe para pagos, WhatsApp Business para notificaciones de pedidos, Google Sheets para exportaciones y más. Nuestro plan Pro incluye acceso a la API para integraciones personalizadas.",
  },
  {
    question: "¿Puedo usar Cendaro en móvil?",
    answer:
      "Sí. Cendaro está diseñado mobile-first. Puedes gestionar inventario, procesar pedidos y revisar analytics desde cualquier dispositivo con navegador. No necesitas instalar ninguna app.",
  },
  {
    question: "¿Cómo funciona la prueba Pro?",
    answer:
      "El plan Pro incluye 14 días de prueba gratuita con acceso a todas las funciones: productos ilimitados, usuarios ilimitados, IA, facturación y analytics avanzados. Puedes cancelar en cualquier momento sin cargos.",
  },
  {
    question: "¿Tienen soporte en español?",
    answer:
      "Sí. Todo el producto, la documentación y el soporte están en español. El equipo de Cendaro está basado en España y respondemos en horario europeo.",
  },
];

function FAQItem({
  question,
  answer,
  index,
}: {
  question: string;
  answer: string;
  index: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <ScrollEntrance delay={index * 0.05}>
      <div className="border-border border-b">
        <button
          type="button"
          className="hover:text-foreground flex w-full cursor-pointer items-center justify-between py-5 text-left transition-colors"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          <span className="text-foreground pr-4 text-base font-medium">
            {question}
          </span>
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <ChevronDown className="text-muted-foreground h-5 w-5 shrink-0" />
          </motion.div>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <p className="text-muted-foreground pb-5 text-sm leading-relaxed">
                {answer}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ScrollEntrance>
  );
}

export function FAQSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-3xl px-6">
        <ScrollEntrance>
          <h2 className="mx-auto max-w-2xl text-center font-serif text-[clamp(2rem,3.5vw,3rem)] leading-[1.15] tracking-[-0.01em]">
            Preguntas frecuentes
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-center">
            Todo lo que necesitas saber para empezar.
          </p>
        </ScrollEntrance>

        <div className="mt-16">
          {faqs.map((faq, index) => (
            <FAQItem
              key={faq.question}
              question={faq.question}
              answer={faq.answer}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
