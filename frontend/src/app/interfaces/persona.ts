/** Únicamente los campos de Persona del diagrama. */
export interface PersonaDatos {
  nombres: string;
  apellidos: string;
  dni: string;
  telefono: string;
}
export interface Persona extends PersonaDatos {
  idPersona: number;
}
