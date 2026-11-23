import { afterNextRender, Component, inject, signal } from '@angular/core';
import { form, FormField, FormRoot, required, minLength, maxLength } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../services/api';
import { Catalogs, Row } from '../../interfaces/platform';
import { LocationMap } from '../shared/location-map';
import { Icon } from '../shared/icon';

@Component({
  selector: 'app-report-new',
  imports: [FormField, FormRoot, RouterLink, LocationMap, Icon],
  templateUrl: './report-new.html',
})
export class ReportNew {
  private api = inject(Api);
  private router = inject(Router);
  catalogs = signal<Catalogs>({ tipos: [], prioridades: [], estados: [] });
  error = signal('');
  message = signal('');
  confirmed = signal(false);
  searching = signal(false);
  address = signal('');
  results = signal<Row[]>([]);
  photo = signal<{ data: string; name: string } | null>(null);
  readingPhoto = signal(false);
  photoError = signal('');
  private photoSelection = 0;
  model = signal({
    idTipoResiduo: '',
    descripcion: '',
    direccionReferencia: '',
    latitud: '',
    longitud: '',
  });
  fields = form(
    this.model,
    (p) => {
      required(p.idTipoResiduo);
      required(p.descripcion);
      minLength(p.descripcion, 10);
      maxLength(p.descripcion, 3000);
      required(p.direccionReferencia);
      minLength(p.direccionReferencia, 5);
      maxLength(p.direccionReferencia, 500);
      required(p.latitud);
      required(p.longitud);
    },
    { submission: { action: async () => this.submit() } },
  );
  constructor() {
    afterNextRender(() => {
      void this.api
        .get<Catalogs>('/catalogos')
        .then((c) => this.catalogs.set(c))
        .catch((e) => this.error.set(errorMessage(e)));
    });
  }
  point(p: { latitud: number; longitud: number }) {
    this.model.update((m) => ({ ...m, latitud: String(p.latitud), longitud: String(p.longitud) }));
    this.confirmed.set(false);
  }
  coordinate(key: 'latitud' | 'longitud', value: string) {
    this.model.update((m) => ({ ...m, [key]: value }));
    this.confirmed.set(false);
  }
  async search() {
    if (this.searching()) return;
    this.searching.set(true);
    this.message.set('');
    this.results.set([]);
    try {
      const r = await this.api.post<Row[]>('/integraciones/geocodificacion', {
        direccion: this.address(),
      });
      if (r.length) {
        this.useAddress(r[0]);
        if (r.length > 1) this.results.set(r);
      } else
        this.message.set(
          'No encontramos coincidencias. Puedes marcar el punto o ingresar las coordenadas.',
        );
    } catch (e) {
      this.message.set(errorMessage(e));
    } finally {
      this.searching.set(false);
    }
  }
  useAddress(r: Row) {
    this.point({ latitud: r['latitud'], longitud: r['longitud'] });
    this.model.update((m) => ({ ...m, direccionReferencia: r['direccion'] }));
    this.results.set([]);
    this.message.set(
      'Mapa centrado en la dirección encontrada. Revisa el marcador y confirma la ubicación del incidente.',
    );
  }
  gps() {
    this.message.set('');
    if (!navigator.geolocation) {
      this.message.set('Tu navegador no dispone de ubicación. Utiliza el mapa o las coordenadas.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        this.point({ latitud: p.coords.latitude, longitud: p.coords.longitude });
        this.message.set(
          'Revisa que este punto corresponda al incidente, no solo a tu ubicación actual.',
        );
      },
      () =>
        this.message.set(
          'No se pudo obtener tu ubicación. Puedes seleccionar el punto manualmente.',
        ),
      { timeout: 8000, enableHighAccuracy: true },
    );
  }
  async submit() {
    this.error.set('');
    if (this.readingPhoto()) {
      this.error.set('Espera a que termine de cargar la foto.');
      return { kind: 'photo', message: 'La foto todavía está cargando.' };
    }
    const m = this.model();
    const lat = Number(m.latitud),
      lng = Number(m.longitud);
    if (
      !this.confirmed() ||
      !m.latitud.trim() ||
      !m.longitud.trim() ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      this.error.set('Revisa las coordenadas y confirma la ubicación antes de enviar.');
      return { kind: 'location', message: 'Confirma una ubicación válida.' };
    }
    try {
      const r = await this.api.post<Row>('/reportes', {
        ...m,
        idTipoResiduo: Number(m.idTipoResiduo),
        latitud: lat,
        longitud: lng,
        ...(this.photo() ? { imagenBase64: this.photo()!.data } : {}),
      });
      await this.router.navigate(['/reportes', r['idReporte']]);
    } catch (e) {
      const message = errorMessage(e);
      this.error.set(message);
      return { kind: 'server', message };
    }
    return undefined;
  }
  numeric(value: string, fallback: number) {
    return value.trim() && Number.isFinite(Number(value)) ? Number(value) : fallback;
  }
  async selectPhoto(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const selection = ++this.photoSelection;
    this.photo.set(null);
    this.photoError.set('');
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      this.photoError.set('Selecciona una foto JPG, PNG o WebP de hasta 5 MB.');
      this.readingPhoto.set(false);
      return;
    }
    this.readingPhoto.set(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('No se pudo leer la foto.'));
        reader.readAsDataURL(file);
      });
      if (selection === this.photoSelection) this.photo.set({ data, name: file.name });
    } catch {
      if (selection === this.photoSelection)
        this.photoError.set('No se pudo leer la foto. Vuelve a seleccionarla.');
    } finally {
      if (selection === this.photoSelection) this.readingPhoto.set(false);
    }
  }
  removePhoto() {
    this.photoSelection++;
    this.photo.set(null);
    this.photoError.set('');
    this.readingPhoto.set(false);
  }
}
