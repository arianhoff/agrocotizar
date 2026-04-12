# Cotizagro — Templates de Email para Supabase

Pegar cada template en: **Supabase → Authentication → Email Templates**

---

## Configuración previa (hacer primero)

**Authentication → URL Configuration:**
- Site URL: `https://cotizagro.com.ar`
- Redirect URLs: agregar `https://cotizagro.com.ar/**`

---

## 1. Confirm signup (Confirmación de cuenta)

**Subject:**
```
Confirmá tu cuenta en Cotizagro
```

**Body (HTML):**
```html
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#16A34A,#22C55E);padding:32px 40px;text-align:center;">
            <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;background:rgba(255,255,255,0.2);border-radius:14px;margin-bottom:16px;">
              <span style="font-size:28px;">🚜</span>
            </div>
            <div style="color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">
              Cotiz<span style="opacity:0.85;">agro</span>
            </div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0F172A;">
              ¡Bienvenido/a a Cotizagro!
            </h1>
            <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
              Gracias por registrarte. Para activar tu cuenta y empezar a cotizar maquinaria agrícola en minutos, confirmá tu dirección de email:
            </p>

            <div style="text-align:center;margin:32px 0;">
              <a href="{{ .ConfirmationURL }}"
                style="display:inline-block;background:#22C55E;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;box-shadow:0 4px 12px rgba(34,197,94,0.35);">
                Confirmar mi cuenta
              </a>
            </div>

            <p style="margin:0;font-size:13px;color:#94A3B8;line-height:1.6;">
              Si el botón no funciona, copiá y pegá este link en tu navegador:<br>
              <a href="{{ .ConfirmationURL }}" style="color:#22C55E;word-break:break-all;">{{ .ConfirmationURL }}</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 32px;border-top:1px solid #F1F5F9;">
            <p style="margin:0;font-size:12px;color:#CBD5E1;line-height:1.6;text-align:center;">
              Si no creaste una cuenta en Cotizagro, podés ignorar este email.<br>
              © {{ now | date "2006" }} Cotizagro · <a href="https://cotizagro.com.ar" style="color:#94A3B8;">cotizagro.com.ar</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
```

---

## 2. Reset password (Recuperar contraseña)

**Subject:**
```
Restablecé tu contraseña de Cotizagro
```

**Body (HTML):**
```html
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#16A34A,#22C55E);padding:32px 40px;text-align:center;">
            <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;background:rgba(255,255,255,0.2);border-radius:14px;margin-bottom:16px;">
              <span style="font-size:28px;">🚜</span>
            </div>
            <div style="color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">
              Cotiz<span style="opacity:0.85;">agro</span>
            </div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0F172A;">
              Recuperá tu contraseña
            </h1>
            <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
              Recibimos una solicitud para restablecer la contraseña de tu cuenta. Hacé click en el botón para crear una nueva:
            </p>

            <div style="text-align:center;margin:32px 0;">
              <a href="{{ .ConfirmationURL }}"
                style="display:inline-block;background:#22C55E;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;box-shadow:0 4px 12px rgba(34,197,94,0.35);">
                Restablecer contraseña
              </a>
            </div>

            <div style="background:#FFF8F8;border:1px solid #FECACA;border-radius:10px;padding:16px;margin-bottom:24px;">
              <p style="margin:0;font-size:13px;color:#EF4444;">
                <strong>⚠️ Este link expira en 1 hora.</strong><br>
                Si no solicitaste este cambio, ignorá este email — tu contraseña no será modificada.
              </p>
            </div>

            <p style="margin:0;font-size:13px;color:#94A3B8;line-height:1.6;">
              Si el botón no funciona, copiá y pegá este link:<br>
              <a href="{{ .ConfirmationURL }}" style="color:#22C55E;word-break:break-all;">{{ .ConfirmationURL }}</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 32px;border-top:1px solid #F1F5F9;">
            <p style="margin:0;font-size:12px;color:#CBD5E1;line-height:1.6;text-align:center;">
              © {{ now | date "2006" }} Cotizagro · <a href="https://cotizagro.com.ar" style="color:#94A3B8;">cotizagro.com.ar</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
```

---

## 3. Magic Link (si lo usás)

**Subject:**
```
Tu link de acceso a Cotizagro
```

**Body (HTML):**
```html
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#16A34A,#22C55E);padding:32px 40px;text-align:center;">
            <span style="font-size:28px;">🚜</span>
            <div style="color:#ffffff;font-size:24px;font-weight:800;margin-top:8px;">Cotizagro</div>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0F172A;">Tu link de acceso</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
              Hacé click para ingresar a Cotizagro. Este link es válido por 1 hora y de un solo uso.
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="{{ .ConfirmationURL }}"
                style="display:inline-block;background:#22C55E;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;">
                Ingresar a Cotizagro
              </a>
            </div>
            <p style="margin:0;font-size:13px;color:#94A3B8;">
              Si no solicitaste este acceso, ignorá este email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 32px;border-top:1px solid #F1F5F9;text-align:center;">
            <p style="margin:0;font-size:12px;color:#CBD5E1;">
              © {{ now | date "2006" }} Cotizagro · <a href="https://cotizagro.com.ar" style="color:#94A3B8;">cotizagro.com.ar</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```

---

## Notas

- La variable `{{ .ConfirmationURL }}` la reemplaza Supabase automáticamente con el link real.
- Para el SMTP propio (`noreply@cotizagro.com.ar`) se necesita configurar Resend o SendGrid en **Project Settings → Auth → SMTP Settings** (requiere acceso a DNS del dominio).
