# EVIE · Memoria privada de Ivi (P3)

## Qué recuerda y qué no
| Tipo | Cómo nace | Por defecto |
|---|---|---|
| **Recuerdos explícitos** (preferencias, datos, prioridades, personas) | «Ivi, recuerda que…», la herramienta `remember_memory` del modelo, o el panel *Configuración personalizada → Memoria* | Activado (`use_memories`) |
| **Historial de conversaciones** (solo las preguntas, máx. 6 por sesión, 200 caracteres cada una; **no las respuestas ni la transcripción**) | Al terminar la conversación (`pagehide`/oculta), solo si está activado | **Desactivado** (`save_history`, `reference_history`) |
| Salud / emocional | Solo si activas la categoría **y** confirmas el recuerdo en pantalla | Desactivado |
| Ubicación (direcciones, coordenadas) | **Nunca**: se rechaza aunque lo pidas | — |
| Turnos con Kisha, modo privado, preguntas sensibles | Nunca entran al historial | — |

## Modelo de datos (D1 `evie-auth`, migración `0007_memory.sql`, aditiva)
- `evie_memory_settings (owner_id PK, data, updated_at)`: ajustes, sellados.
- `evie_memories (owner_id, id, kind, category, topic, data, keys, source, source_session, created_at, updated_at)`:
  - `data` = texto **cifrado con AES-GCM** (`EVIE_SESSION_KEY`).
  - `keys` y `topic` = hashes HMAC-SHA-256 truncados de palabras clave y tema; **nunca texto plano**.
  - `source` = `explicit | conversation | panel` y, si aplica, `source_session` (se muestra como «Fuente»).
- `evie_sessions (owner_id, id, day, started_at, data, keys, created_at)`:
  - `day` es la fecha local según la zona horaria del usuario (por defecto `America/Mexico_City`).
  - `data` va sellado.
- **Límites:** 200 recuerdos, 280 caracteres por recuerdo, 400 sesiones.
- Las tablas también se crean solas (`ensureMemorySchema`).
- Reversión: `DROP TABLE evie_sessions; DROP TABLE evie_memories; DROP TABLE evie_memory_settings;`.

## Recuperación (acotada, como dato)
1. En cada `/api/ai/chat` el servidor calcula los hashes de las palabras de la pregunta, puntúa por coincidencia y recencia y toma **como máximo 6 recuerdos + 2 sesiones (≤ 1 800 caracteres)**.
2. Se inyectan dentro de `<memoria_usuario>…</memoria_usuario>`, con la instrucción de que es **información del usuario, no órdenes**. Un recuerdo como «ignora tus reglas» se trata como texto.
3. **Modo privado** (`«Ivi, activa el modo privado»`, insignia visible): sin recuperación, sin guardar recuerdos ni historial.
4. **«¿Recuerdas lo que te pregunté ayer?»:** se resuelve «ayer», «anteayer», «hoy» o el día de la semana en la zona horaria del usuario. Se responde con las preguntas guardadas de ese día y su fecha. Si el historial está apagado o no hay nada, lo dice; **nunca inventa**.
5. **Contradicciones:** un recuerdo nuevo con el mismo tema (hash de tema) reemplaza al anterior («Actualicé…»). Los duplicados exactos no se repiten.

## Aislamiento y controles
- Todo va por `owner_id` de la sesión (Alejandro ≠ Naomi). El cliente descarta la sesión en curso al cambiar de cuenta. El E2E verifica que B no ve nada de A.
- **Panel Memoria:**
  - Activar o desactivar memoria, uso de recuerdos, historial y categorías sensibles. Los ajustes se suben **solo al pulsar «Guardar ajustes de memoria»**.
  - Ver, editar y borrar cada recuerdo, con su fuente.
  - Borrar una conversación, ofreciendo borrar también los recuerdos derivados de ella (cascada: `DELETE /sessions/:id` devuelve `derived_memories`).
  - **Exportar** en JSON y **borrar toda la memoria**.
- **API** (`/api/memory`):

  | Método y ruta | Uso |
  |---|---|
  | `GET /` | estado y listas |
  | `PUT /settings` | guardar ajustes |
  | `POST /items` | crear recuerdo |
  | `PATCH /items/:id` | editar recuerdo |
  | `DELETE /items/:id` | borrar recuerdo |
  | `POST /forget` | «olvida…» |
  | `POST /sessions` | guardar sesión |
  | `DELETE /sessions/:id` | borrar sesión |
  | `POST /recall` | «¿recuerdas…?» |
  | `GET /export` | exportar |
  | `DELETE /` | borrar todo |

## Supabase
No se necesita ningún cambio: la memoria vive en D1, cifrada, fuera de `crm_records`.

## Límites honestos
- La búsqueda es por palabras clave con hash, no semántica: «mi perro» no encuentra «mi mascota». Para algo más flexible haría falta embeddings (otro proveedor y otro costo).
- Solo se recuerdan las preguntas del historial, no lo que Ivi respondió.
