# LeagueOS CPZ · Administración

Esta instalación utiliza Cloudflare Pages Functions y Cloudflare D1. Los resultados y la clasificación son públicos, pero la escritura se comprueba exclusivamente en el servidor.

## Variables requeridas en Cloudflare Pages (producción)

- `ADMIN_PASSWORD`: **secreto cifrado**, de 12 caracteres o más. No almacenar su valor en GitHub, código fuente, documentación ni variables visibles.
- `LEAGUE_DB`: binding **D1 database** a la base de datos de producción de LeagueOS.
- `LEAGUE_DEMO`: **no configurar en producción**. Si se usa el valor `true`, se habilita la simulación ficticia exclusivamente para pruebas.

Después de cambiar un secreto o un binding, es necesario desplegar de nuevo la web para que la nueva configuración se refleje en el entorno de producción.

## Endpoints de verificación sin credenciales

- `GET /api/session`: indica `ready` y `authenticated`. En modo preparación también devuelve banderas booleanas `setup.databaseConnected` y `setup.adminPasswordConfigured`, **nunca el valor del secreto**.
- `GET /api/state`: devuelve la clasificación actual y su revisión para consulta pública.

Con ambas variables configuradas y el despliegue completado, `/api/session` debe devolver `ready:true`. El navegador permite entrar a `Administración` y, tras el inicio de sesión, registrar resultados desde `Partidos`.

## Reglas del acceso

- Cookie de sesión `HttpOnly`, `Secure`, `SameSite=Strict`, con duración máxima de ocho horas.
- La API no acepta cambios de resultados sin una sesión válida; cambiar botones en HTML no concede permisos.
- Marcadores enteros entre 0 y 99, sin empates.
- Los 60 encuentros deben estar completados antes de cerrar el periodo.
- Una revisión de la liga evita sobrescribir a ciegas cambios que se hayan guardado en otra pestaña.
- Un límite de intentos fallidos protege el inicio de sesión.

## Antes de poner en marcha la liga real

1. Confirmar reglamento y criterios de desempate.
2. Sustituir jugadores ficticios por inscripciones autorizadas.
3. Preparar backups de Cloudflare D1.
4. Comprobar acceso y actualización de resultados entre dos navegadores.
5. Confirmar permiso para el uso del nombre, emblema y fotografías del club.

## URL

https://leagueos-cpz.pages.dev

Nota: esta demo aún muestra jugadores de prueba. No introducir datos personales reales hasta completar el despliegue de producción y los controles de privacidad.


## Papelera y recuperación (fase 1 pendiente de revisión)

Se ha preparado un PR separado que sustituye el borrado físico de partidos individuales y dobles por marcado reversible (`deleted_at`) y añade auditoría de creación, edición, borrado y restauración. **Este comportamiento solo estará disponible tras migración autorizada y despliegue compatible.** No dar por supuesto que ya está activo en producción.

Tras su aprobación, para recuperar un partido enviado a la papelera:
1. Entrar como administrador y abrir la sección **Resultados** o **Dobles**.
2. Buscar el cruce en la **Papelera** y pulsar **Restaurar**.
3. Verificar que reaparece en resultados activos y que la clasificación se recalcula. La API registra la restauración en el historial.

Si no aparece, no repetir altas ni ejecutar manualmente SQL sobre la base real: revisar primero el historial y la copia cifrada, previa autorización. Guía íntegra de preparación, controles y marcha atrás: `docs/fase1-proteccion-d1.md`.
