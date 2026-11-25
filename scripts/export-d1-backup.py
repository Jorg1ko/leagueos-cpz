#!/usr/bin/env python3
"""Exporta D1 mediante API oficial. NO ejecuta SQL ni importa datos.

SOLO invocado tras aprobación expresa por el workflow de backups.
Se requiere token dedicado D1 Write: Cloudflare exige ese permiso porque
la exportación completa bloquea temporalmente consultas a la base.
Jamás registrar cabeceras, URLs firmadas ni datos personales en logs.
"""
import json
import os
import pathlib
import sqlite3
import sys
import time
from urllib.parse import urlsplit
import urllib.error
import urllib.request

ACCOUNT = "91f1c143e0758ef69970b4d75629f605"
DATABASE = "34356bf4-507b-4cc8-8de0-aca736e23cf9"
URL = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DATABASE}/export"
OUTPUT = pathlib.Path(os.environ.get("D1_EXPORT_OUTPUT", "cpz-d1-export.sql"))


def request_export(token, bookmark):
    payload = {"output_format": "polling"}
    if bookmark:
        payload["current_bookmark"] = bookmark
    req = urllib.request.Request(
        URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=65) as response:
            result = json.load(response)
    except urllib.error.HTTPError as err:
        raise RuntimeError("Exportación D1 rechazada (HTTP " + str(err.code) + "). Comprobar permiso D1 Write.") from None
    if not result.get("success"):
        raise RuntimeError("La API Cloudflare D1 rechazó la exportación.")
    return result.get("result") or {}



def validate_local_export(path):
    """Valida el volcado en SQLite EFÍMERO, sin acceso de red ni a la D1 original.

    La única evidencia definitiva de recuperación será restaurar y descifrar
    posteriormente una copia con la clave privada fuera de GitHub.
    """
    if not path.is_file() or path.stat().st_size < 1024:
        raise RuntimeError("Copia D1 vacía o anormalmente pequeña: copia no válida.")
    try:
        sql = path.read_text(encoding="utf-8")
    except UnicodeError:
        raise RuntimeError("La copia descargada no es SQL UTF-8.") from None
    if "CREATE TABLE" not in sql.upper():
        raise RuntimeError("La copia descargada no contiene definiciones de tablas.")
    # El volcado se ejecuta SOLO en una base SQLite temporal en memoria.
    # No existe conexión ni posibilidad de escritura a D1 durante esta verificación.
    conn = sqlite3.connect(":memory:")
    try:
        conn.executescript(sql)
        counts = {}
        for table in ("cpz_match_results", "cpz_doubles_results"):
            found = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)
            ).fetchone()
            if not found:
                raise RuntimeError("La copia no contiene la tabla " + table)
            counts[table] = conn.execute("SELECT COUNT(*) FROM " + table).fetchone()[0]
        check = conn.execute("PRAGMA quick_check").fetchone()
        if check is None or check[0] != "ok":
            raise RuntimeError("La base local reconstruida no ha superado quick_check.")
        return counts
    except sqlite3.Error:
        raise RuntimeError("El SQL exportado no se puede reconstruir en SQLite temporal.") from None
    finally:
        conn.close()


def export():
    token = os.environ.get("CF_BACKUP_TOKEN", "")
    if not token:
        raise RuntimeError("Falta el secreto específico de copias. No se ha exportado nada.")
    # Nunca validar ni subir un archivo obsoleto de una ejecución previa.
    OUTPUT.unlink(missing_ok=True)
    bookmark = None
    signed_url = None
    for _ in range(45):
        status = request_export(token, bookmark)
        if status.get("status") == "error":
            raise RuntimeError("Cloudflare D1 informó un error durante la exportación.")
        if status.get("status") == "complete":
            signed_url = (status.get("result") or {}).get("signed_url")
            break
        bookmark = status.get("at_bookmark") or bookmark
        time.sleep(2)
    if not signed_url:
        raise RuntimeError("La exportación D1 no finalizó o no devolvió archivo.")
    if urlsplit(signed_url).scheme != "https":
        raise RuntimeError("Cloudflare devolvió un enlace de descarga no seguro.")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    try:
        # El enlace firmado tiene caducidad y NO se imprime nunca.
        with urllib.request.urlopen(signed_url, timeout=95) as response, OUTPUT.open("wb") as out:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)
    except Exception:
        OUTPUT.unlink(missing_ok=True)
        raise RuntimeError("No se pudo descargar el export SQL de D1.") from None

    try:
        counts = validate_local_export(OUTPUT)
    except Exception:
        OUTPUT.unlink(missing_ok=True)
        raise
    print("Exportación comprobada en SQLite temporal; tamaño bytes:", OUTPUT.stat().st_size)
    print("Recuentos locales verificados (individual/dobles):",
          counts["cpz_match_results"], counts["cpz_doubles_results"])


if __name__ == "__main__":
    try:
        export()
    except Exception as exc:
        print("ERROR DE COPIA:", str(exc), file=sys.stderr)
        sys.exit(1)
