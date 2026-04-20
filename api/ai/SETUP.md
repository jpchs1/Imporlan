# Imporlan WhatsApp AI Chat - Setup Guide

## Prerequisitos

1. **Cuenta Meta Business Manager** verificada
2. **WhatsApp Business Platform** activada
3. **API Key de Anthropic (Claude)** - https://console.anthropic.com
4. **Servidor con PHP 7.4+** y extensión cURL

## Paso 1: Configurar Meta Business / WhatsApp API

### 1.1 Crear App en Meta Developers
1. Ir a https://developers.facebook.com
2. Crear nueva App → Tipo "Business"
3. Agregar producto "WhatsApp"
4. En WhatsApp > API Setup, obtener:
   - **Phone Number ID** (del número +56 9 4021 1459)
   - **WhatsApp Business Account ID**
   - **Temporary Access Token** (para pruebas)

### 1.2 Generar Access Token Permanente
1. En Business Settings > System Users, crear usuario sistema
2. Asignar permisos: `whatsapp_business_messaging`, `whatsapp_business_management`
3. Generar token permanente

### 1.3 Configurar Webhook
1. En WhatsApp > Configuration > Webhook
2. **Callback URL:** `https://www.imporlan.cl/api/whatsapp_webhook.php`
3. **Verify Token:** El mismo que definas en `whatsapp_config.php`
4. Suscribir a: `messages`

## Paso 2: Configurar Servidor

### 2.1 Crear archivo de configuración
```bash
cp api/ai/whatsapp_config.example.php api/ai/whatsapp_config.php
```

### 2.2 Editar whatsapp_config.php con tus credenciales
```php
define('WHATSAPP_PHONE_NUMBER_ID', 'TU_PHONE_NUMBER_ID');
define('WHATSAPP_ACCESS_TOKEN', 'TU_ACCESS_TOKEN_PERMANENTE');
define('WHATSAPP_VERIFY_TOKEN', 'TU_TOKEN_VERIFICACION');
define('CLAUDE_API_KEY', 'sk-ant-TU_API_KEY');
```

### 2.3 Ejecutar migración de base de datos
```bash
php api/migrations/whatsapp_ai_tables.php
```

### 2.4 Proteger archivos sensibles
Agregar a `.htaccess` en `/api/ai/`:
```apache
<Files "whatsapp_config.php">
    Order allow,deny
    Deny from all
</Files>
```

## Paso 3: Configurar Cron Jobs

```bash
# Follow-ups automáticos (cada 15 minutos)
*/15 * * * * php /home/wwimpo/public_html/api/cron/whatsapp_follow_ups.php >> /var/log/whatsapp_followups.log 2>&1
```

## Paso 4: Pruebas

### 4.1 Verificar webhook
```bash
curl "https://www.imporlan.cl/api/whatsapp_webhook.php?hub_mode=subscribe&hub_verify_token=TU_TOKEN&hub_challenge=test123"
# Debe responder: test123
```

### 4.2 Enviar mensaje de prueba
Envía un "Hola" al número +56 9 4021 1459 desde WhatsApp.
La IA debería responder en ~3 segundos.

### 4.3 Verificar logs
```bash
# Webhook logs
tail -f /var/log/whatsapp_webhook.log

# Base de datos
SELECT * FROM whatsapp_webhook_log ORDER BY created_at DESC LIMIT 10;
SELECT * FROM ai_usage_log ORDER BY created_at DESC LIMIT 10;
```

## Estructura de Archivos

```
api/
├── whatsapp_webhook.php          ← Punto de entrada webhook Meta
├── ai/
│   ├── whatsapp_config.php       ← Credenciales (NO en git)
│   ├── whatsapp_config.example.php ← Template credenciales
│   ├── whatsapp_api.php          ← Cliente WhatsApp Cloud API
│   ├── claude_client.php         ← Cliente Claude API con caching
│   ├── system_prompt.php         ← Knowledge base / cerebro IA
│   ├── chat_ai_handler.php       ← Orquestador principal
│   ├── conversation_memory.php   ← Gestión de contexto/historial
│   ├── guardrails.php            ← Seguridad y validación
│   └── tools/
│       ├── search_marketplace.php
│       ├── calculate_import_quote.php
│       ├── manage_lead.php
│       └── send_whatsapp_media.php
├── cron/
│   └── whatsapp_follow_ups.php   ← Cron follow-ups
└── migrations/
    └── whatsapp_ai_tables.php    ← Migración DB
```

## Monitoreo de Costos

Consulta mensual:
```sql
SELECT
    DATE_FORMAT(created_at, '%Y-%m') as mes,
    COUNT(*) as total_requests,
    SUM(input_tokens) as total_input,
    SUM(output_tokens) as total_output,
    SUM(cache_read_tokens) as total_cache_reads,
    ROUND(SUM(cost_usd), 2) as costo_total_usd
FROM ai_usage_log
GROUP BY DATE_FORMAT(created_at, '%Y-%m')
ORDER BY mes DESC;
```

## Límite de costos

Configurado en `whatsapp_config.php`:
```php
define('CLAUDE_MONTHLY_COST_LIMIT_USD', 50.00);
```
Cuando se alcanza el límite, la IA deja de responder y envía mensaje de fallback.
