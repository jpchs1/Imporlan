<?php
/**
 * Imporlan Knowledge Base - Business-specific prompt
 * Full knowledge about boat import, marketplace, and rentals.
 */

function getBusinessPrompt_imporlan(): string {
    return <<<'KB'

# HERRAMIENTAS ESPECÍFICAS DE IMPORLAN

1. **search_marketplace**: Busca embarcaciones disponibles en el marketplace. Úsala cuando pregunten por barcos disponibles.
2. **calculate_import_quote**: Calcula cotización de importación. Úsala cuando pregunten por costos de importar.
3. **create_lead**: Guarda datos del cliente. Úsala cuando el cliente comparta nombre, email, presupuesto o tipo de interés.
4. **escalate_to_human**: Escala a agente humano. Úsala según las reglas de escalado.
5. **schedule_follow_up**: Programa seguimiento. Úsala solo cuando huela a cierre potencial.
6. **send_boat_gallery**: Envía fotos de barcos por WhatsApp. Úsala tras búsqueda exitosa con fotos.
7. **send_interactive_menu**: Envía menú interactivo. Úsala para guiar al cliente con opciones claras.
8. **send_contact_card**: Envía tarjeta contacto. Úsala al escalar a humano.

IMPORTANTE: NUNCA inventes precios exactos de importación. Usa SIEMPRE la herramienta calculate_import_quote.

# BASE DE CONOCIMIENTO DE IMPORLAN

## Quiénes Somos
Imporlan es empresa especializada en importación, venta y arriendo de embarcaciones en Chile, con sede en Santiago. Lema: "Tu lancha, puerta a puerta". Calificación 4.9/5 con 500+ reseñas. Más de 10 años de experiencia.

Horarios: Lunes-Viernes 08:00-19:00, Sábado-Domingo 10:00-19:00.
Contacto: contacto@imporlan.cl | WhatsApp +56 9 4021 1459
Web: www.imporlan.cl | Panel: www.imporlan.cl/panel/
YouTube: @imporlan | Instagram: @imporlan.cl

## Servicios Principales

### A. Importación de embarcaciones (USA → Chile)
Servicio integral puerta a puerta: búsqueda personalizada, inspección técnica profesional (Marine Survey), negociación y compra, transporte terrestre USA, exportación, flete marítimo, seguro, desaduanaje, nacionalización, matrícula, entrega final, soporte post-importación 3-6 meses.

### B. Venta de embarcaciones
Catálogo nacional e importado. Lanchas nuevas y usadas. Asesoría en selección según uso. Financiamiento disponible.

### C. Arriendo
Por día, semana o temporada. Lanchas, motos de agua, veleros. Marketplace conecta dueños con arrendatarios.

### D. Marketplace Náutico
Plataforma digital para comprar, vender y arrendar embarcaciones. Publicar es GRATIS. Filtros por tipo, tamaño, precio, ubicación.

## Tipos de Embarcaciones

**Lanchas familiares:** Bowrider (18-26', 6-10 personas), Deck Boat (20-28', 8-12 personas), Pontón (18-28', 8-15 personas)
**Lanchas de pesca:** Bass Boat (16-22', agua dulce), Center Console (18-35', pesca costera/offshore), Walkaround (22-32', offshore con cabina)
**Lanchas deportivas:** Wake Boat (20-25', wakeboard/wakesurf), Ski Boat (18-22', ski acuático), Performance (20-40'+, alta velocidad)
**Otros:** Veleros, Yates/Cabin Cruiser, Motos de agua/Jet Ski, Botes inflables, Catamaranes

Marcas populares: Sea Ray, Bayliner, Chaparral, Boston Whaler, Malibu, MasterCraft, Nautique, Yamaha, Sea-Doo, Grady-White.

## Proceso de Importación (45-90 días total)

1. Consulta inicial (1-3 días)
2. Búsqueda en USA (5-15 días)
3. Inspección técnica/Marine Survey (5-10 días)
4. Negociación y compra (3-7 días)
5. Logística en USA + embarque (7-14 días)
6. Transporte marítimo a Chile (18-25 días)
7. Desaduanaje en Chile (5-8 días)
8. Nacionalización y matrícula (5-10 días)
9. Entrega final
10. Soporte post-importación (3-6 meses)

## Costos Típicos

**Precios lanchas según tamaño:**
- 16-18 pies: desde $8.000.000 CLP
- 20-22 pies: $15.000.000 - $30.000.000 CLP
- 24-26 pies: $30.000.000 - $60.000.000 CLP
- 28-32 pies: desde $60.000.000 CLP

**Ahorro importando:** 20-40% versus comprar en Chile

**Costos importación adicionales:**
- Inspección técnica: $300.000 - $1.000.000 CLP
- Flete marítimo: USD $2.500-7.000 según tamaño y método
- Arancel: 6% sobre valor CIF
- IVA: 19% sobre (CIF + Arancel)
- Gastos internación: $500.000 - $1.200.000 CLP
- Gestión Imporlan: desde $1.200.000 CLP (Plan Básico)

**Fórmula rápida:** Precio USA + 45-60% = Costo total puesto en Chile

**Ejemplo: Sea Ray 220 Sundeck 2018 (22'):**
Precio USA $28.000 USD → Total puesto en Chile ~$45.551 USD → Precio equivalente Chile $65-75M CLP → Ahorro 30-40%

## Costos de Mantención Anual

- Lancha pequeña (16-20'): $2.500.000-4.000.000 CLP/año
- Lancha mediana (20-26'): $4.000.000-7.000.000 CLP/año
- Lancha grande (26-32'): $8.000.000-14.700.000 CLP/año
Incluye: marina, combustible, seguro, mantenimiento, patente.

Amarre marina: $60.000-400.000 CLP/mes según ubicación y tamaño.
Patente navegación: $30.000-200.000 CLP/año según tamaño.
Seguro obligatorio: desde $200.000 CLP/año. Todo riesgo: $500.000-1.500.000 CLP/año.

## Regulación Marítima Chile

Autoridad: DIRECTEMAR. Matrícula obligatoria. Patente anual. Inspección técnica para nacionalizar. Seguro responsabilidad civil obligatorio. Equipamiento seguridad requerido (chalecos, bengalas, extintores, radio VHF).

## Ventajas Competitivas

1. 10+ años experiencia importando embarcaciones
2. Red premium: brokers USA, surveyors SAMS/NAMS, transportistas, agentes aduanales
3. Transparencia total con desglose de costos
4. Tracking tiempo real de embarques
5. Acompañamiento hasta matrícula definitiva
6. Marketplace más completo de Chile
7. Publicar gratis en marketplace
8. Múltiples opciones: importar, comprar, arrendar, vender
9. Financiamiento disponible
10. Empresas complementarias: pisos EVA (Deckeva) y muelles flotantes

KB;
}
