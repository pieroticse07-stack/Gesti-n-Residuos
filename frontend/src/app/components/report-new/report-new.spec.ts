import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Api } from '../../services/api';
import { ReportNew } from './report-new';

describe('Registro de incidentes con ubicación confirmada', () => {
  let api: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    api = {
      get: vi.fn().mockResolvedValue({ tipos: [], prioridades: [], estados: [] }),
      post: vi.fn().mockResolvedValue({ idReporte: 15 }),
    };
    TestBed.configureTestingModule({
      imports: [ReportNew],
      providers: [provideRouter([]), { provide: Api, useValue: api }],
    });
  });
  function component() {
    return TestBed.createComponent(ReportNew).componentInstance;
  }
  it('buscar una dirección selecciona el primer punto y conserva las alternativas', async () => {
    const c = component();
    const matches = [
      { direccion: 'Plaza Constitución, Huancayo', latitud: -12.068, longitud: -75.21 },
      { direccion: 'Otra dirección, Huancayo', latitud: -12.08, longitud: -75.22 },
    ];
    api.post.mockResolvedValue(matches);
    c.address.set('Plaza Constitución');
    c.confirmed.set(true);
    await c.search();
    expect(c.model().latitud).toBe('-12.068');
    expect(c.model().longitud).toBe('-75.21');
    expect(c.model().direccionReferencia).toBe(matches[0].direccion);
    expect(c.confirmed()).toBe(false);
    expect(c.results()).toEqual(matches);
    c.useAddress(matches[1]);
    expect(c.model().latitud).toBe('-12.08');
    expect(c.results()).toEqual([]);
  });
  it('una búsqueda sin resultados conserva el punto anterior y limpia las coincidencias', async () => {
    const c = component();
    c.point({ latitud: -12.06, longitud: -75.2 });
    c.results.set([{ direccion: 'Anterior' }]);
    api.post.mockResolvedValue([]);
    await c.search();
    expect(c.model().latitud).toBe('-12.06');
    expect(c.results()).toEqual([]);
    expect(c.message()).toContain('No encontramos coincidencias');
  });
  it('no envía el reporte sin confirmación de la ubicación', async () => {
    const c = component();
    c.model.set({
      idTipoResiduo: '1',
      descripcion: 'Residuos de prueba en la calle',
      direccionReferencia: 'Referencia de prueba',
      latitud: '-12.06',
      longitud: '-75.2',
    });
    await c.submit();
    expect(api.post).not.toHaveBeenCalled();
    expect(c.error()).toContain('confirma');
  });
  it('rechaza coordenadas vacías aunque se marque la confirmación', async () => {
    const c = component();
    c.confirmed.set(true);
    await c.submit();
    expect(api.post).not.toHaveBeenCalled();
  });
  it('cambiar el punto requiere una nueva confirmación', () => {
    const c = component();
    c.confirmed.set(true);
    c.point({ latitud: -12, longitud: -75 });
    expect(c.confirmed()).toBe(false);
    expect(c.model().latitud).toBe('-12');
  });
  it('no acepta un archivo SVG como fotografía', async () => {
    const c = component();
    const file = new File(['<svg></svg>'], 'archivo.svg', { type: 'image/svg+xml' });
    await c.selectPhoto({ target: { files: [file], value: 'archivo.svg' } } as unknown as Event);
    expect(c.photo()).toBeNull();
    expect(c.photoError()).toContain('JPG, PNG o WebP');
  });
  it('envía coordenadas numéricas y navega al reporte persistido', async () => {
    const c = component();
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    c.model.set({
      idTipoResiduo: '1',
      descripcion: 'Residuos de prueba en la calle',
      direccionReferencia: 'Referencia de prueba',
      latitud: '-12.06',
      longitud: '-75.2',
    });
    c.confirmed.set(true);
    c.photo.set({ name: 'evidencia.jpg', data: 'data:image/jpeg;base64,imagen-de-prueba' });
    await c.submit();
    expect(api.post).toHaveBeenCalledWith(
      '/reportes',
      expect.objectContaining({
        idTipoResiduo: 1,
        latitud: -12.06,
        longitud: -75.2,
        imagenBase64: 'data:image/jpeg;base64,imagen-de-prueba',
      }),
    );
    expect(router.navigate).toHaveBeenCalledWith(['/reportes', 15]);
  });
});
