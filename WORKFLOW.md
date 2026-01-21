# Flujo de Trabajo - Imporlan

## Principios Fundamentales

1. **GitHub es la ÚNICA fuente de verdad** - Todo el código vive en el repositorio
2. **Nunca modificar producción directamente** - Solo se actualiza desde GitHub
3. **Siempre probar en /test primero** - Validar antes de pasar a producción
4. **Todo cambio queda versionado** - Commits claros y descriptivos

## Estructura de Ambientes

| Ambiente | URL | Propósito |
|----------|-----|-----------|
| TEST | https://www.imporlan.cl/test/ | Desarrollo y pruebas |
| PRODUCCIÓN | https://www.imporlan.cl/ | Sitio en vivo |

## Flujo de Desarrollo

### Paso 1: Desarrollo en /test

Todos los cambios se realizan primero en el ambiente de pruebas:
- URL: https://www.imporlan.cl/test/
- Panel Usuario: https://www.imporlan.cl/test/panel/
- API: https://www.imporlan.cl/test/api/

### Paso 2: Validación

Verificar que todo funciona correctamente:
- Landing page carga correctamente
- Panel de usuario funciona
- Panel de administración funciona
- Correos se envían (a jpchs1@gmail.com en TEST)
- Pagos funcionan (modo sandbox)
- Imágenes cargan correctamente

### Paso 3: Commit a GitHub

Una vez aprobado por Juan Pablo, hacer commit con mensaje descriptivo y push a main.

### Paso 4: Deploy a Producción

Usar el endpoint de deploy (el token está en deploy_config.php en el servidor):

- Deploy a TEST: `/api/deploy.php?env=test&token=TOKEN`
- Deploy a PRODUCCIÓN: `/api/deploy.php?env=prod&token=TOKEN&confirm=yes`

## Configuración de Correos

### Ambiente TEST
- Todos los correos se redirigen a: jpchs1@gmail.com
- Permite probar flujos reales sin enviar a usuarios

### Ambiente PRODUCCIÓN
- Correos se envían a destinatarios reales
- From: contacto@imporlan.cl

La detección de ambiente es automática basada en la URL.

## Archivos Protegidos

Estos archivos NUNCA se sobrescriben durante el deploy:
- api/config.php - Credenciales de base de datos
- api/db_config.php - Configuración de conexión

## Archivos de Configuración (No versionados)

Estos archivos deben existir en el servidor pero NO en GitHub:
- /home/wwimpo/deploy_config.php - Token de deploy

## Rollback (Revertir Cambios)

Si algo falla en producción, usar git revert y luego hacer deploy nuevamente.

## GitHub

- Repositorio: https://github.com/jpchs1/Imporlan
- Branch principal: main
