# EVIE · Aviso de privacidad (BORRADOR, requiere revisión jurídica)

> Escrito a partir de lo que el código hace hoy (2026-11-21). Todo lo marcado **[PENDIENTE]** lo debes llenar tú.
> Si EVIE es solo para ti y una persona invitada, quizá no necesites publicarlo; si lo abres a clientes (SOMA) o a más
> personas, sí. En México aplica la LFPDPPP; confírmalo con un abogado. Esto no garantiza cumplimiento.

## Responsable
- Nombre / razón social: **[PENDIENTE]**
- Domicilio y correo de contacto para privacidad: **[PENDIENTE]**
- País del responsable y de las personas usuarias: **[PENDIENTE]** (se asume México)

## Qué datos se tratan y para qué
| Datos | Para qué | Dónde se guardan |
|---|---|---|
| Usuario y contraseña (la contraseña la gestiona Supabase Auth, EVIE no la guarda) | Acceso a la cuenta | Supabase (EE. UU., us-east-1) |
| Registros del CRM: finanzas, agenda, hábitos, objetivos, gimnasio, comidas y calorías, granja, SOMA/clientes, aprendizaje, libros, contenido, vision board, compras | Que la app funcione y se sincronice entre tus dispositivos | Supabase, tabla `crm_records`, solo visible para tu cuenta |
| Perfil y preferencias (nombre preferido, saludo, zona horaria, ajustes) | Personalización | Supabase `profiles` / `user_preferences` |
| Contactos de EVIE (nombre, alias, WhatsApp, Instagram, notas) | "Mándale un mensaje a…" (solo abre WhatsApp prellenado) | Supabase `contacts` |
| Fotos que subes | Perfil, vision board, etc. | Supabase Storage privado `user-media` |
| Sesión, invitaciones, contadores de uso de IA | Seguridad y límites | Cloudflare D1 |
| Memoria de Ivi (recuerdos explícitos; historial de preguntas solo si lo activas) | Respuestas personalizadas | Cloudflare D1, cifrada |
| Tokens de Google Calendar (si conectas) | Leer y, si lo permites, crear eventos propios | Cloudflare D1, cifrados |
| Entradas de diario con Kisha (solo al confirmar) | Diario personal | Supabase `crm_records` (`journal`) |
| Datos de salud (peso, calorías, entrenamientos) y emocionales (diario) | Módulos Físico y Kisha | Supabase. **Son datos sensibles: [PENDIENTE] consentimiento expreso** |

**No se guarda:** audio de voz, historial de ubicaciones del mapa, ni la contraseña en tablas propias.

## Proveedores (encargados) que reciben datos
| Proveedor | Qué recibe | Cuándo |
|---|---|---|
| Supabase | Todo lo de la tabla de arriba marcado "Supabase" | Siempre (con cuenta) |
| Cloudflare | Tráfico de la app, sesión, memoria cifrada | Siempre |
| Groq | Audio, solo mientras se transcribe | Al hablar con EVIE/Kisha, si está configurado |
| OpenAI | Texto de tu pregunta, contexto necesario y recuerdos relevantes | Al usar el chat o la investigación |
| Fish Audio | Texto que EVIE va a leer en voz alta | Al usar voz, si está configurado |
| Google | Lo necesario para Calendar o para entrar con Google | Solo si lo conectas |
| Stadia Maps | Destino buscado y coordenadas de la ruta (sin historial) | Solo al usar el Mapa |
| Open-Meteo | Ubicación aproximada para el clima | Al pedir el clima |

Transferencias internacionales: Supabase, Cloudflare, OpenAI, Groq y otros procesan datos fuera de México. **[PENDIENTE] revisar cláusulas.**

## Almacenamiento en tu dispositivo
EVIE usa `localStorage`, IndexedDB y un service worker para funcionar sin conexión y no perder borradores.
Una cookie de sesión técnica (`__Host-evie-session`, 30 días máx.). **No hay analítica ni cookies de publicidad.**

## Conservación y borrado
- Mientras la cuenta exista. Borrar la cuenta en Supabase borra en cascada perfiles, preferencias, registros y contactos.
- Invitados temporales: acceso y datos se eliminan al vencer las 72 h.
- Respaldos: **[PENDIENTE]** (el plan gratis de Supabase no incluye copias descargables; ¿harás exportaciones?).

## Tus derechos (ARCO)
Acceder, rectificar, cancelar u oponerte. EVIE ya permite exportar y borrar la memoria de Ivi desde la app.
Para lo demás: **[PENDIENTE] medio y plazo de respuesta.**

## Menores
**[PENDIENTE]** EVIE no está pensada para menores de edad.

## Esto NO es lo mismo que la seguridad técnica
El aviso explica qué se hace con los datos. La protección real la dan las políticas RLS y los permisos de la base
(`docs/SUPABASE-SETUP.md`, `tests/supabase-rls-check.sql`).
