-- Solo el módulo Persona del diagrama. Ejecutar en un proyecto nuevo.
CREATE TABLE IF NOT EXISTS public."Persona" (
    "idPersona" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombres varchar(100) NOT NULL CHECK (length(btrim(nombres)) > 0),
    apellidos varchar(100) NOT NULL CHECK (length(btrim(apellidos)) > 0),
    dni varchar(8) NOT NULL UNIQUE CHECK (dni ~ '^[0-9]{8}$'),
    telefono varchar(9) NOT NULL CHECK (telefono ~ '^[0-9]{9}$')
);

-- Las operaciones se realizan desde FastAPI, con la conexión privada del servidor.
ALTER TABLE public."Persona" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."Persona" FROM anon, authenticated;
