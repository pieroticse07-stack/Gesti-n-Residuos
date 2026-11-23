-- Las observaciones acumuladas y los mensajes de historial no se truncan.
ALTER TABLE public."HISTORIAL_ESTADO_REPORTE" ALTER COLUMN observacion TYPE text;
ALTER TABLE public."ATENCION_LIMPIEZA" ALTER COLUMN "observacionCuadrilla" TYPE text;
ALTER TABLE public."MIGRACION_SISTEMA" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."MIGRACION_SISTEMA" FROM anon, authenticated;
