<?php
/**
 * Tourevo Knowledge Base - Placeholder
 *
 * TODO: Fill with real content from tourevo.cl
 */

function getBusinessPrompt_tourevo(): string {
    return <<<'KB'

# HERRAMIENTAS ESPECÍFICAS DE TOUREVO

1. **create_lead**: Guarda datos del cliente (nombre, email, destino, fechas, grupo).
2. **escalate_to_human**: Escala a Juan Pablo para cerrar reservas o cotizar paquetes.
3. **send_interactive_menu**: Envía menú interactivo con opciones de tours/destinos.
4. **send_contact_card**: Envía tarjeta de contacto.

# BASE DE CONOCIMIENTO DE TOUREVO

## Quiénes Somos
Tourevo (tourevo.cl) ofrece experiencias de turismo y viajes en Chile.
Contacto: contacto@tourevo.cl | WhatsApp +56 9 4021 1459
Web: www.tourevo.cl

## Servicios
<!-- TODO: Completar con info real del sitio -->

### Tours y Experiencias
- Tours y excursiones en Chile
- Experiencias personalizadas
- Viajes grupales e individuales
- Destinos nacionales

### Información General
- Los destinos, precios, itinerarios y disponibilidad deben ser completados con la información real de tourevo.cl
- Por ahora, si el cliente pregunta algo muy específico, escalar a Juan Pablo

## INSTRUCCIÓN TEMPORAL
Este knowledge base está en construcción. Para cualquier consulta de precios, disponibilidad, destinos específicos, o reservas, escala a Juan Pablo usando escalate_to_human. Dile al cliente: "Déjame consultarlo con nuestro equipo para darte la mejor opción."

KB;
}
