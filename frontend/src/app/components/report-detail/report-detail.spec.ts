import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Api } from '../../services/api';
import { Auth } from '../../services/auth';
import { ReportDetail } from './report-detail';

describe('Revisión municipal desde la interfaz', () => {
  const report = {
    idReporte: 1,
    revision: 'pendiente',
    nombreEstado: 'pendiente',
    nombreTipo: 'Orgánicos',
    descripcion: 'Residuos de prueba',
    direccionReferencia: 'Referencia de prueba',
    latitud: -12.06,
    longitud: -75.2,
    fechaReporte: '2026-11-22T12:00:00-05:00',
    reportante: 'Prueba',
    validacionTerritorial: 'pendiente',
  };
  let api: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
  };
  beforeEach(() => {
    api = {
      get: vi.fn().mockImplementation((path: string) =>
        Promise.resolve(
          path === '/reportes/1'
            ? {
                reporte: report,
                atenciones: [],
                estados: [],
                revisiones: [],
                asignaciones: [],
                prioridades: [],
              }
            : path === '/recursos'
              ? { cuadrillas: [], vehiculos: [] }
              : path === '/catalogos'
                ? { tipos: [], prioridades: [], estados: [] }
                : path === '/config/publica'
                  ? { geoapifyKey: '' }
                  : [],
        ),
      ),
      post: vi.fn().mockResolvedValue({ message: 'Guardado' }),
      put: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [ReportDetail],
      providers: [
        provideRouter([]),
        { provide: Api, useValue: api },
        { provide: Auth, useValue: { user: signal({ rol: 'administrador' }) } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: '1' }) } },
        },
      ],
    });
  });
  it('el botón Aprobar abre la decisión y envía revisión, ámbito y motivo', async () => {
    const fixture = TestBed.createComponent(ReportDetail);
    await fixture.componentInstance.load();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const button = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Aprobar reporte'),
    )!;
    button.click();
    fixture.detectChanges();
    const reason = root.querySelector('textarea')!;
    reason.value = 'Competencia municipal verificada.';
    reason.dispatchEvent(new Event('input', { bubbles: true }));
    root
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(api.post).toHaveBeenCalledWith('/reportes/1/revision', {
      revision: 'aprobado',
      validacionTerritorial: 'dentro',
      motivo: 'Competencia municipal verificada.',
    });
  });
  it('un ciudadano no recibe controles de aprobación en el detalle', async () => {
    (TestBed.inject(Auth).user as any).set({ rol: 'ciudadano' });
    const fixture = TestBed.createComponent(ReportDetail);
    await fixture.componentInstance.load();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Aprobar reporte');
  });
});
