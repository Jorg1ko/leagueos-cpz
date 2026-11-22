#!/usr/bin/env python3
"""Export ONLY November 2026 competition match summaries, never accounts or secrets.

This script never writes to D1. It runs in GitHub Actions, using an API
token from the GitHub Secrets environment, and writes a static lab snapshot.
"""
import datetime
import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.request

ACCOUNT = "91f1c143e0758ef69970b4d75629f605"
# Identificador cotejado con el flujo de recuperación D1 del repositorio oficial.
DB = "34356bf4-507b-4cc8-8de0-aca736e23cf9"
ENDPOINT = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB}/query"
OUTPUT = pathlib.Path("lab-static/dist/lab-results.js")
ROSTERS = pathlib.Path("rosters.js")
INDIVIDUAL_SQL = """
SELECT r.played_at AS date, r.round_label AS round,
       r.group_label AS groupLabel, a.player_name AS player1,
       b.player_name AS player2, r.sets_json AS setsJson
FROM cpz_match_results AS r
JOIN cpz_player_accounts AS a ON a.id = r.player_one_id
JOIN cpz_player_accounts AS b ON b.id = r.player_two_id
WHERE r.played_at >= '2026-11-01' AND r.played_at < '2026-12-01'
ORDER BY r.played_at DESC LIMIT 300
"""
DOUBLES_SQL = """
SELECT group_label AS groupLabel, pair_one AS pair1, pair_two AS pair2,
       played_at AS date, round_label AS round, sets_json AS setsJson
FROM cpz_doubles_results
WHERE played_at >= '2026-11-01' AND played_at < '2026-12-01'
ORDER BY played_at DESC LIMIT 200
"""

def roster(label):
    text = ROSTERS.read_text(encoding="utf-8")
    m = re.search(r"export const " + label + r"=(.*?);", text)
    if not m:
        raise RuntimeError("No se encontró el listado oficial del club")
    return json.loads(m.group(1))

def query(sql, token):
    # Whitelisted read-only SQL defined above, not user-controlled.
    if not sql.strip().upper().startswith("SELECT "):
        raise RuntimeError("Solo están permitidas consultas SELECT")
    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps({"sql": sql.strip()}).encode("utf-8"),
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            data = json.load(response)
    except urllib.error.HTTPError as exc:
        raise RuntimeError("Cloudflare D1 SQL consulta rechazada (HTTP " + str(exc.code) + "). Requiere D1 Read.") from None
    if not data.get("success") or not data.get("result") or not data["result"][0].get("success"):
        raise RuntimeError("Cloudflare D1 rechazó la consulta de solo lectura")
    return data["result"][0].get("results", [])

def parse_sets(raw):
    try:
        data = json.loads(raw)
        if not isinstance(data, list) or len(data) not in (2, 3):
            return None
        if not all(isinstance(s, list) and len(s) == 2 and all(type(p) == int and 0 <= p <= 99 for p in s) and s[0] != s[1] for s in data):
            return None
        return data
    except (ValueError, TypeError):
        return None

def main():
    token = os.environ.get("CF_TOKEN", "")
    if not token:
        raise RuntimeError("No hay token configurado para consulta D1")
    single_roster = roster("NOVEMBER_ROSTER")
    pair_roster = roster("NOVEMBER_DOUBLES")

    individual = []
    for row in query(INDIVIDUAL_SQL, token):
        group = str(row["groupLabel"]).strip().upper().removeprefix("GRUPO ")
        people = single_roster.get(group)
        sets = parse_sets(row.get("setsJson"))
        if people and sets and row.get("player1") in people and row.get("player2") in people and row["player1"] != row["player2"]:
            individual.append({
                "groupLabel":group,"player1":row["player1"],"player2":row["player2"],
                "date":row["date"],"round":row["round"],"sets":sets
            })

    doubles = []
    try:
        rows = query(DOUBLES_SQL, token)
    except RuntimeError as exc:
        # A missing doubles table is a known historical possibility, but do not
        # mask authentication failures as an empty competition.
        raise RuntimeError("No se pudieron consultar los resultados de dobles: " + str(exc)) from None
    for row in rows:
        group = str(row["groupLabel"]).strip().upper()
        teams = pair_roster.get(group)
        sets = parse_sets(row.get("setsJson"))
        try:
            a, b = int(row["pair1"]), int(row["pair2"])
        except (TypeError, ValueError, KeyError):
            continue
        if teams and sets and 0 <= a < len(teams) and 0 <= b < len(teams) and a != b:
            doubles.append({
                "groupLabel":group,
                "player1":" / ".join(teams[a]),
                "player2":" / ".join(teams[b]),
                "date":row["date"],"round":row["round"],"sets":sets
            })
    snapshot = {
        "available":True,
        "capturedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "individualResults":individual,
        "doublesResults":doubles,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("window.CPZ_LAB_RESULTS=" + json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"Consulta D1 de solo lectura completada. Partidos individuales: {len(individual)}; dobles: {len(doubles)}.")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("Aviso:", str(exc), file=sys.stderr)
        sys.exit(1)
