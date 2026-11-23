-- Ampliación incremental: no modifica ni recrea public."Persona".
CREATE TABLE IF NOT EXISTS public."ROL" (
 "idRol" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 "nombreRol" varchar(40) NOT NULL UNIQUE,
 activo boolean NOT NULL DEFAULT true
);
INSERT INTO public."ROL" ("nombreRol") VALUES ('ciudadano'), ('administrador'), ('cuadrilla') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public."USUARIO_SISTEMA" (
 "idUsuario" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 "idPersona" bigint NOT NULL UNIQUE REFERENCES public."Persona"("idPersona"),
 "idRol" bigint NOT NULL REFERENCES public."ROL"("idRol"),
 correo varchar(200) NOT NULL UNIQUE CHECK (correo = lower(correo)),
 password text NOT NULL,
 "fechaEliminacion" timestamptz
);
CREATE TABLE IF NOT EXISTS public."SESION" (
 token varchar(64) PRIMARY KEY,
 "idUsuario" bigint NOT NULL REFERENCES public."USUARIO_SISTEMA"("idUsuario"),
 expira timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS public."TIPO_RESIDUO" (
 "idTipoResiduo" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 "nombreTipo" varchar(100) NOT NULL UNIQUE,
 descripcion varchar(500) NOT NULL DEFAULT '', activo boolean NOT NULL DEFAULT true
);
INSERT INTO public."TIPO_RESIDUO" ("nombreTipo",descripcion) VALUES
 ('Orgánicos','Restos de alimentos y residuos vegetales'),
 ('Aprovechables','Papel, cartón, plástico, vidrio y metales'),
 ('No aprovechables','Residuos mezclados que requieren disposición adecuada'),
 ('Escombros','Residuos de construcción y demolición'),
 ('Peligrosos','Residuos que requieren evaluación y manejo especializado') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public."PRIORIDAD" (
 "idPrioridad" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 "nombrePrioridad" varchar(80) NOT NULL UNIQUE,
 orden integer NOT NULL UNIQUE CHECK (orden > 0), activo boolean NOT NULL DEFAULT true
);
INSERT INTO public."PRIORIDAD" ("nombrePrioridad",orden) VALUES ('Alta',1),('Media',2),('Baja',3) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public."ESTADO_REPORTE" (
 "idEstadoReporte" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 "nombreEstado" varchar(40) NOT NULL UNIQUE,
 activo boolean NOT NULL DEFAULT true
);
INSERT INTO public."ESTADO_REPORTE" ("nombreEstado") VALUES ('pendiente'),('en proceso'),('resuelto') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public."CUADRILLA" (
 "idCuadrilla" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 "nombreCuadrilla" varchar(100) NOT NULL, descripcion varchar(500) NOT NULL DEFAULT '', "fechaBaja" timestamptz
);
CREATE TABLE IF NOT EXISTS public."PERTENENCIA_CUADRILLA" (
 "idPertenencia" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 "idUsuario" bigint NOT NULL REFERENCES public."USUARIO_SISTEMA"("idUsuario"),
 "idCuadrilla" bigint NOT NULL REFERENCES public."CUADRILLA"("idCuadrilla"),
 "fechaInicio" timestamptz NOT NULL DEFAULT now(), "fechaFin" timestamptz,
 CHECK ("fechaFin" IS NULL OR "fechaFin" >= "fechaInicio")
);
CREATE UNIQUE INDEX IF NOT EXISTS pertenencia_vigente ON public."PERTENENCIA_CUADRILLA" ("idUsuario","idCuadrilla") WHERE "fechaFin" IS NULL;
CREATE TABLE IF NOT EXISTS public."VEHICULO_RECOLECTOR" (
 "idVehiculo" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 placa varchar(15) NOT NULL UNIQUE, marca varchar(80) NOT NULL, modelo varchar(80) NOT NULL,
 "capacidadToneladas" numeric(10,2) NOT NULL CHECK ("capacidadToneladas" > 0),
 "estadoOperativo" varchar(30) NOT NULL DEFAULT 'operativo' CHECK ("estadoOperativo" IN ('operativo','mantenimiento','fuera de servicio')),
 "fechaBaja" timestamptz
);
CREATE TABLE IF NOT EXISTS public."REPORTE_INCIDENCIA" (
 "idReporte" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 "idUsuarioReportante" bigint NOT NULL REFERENCES public."USUARIO_SISTEMA"("idUsuario"),
 "idTipoResiduo" bigint NOT NULL REFERENCES public."TIPO_RESIDUO"("idTipoResiduo"),
 "idPrioridad" bigint REFERENCES public."PRIORIDAD"("idPrioridad"),
 "idEstadoReporte" bigint NOT NULL REFERENCES public."ESTADO_REPORTE"("idEstadoReporte"),
 "idReporteOriginal" bigint REFERENCES public."REPORTE_INCIDENCIA"("idReporte"),
 "fechaReporte" timestamptz NOT NULL DEFAULT now(),
 "direccionReferencia" varchar(500) NOT NULL, latitud numeric(10,7) NOT NULL CHECK(latitud BETWEEN -90 AND 90),
 longitud numeric(10,7) NOT NULL CHECK(longitud BETWEEN -180 AND 180), descripcion varchar(3000) NOT NULL,
 revision varchar(20) NOT NULL DEFAULT 'pendiente' CHECK(revision IN ('pendiente','aprobado','rechazado')),
 "validacionTerritorial" varchar(20) NOT NULL DEFAULT 'pendiente' CHECK("validacionTerritorial" IN ('pendiente','dentro','fuera')),
 "idUsuarioValidador" bigint REFERENCES public."USUARIO_SISTEMA"("idUsuario"),
 "fechaValidacion" timestamptz, "observacionValidacion" varchar(1500),
 CHECK ("idReporteOriginal" IS NULL OR "idReporteOriginal" <> "idReporte")
);
CREATE TABLE IF NOT EXISTS public."ATENCION_LIMPIEZA" (
 "idAtencion" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 "idReporte" bigint NOT NULL REFERENCES public."REPORTE_INCIDENCIA"("idReporte"),
 "idCuadrilla" bigint NOT NULL REFERENCES public."CUADRILLA"("idCuadrilla"),
 "idVehiculo" bigint NOT NULL REFERENCES public."VEHICULO_RECOLECTOR"("idVehiculo"),
 "idUsuarioAsignador" bigint NOT NULL REFERENCES public."USUARIO_SISTEMA"("idUsuario"),
 "fechaAsignacion" timestamptz NOT NULL DEFAULT now(), "fechaInicio" timestamptz, "fechaFin" timestamptz,
 "observacionCuadrilla" varchar(3000) NOT NULL DEFAULT '',
 CHECK ("fechaInicio" IS NULL OR "fechaInicio" >= "fechaAsignacion"),
 CHECK ("fechaFin" IS NULL OR ("fechaInicio" IS NOT NULL AND "fechaFin" >= "fechaInicio"))
);
CREATE UNIQUE INDEX IF NOT EXISTS cuadrilla_ocupada ON public."ATENCION_LIMPIEZA" ("idCuadrilla") WHERE "fechaFin" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS vehiculo_ocupado ON public."ATENCION_LIMPIEZA" ("idVehiculo") WHERE "fechaFin" IS NULL;
CREATE TABLE IF NOT EXISTS public."HISTORIAL_ESTADO_REPORTE" (
 "idHistorial" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 "idReporte" bigint NOT NULL REFERENCES public."REPORTE_INCIDENCIA"("idReporte"),
 "idEstadoReporte" bigint NOT NULL REFERENCES public."ESTADO_REPORTE"("idEstadoReporte"),
 "idUsuarioResponsable" bigint NOT NULL REFERENCES public."USUARIO_SISTEMA"("idUsuario"),
 "fechaCambio" timestamptz NOT NULL DEFAULT now(), observacion varchar(1500) NOT NULL
);
CREATE TABLE IF NOT EXISTS public."HISTORIAL_PRIORIDAD" (
 "idHistorialPrioridad" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 "idReporte" bigint NOT NULL REFERENCES public."REPORTE_INCIDENCIA"("idReporte"),
 "idPrioridad" bigint NOT NULL REFERENCES public."PRIORIDAD"("idPrioridad"),
 "idUsuarioResponsable" bigint NOT NULL REFERENCES public."USUARIO_SISTEMA"("idUsuario"),
 "fechaCambio" timestamptz NOT NULL DEFAULT now(), motivo varchar(1500) NOT NULL
);
CREATE TABLE IF NOT EXISTS public."HISTORIAL_REVISION_REPORTE" (
 "idRevision" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 "idReporte" bigint NOT NULL REFERENCES public."REPORTE_INCIDENCIA"("idReporte"),
 revision varchar(20) NOT NULL CHECK(revision IN ('aprobado','rechazado')),
 "idUsuarioResponsable" bigint NOT NULL REFERENCES public."USUARIO_SISTEMA"("idUsuario"),
 "fechaCambio" timestamptz NOT NULL DEFAULT now(), motivo varchar(1500) NOT NULL
);
CREATE TABLE IF NOT EXISTS public."HISTORIAL_ASIGNACION" (
 "idHistorialAsignacion" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 "idAtencion" bigint NOT NULL REFERENCES public."ATENCION_LIMPIEZA"("idAtencion"),
 "idCuadrilla" bigint NOT NULL REFERENCES public."CUADRILLA"("idCuadrilla"),
 "idVehiculo" bigint NOT NULL REFERENCES public."VEHICULO_RECOLECTOR"("idVehiculo"),
 "idUsuarioAsignador" bigint NOT NULL REFERENCES public."USUARIO_SISTEMA"("idUsuario"),
 "fechaAsignacion" timestamptz NOT NULL DEFAULT now(), "fechaFin" timestamptz,
 motivo varchar(1500) NOT NULL, CHECK("fechaFin" IS NULL OR "fechaFin" >= "fechaAsignacion")
);
CREATE INDEX IF NOT EXISTS reportante_reportes ON public."REPORTE_INCIDENCIA" ("idUsuarioReportante","fechaReporte");
CREATE INDEX IF NOT EXISTS historial_reporte ON public."HISTORIAL_ESTADO_REPORTE" ("idReporte","fechaCambio");
CREATE INDEX IF NOT EXISTS sesiones_usuario ON public."SESION" ("idUsuario");
-- La API privada aplica permisos por rol; no se expone acceso directo a estas tablas.
DO $$ DECLARE tabla text; BEGIN
 FOREACH tabla IN ARRAY ARRAY['ROL','USUARIO_SISTEMA','SESION','TIPO_RESIDUO','PRIORIDAD','ESTADO_REPORTE','CUADRILLA','PERTENENCIA_CUADRILLA','VEHICULO_RECOLECTOR','REPORTE_INCIDENCIA','ATENCION_LIMPIEZA','HISTORIAL_ESTADO_REPORTE','HISTORIAL_PRIORIDAD','HISTORIAL_REVISION_REPORTE','HISTORIAL_ASIGNACION'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tabla);
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated',tabla);
 END LOOP;
END $$;
