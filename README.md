# Club Pickleball Zaragoza · laboratorio de actividades y Liga CPZ

Este repositorio incluye la web de **RANKINGS CPZ** y una vista independiente de pruebas para diseñar el acceso al club y consultar la liga. **Este README describe la rama `experimental/laboratorio-cpz`, no sustituye las instrucciones de producción de `main`.**

## Laboratorio publicado

- Portada del club: https://lab-mobile.leagueos-cpz.pages.dev/
- Liga dentro del laboratorio: https://lab-mobile.leagueos-cpz.pages.dev/liga.html
- Web oficial, separada de los cambios experimentales: https://leagueos-cpz.pages.dev/

La portada muestra **Liga CPZ** y **Torneo de Héroes de Ebro Viejo** (nombre provisional), anunciado únicamente como proyecto **en preparación para diciembre de 2026**, con fotografías locales del club en `lab-assets/`. La fecha exacta, formato e inscripciones aún no están confirmados. Hay navegación de ida y vuelta entre portada y liga, diseño adaptable a móvil y modo oscuro automático.

## Qué funciona y qué es una demostración

**Liga** (`player.html` publicado como `liga.html`): grupos individuales y de dobles, clasificaciones provisionales y desempates, zonas potenciales de ascenso y descenso, partidos pendientes, marcadores reales por set y acceso a reservas de Taykus. La explicación de cada posición se abre con ⓘ. El navegador no tiene privilegios de escritura sobre D1.

**Torneo de Héroes de Ebro Viejo** (`club-portal.html`, `club-portal.js`, `tournament-groups.js`): simulación de **7 grupos de 4** (28 plazas). Los 20 nombres proceden directamente de los grupos A1, A2, A3, A4 y A5 de la **liga individual** en `lab-data.js`; las 8 plazas restantes usan personajes ficticios con nombres gamberros y se identifican visualmente como **inventados**. Los 20 nombres reales son **solo referencias para la maqueta, no personas inscritas**. La distribución es de prueba, no un sorteo ni una clasificación definitiva. La competición se prepara para diciembre de 2026 sin día, horario, sede, precios, modalidad concreta ni bases confirmadas y sin inscripción ni pagos. Los Drop-ins han sido retirados.

**Reservas:** dos códigos facilitados para **noviembre de 2026**, `RANKINGINDNOV26` y `RANKINGDOBNOV26`. Botones para copiar y para abrir https://pickleballzaragoza.taykus.com/bookingtypes. No se proporciona ni se simula un cupón aplicado automáticamente. La validez final depende de Taykus y del club.

## Fuente de resultados y aislamiento

El workflow `.github/workflows/laboratorio-movil.yml` solo responde a cambios de la rama `experimental/laboratorio-cpz` (o ejecución manual controlada). Construye una copia **estática** en `lab-static/dist/` y la publica en Cloudflare Pages, rama `lab-mobile`.

- `scripts/build-lab-snapshot.py` ejecuta **dos consultas SQL SELECT** sobre D1, filtradas a noviembre de 2026. No contiene instrucciones SQL de escritura ni exporta credenciales, cuentas o datos privados.
- La única credencial para la consulta es el secreto `CLOUDFLARE_D1_READ_TOKEN`, con permiso D1 Read. **No se utiliza el token de despliegue para consultar D1.**
- Sin ese secreto, o si falla la extracción, se conserva el `lab-results.js` vacío: **el laboratorio sigue publicándose sin inventar marcadores**. La vista informa de que la copia no está disponible.
- La fotografía y el escudo se guardaron como archivos locales en `lab-assets/` mediante el importador acotado a la rama experimental `.github/workflows/importar-fotos-lab.yml`. En ejecución el navegador carga **solo los archivos publicados**, sin depender del servidor de imágenes del club.
- La copia de partidos no se actualiza en tiempo real: se regenera al desplegar nuevamente. Es solo de consulta.

No modificar D1, la rama `main` ni producción desde cambios del laboratorio.

## Desarrollo y comprobaciones

Archivos principales: `club-portal.html`, `club-portal.css`, `club-portal.js`, `tournament-groups.js`, `player.html`, `league-lab.css`, `ranking-engine.js`, `lab-features.js`, `lab-data.js`, `lab-results.js`, `scripts/build-lab-snapshot.py` y `tests/`.

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
