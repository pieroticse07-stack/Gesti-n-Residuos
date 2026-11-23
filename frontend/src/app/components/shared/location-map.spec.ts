import { TestBed } from '@angular/core/testing';
import type { Map, Marker } from 'leaflet';
import { Api } from '../../services/api';
import { LocationMap } from './location-map';

describe('Mapa interactivo de reportes con Geoapify', () => {
  let api: { get: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    api = { get: vi.fn().mockResolvedValue({ geoapifyKey: 'test-map-key' }) };
    TestBed.configureTestingModule({
      imports: [LocationMap],
      providers: [{ provide: Api, useValue: api }],
    });
  });

  async function editableMap() {
    const fixture = TestBed.createComponent(LocationMap);
    fixture.componentRef.setInput('editable', true);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const internal = component as unknown as { map?: Map; marker?: Marker };
    await vi.waitFor(() => expect(component.loaded()).toBe(true));
    return { fixture, component, internal };
  }

  it('permite continuar manualmente cuando no hay clave', async () => {
    api.get.mockResolvedValue({ geoapifyKey: '' });
    const fixture = TestBed.createComponent(LocationMap);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.loaded()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('coordenadas');
    expect(fixture.nativeElement.querySelector('.leaflet-container')).toBeNull();
  });

  it('un clic actualiza el marcador y comunica el punto al formulario', async () => {
    const { component, internal } = await editableMap();
    const selected = vi.fn();
    component.selected.subscribe(selected);
    internal.map!.fire('click', { latlng: { lat: -12.067123456, lng: -75.208123456 } });
    expect(selected).toHaveBeenCalledWith({ latitud: -12.0671235, longitud: -75.2081235 });
    expect(internal.marker!.getLatLng().lat).toBeCloseTo(-12.067123456);
  });

  it('arrastrar el marcador comunica las nuevas coordenadas', async () => {
    const { component, internal } = await editableMap();
    const selected = vi.fn();
    component.selected.subscribe(selected);
    internal.marker!.setLatLng([-12.08, -75.22]).fire('dragend');
    expect(selected).toHaveBeenCalledWith({ latitud: -12.08, longitud: -75.22 });
  });

  it('las coordenadas elegidas en la búsqueda centran y acercan el mapa', async () => {
    const { fixture, internal } = await editableMap();
    fixture.componentRef.setInput('latitude', -12.09);
    fixture.componentRef.setInput('longitude', -75.23);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(internal.map!.getCenter().lat).toBeCloseTo(-12.09, 3);
    expect(internal.map!.getCenter().lng).toBeCloseTo(-75.23, 3);
    expect(internal.map!.getZoom()).toBeGreaterThanOrEqual(16);
    expect(internal.marker!.getLatLng().lat).toBeCloseTo(-12.09);
  });

  it('no crea un mapa si se abandona la pantalla antes de recibir la configuración', async () => {
    let resolve!: (value: { geoapifyKey: string }) => void;
    api.get.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const fixture = TestBed.createComponent(LocationMap);
    fixture.detectChanges();
    fixture.destroy();
    resolve({ geoapifyKey: 'test-map-key' });
    await Promise.resolve();
    expect(fixture.componentInstance.loaded()).toBe(false);
  });
});
