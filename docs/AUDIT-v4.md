# EVIE CRM V2 · Auditoría de datos v4 (Supabase + Cloudflare D1)

Fecha: 2026-10-16. Lo revisé leyendo las migraciones del repositorio y el código. **No me conecté al proyecto
Supabase real** (aquí no hay credenciales). Antes de cambiar nada en producción, confirma este inventario con el paso 1.

## 1. Respaldo antes de cualquier migración (obligatorio)

```bash
# En TU computadora (nunca en el navegador ni en el repo)
export SUPABASE_URL=https://<proyecto>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<clave service role>
node scripts/supabase-export.mjs ~/evie-respaldos           # solo lee; escribe un JSON con huellas SHA-256
node scripts/supabase-restore.mjs ~/evie-respaldos/<archivo>.json   # simulación: verifica las huellas
# Restaurar de verdad (upsert por llave primaria, nunca borra):
node scripts/supabase-restore.mjs ~/evie-respaldos/<archivo>.json --apply
```

D1 (cuentas, sesiones, memoria): `npx wrangler d1 export evie-auth --remote --output=evie-auth-<fecha>.sql`.

## 2. Supabase — inventario

| Tabla | Llave | RLS | Política |
|---|---|---|---|
| `public.profiles` | `id` | activada | `own_profile` — solo `id = auth.uid()` |
| `public.user_preferences` | `user_id` | activada | `own_preferences` — solo `user_id = auth.uid()`; check `evie_state_shape_required` (version 4, profile/preferences objeto) |
| `public.crm_records` | `owner_id, collection, record_id` | activada | `own_records` — solo `owner_id = auth.uid()`; `collection` en lista permitida; `transactions.amount` entero ≥ 0 |
| `public.sync_devices` | `user_id, device_id` | activada | `own_devices` |
| `public.contacts` | `owner_id, id` | activada | `own_contacts` |
| `storage.objects` (bucket `user-media`) | — | activada | lectura/escritura solo en la carpeta `auth.uid()/…`; `anon` bloqueado (restrictiva) |

Funciones: `evie_pull` (security invoker, filtra por `auth.uid()`), `evie_apply` (security definer con
`search_path=''`; valida revisión y forma).

Migraciones en `migrations/supabase/` (en orden): `202609250001_accounts`, `202609250002_media`,
`202609250003_validation_guards`, `202610130001_automations` (rollback en `rollback/202610130001_automations_down.sql`).
**Pendiente de verificar en el proyecto real:** que las cuatro estén aplicadas. Puedes comprobarlo en el SQL Editor:
`select collection, count(*) from public.crm_records group by 1;` y que la lista permitida incluya `automations`.

## 3. Cloudflare D1 (`AUTH_DB` = `evie-auth`)

Tablas: `auth_sessions`, `auth_attempts`, `auth_accounts`, `auth_invites`, `ai_usage`, `provider_tokens`,
`oauth_states`, `user_profiles`, `kisha_turns`, `google_auth_states`, `google_links`, `desktop_handoffs`,
`evie_memory_settings`, `evie_memories`, `evie_sessions`. Migraciones en `migrations/d1/0001…0007`.
v4 **no agrega** migraciones D1.

## 4. Nombres de secretos y variables (solo nombres; nunca valores)

Secretos (en `wrangler pages secret put`, nunca en el navegador): `OPENAI_API_KEY`, `GROQ_API_KEY`,
`FISH_AUDIO_API_KEY`, `FISH_AUDIO_VOICE_ID`, `SUPABASE_SERVICE_ROLE_KEY`, `EVIE_SESSION_KEY`, `EVIE_BOOTSTRAP_TOKEN`,
`GOOGLE_CLIENT_SECRET`, `STADIA_API_KEY`.
Variables públicas o de configuración: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `GOOGLE_CLIENT_ID`,
`EVIE_ACCOUNTS_ENABLED`, `EVIE_OPEN_SIGNUP`, `EVIE_PASSWORD_LOGIN`, `EVIE_GOOGLE_AUTH`, `EVIE_AUTH_DOMAIN`,
`EVIE_PUBLIC_ORIGIN`, `EVIE_LEGACY_OWNER_ID`, `EVIE_DAILY_LIMITS`, `EVIE_MAP_LIMITS`, `EVIE_MAP_STYLE_URL(_DARK)`,
`EVIE_MAP_TRAFFIC`, `EVIE_MODEL_FAST/SMART/RESEARCH`, `EVIE_WEB_SEARCH`, `FISH_AUDIO_MODEL`, `GROQ_STT_MODEL`,
`KISHA_MODEL`, `STADIA_BASE_URL`.
Verificado: `SUPABASE_SERVICE_ROLE_KEY` solo se usa en `src/accounts.js` (servidor, alta de cuentas). Ningún archivo de `public/` la menciona.

## 5. ¿v4 necesita migración? — No

Todo lo nuevo de v4 viaja dentro de colecciones que ya existen y de `user_preferences.payload` (JSON), así que
**no requiere cambios de esquema**:

| Función v4 | Dónde vive | Restricción relevante |
|---|---|---|
| Cuenta del movimiento (`evie_account`), `op_id`, `transfer_id`, `kind`, `in_baseline`, `adjust_reviewed_at` | `crm_records` / `transactions` | importe entero ≥ 0 en centavos ✔ (los traspasos usan dos filas positivas) |
| Cuentas, conciliaciones (`reconciliations[]`) | `preferences.evieAccounts` | JSON ✔ |
| Físico: sesiones rápidas, `muscle_override` | `crm_records` / `gymSessions` | colección permitida ✔ |
| Silueta del cuerpo | `preferences.fisicoPresentation` | JSON ✔ |
| Acciones de Ivi (agenda, SOMA, aprendizaje) | `agendaItems`, `clients`, `skills` | permitidas ✔ |
| Auditoría de Ivi (últimas 200, sin texto de notas) | `preferences.evieAudit` | JSON ✔ (tamaño acotado) |
| Temporizadores | `localStorage` del dispositivo (`<cuenta>-timers`) | no se sincroniza a propósito: la alarma suena en el dispositivo que la creó |
| Kisha relato largo | borrador local; al guardar va a `journal` (ya permitida) | transcripción ≤ 40 000 car. |

Si en el futuro se quiere sincronizar los temporizadores, la migración aditiva sería añadir `'timers'` a la
lista permitida de `crm_records.collection`, con su rollback que la retire (solo si no hay filas `timers`).

## 6. Aislamiento de cuentas (Alejandro/Dali y Naomi)

- El `Store` local usa una clave por cuenta (`EvieAccounts.storageKey()`), y la sincronización solo envía y recibe filas con `owner_id = auth.uid()`, garantizado por RLS.
- `EvieActions`, `EvieFinance`, `EvieFisico` y `EvieTimers` trabajan únicamente sobre el `Store` de la sesión activa. El servidor de IA nunca recibe los registros: solo los resultados que la herramienta devuelve al modelo.
- **Prueba manual recomendada antes de desplegar:**
  1. Entra con Naomi y registra un gasto.
  2. Entra con Alejandro en otro navegador.
  3. Confirma que ese gasto no aparece.
