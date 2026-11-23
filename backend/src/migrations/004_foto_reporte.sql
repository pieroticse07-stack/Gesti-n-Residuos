-- Una fotografía opcional por reporte. Se consulta únicamente mediante la API autorizada.
CREATE TABLE IF NOT EXISTS public."FOTO_REPORTE" (
    "idFoto" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "idReporte" bigint NOT NULL UNIQUE REFERENCES public."REPORTE_INCIDENCIA"("idReporte"),
    contenido bytea NOT NULL CHECK (octet_length(contenido) BETWEEN 1 AND 2097152),
    "tipoContenido" varchar(30) NOT NULL DEFAULT 'image/jpeg' CHECK ("tipoContenido"='image/jpeg'),
    "fechaSubida" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public."FOTO_REPORTE" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."FOTO_REPORTE" FROM anon, authenticated;
