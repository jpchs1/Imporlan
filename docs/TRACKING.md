# Sistema de Tracking Maritimo - Imporlan

## Descripcion General

Sistema de seguimiento en vivo de embarcaciones USA -> Chile con datos AIS, integrado al Panel Imporlan.

## Arquitectura

```
api/
  tracking_api.php          # API endpoints (action-based)
  tracking/
    ais_provider_interface.php  # Interface desacoplada
    ais_provider.php            # Implementacion con cache 10 min
  cron/
    rotate_featured_vessels.php # Rotacion automatica de vessels

panel-test/
  assets/
    tracking-enhancer.js    # UI usuario (#seguimiento)
  admin/assets/
    tracking-admin.js       # UI admin (#tracking)

t/
  index.html                # Pagina publica tokenizada
  .htaccess                 # URL routing para tokens
```

## Variables de Entorno

- `AIS_API_KEY`: Clave del proveedor AIS (configurar en cPanel). Sin esta clave, solo funcionan posiciones manuales.

## Base de Datos

### Tablas

- `vessels`: Embarcaciones (nombre, IMO, MMSI, naviera, origen, destino, estado, destacada)
- `vessel_positions`: Historial de posiciones (lat, lon, velocidad, rumbo, fuente, timestamp)
- `orders.vessel_id`: FK a vessels (asignacion de tracking a expediente)
- `orders.tracking_public_token`: Token unico de 64 chars para acceso publico

### Migracion

Ejecutar desde admin autenticado:
```
GET /test/api/tracking_api.php?action=migrate
Authorization: Bearer {admin_token}
```

## API Endpoints

### Publicos
| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `?action=featured` | GET | Embarcaciones destacadas con posicion |
| `?action=vessel_detail&id=X` | GET | Detalle de embarcacion |
| `?action=vessel_positions&id=X` | GET | Historial de posiciones |
| `?action=public_tracking&token=X` | GET | Tracking publico por token |

### Admin (requieren Authorization Bearer)
| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `?action=admin_list_vessels` | GET | Listar todas las embarcaciones |
| `?action=admin_create_vessel` | POST | Crear embarcacion |
| `?action=admin_update_vessel` | POST | Actualizar embarcacion |
| `?action=admin_delete_vessel` | POST | Eliminar embarcacion |
| `?action=admin_rotate_featured` | POST | Rotar embarcaciones destacadas |
| `?action=admin_assign_vessel` | POST | Asignar vessel a expediente |
| `?action=admin_add_position` | POST | Agregar posicion manual |
| `?action=migrate` | GET | Crear/actualizar tablas |

## Agregar Vessel Manual

1. Admin Panel -> Tracking -> Crear Embarcacion
2. Ingresar IMO o MMSI (obligatorio al menos uno)
3. Completar origen, destino, naviera
4. Opcionalmente agregar posicion inicial (lat/lon)
5. Marcar como "Destacada" para que aparezca en panel usuario

## Asignar Tracking a Expediente

1. Admin Panel -> Tracking -> [seleccionar embarcacion]
2. En seccion "Asignar a Expediente", ingresar ID de la orden
3. Sistema genera token publico de 64 caracteres
4. Sistema envia email `sendTrackingActivated()` al cliente
5. URL publica: `https://www.imporlan.cl/t/{token}`

## Emails Automaticos

| Evento | Metodo | Destinatario |
|--------|--------|-------------|
| Tracking asignado | `sendTrackingActivated()` | Cliente |
| Vessel arribado | `sendVesselArrived()` | Cliente |

## Cron Job

Ejecuta diariamente a las 2 AM:
```
0 2 * * * /usr/bin/php /home/wwimpo/public_html/api/cron/rotate_featured_vessels.php
```

Funciones:
- Detecta vessels automaticos que han llegado a Chile (lat < -30)
- Marca como `status='arrived'`
- Activa reemplazos del pool de programados
- Asegura minimo 3 embarcaciones destacadas activas
- Envia emails de arribo a clientes afectados

## Cache AIS

- TTL: 10 minutos por vessel
- Almacena en tabla `vessel_positions`
- Fallback: ultima posicion conocida si API falla
- Logging: errores en `error_log`

## Pagina Publica

URL: `https://www.imporlan.cl/t/{token}`

- No requiere autenticacion
- Muestra mapa con posicion actual (Leaflet/OpenStreetMap)
- Muestra informacion de la embarcacion y ruta
- Muestra historial de posiciones como linea en el mapa

## Panel Usuario

Ruta: `#seguimiento`

Layout 3 columnas:
1. Lista de embarcaciones destacadas
2. Mapa interactivo con marcadores
3. Panel de detalle de embarcacion seleccionada

## Panel Admin

Ruta: `#tracking`

- CRUD completo de embarcaciones
- Agregar posiciones manuales
- Asignar tracking a expedientes
- Filtros por estado y busqueda
