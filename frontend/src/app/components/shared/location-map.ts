import {
  afterNextRender,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Api } from '../../services/api';
import { PublicConfig, Report } from '../../interfaces/platform';
import type * as Leaflet from 'leaflet';

@Component({
  selector: 'app-location-map',
  template: ` <div class="map-box" [class.map-unavailable]="!loaded()">
    <div #canvas class="map-canvas" aria-label="Mapa de ubicación en Huancayo"></div>
    @if (!loaded()) {
      <div class="map-fallback">
        <span class="map-pin">◎</span><strong>Ubicación del incidente</strong>
        <p>{{ message() }}</p>
        <span>Huancayo · Junín, Perú</span>
      </div>
    }
    @if (loaded() && editable()) {
      <span class="map-hint">Haz clic para colocar el punto del incidente</span>
    }
    @if (loaded() && tileError()) {
      <span class="map-error" role="status"
        >No se pudo cargar el fondo del mapa. Puedes usar las coordenadas manualmente.</span
      >
    }
  </div>`,
  styles: [
    `
      :host {
        display: block;
      }
      .map-box {
        isolation: isolate;
        height: 340px;
        border: 1px solid #dbe6e2;
        border-radius: 14px;
        position: relative;
        overflow: hidden;
        background: #edf4f0;
      }
      .map-canvas {
        height: 100%;
        width: 100%;
      }
      .map-fallback {
        z-index: 1000;
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 24px;
        text-align: center;
        background:
          linear-gradient(35deg, transparent 48%, #fff9 49%, #fff9 51%, transparent 52%),
          linear-gradient(125deg, #e3eee8 30%, #d8e8e0 30%, #eaf2ed 60%);
        background-size:
          100px 130px,
          100% 100%;
      }
      .map-fallback p {
        max-width: 360px;
        font-size: 0.9rem;
        color: #4b6256;
        line-height: 1.6;
        margin: 10px 0;
      }
      .map-fallback span:last-child {
        font-size: 0.85rem;
        color: #567063;
      }
      .map-pin {
        font-size: 3rem;
        color: #187456;
        margin-bottom: 12px;
      }
      .map-hint {
        z-index: 1000;
        pointer-events: none;
        position: absolute;
        bottom: 28px;
        left: 18px;
        background: #fff;
        padding: 10px 14px;
        border-radius: 8px;
        font-size: 0.85rem;
        box-shadow: 0 3px 10px #102e2b16;
      }
      .map-error {
        position: absolute;
        z-index: 1000;
        top: 12px;
        right: 12px;
        left: 54px;
        padding: 10px;
        background: #fff3dd;
        color: #663b05;
        border-radius: 8px;
        font-size: 0.85rem;
        pointer-events: none;
      }
    `,
  ],
})
export class LocationMap implements OnDestroy {
  editable = input(false);
  latitude = input(-12.0651);
  longitude = input(-75.2049);
  reports = input<Report[]>([]);
  selected = output<{ latitud: number; longitud: number }>();
  openReport = output<number>();
  private api = inject(Api);
  private canvas = viewChild<ElementRef<HTMLElement>>('canvas');
  loaded = signal(false);
  message = signal(
    'Puedes indicar coordenadas y una referencia manualmente mientras el mapa no esté disponible.',
  );
  tileError = signal(false);
  private map?: Leaflet.Map;
  private maps?: typeof Leaflet;
  private marker?: Leaflet.Marker;
  private markers: Leaflet.Marker[] = [];
  private resizeObserver?: ResizeObserver;
  private tileTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;
  constructor() {
    effect(() => {
      const lat = this.latitude(),
        lng = this.longitude(),
        reports = this.reports();
      if (this.loaded()) {
        this.updateMarkers(reports);
        if (this.editable() && this.marker) {
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            this.marker.setLatLng([lat, lng]);
            this.map?.setView([lat, lng], Math.max(this.map.getZoom(), 16));
          }
        } else if (reports.length === 1) {
          this.map?.panTo([Number(reports[0].latitud), Number(reports[0].longitud)]);
        }
      }
    });
    afterNextRender(() => void this.init());
  }
  private async init() {
    try {
      const config = await this.api.get<PublicConfig>('/config/publica');
      if (this.destroyed) return;
      if (!config.geoapifyKey) {
        this.message.set(
          'El mapa todavía no está habilitado. Puedes usar tu ubicación o ingresar coordenadas y una referencia manualmente.',
        );
        return;
      }
      // Leaflet accede a window: cargar únicamente al renderizar en el navegador.
      this.maps = await import('leaflet');
      if (this.destroyed) return;
      this.map = this.maps.map(this.canvas()!.nativeElement, {
        center: [this.latitude(), this.longitude()],
        zoom: 14,
        scrollWheelZoom: false,
      });
      const tiles = this.maps.tileLayer(
        `https://maps.geoapify.com/v1/tile/osm-carto/{z}/{x}/{y}.png?apiKey=${encodeURIComponent(config.geoapifyKey)}`,
        {
          maxZoom: 20,
          attribution:
            '<a href="https://www.geoapify.com/" target="_blank" rel="noopener">Geoapify</a> | &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',
        },
      );
      let successfulTiles = 0;
      tiles.on('tileload', () => {
        successfulTiles++;
        clearTimeout(this.tileTimer);
        this.tileError.set(false);
      });
      tiles.on('tileerror', () => {
        if (!successfulTiles) this.tileError.set(true);
      });
      this.tileTimer = setTimeout(() => {
        if (!this.destroyed && !successfulTiles) this.tileError.set(true);
      }, 10000);
      tiles.addTo(this.map);
      if (this.editable()) {
        this.marker = this.maps
          .marker([this.latitude(), this.longitude()], {
            draggable: true,
            icon: this.pinIcon(),
            title: 'Punto seleccionado',
          })
          .addTo(this.map);
        this.map.on('click', (event: Leaflet.LeafletMouseEvent) => {
          this.pick(event.latlng.lat, event.latlng.lng);
        });
        this.marker.on('dragend', () => {
          const p = this.marker!.getLatLng();
          this.pick(p.lat, p.lng);
        });
      }
      this.loaded.set(true);
      this.updateMarkers(this.reports());
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
        this.resizeObserver.observe(this.canvas()!.nativeElement);
      }
    } catch {
      if (this.destroyed) return;
      this.map?.remove();
      this.map = undefined;
      this.loaded.set(false);
      this.message.set(
        'No fue posible cargar el mapa. Conserva la referencia y utiliza las coordenadas manuales.',
      );
    }
  }
  private pick(lat: number, lng: number) {
    this.marker?.setLatLng([lat, lng]);
    this.selected.emit({ latitud: Number(lat.toFixed(7)), longitud: Number(lng.toFixed(7)) });
  }
  private updateMarkers(reports: Report[]) {
    for (const marker of this.markers) marker.remove();
    if (!this.map || !this.maps) return;
    this.markers = reports
      .filter((r) => Number.isFinite(Number(r.latitud)) && Number.isFinite(Number(r.longitud)))
      .map((report) => {
        const title = `Reporte #${report.idReporte} · ${report.nombreTipo}`;
        const marker = this.maps!.marker([Number(report.latitud), Number(report.longitud)], {
          icon: this.pinIcon(),
          title,
        }).addTo(this.map!);
        const label = document.createElement('span');
        label.textContent = title;
        marker.bindTooltip(label);
        marker.on('click', () => this.openReport.emit(report.idReporte));
        return marker;
      });
  }
  private pinIcon(): Leaflet.DivIcon {
    return this.maps!.divIcon({
      className: 'residuos-map-marker',
      html: '<svg width="30" height="40" viewBox="0 0 30 40" aria-hidden="true"><path d="M15 39C12 34 1 23 1 15a14 14 0 0 1 28 0c0 8-11 19-14 24Z" fill="#167454" stroke="white" stroke-width="2"/><circle cx="15" cy="15" r="5" fill="white"/></svg>',
      iconSize: [30, 40],
      iconAnchor: [15, 40],
      tooltipAnchor: [0, -36],
    });
  }
  ngOnDestroy() {
    this.destroyed = true;
    clearTimeout(this.tileTimer);
    this.resizeObserver?.disconnect();
    this.map?.remove();
    this.map = undefined;
  }
}
