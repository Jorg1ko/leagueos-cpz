# Fase 1 · Protección reversible de resultados CPZ

**Estado: preparado en PR; no aplicado a la base real ni publicado.**

Rama origen: `experimental/laboratorio-cpz`. Rama de trabajo: `phase1/proteccion-datos-reversible-20261122`.
No fusionar con `main` ni ejecutar `provision-d1.yml`.

## Riesgo corregido en el código

- Los antiguos `DELETE FROM cpz_match_results` y `DELETE FROM cpz_doubles_results` de las APIs se sustituyen por `UPDATE deleted_at=CURRENT_TIMESTAMP`.
- El middleware deja de vaciar resultados, cuentas, contactos y clasificación heredada durante la inicialización.
- Las lecturas activas en APIs de administración, consulta compartida y laboratorio excluyen `deleted_at IS NOT NULL`.
- `GET /api/results?trash=1` y `GET /api/doubles-results?trash=1` muestran **únicamente en administración** resultados borrados. `POST` con `{"action":"restore","id":N}` restaura una fila, conservando su ID. Los endpoints existentes y el JSON de resultados activos se mantienen compatibles.
- `cpz_result_audit` registra cada operación manual, de importación, de dobles y de restauración en la misma transacción que modifica el resultado.

## Esquema y comprobaciones previas (solo lectura)

**Inspección real de solo lectura completada el 22 de noviembre de 2026:** se consultó `sqlite_schema` y `COUNT(*)` mediante cuatro sentencias `SELECT` utilizando el permiso D1 Read. La tabla `cpz_match_results` tenía **30 filas** y `cpz_doubles_results` **11 filas**. Los campos y restricciones UNIQUE observados coinciden con las definiciones existentes; `deleted_at` no estaba presente en ninguna de ellas. Los índices observados son `sqlite_autoindex_cpz_match_results_1` (UNIQUE por `match_key`) y `sqlite_autoindex_cpz_doubles_results_1` (UNIQUE por `group_label,pair_one,pair_two`). Evidencia: ejecución de GitHub Actions [inspección D1 de solo lectura](https://github.com/Jorg1ko/leagueos-cpz/actions/runs/44983630076).

**Antes de ejecutar la migración**, volver a contrastar esquema y recuentos por si han cambiado desde esta inspección. Consultas SQL recomendadas, sin modificaciones:

```sql
PRAGMA table_info(cpz_match_results);
PRAGMA table_info(cpz_doubles_results);
PRAGMA index_list(cpz_match_results);
PRAGMA index_list(cpz_doubles_results);
SELECT COUNT(*) AS total FROM cpz_match_results;
SELECT COUNT(*) AS total FROM cpz_doubles_results;
```

Comprobar que `deleted_at` **no existe aún** y que los resultados esperados siguen presentes; si no coincide, **detenerse** y adaptar la migración, nunca ejecutarla a ciegas.

## Migración aditiva sin DROP

- `migrations/2026-11-22_soft_delete_audit.sql`: añade `deleted_at` a las dos tablas y crea `cpz_result_audit` más su índice.
- `migrations/2026-11-22_soft_delete_audit_rollback.sql`: restauración **lógica** de filas con `deleted_at=NULL`, no elimina columnas ni historial.

La migración se prueba sobre SQLite en memoria en `tests/phase1-results-protection.test.mjs` (creación, edición, importación, borrado, restauración, auditoría y recálculo de clasificación, ambos modos). El test nunca consulta la base real.

**Comando para aplicar a D1 remota, SOLO cuando lo autorices, tras una copia completa, cifrada, recuperable y verificada:**

```bash
npx wrangler@4 d1 execute leagueos-cpz-db --remote --file=./migrations/2026-11-22_soft_delete_audit.sql
```

La sesión Wrangler debe apuntar a la cuenta Cloudflare correcta, con acceso autorizado, sin publicar credenciales. **NO ejecutar ahora.** Solo después de inspeccionar el esquema, validar el respaldo y recibir autorización específica para tocar D1. A continuación habría que desplegar **en una operación separada y autorizada** las APIs nuevas; el código nuevo espera las columnas de la migración. Un despliegue sin migración haría fallar las consultas.

**Vuelta atrás:** detener nuevas modificaciones, verificar copia, usar `migrations/2026-11-22_soft_delete_audit_rollback.sql` en una base de pruebas, comprobar filas restauradas y solo entonces volver a una versión compatible de la aplicación. El deshacer no destruye el historial; la aplicación antigua no entiende la papelera.

## Copias nocturnas (preparadas, NO activadas)

Workflow `.github/workflows/d1-backup-cifrada.yml`:
- `schedule` a las **02:20 UTC** cada día y `workflow_dispatch` para inicio manual;
- un control adicional `vars.CPZ_D1_BACKUP_APPROVED == 'true'` impide iniciar si no se aprueba explícitamente;
- utiliza **únicamente** el secreto específico `CLOUDFLARE_D1_BACKUP_TOKEN`, nunca el de Pages ni el de lectura del laboratorio;
- exporta un SQL completo, comprueba que no esté vacío y que contiene las tablas de resultados; si falla, **no sube ninguna copia**;
- **cifra el contenido con age antes de subirlo** a GitHub (repositorio público); la clave privada nunca entra en GitHub;
- antes de cifrar, el SQL se carga en **SQLite temporal en memoria** para comprobar que es reconstruible, contiene ambas tablas y supera `PRAGMA quick_check`; los recuentos se muestran sin exponer datos personales;
- el archivo temporal sin cifrar se mantiene con permisos restringidos fuera del workspace del repositorio y se elimina al terminar el paso o ante un error de cifrado;
- CI verifica **sin red ni credenciales** el rechazo de archivos vacíos, incompletos y corruptos, y un ciclo age de cifrado y descifrado con claves desechables; este test **no prueba aún la restauración real** de una copia del club;
- guarda artefactos `.sql.age` con `retention-days:14`. Para una ejecución diaria se conservan normalmente las copias de los últimos 14 días. Una ejecución manual crea una copia adicional; la retención por días no garantiza un recuento exacto de 14 artefactos;
- no realiza consultas SQL de escritura ni modificaciones explícitas de filas. **Advertencia:** la exportación D1 requiere permiso D1 Write y puede bloquear temporalmente consultas, aunque solo genere una copia.

**Limitación importante de GitHub:** la programación `schedule` de GitHub Actions se activa únicamente en la rama predeterminada. Como la predeterminada actualmente es `main` y este trabajo **no puede tocarla**, la copia nocturna queda **preparada pero inactiva** en el PR. Para programarla realmente habrá que autorizar una instalación en `main` o escoger un programador externo sobre una rama aislada. Tampoco se ha lanzado ninguna exportación manual.

### Permisos exactos y configuración sin compartir secretos

**Token dedicado para copias**: en Cloudflare, perfil → **API Tokens** → **Create Token** → **Custom token**. Elegir **Account → D1 → Write** (en algunas pantallas, **Edit**), limitar recursos a la cuenta que contiene `leagueos-cpz-db` y, si el panel lo permite, únicamente esa base. No añadir permisos Pages, Workers, DNS ni otras APIs. Es un permiso potente: Cloudflare lo requiere para exportar; no equivale a D1 Read.

En GitHub, Settings → Secrets and variables → Actions → Secrets, crear `CLOUDFLARE_D1_BACKUP_TOKEN`, con su valor **directamente en la interfaz**, nunca en código, PR ni chat.

**Cifrado necesario** debido a la visibilidad pública del repo: generar fuera de GitHub un par age (`age-keygen -o cpz-d1-recovery-key.txt`). Conservar la **clave privada fuera del repositorio**, idealmente en un gestor seguro y con otra copia offline; no incluirla en mensajes. Guardar únicamente el destinatario público `age1...` como secreto Actions `D1_BACKUP_AGE_RECIPIENT`. Este procedimiento permite recuperar las copias: `age -d -i cpz-d1-recovery-key.txt cpz-d1-export.sql.age > restored.sql` (solo en entorno seguro y autorizado). La restauración a D1 **no forma parte** de esta fase ni se debe ejecutar automáticamente.

Una vez revisado todo y con autorización separada para que se acceda a la base real, crear en GitHub Actions → Variables `CPZ_D1_BACKUP_APPROVED=true` y configurar el disparador automático de forma autorizada.

**Retención:** en GitHub Actions los artefactos expiran automáticamente al plazo indicado, pero solo está cifrado su **contenido**; los metadatos del artefacto no son secretos. Si se exige exactamente mantener los últimos 14 respaldos incluyendo ejecuciones manuales, usar un almacenamiento privado con política de retención numérica y revisión aparte.

Fuentes externas: https://developers.cloudflare.com/d1/observability/debug-d1/ y https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows .

## Protocolo ante borrado accidental

1. En el panel **Administración → Resultados** o **Dobles**, abrir la **Papelera**.
2. Identificar el resultado por jugadores/parejas, grupo y fecha. Pulsar **Restaurar**.
3. La API quita `deleted_at`, conserva el ID y añade un evento `restore` al historial de auditoría.
4. Volver a la clasificación para comprobar que el marcador y el partido pendiente se recalculan.
5. Si el partido no aparece en la papelera, **no recrear a ciegas**: revisar historial y copia verificada, sin restaurar la base completa salvo autorización.

## Pruebas, publicación y alcance

- `node --check` sobre JS; `ast.parse` para Python; tests de `tests/` y comprobación de JS inline en el workflow de CI del PR.
- No se realizan escrituras a D1 real.
- Ningún PR se fusiona si fallan pruebas. El PR de fase 1 **no despliega producción ni el laboratorio** hasta que se integre expresamente a la rama objetivo.
- NO se realizan cambios de contraseñas, regeneraciones de D1, `DROP` ni ejecución de `provision-d1.yml`.


## Intento único de respaldo real — 22 de noviembre de 2026

Con autorización explícita se inició un workflow **temporal** y limitado al PR #34: [ejecución de copia 45064932463](https://github.com/Jorg1ko/leagueos-cpz/actions/runs/45064932463).

**Resultado: NO SE OBTUVO COPIA.** Cloudflare rechazó la petición inicial a su API de exportación con **HTTP 401 Unauthorized**. El workflow terminó antes de descargar o cifrar SQL, y GitHub confirmó **cero artefactos** para esa ejecución. El archivo de workflow que permitía ese intento se eliminó de la rama de fase 1 en el commit `4d69b5eec0c30ad153be71b9b6a8083d5aec800c`, para impedir ejecuciones posteriores. No se ejecutaron migraciones, SQL de escritura ni despliegues. El token no se compartió ni se imprimió en los logs.

**Acción pendiente:** revisar si el secreto `CLOUDFLARE_D1_BACKUP_TOKEN` contiene un token API activo y correcto, con permiso **Account → D1 → Edit (Write)** y acceso a la cuenta de la base. Un HTTP 401 apunta a un problema de autenticación, aunque el alcance exacto debe verificarse; no da derecho a concluir que el token esté simplemente mal copiado.

**Puerta de seguridad:** sigue prohibido aplicar la migración mientras no exista una copia real cifrada, descargable y comprobable. No repetir la exportación ni activar copias programadas sin nueva autorización específica.


### Diagnóstico posterior, sin exportación

Se ejecutó una comprobación temporal, **solo GET**, del secreto configurado en GitHub. Evidencia: [diagnóstico 45065116329](https://github.com/Jorg1ko/leagueos-cpz/actions/runs/45065116329). Resultado:

- `GET /user/tokens/verify`: HTTP 401, error Cloudflare `1000`.
- `GET /accounts/<cuenta>/tokens/verify`: HTTP 401, error Cloudflare `1000`.
- `GET /accounts/<cuenta>/d1/database/<base>` (sin SQL): HTTP 401, error Cloudflare `10000`.

Es una **evidencia de problema de autenticación o permisos** del token almacenado; no se puede distinguir todavía si es un valor incorrecto, un token inactivo o un permiso/recurso mal configurado. Nunca se imprimió el token ni se realizó exportación en este diagnóstico. El workflow temporal de diagnóstico fue eliminado en el commit `767a2cb04f3173611b233ba856424bfeede354e8`.

Próximo paso: usuario debe sustituir por su cuenta el valor de GitHub Actions `CLOUDFLARE_D1_BACKUP_TOKEN` por un **token API activo y completo, sin el prefijo `Bearer`**, con permiso **Account / D1 / Edit** para la cuenta donde reside la base. Si no conserva el valor original, generar otro token desde el panel de Cloudflare. **No compartir tokens en la conversación ni en commits.** No repetir la exportación sin nueva autorización explícita.
