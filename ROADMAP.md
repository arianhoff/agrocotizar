# Cotizagro — Roadmap

## En progreso / Pendiente

### Pagos y suscripciones
- [x] Integración Mercado Pago — checkout, webhook, prueba gratis 14 días
- [x] Pasar MP a producción
- [ ] **Email de aviso de vencimiento de prueba gratis** — enviar mail X días antes de que expire el trial (Supabase Edge Function + Resend)
- [ ] **Diferenciar planes y bloquear funciones** — aplicar límites según plan activo (Gratis, Vendedores, Concesionarios); bloquear acceso al vencer la prueba o el plan pago

### Cuentas y seguridad
- [x] Seguridad en creación de cuenta nueva — verificación de email, rate limiting, mensajes de error genéricos
- [x] Personalizar emails de Supabase — templates en español + SMTP propio via Resend (noreply@cotizagro.com.ar)

### Multi-usuario (Concesionarios)
- [ ] **Sección Concesionarios** — panel para que el titular del plan contrate y derive acceso a sus vendedores (invitación por email, roles admin/vendedor, límite de seats según plan)

### Otros pendientes
- [ ] **Configurar hola@cotizagro.com.ar** — crear o apuntar el mailbox de soporte; actualizar la dirección en la app donde aparezca
- [ ] Al borrar lista/cliente, eliminar en todos lados (Supabase + local)
- [x] Logo cargado en configuración también aparece en el PDF
- [x] Hacer test de seguridad
- [x] Auto-detectar moneda (ARS/USD) al cargar lista de precios
- [x] Revisar listas extensas o mayores a 50MB (auto-split en chunks de 2MB)

## Bugs conocidos / Deuda técnica

- [ ] Auto-sync en mobile sin tocar botón (visibilitychange no dispara en iOS cuando la app vuelve del background — por ahora hay poll cada 60s como fallback)
- [ ] BCRA consulta deuda: bloqueado por IP en Vercel y Cloudflare — pendiente solución alternativa

## Completado

- [x] Dominio cotizagro.com.ar conectado a Vercel
- [x] AFIP/ARCA padrón funcionando en producción
- [x] Sincronización de listas de precios entre dispositivos (manual con botón Sincronizar)
- [x] Fix IDs de productos y opciones (UUID válido para Supabase)
- [x] RLS policies para product_options en Supabase
- [x] Fix race condition FK al agregar opciones (sync producto antes que opción)
- [x] Rama `teste` en GitHub para desarrollo/testing antes de pasar a `main`
- [x] Catálogo viene vacío (sin lista predeterminada GEA)
- [x] Cancelar suscripción desde configuración
- [x] Flujo landing → plan → activación directa (trial y checkout sin pasos manuales)
- [x] Condiciones de pago por defecto cuando la IA no detecta ninguna al importar lista
