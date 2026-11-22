# EVIE · Estado del backend (verificado 2026-11-21)

## Cómo está conectado
```
Navegador (PC / teléfono, PWA)  →  Cloudflare Pages "evie-crm-v2" (Worker /api)  →  Supabase "EVIE CRM V2"
                                              └→ Cloudflare D1 "evie-auth" (sesiones, invitaciones, memoria, tareas v5)
```
- El navegador **nunca** habla con Supabase ni ve sus tokens. Solo el Worker (`src/accounts.js`) lo hace, con la sesión del usuario.
  A diferencia de Intensity (catálogo público con `cloud.js` en el navegador), EVIE guarda datos privados.
- La "conexión" son dos variables del Worker: `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`. En producción ya están
  en Cloudflare → evie-crm-v2 → Settings → Variables and secrets. En local, en `.dev.vars`.
- Despliegue: cada push a `main` de GitHub `tekataki/EVIE-CRM-V2` publica en https://evie-crm-v2.pages.dev .

## Producción
| Pieza | Valor | Estado |
|---|---|---|
| Supabase | `EVIE CRM V2` · ref `mehhbdnxskfbortgglnd` · org dali-os · us-west-2 | ✅ activo |
| URL | `https://mehhbdnxskfbortgglnd.supabase.co` | |
| Clave pública | en Cloudflare (`SUPABASE_PUBLISHABLE_KEY`) y en `.dev.vars`; también en Supabase → Project Settings → API Keys | |
| Migraciones Supabase | 0001 accounts · 0002 media · 0003 validation_guards · 0004 automations · 0005 hardening | ✅ las 5 (0004 y 0005 aplicadas el 2026-11-21) |
| Cloudflare D1 `evie-auth` | tablas 0001–0008 (incluye v5: tareas, escenas, planes, invitados) | ✅ |
| Sitio en vivo | archivos iguales a `main` (commit 4cec587) | ✅ |
| Worker → Supabase | inicio de sesión falso responde "Usuario o contraseña no válidos" | ✅ conecta |

### Qué se arregló el 2026-11-21
1. **Automatizaciones**: la migración 0004 nunca se había aplicado. Crear un atajo hacía fallar el guardado y,
   como la sincronización va en un solo lote, también trababa los demás cambios de esa cuenta. Ya funciona.
2. **Endurecimiento** (0005): las funciones `evie_apply`, `evie_pull` y `evie_new_user` se podían llamar sin sesión
   (Supabase da permiso directo al rol `anon`). Ahora solo con sesión, y la de trigger con nadie.
   Las políticas RLS usan `(select auth.uid())`, que es más rápido.
3. Prueba de permisos en producción (se deshace sola, no tocó datos): visitante sin sesión bloqueado; un usuario
   nuevo no ve nada de nadie; no puede escribir sin `evie_apply`, ni editar filas ajenas, ni subir a la carpeta de
   otro; los atajos `javascript:` se rechazan. Los 104 registros existentes quedaron iguales.

### Avisos que quedan (no urgentes)
- Linter: `evie_apply` es `SECURITY DEFINER` y la ejecuta un usuario con sesión. **Es intencional**: es la única
  puerta de escritura, usa siempre `auth.uid()`, `search_path` vacío y sin SQL dinámico.
- Linter: *Leaked password protection* apagado (revisa contraseñas filtradas; en Supabase es de plan Pro).
- Supabase tiene 7 usuarios y D1 5 cuentas: los 2 extra son del 2026-09-28, antes de que existiera el registro de
  cuentas en D1, y tienen 0 registros. No estorban; se pueden borrar en Authentication → Users si quieres.
- `SUPABASE_SERVICE_ROLE_KEY` no está en Cloudflare. Sin ella:
  - El registro usa el alta pública de Supabase. Por eso "Allow new users to sign up" tiene que seguir encendido y
    "Confirm email" apagado. Alguien con la clave pública podría crear un usuario directo en Supabase, aunque solo
    vería sus propios datos vacíos. La clave no está en el frontend.
  - **Invitados de 72 h (v5) no funcionan**: canjear un código de invitado responde 503
    "Las invitaciones temporales requieren SUPABASE_SERVICE_ROLE_KEY". Las invitaciones normales sí funcionan.
  - Si la agregas (Supabase → Project Settings → API Keys → secret, como *Secret* en Cloudflare y redespliegas),
    puedes apagar "Allow new users to sign up" y el registro seguirá funcionando por invitación.

## Correr en tu PC (opcional; el sitio ya sirve en PC y teléfono)
`.dev.vars` apunta a **producción**: entras con tus cuentas reales y lo que guardes va a tus datos reales.
```powershell
npx wrangler d1 migrations apply evie-auth --local
npx vite --port 5188
```
Abre http://localhost:5188 (el 5173 lo usa otro proyecto tuyo).

## Teléfono
Abre https://evie-crm-v2.pages.dev → menú del navegador → **Agregar a pantalla de inicio** (PWA).
Mismas cuentas y mismos datos que en la PC: se sincronizan por Supabase.

## Repetir la prueba de permisos
Supabase → SQL Editor → pega `tests/supabase-rls-check.sql` → Run. El "error" final es el resultado (todo se deshace).

## Proyecto que sobra
El 2026-11-21 se creó por error un proyecto vacío `evie-crm` en otra cuenta de Supabase
(organización SOMA), antes de conectar la cuenta correcta. No tiene usuarios ni datos y nada apunta a él.
Puedes borrarlo desde esa cuenta: Project Settings → General → Delete project.

## Límites
- Plan gratis: Supabase pausa el proyecto tras 7 días sin uso (los proyectos "dali-os" y "DALI OS" ya están pausados).
- Sin copias descargables en el plan gratis: usa `scripts/supabase-export.mjs` para respaldos.
