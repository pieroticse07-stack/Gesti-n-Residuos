import {
  HttpBackend,
  HttpClient,
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, firstValueFrom, from, switchMap, throwError, timeout } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiEndpoint {
  // HttpBackend evita pasar las comprobaciones de salud por este interceptor.
  private probe = new HttpClient(inject(HttpBackend));
  private discovery?: Promise<string>;

  resolve(): Promise<string> {
    return (this.discovery ??= this.discover().catch((error) => {
      this.reset();
      throw error;
    }));
  }
  reset(): void {
    this.discovery = undefined;
  }

  private async discover(): Promise<string> {
    if (!environment.apiUrl) return ''; // Producción: proxy /api del frontend.
    const configured = new URL(environment.apiUrl);
    const local =
      ['localhost', '127.0.0.1'].includes(configured.hostname) &&
      ['8000', '8001'].includes(configured.port);
    if (!local) return environment.apiUrl;
    const alternative = new URL(configured);
    alternative.port = configured.port === '8001' ? '8000' : '8001';
    let lastError: unknown;
    for (const base of [environment.apiUrl, alternative.origin]) {
      try {
        const result = await firstValueFrom(
          this.probe.get<{ status: string }>(`${base}/health`).pipe(timeout(1500)),
        );
        if (result.status === 'ok') return base;
      } catch (error) {
        lastError = error;
      }
    }
    throw new HttpErrorResponse({
      status: 0,
      statusText: 'Backend no disponible',
      error: lastError,
    });
  }
}

export const credentialsInterceptor: HttpInterceptorFn = (request, next) => {
  const apiPrefix = `${environment.apiUrl}/api/`;
  if (!request.url.startsWith(apiPrefix)) return next(request);
  const endpoint = inject(ApiEndpoint);
  return from(endpoint.resolve()).pipe(
    switchMap((base) =>
      next(
        request.clone({
          url: base + request.url.slice(environment.apiUrl.length),
          withCredentials: true,
        }),
      ),
    ),
    catchError((error) => {
      // Una escritura no se repite: podría haberse guardado aunque se perdiera la respuesta.
      if (error instanceof HttpErrorResponse && error.status === 0) endpoint.reset();
      return throwError(() => error);
    }),
  );
};

export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0)
      return 'No se pudo conectar con el servidor. Comprueba que el backend esté iniciado.';
    if (typeof error.error?.detail === 'string') return error.error.detail;
    if (error.status === 422)
      return 'Revisa los datos obligatorios y sus formatos antes de continuar.';
  }
  return error instanceof Error
    ? error.message
    : 'No se pudo completar la operación. Intenta nuevamente.';
}

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  blob(path: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/api${path}`, {
        responseType: 'blob',
        withCredentials: true,
      }),
    );
  }
  get<T>(path: string): Promise<T> {
    return firstValueFrom(
      this.http.get<T>(`${environment.apiUrl}/api${path}`, { withCredentials: true }),
    );
  }
  post<T>(path: string, data: unknown = {}): Promise<T> {
    return firstValueFrom(
      this.http.post<T>(`${environment.apiUrl}/api${path}`, data, { withCredentials: true }),
    );
  }
  put<T>(path: string, data: unknown): Promise<T> {
    return firstValueFrom(
      this.http.put<T>(`${environment.apiUrl}/api${path}`, data, { withCredentials: true }),
    );
  }
}
