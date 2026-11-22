"""Pruebas de copia D1 totalmente OFFLINE. No generan partidos ni usan credenciales."""
import importlib.util
import pathlib
import tempfile
import unittest

SOURCE = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "export-d1-backup.py"
spec = importlib.util.spec_from_file_location("cpz_d1_export", SOURCE)
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)

# Solo esquema vacío de test; sin jugadores ni resultados inventados.
VALID_EMPTY_SCHEMA = """
BEGIN TRANSACTION;
CREATE TABLE cpz_match_results (id INTEGER PRIMARY KEY AUTOINCREMENT);
CREATE TABLE cpz_doubles_results (id INTEGER PRIMARY KEY AUTOINCREMENT);
COMMIT;
""" + ("-- comentario de relleno para comprobar un archivo no truncado\n" * 30)


class BackupValidationTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = pathlib.Path(self.directory.name) / "export.sql"

    def tearDown(self):
        self.directory.cleanup()

    def write(self, content):
        self.path.write_bytes(content if isinstance(content, bytes) else content.encode("utf-8"))

    def test_valid_local_sql_can_be_reconstructed(self):
        self.write(VALID_EMPTY_SCHEMA)
        count = exporter.validate_local_export(self.path)
        self.assertEqual(count, {"cpz_match_results": 0, "cpz_doubles_results": 0})

    def test_empty_export_rejected(self):
        self.write("")
        with self.assertRaisesRegex(RuntimeError, "vacía"):
            exporter.validate_local_export(self.path)

    def test_missing_doubles_table_rejected(self):
        self.write(
            "CREATE TABLE cpz_match_results (id INTEGER PRIMARY KEY);\n"
            + "-- esquema incompleto\n" * 65
        )
        with self.assertRaisesRegex(RuntimeError, "cpz_doubles_results"):
            exporter.validate_local_export(self.path)

    def test_invalid_sql_rejected(self):
        self.write("CREATE TABLE cpz_match_results (id TEXT); INVALID SYNTAX;\n" + "-- test\n"*200)
        with self.assertRaisesRegex(RuntimeError, "no se puede reconstruir"):
            exporter.validate_local_export(self.path)

    def test_invalid_utf8_rejected(self):
        self.write(b"CREATE TABLE cpz_match_results (id TEXT);" + b"\xff" * 1200)
        with self.assertRaisesRegex(RuntimeError, "UTF-8"):
            exporter.validate_local_export(self.path)

    def test_missing_file_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "vacía"):
            exporter.validate_local_export(self.path)


if __name__ == "__main__":
    unittest.main()
