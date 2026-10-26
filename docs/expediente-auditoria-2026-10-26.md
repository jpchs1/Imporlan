# Auditoría del expediente: administración y cliente

Fecha: 26 de octubre de 2026. Referencia operativa: IMP-00036.

Se revisaron resumen, etapas, elección, ranking, cotizador, pagos, informes,
archivos, navegación, errores y uso en móvil. La revisión autenticada en
producción fue de lectura desde administración. La vista de cliente se validó
con sus componentes reales y datos ficticios; los permisos de documentos y
las reglas de elección se probaron contra las APIs PHP reales con SQLite.
No se generaron cobros, elecciones, cotizaciones ni correos de prueba en producción.

## Hallazgos corregidos

| Área | Problema | Resultado |
| --- | --- | --- |
| Publicación | «Publicar ahora» seguía condicionado por la espera configurada. | La publicación manual habilita inmediatamente el resumen del cliente. |
| Privacidad de precios | La espera ocultaba `quote_total_clp`, pero el mismo total viajaba en `value_chile_negotiated_clp`. | Durante el análisis se ocultan también los totales de la matriz, tanto en servidor como en presentación. |
| Espera | El cliente siempre leía «24 horas», incluso con otra configuración. | Se presenta la fecha de disponibilidad que entrega el servidor. |
| Comparación | El orden mezclaba USD y CLP; la tabla ignoraba precios negociados y cotizaciones vigentes. | Órdenes separados por moneda, precios desconocidos al final y preferencia por total cotizado/negociado en Chile. |
| Presentación de precios | Cuatro casillas daban el mismo énfasis a referencias y montos vigentes, con varios «Sin dato». | Se destacan compra negociada y total en Chile; el publicado USA queda como referencia y el ahorro se muestra cuando existe base comparable. |
| Cotizaciones históricas | Un snapshot incompleto podía producir NaN o un desglose inventado. | Se conserva el total válido y se identifica el detalle pendiente de actualización. |
| Actualización del cliente | El polling ignoraba precios, cotizaciones y estados si no cambiaba el ranking. Los pagos tampoco se refrescaban periódicamente. | El expediente completo y los servicios relacionados se actualizan cada 30 segundos. |
| Ranking del cliente | Los guardados simultáneos podían competir; un error dejaba el orden local sin persistir; avisar al agente ignoraba un guardado fallido. | Un guardado a la vez, reversión ante fallo y notificación sólo tras guardar correctamente. La fecha proviene del servidor. |
| Búsqueda y orden | Buscar sin acentos no encontraba algunos nombres; reordenar una selección filtrada resultaba ambiguo. | Búsqueda normalizada y reordenamiento disponible en la vista completa del ranking. |
| Guardado admin | Un guardado o refresco iniciado antes de una edición podía pisarla. Algunas acciones marcaban limpio un formulario no guardado. | Se preservan las ediciones nuevas, permanece el aviso pendiente y se guardan formulario y links antes de las acciones que lo necesitan. |
| Guardar cotización | Refrescar después del modal podía sobrescribir otras ediciones del expediente. | Se actualizan sólo sus campos de cotización y se conservan los cambios pendientes. |
| Archivos | Al cambiar de expediente podían quedar archivos del anterior; respuestas tardías podían mezclarlos. | Los archivos pertenecen al expediente y petición vigentes. Un fallo al actualizar el mismo expediente conserva su última lista correcta. |
| Fallos de servicios | Algunos errores parecían listas vacías o una carga interminable. | Errores explícitos, reintentos y bloqueo de crear otro cobro mientras no se hayan recuperado los existentes. |
| Filas vacías | IMP-00036 mostraba ocho borradores junto a dos anuncios reales. La limpieza ignoraba ciertos campos con información. | Borradores plegados y recuperables; la limpieza conserva filas con título, negociación u otros datos. |
| Identidad y estado | Algunos IDs numéricos recibidos como texto no marcaban la elección. Una foto bastaba para declarar «Ficha completa». | Comparación coherente de IDs y ficha completa sólo con identificación, imagen y precio. |

El campo de referencia «Publicado · Chile» vacío no se rellena con un cálculo
supuesto: la cotización de compra usa el valor negociado. Los informes y archivos
vacíos en IMP-00036 corresponden al material aún no incorporado, no a una petición
fallida observada en esa revisión.

## Validación

- 37 comprobaciones nuevas de integridad con navegador y contenedores React reales:
  polling, ranking fallido, avisos, recuperación de servicios, archivos de dos
  expedientes, comparación por moneda, privacidad de totales pendientes,
  guardado concurrente, borradores, errores de carga y cobros.
- 156 comprobaciones del workspace a 390, 768 y 1440 px, incluidos roles cliente,
  equipo y agente, navegación por teclado, filtros, archivos y recuperación.
- 114 comprobaciones del cotizador a 320, 390, 768, 1200 y 1440 px.
- 56 comprobaciones de acceso a JPG/PDF, incluyendo navegador contra PHP real.
- 21 comprobaciones de privacidad/publicación de cotizaciones.
- Suites PHP de CI, incluidas 175 comprobaciones de elección e importación,
  autenticación, pagos, scraping, correo y separación de roles.
- ESLint de los componentes modificados y builds de ambos paneles de producción.

No cambian los porcentajes, fórmulas ni hitos de cobro: Pago 1 al elegir; Pago 2
tras inspección aprobada o disponibilidad confirmada si no hay inspección;
Pago 3 en camino a Chile. La planilla interna y los documentos privados siguen
excluidos del cliente, y el agente de EE. UU. sigue sin contacto ni cobros del cliente.
