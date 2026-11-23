import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  provideRouter,
} from '@angular/router';
import { Auth, authGuard } from './auth';
import { User } from '../interfaces/platform';
import { environment } from '../../environments/environment';

const citizen: User = {
  idUsuario: 1,
  idPersona: 1,
  nombres: 'Prueba',
  apellidos: 'Ciudadana',
  correo: 'prueba@example.test',
  rol: 'ciudadano',
};
describe('Sesión y autorización de navegación', () => {
  let auth: Auth;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    auth = TestBed.inject(Auth);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('restaura la sesión mediante cookie sin almacenar contraseñas en el navegador', async () => {
    const pending = auth.restore();
    const request = http.expectOne(environment.apiUrl + '/api/auth/me');
    expect(request.request.withCredentials).toBe(true);
    request.flush(citizen);
    await pending;
    expect(auth.user()).toEqual(citizen);
    expect(auth.ready()).toBe(true);
  });
  it('una sesión expirada permite volver al login', async () => {
    const pending = auth.restore();
    http
      .expectOne(environment.apiUrl + '/api/auth/me')
      .flush({ detail: 'Sesión expirada' }, { status: 401, statusText: 'Unauthorized' });
    await pending;
    expect(auth.user()).toBeNull();
    expect(auth.ready()).toBe(true);
  });
  it('no borra la sesión local si falla su revocación en el servidor', async () => {
    auth.user.set(citizen);
    auth.ready.set(true);
    const pending = auth.logout();
    http
      .expectOne(environment.apiUrl + '/api/auth/logout')
      .flush({ detail: 'Sin conexión' }, { status: 503, statusText: 'Unavailable' });
    await expect(pending).rejects.toBeDefined();
    expect(auth.user()).toEqual(citizen);
  });
  it('impide al ciudadano abrir una pantalla municipal aunque escriba la URL', async () => {
    auth.user.set(citizen);
    auth.ready.set(true);
    const result = await TestBed.runInInjectionContext(() =>
      authGuard(
        { data: { roles: ['administrador'] } } as unknown as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );
    expect(TestBed.inject(Router).serializeUrl(result as any)).toBe('/panel');
  });
  it('redirige al login cuando no hay sesión', async () => {
    auth.ready.set(true);
    const result = await TestBed.runInInjectionContext(() =>
      authGuard({ data: {} } as unknown as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    expect(TestBed.inject(Router).serializeUrl(result as any)).toBe('/ingresar');
  });
});
