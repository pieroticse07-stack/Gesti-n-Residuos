import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { Persona, PersonaDatos } from '../interfaces/persona';

@Injectable({ providedIn: 'root' })
export class PersonaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/personas`;
  listar(): Observable<Persona[]> {
    return this.http.get<Persona[]>(this.url).pipe(
      map((personas) => {
        if (!Array.isArray(personas))
          throw new Error('La API no devolvió un listado de personas válido.');
        return personas.map((persona) => this.validar(persona));
      }),
      catchError(this.fallar),
    );
  }
  obtener(id: number): Observable<Persona> {
    return this.http.get<Persona>(`${this.url}/${id}`).pipe(
      map((p) => this.validar(p)),
      catchError(this.fallar),
    );
  }
  crear(datos: PersonaDatos): Observable<Persona> {
    return this.http.post<Persona>(this.url, datos).pipe(
      map((p) => this.validar(p)),
      catchError(this.fallar),
    );
  }
  actualizar(id: number, datos: PersonaDatos): Observable<Persona> {
    return this.http.put<Persona>(`${this.url}/${id}`, datos).pipe(
      map((p) => this.validar(p)),
      catchError(this.fallar),
    );
  }
  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`).pipe(catchError(this.fallar));
  }
  private validar(persona: Persona): Persona {
    if (
      !persona ||
      !Number.isSafeInteger(persona.idPersona) ||
      persona.idPersona <= 0 ||
      !(['nombres', 'apellidos', 'dni', 'telefono'] as const).every(
        (campo) => typeof persona[campo] === 'string',
      )
    ) {
      throw new Error(
        'La API no corresponde al módulo Persona de este proyecto. Revisa la URL del backend.',
      );
    }
    return persona;
  }
  private fallar(error: HttpErrorResponse | Error): Observable<never> {
    if (!(error instanceof HttpErrorResponse)) return throwError(() => error);
    let mensaje = 'No se pudo completar la operación. Intenta nuevamente.';
    if (error.status === 0) {
      mensaje =
        'No se pudo conectar con el backend. Verifica que esté ejecutándose en el puerto 8000.';
    } else if (typeof error.error?.detail === 'string') {
      mensaje = error.error.detail;
    } else if (error.status === 422) {
      mensaje =
        'Revisa los datos: nombres y apellidos son obligatorios, el DNI debe tener 8 dígitos y el teléfono 9.';
    }
    return throwError(() => new Error(mensaje));
  }
}
