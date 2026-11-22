-- Deshacer NO destructivo tras autorizar expresamente su uso.
-- No elimina columnas, tablas, resultados ni el historial.
-- Al revertir el código a la versión anterior, activar todos los registros
-- para que esa versión (sin deleted_at) no vuelva a incluir filas ocultas.
-- Exigir previamente una copia verificada. NO aplicar automáticamente.
BEGIN TRANSACTION;
UPDATE cpz_match_results SET deleted_at=NULL WHERE deleted_at IS NOT NULL;
UPDATE cpz_doubles_results SET deleted_at=NULL WHERE deleted_at IS NOT NULL;
COMMIT;
