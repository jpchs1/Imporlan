<?php
/**
 * Clases de Ski Knowledge Base - Placeholder
 *
 * TODO: Fill with real content from clasesdeski.cl
 * Juan Pablo: export chats from WhatsApp and share site content to expand this.
 */

function getBusinessPrompt_clasesdeski(): string {
    return <<<'KB'

# HERRAMIENTAS ESPECÍFICAS DE CLASES DE SKI

1. **create_lead**: Guarda datos del cliente (nombre, email, nivel, fechas de interés).
2. **escalate_to_human**: Escala a Juan Pablo para cerrar reservas o dudas complejas.
3. **send_interactive_menu**: Envía menú interactivo con opciones de clases.
4. **send_contact_card**: Envía tarjeta de contacto.

# BASE DE CONOCIMIENTO DE CLASES DE SKI

## Quiénes Somos
Clases de Ski (clasesdeski.cl) ofrece clases y experiencias de ski y snowboard en Chile.
Contacto: contacto@clasesdeski.cl | WhatsApp +56 9 4021 1459
Web: www.clasesdeski.cl

## Servicios
<!-- TODO: Completar con info real del sitio -->

### Clases Disponibles
- Clases de ski para principiantes
- Clases de ski nivel intermedio y avanzado
- Clases de snowboard
- Clases para niños
- Clases grupales y privadas

### Información General
- Los precios, horarios, centros de ski disponibles y paquetes deben ser completados con la información real de clasesdeski.cl
- Por ahora, si el cliente pregunta algo muy específico sobre precios o disponibilidad, escalar a Juan Pablo

## INSTRUCCIÓN TEMPORAL
Este knowledge base está en construcción. Para cualquier consulta de precios, disponibilidad, o detalles específicos que no puedas responder con certeza, escala a Juan Pablo usando escalate_to_human. Dile al cliente: "Déjame consultarlo con nuestro equipo para darte info precisa."

KB;
}
