import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PersonaService } from './persona';
import { environment } from '../../environments/environment';

describe('PersonaService', () => {
  let service: PersonaService;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/api/personas`;
  const datos = { nombres: 'Ana', apellidos: 'Torres', dni: '00123456', telefono: '987654321' };
  const persona = { idPersona: 1, ...datos };
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PersonaService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('envía las operaciones CRUD a FastAPI', () => {
    service.listar().subscribe((v) => expect(v).toEqual([persona]));
    http.expectOne({ url, method: 'GET' }).flush([persona]);
    service.obtener(1).subscribe((v) => expect(v).toEqual(persona));
    http.expectOne({ url: `${url}/1`, method: 'GET' }).flush(persona);
    service.crear(datos).subscribe();
    const crear = http.expectOne({ url, method: 'POST' });
    expect(crear.request.body).toEqual(datos);
    crear.flush(persona);
    service.actualizar(1, datos).subscribe();
    const editar = http.expectOne({ url: `${url}/1`, method: 'PUT' });
    expect(editar.request.body).toEqual(datos);
    editar.flush(persona);
    service.eliminar(1).subscribe();
    http
      .expectOne({ url: `${url}/1`, method: 'DELETE' })
      .flush(null, { status: 204, statusText: 'No Content' });
  });
  it('muestra el conflicto de DNI enviado por el backend', () => {
    service
      .crear(datos)
      .subscribe({ error: (error: Error) => expect(error.message).toContain('DNI') });
    http
      .expectOne(url)
      .flush(
        { detail: 'Ya existe una persona con ese DNI.' },
        { status: 409, statusText: 'Conflict' },
      );
  });
  it('rechaza respuestas de otro backend con campos incompatibles', () => {
    service.listar().subscribe({
      next: () => {
        throw new Error('No debe aceptar datos incompatibles');
      },
      error: (error: Error) => expect(error.message).toContain('no corresponde'),
    });
    http.expectOne(url).flush([{ documentoIdentidad: '12345678', nombre: 'Ana' }]);
  });
});
