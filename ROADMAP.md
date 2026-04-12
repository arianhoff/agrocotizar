# Cotizagro — Roadmap

## En progreso / Pendiente

### Pagos y suscripciones
- [x] Integración Mercado Pago — checkout, webhook, prueba gratis 14 días
- [ ] **Email de aviso de vencimiento de prueba gratis** — enviar mail X días antes de que expire el trial (Supabase Edge Function + Resend/SendGrid)
- [ ] **Bloqueo de app al vencer el plan** — mostrar paywall cuando `plan_expires_at` < now y no hay trial activo
- [ ] Pasar MP a producción — reemplazar token de prueba por producción

### Cuentas y seguridad
- [ ] **Seguridad en creación de cuenta nueva** — verificación de email obligatoria, rate limiting en signup, CAPTCHA o honey-pot anti-bot
- [ ] **Personalizar emails y links de Supabase** — dominio propio en emails de confirmación/reset (ej. noreply@cotizagro.com.ar), templates en español con branding

### Multi-usuario (Concesionarios)
- [ ] **Sección Concesionarios** — panel para que el titular del plan contrate y derive acceso a sus vendedores (invitación por email, roles admin/vendedor, límite de seats según plan)

### Otros pendientes
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
