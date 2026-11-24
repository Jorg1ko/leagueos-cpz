# Actualización de la vista de Liga CPZ · 24 noviembre 2026

## Alcance

Solo se sustituye la vista del jugador `player.html` con la estética del laboratorio, adaptada al acceso protegido y a la lectura real de `GET /api/shared/data`.

Se conserva el archivo anterior literalmente en `docs/backup/player-original-2026-11-24.html`, sin incluirlo en el artefacto desplegado. También puede restaurarse mediante un revert de Git.

## Funciones conservadas

- Acceso compartido mediante cookie, sin cambiar autenticación, permisos ni contraseñas.
- Clasificación individual y dobles con el motor existente `ranking-engine.js` (sin cambios).
- Listado de **todos los resultados**, filtros por modalidad y grupo.
- Partidos jugados y pendientes, desglose por sets, reglas de desempate y zonas de ascenso/descenso.
- Reservas Taykus, promociones actuales con copia de códigos, normas y enlaces a RFET.
- Actualizar datos y cerrar sesión.
- Administración y endpoints privados, sin modificaciones.

## Seguridad de datos

No se modifica `index.html`, `admin.js`, `functions/`, `rosters.js`, `ranking-engine.js` ni la base de datos D1. No se incluyen scripts del torneo, Drop-ins o grupos ficticios. No se hacen migraciones SQL ni cambios de esquema. La API de lectura es la misma que antes del cambio.

## Validación y reversión

Antes de publicar, se ejecutan los tests de ranking y autenticación ya existentes y una prueba nueva de preservación visual y funcional. El despliegue permanece condicionado a las comprobaciones de GitHub Actions.

Para revertir: restaurar `player.html` desde `docs/backup/player-original-2026-11-24.html` en un commit nuevo de `main`, ejecutar CI y volver a publicar el mismo sitio. Ese archivo NO contiene datos del servidor, solo código de la interfaz antigua.

**Nota:** El sistema utiliza una base de datos real; este cambio está restringido a HTML/CSS/JS de visualización. La verificación de la pantalla de jugadores después de su publicación debe realizarse con el acceso habitual, sin compartir la contraseña en el chat.
