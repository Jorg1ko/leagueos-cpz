# Club Pickleball Zaragoza · laboratorio de actividades y Liga CPZ

Este repositorio incluye la web de **RANKINGS CPZ** y una vista independiente de pruebas para diseñar el acceso al club y consultar la liga. **Este README describe la rama `experimental/laboratorio-cpz`, no sustituye las instrucciones de producción de `main`.**

## Laboratorio publicado

- Portada del club: https://lab-mobile.leagueos-cpz.pages.dev/
- Liga dentro del laboratorio: https://lab-mobile.leagueos-cpz.pages.dev/liga.html
- Web oficial, separada de los cambios experimentales: https://leagueos-cpz.pages.dev/

La portada muestra **Liga CPZ** y **CPZ Open** (nombre oficial indicado por el cartel compartido), previsto para el **12 de diciembre de 2026**, con fotografías locales del club en `lab-assets/`. La fecha indicada en el cartel es **12 DIC**; el año 2026 viene del contexto del torneo en el laboratorio. El formato concreto de la maqueta, los horarios, las inscripciones y los datos de participantes siguen en fase de prueba. Hay navegación de ida y vuelta entre portada y liga, diseño adaptable a móvil y modo oscuro automático.

## Portada de Liga CPZ

El laboratorio incluye `lab-assets/liga-cpz-poster.webp`, una imagen nueva de la liga con los colores del club, trofeo y pelota de pickleball. Se muestra en la tarjeta de **Liga CPZ** de la portada, con la misma altura de imagen que la tarjeta CPZ Open y sin recortar el diseño; la etiqueta de temporada se superpone en la esquina para no añadir una segunda cabecera. Dentro de la sección de acceso a clasificaciones y resultados se muestra con su proporción completa, también en móvil. Se conserva toda la información real de la liga y no se modifican `main`, la D1 de producción ni los resultados.

## Portada del CPZ Open

El laboratorio incluye `lab-assets/cpz-open-poster.webp`, una versión ligera del cartel visual creado a partir de la publicación compartida. Se muestra completo al abrir el torneo y como imagen de cabecera en su tarjeta de la portada; no sustituye el escudo ni las fotos de la liga. El recurso queda en el repositorio experimental y se publica mediante la copia ya existente de `lab-assets` en GitHub Actions.

## Vista de próximos partidos para televisión

Dentro de la sección **CPZ Open**, antes de la clasificación por grupos, se muestran los **siete partidos de ejemplo de la primera franja 09:00–09:20**, uno por pista. No aparecen como sección independiente en la portada. Los cruces y nombres derivan de `CPZTournamentDemo.firstWave`, la misma fuente que el calendario de los grupos A–G; no se duplican datos ni se inventan nuevos participantes. Pulsar **«Ver en TV»** o cualquiera de las siete tarjetas abre un panel de alto contraste y tipografía grande, optimizado para una televisión. Solicita la Fullscreen API tras el clic; cuando el navegador la impide, mantiene la vista ampliada como superposición. Se cierra con **Salir** o **Escape**. No hay autoavance, inscripción ni consulta de resultados adicionales. El día se muestra como **12 de diciembre de 2026**, de acuerdo con el cartel y el año previsto en el laboratorio; los horarios y enfrentamientos siguen marcados como **ejemplos no confirmados**. Sin cambios en D1 ni en `main`.

## Qué funciona y qué es una demostración

**Liga** (`player.html` publicado como `liga.html`): grupos individuales y de dobles, clasificaciones provisionales y desempates, zonas potenciales de ascenso y descenso, partidos pendientes, marcadores reales por set y acceso a reservas de Taykus. La explicación de cada posición se abre con ⓘ. El navegador no tiene privilegios de escritura sobre D1.

**CPZ Open** (`club-portal.html`, `club-portal.js`, `tournament-groups.js`): simulación de **7 grupos de 4** (28 plazas). Los 20 nombres proceden directamente de los grupos A1, A2, A3, A4 y A5 de la **liga individual** en `lab-data.js`; las 8 plazas restantes usan personajes ficticios con nombres gamberros. Se identifican como ficticios en el modelo interno, pero no se añaden etiquetas explicativas junto a los nombres en la vista pública. Los 20 nombres reales son **solo referencias para la maqueta, no personas inscritas**. La vista tiene un **desplegable** para elegir un solo grupo, con pista asignada de la 1 a la 7, clasificación provisional mediante el motor de la liga y desglose de PJ, PG, PP, sets y puntos, más los seis enfrentamientos de todos contra todos por grupo. Cada pista programa partidos ficticios de **20 minutos desde las 09:00 a las 11:00**, en paralelo (42 partidos en total), sin inventar marcadores ni horarios definitivos. La distribución es de prueba, no un sorteo ni una clasificación definitiva. La ficha señala que los horarios y las clasificaciones son provisionales, sin banner de laboratorio, leyendas de prueba ni acceso de administración simulado. La competición se prepara para el 12 de diciembre de 2026, sin horarios definitivos, sede, precios ni bases completos confirmados en la maqueta y sin inscripción ni pagos. Los Drop-ins han sido retirados.

**Reservas:** dos códigos facilitados para **noviembre de 2026**, `RANKINGINDNOV26` y `RANKINGDOBNOV26`. Botones para copiar y para abrir https://pickleballzaragoza.taykus.com/bookingtypes. No se proporciona ni se simula un cupón aplicado automáticamente. La validez final depende de Taykus y del club.

### Reglas del cartel compartido · CPZ Open

El cartel establece **formato tradicional**, en **individual y dobles**, con **grupos de 4** y estas reglas: **fase de grupos y primeras eliminatorias a 11 puntos**; **semifinal y final, un set a 15**. Las categorías son **4.5/5.0** (los dos primeros de grupo pasan a 5.0 y los dos últimos a 4.5) y **3.5/4.0** (los dos primeros pasan a 4.0 y los dos últimos a 3.5).

El cartel no indica cuántos grupos corresponden a cada modalidad/categoría, los nombres y parejas inscritos, los cruces concretos, las horas, las reglas para el tercer puesto, el ranking global 1–28 ni los pases directos. Por eso el modelo anterior de siete grupos individuales, 14+14 cuadros y ranking global se conserva únicamente como **simulación sin categoría asignada**, no como formato confirmado. No se crean parejas de dobles ni se inventan niveles personales.

### Cuadros experimentales por nivel (pendientes de validar)

La simulación anterior conserva dos cuadros de **14 participantes de ejemplo**: los **1.º y 2.º** van al nivel superior (puestos **1–14** en la simulación) y los **3.º y 4.º** van al inferior (puestos **15–28**). Esta numeración global es solo del laboratorio y todavía NO respeta la separación real por categorías y modalidades, que está pendiente. En cada cuadro se usan **6 cruces previos** y **2 pases directos** por mejor diferencia de puntos de la fase de grupos para formar cuartos de final de ocho jugadores. Si el corte de pases está empatado también en diferencia de sets y victorias, el sistema deja el desempate pendiente: no sortea ni inventa clasificados.

Los partidos de grupos y las primeras eliminatorias quedan marcados **a 11**, semifinales y final **un set a 15**, mientras que la puntuación del tercer puesto y de las clasificaciones adicionales sigue **por confirmar**, porque el cartel no la define. Además, el laboratorio muestra partidos por tercero y cruces de clasificación para todas las plazas: **5–8 y 9–14** dentro de cada cuadro. Los 6 eliminados en la previa disputan una fase propia para los puestos 9–14, con dos pases a semifinal por mejores estadísticas. Así cada jugador puede terminar con una **posición única del 1.º al 28.º** una vez registrados todos los resultados, sin limitarse a ordenar por diferencia de puntos. El modelo de estructura está en `tournament-brackets.js`. La web muestra las fases desplegables sin nombres ni resultados, y un listado completo de posiciones pendientes. Los resultados, horarios de eliminación y sistema de desempate definitivo no se han confirmado y **no** se guardan ni se importan a D1.

## Fuente de resultados y aislamiento

El workflow `.github/workflows/laboratorio-movil.yml` solo responde a cambios de la rama `experimental/laboratorio-cpz` (o ejecución manual controlada). Construye una copia **estática** en `lab-static/dist/` y la publica en Cloudflare Pages, rama `lab-mobile`.

- `scripts/build-lab-snapshot.py` ejecuta **dos consultas SQL SELECT** sobre D1, filtradas a noviembre de 2026. No contiene instrucciones SQL de escritura ni exporta credenciales, cuentas o datos privados.
- La única credencial para la consulta es el secreto `CLOUDFLARE_D1_READ_TOKEN`, con permiso D1 Read. **No se utiliza el token de despliegue para consultar D1.**
- Sin ese secreto, o si falla la extracción, se conserva el `lab-results.js` vacío: **el laboratorio sigue publicándose sin inventar marcadores**. La vista informa de que la copia no está disponible.
- La fotografía y el escudo se guardaron como archivos locales en `lab-assets/` mediante el importador acotado a la rama experimental `.github/workflows/importar-fotos-lab.yml`. En ejecución el navegador carga **solo los archivos publicados**, sin depender del servidor de imágenes del club.
- La copia de partidos no se actualiza en tiempo real: se regenera al desplegar nuevamente. Es solo de consulta.

No modificar D1, la rama `main` ni producción desde cambios del laboratorio.

## Desarrollo y comprobaciones

Archivos principales: `club-portal.html`, `club-portal.css`, `club-portal.js`, `tournament-groups.js`, `tournament-brackets.js`, `player.html`, `league-lab.css`, `ranking-engine.js`, `lab-features.js`, `lab-data.js`, `lab-results.js`, `scripts/build-lab-snapshot.py` y `tests/`.

Ejecutar **todos** los tests de Node, incluidos los de autenticación compartida que solo prueban funciones y no escriben en D1:

```bash
for file in tests/*.cjs tests/*.mjs tests/*.js; do
  if [ -f "$file" ]; then node "$file"; fi
done
for file in ./*.js; do
  if [ -f "$file" ]; then node --check "$file"; fi
done
python3 - <<'PY'
import ast, pathlib
for file in pathlib.Path("scripts").glob("*.py"):
    ast.parse(file.read_text(encoding="utf-8"), filename=str(file))
print("Sintaxis Python correcta")
PY
```

GitHub Actions comprueba las vistas, los scripts, los tests y las imágenes **antes** del despliegue. Si fallan, no debe integrarse ningún PR ni desplegarse esa versión.

## Pendiente, no incluido en este cambio

- Autenticación real, permisos por actividad, inscripciones reales del torneo, borrado de resultados y copias de seguridad D1.
- **Protección de la vista previa:** opciones a evaluar sin aplicar aún: Cloudflare Access con identidad y lista de correos autorizados (preferible), o un middleware de autenticación en Pages Functions/Worker. Una URL poco conocida y `noindex` **no son controles de seguridad**.
- **Propuesta de limpieza para un commit separado, sin ejecutar:** revisar y retirar `.github/workflows/recover-d1-20261109.yml` si se confirma que la exportación puntual de recuperación ya no es necesaria. Es un workflow histórico con permiso de lectura/exportación D1, disparado al modificarse su propio archivo y con retención del artefacto de solo un día. No debe eliminarse sin revisar primero que no se necesita para recuperación o auditoría. Cualquier retirada se hará únicamente con autorización y en un commit exclusivo.


## Fase 1 de protección de resultados (PR de revisión)

La protección reversible de resultados se desarrolla en una **rama separada**, sin tocar `main`, D1 real ni credenciales. Incluye auditoría, papelera y un workflow propuesto de copia cifrada. **No está instalada ni migrada en producción.** Ver `docs/fase1-proteccion-d1.md` antes de cualquier aprobación; la migración `migrations/2026-11-22_soft_delete_audit.sql` requiere copia verificada y consentimiento expreso. Las copias nocturnas permanecen desactivadas hasta autorización y no se ejecutan desde ramas no predeterminadas de GitHub Actions.
