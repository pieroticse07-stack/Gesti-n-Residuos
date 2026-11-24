import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { credentialsInterceptor } from './api';
import { environment } from '../../environments/environment';

describe('Conexión automática a los puertos locales del backend', () => {
  let client: HttpClient;
  let http: HttpTestingController;
  const preferred = environment.apiUrl;
  const alternate = preferred.replace(':8001', ':8000');
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([credentialsInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('producción usa /api del mismo origen y conserva las cookies sin detectar puertos', async () => {
    const previous = environment.apiUrl;
    environment.apiUrl = '';
    try {
      const pending = firstValueFrom(
        client.post('/api/auth/login', { correo: 'test@example.test' }),
      );
      await settle();
      const login = http.expectOne('/api/auth/login');
      expect(login.request.withCredentials).toBe(true);
      login.flush({ idUsuario: 1 });
      await pending;
      http.expectNone('/health');
    } finally {
      environment.apiUrl = previous;
    }
  });

  it('no redirige solicitudes ajenas a la API ni les añade credenciales', async () => {
    const pending = firstValueFrom(client.get('https://example.test/resource'));
    const external = http.expectOne('https://example.test/resource');
    expect(external.request.withCredentials).toBe(false);
    external.flush({});
    await pending;
  });

  it('usa 8001 si está disponible y comparte la detección entre solicitudes', async () => {
    const first = firstValueFrom(client.get(`${preferred}/api/auth/me`));
    const second = firstValueFrom(client.get(`${preferred}/api/config/publica`));
    http.expectOne(`${preferred}/health`).flush({ status: 'ok' });
    await settle();
    const session = http.expectOne(`${preferred}/api/auth/me`);
    expect(session.request.withCredentials).toBe(true);
    session.flush({ idUsuario: 1 });
    http.expectOne(`${preferred}/api/config/publica`).flush({});
    await Promise.all([first, second]);
    http.expectNone(`${alternate}/health`);
  });

  it('envía el login una sola vez a 8000 cuando 8001 no responde', async () => {
    const pending = firstValueFrom(
      client.post(`${preferred}/api/auth/login`, { correo: 'test@example.test' }),
    );
    http.expectOne(`${preferred}/health`).error(new ProgressEvent('error'));
    await settle();
    http.expectOne(`${alternate}/health`).flush({ status: 'ok' });
    await settle();
    http.expectNone(`${preferred}/api/auth/login`);
    const login = http.expectOne(`${alternate}/api/auth/login`);
    expect(login.request.method).toBe('POST');
    expect(login.request.withCredentials).toBe(true);
    login.flush({ idUsuario: 1 });
    await pending;
  });

  it('no cambia de puerto ni repite una operación rechazada por el backend', async () => {
    const pending = firstValueFrom(client.post(`${preferred}/api/reportes`, {})).catch(
      (error) => error,
    );
    http.expectOne(`${preferred}/health`).flush({ status: 'ok' });
    await settle();
    http
      .expectOne(`${preferred}/api/reportes`)
      .flush({ detail: 'No autorizado' }, { status: 403, statusText: 'Forbidden' });
    expect((await pending).status).toBe(403);
    http.expectNone(`${alternate}/health`);
  });

  it('no envía datos de registro cuando ninguno de los dos puertos responde', async () => {
    const pending = firstValueFrom(client.post(`${preferred}/api/auth/registro`, {})).catch(
      (error) => error,
    );
    http.expectOne(`${preferred}/health`).error(new ProgressEvent('error'));
    await settle();
    http.expectOne(`${alternate}/health`).error(new ProgressEvent('error'));
    expect((await pending).status).toBe(0);
    http.expectNone(`${preferred}/api/auth/registro`);
    http.expectNone(`${alternate}/api/auth/registro`);
  });
});
