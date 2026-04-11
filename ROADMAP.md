# Cotizagro — Roadmap

## En progreso / Pendiente

- [ ] Hacer funcionar métodos de pago en el inicio de sesión
- [ ] Empezar gratis: bloquear app a los 15 días de prueba
- [x] Logo cargado en configuración también aparece en el PDF
- [x] Hacer test de seguridad
- [x] Auto-detectar moneda (ARS/USD) al cargar lista de precios
- [ ] Al borrar lista/cliente, eliminar en todos lados (Supabase + local)
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
