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
| Migraciones Supabase | 0001 accounts · 0002 media · 0003 validation_guards · 0004 automations · 0005 hardening · **0006 guests_sync** (`202611220001`) | ✅ las 6 (0004–0006 aplicadas el 2026-11-21) |
| Tarea programada (pg_cron) | `evie-guest-purge` cada 15 min | ✅ |
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

### v6 (2026-11-21): invitados, Google, recuperación y sincronización
| Función | Cómo funciona | Estado |
|---|---|---|
| **Invitados de 72 h** | Ya **no necesitan la clave secreta**. El Worker crea al invitado con el alta normal y, con la sesión del propio invitado, llama a `evie_guest_register()`. Supabase guarda la fila en `evie_guests` y fija la caducidad (72 h, no se puede alargar). Al vencer o al terminarlo el propietario, una RLS restrictiva lo bloquea al instante en todas las tablas y `evie_apply`; `pg_cron` borra al usuario cada 15 min (en cascada: perfil, preferencias, registros, contactos). Los invitados no suben fotos a la nube: sus fotos se quedan en su dispositivo, así no quedan archivos huérfanos. Los usuarios `guest-…` están reservados. | ✅ listo |
| **Continuar con Google** | El Worker consulta a Supabase si el proveedor Google está encendido (`/auth/v1/settings`, caché de 5 min). Al activarlo en Supabase, el botón se habilita solo, **sin tocar Cloudflare**. | ✅ activo desde 2026-11-22 (ver «Estado de Google» abajo) |

### Estado de Google (2026-11-22)
- Google Cloud: proyecto **EVIE CRM** (`evie-crm-515505`), cliente OAuth web **«EVIE web (Supabase)»** con la
  redirección `https://mehhbdnxskfbortgglnd.supabase.co/auth/v1/callback`. Ámbitos: solo `openid email profile`.
- Supabase: proveedor Google encendido, **Allow manual linking** encendido, Site URL y Redirect URL de EVIE puestos.
- **La app de Google está en modo «Prueba»:** solo pueden entrar con Google las cuentas agregadas en Google Cloud →
  Google Auth Platform → **Público → Usuarios de prueba** (máx. 100). Para que **cualquiera** pueda crear su cuenta
  con Google hay que **publicarla**, y Google pide antes en **Información de la marca**: página principal
  (`https://evie-crm-v2.pages.dev`), enlace a un **aviso de privacidad público** y el dominio autorizado
  `evie-crm-v2.pages.dev`. El borrador está en `docs/PRIVACIDAD-BORRADOR.md` (le faltan tus datos de responsable).
- El secreto del cliente solo está en Supabase (y en el JSON que hayas descargado). Nunca va en el repositorio.

### v7 (2026-11-22): acceso solo con Google
| Pantalla | Qué hace |
|---|---|
| **Iniciar sesión** | «Continuar con Google». Abre la cuenta a la que pertenece esa cuenta de Google. |
| **Crear mi cuenta** | «Crear cuenta con Google». Cualquier cuenta de Google crea su propio espacio privado y vacío (sin código). Ya no existe el registro con usuario y contraseña. `EVIE_GOOGLE_SIGNUP=invite` en Cloudflare lo vuelve solo por invitación. |
| **Tengo un código de invitación** (pestaña pequeña) | Invitado de prueba por 72 h: solo nombre + código. |
| **¿Ya tenías usuario y contraseña?** | Solo para las 5 cuentas anteriores: entras **una vez** con tu usuario y te lleva directo a Google para unirlo a tu cuenta (tus datos no se mueven). Después esa cuenta **solo entra con Google**: la contraseña vieja se rechaza. Requiere **Allow manual linking** (paso 5). |

- **Importante para las cuentas anteriores:** usa primero «¿Ya tenías usuario y contraseña?». Si alguien entra
  directo con «Continuar con Google», se crea un espacio nuevo vacío para esa cuenta de Google, y esa cuenta de
  Google ya no se podrá unir al usuario anterior (sale el aviso «ya tiene su propio espacio»). Se puede arreglar a mano.
- Mientras Google no esté activo, la pantalla muestra el formulario de usuario abierto, así nadie se queda fuera.
- Interruptor de emergencia: `EVIE_GOOGLE_AUTH=false` en Cloudflare apaga Google y devuelve las contraseñas a todos.
- La recuperación con contraseña nueva («¿Olvidaste tu contraseña?») se retiró de la pantalla: ya no hay contraseñas.
- **Datos del celular:** un celular que guardó datos con una versión vieja (sin «automatizaciones») mostraba
  «No pudimos abrir tus datos · Colección v4 inválida: automations». Ya abre solo. Y si alguna vez una copia local no
  se puede leer, aparece **«Volver a bajar mis datos de la nube»** (guarda aparte la copia del dispositivo, no borra nada en la nube).
| **Sincronización entre dispositivos** | Cada cambio se sube ~1 s después. Cada dispositivo pregunta cada 15 s una huella barata de la cuenta (`evie_sync_stamp()`) y descarga solo si otro dispositivo cambió algo. Al volver a la app (celular) baja los cambios al instante. Ajustes de la app (tema, preferencias de EVIE, incluido el sonido de "pensando") van en la cuenta. | ✅ |
| **Fotos entre dispositivos** | Antes cada foto vivía solo en el navegador donde se subió. Ahora se suben a `user-media/<tu-id>/` (privado, con tu sesión) y otro dispositivo las descarga la primera vez que las muestra. Las fotos anteriores se suben solas la próxima vez que abras la app en el dispositivo que las tiene. | ✅ (en la app de Windows siguen locales) |

Lo que sigue siendo **por dispositivo** a propósito: temporizadores (para que la alarma no suene en todos), la última sección abierta, borradores sin guardar y las tarjetas abiertas del HUD.

### Activar Google (lo haces tú: requiere tu cuenta de Google y pegar un secreto)
1. https://console.cloud.google.com → crea o elige un proyecto → **APIs & Services → OAuth consent screen**:
   tipo *External*, nombre "EVIE", tu correo de soporte; ámbitos solo `openid`, `email`, `profile`.
   Agrega tu correo (y el de quien uses) en *Test users* o publica la app.
2. **Credentials → Create credentials → OAuth client ID → Web application**.
   *Authorized redirect URIs*: `https://mehhbdnxskfbortgglnd.supabase.co/auth/v1/callback`
3. Copia el **Client ID** y el **Client secret**.
4. Supabase → https://supabase.com/dashboard/project/mehhbdnxskfbortgglnd/auth/providers → **Google** → Enable →
   pega Client ID y Client secret → Save.
5. Supabase → Authentication → **Sign In / Providers** → activa **Allow manual linking** (para pasar las cuentas
   anteriores a Google con «¿Ya tenías usuario y contraseña?»).
6. Supabase → Authentication → **URL Configuration**:
   - Site URL: `https://evie-crm-v2.pages.dev`
   - Redirect URLs → Add: `https://evie-crm-v2.pages.dev/api/auth/google/callback**`
7. Espera 1 minuto y recarga EVIE: «Continuar con Google» ya no aparece gris.
8. En la pantalla de acceso abre **«¿Ya tenías usuario y contraseña?»**, entra con tu usuario y elige tu cuenta de
   Google. Desde ahí solo usas «Continuar con Google». Cada persona con cuenta anterior hace lo mismo una vez.
   Las personas nuevas solo tocan «Crear cuenta con Google».

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
  - Los invitados de 72 h **ya funcionan sin ella** (v6, ver arriba).
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
