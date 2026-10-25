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
