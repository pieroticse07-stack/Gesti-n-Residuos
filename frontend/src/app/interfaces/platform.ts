export interface User {
  idUsuario: number;
  idPersona: number;
  nombres: string;
  apellidos: string;
  correo: string;
  rol: 'ciudadano' | 'administrador' | 'cuadrilla';
}
export interface Report {
  fotoDisponible?: boolean;
  idReporte: number;
  idUsuarioReportante: number;
  idTipoResiduo: number;
  descripcion: string;
  direccionReferencia: string;
  latitud: number;
  longitud: number;
  fechaReporte: string;
  nombreTipo: string;
  nombrePrioridad: string | null;
  nombreEstado: string;
  revision: string;
  validacionTerritorial: string;
  observacionValidacion: string | null;
  idReporteOriginal: number | null;
  reportante: string;
  idPrioridad: number | null;
}
export type Row = Record<string, any>;
export interface Catalogs {
  tipos: Row[];
  prioridades: Row[];
  estados: Row[];
}
export interface PublicConfig {
  geoapifyKey: string;
  dniDisponible: boolean;
  geocodificacionDisponible: boolean;
}
