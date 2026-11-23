import { afterNextRender, Component, inject, signal, OnDestroy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../services/api';
import { Auth } from '../../services/auth';
import { Catalogs, Report, Row } from '../../interfaces/platform';
import { LocationMap } from '../shared/location-map';
import { Icon } from '../shared/icon';
import { DialogFocus } from '../shared/dialog-focus';

interface Field {
  key: string;
  label: string;
  options?: { value: string; label: string }[];
  optional?: boolean;
}
@Component({
  selector: 'app-report-detail',
  imports: [DatePipe, RouterLink, LocationMap, Icon, DialogFocus],
  templateUrl: './report-detail.html',
})
export class ReportDetail implements OnDestroy {
  private api = inject(Api);
  readonly auth = inject(Auth);
  id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  data = signal<Row | null>(null);
  resources = signal<Row>({ cuadrillas: [], vehiculos: [] });
  catalogs = signal<Catalogs>({ tipos: [], prioridades: [], estados: [] });
  otherReports = signal<Report[]>([]);
  error = signal('');
  notice = signal('');
  busy = signal(false);
  loading = signal(true);
  photoUrl = signal('');
  photoError = signal('');
  private destroyed = false;
  actionError = signal('');
  action = signal<{
    title: string;
    path: string;
    fields: Field[];
    method?: 'PUT';
    extra?: Row;
  } | null>(null);
  draft = signal<Record<string, string>>({});
  get report(): Report | null {
    return (this.data()?.['reporte'] as Report) || null;
  }
  get admin() {
    return this.auth.user()?.rol === 'administrador';
  }
  constructor() {
    afterNextRender(() => void this.load());
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.data.set(await this.api.get<Row>(`/reportes/${this.id}`));
      if (this.report?.fotoDisponible && !this.photoUrl()) {
        try {
          const blob = await this.api.blob(`/reportes/${this.id}/foto`);
          if (!this.destroyed) this.photoUrl.set(URL.createObjectURL(blob));
        } catch {
          this.photoError.set(
            'No fue posible cargar la fotografía. Actualiza el reporte para intentarlo nuevamente.',
          );
        }
      }
      if (this.admin) {
        const [r, c, reports] = await Promise.all([
          this.api.get<Row>('/recursos'),
          this.api.get<Catalogs>('/catalogos'),
          this.api.get<Report[]>('/reportes'),
        ]);
        this.resources.set(r);
        this.catalogs.set(c);
        this.otherReports.set(reports);
      }
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
  label(r: Report) {
    return r.revision === 'pendiente'
      ? 'Pendiente de revisión'
      : r.revision === 'rechazado'
        ? 'Rechazado'
        : r.nombreEstado === 'pendiente'
          ? 'Pendiente de atención'
          : r.nombreEstado === 'en proceso'
            ? 'En proceso'
            : 'Resuelto';
  }
  launch(kind: string, attention?: Row) {
    const reason: Field = { key: 'motivo', label: 'Motivo u observación (mínimo 5 caracteres)' };
    let fields: Field[] = [reason],
      path = `/reportes/${this.id}/${kind}`,
      title = '',
      extra: Row = {},
      method: 'PUT' | undefined;
    let draft: Record<string, string> = { motivo: '' };
    if (kind === 'aprobar' || kind === 'rechazar') {
      title = kind === 'aprobar' ? 'Aprobar reporte' : 'Rechazar reporte';
      path = `/reportes/${this.id}/revision`;
      extra = { revision: kind === 'aprobar' ? 'aprobado' : 'rechazado' };
      fields = [
        {
          key: 'validacionTerritorial',
          label: 'Resultado de la validación territorial',
          options: [
            { value: 'dentro', label: 'Dentro del ámbito municipal' },
            { value: 'fuera', label: 'Fuera del ámbito municipal' },
          ],
        },
        reason,
      ];
      draft['validacionTerritorial'] =
        kind === 'aprobar'
          ? 'dentro'
          : this.report?.validacionTerritorial === 'fuera'
            ? 'fuera'
            : 'dentro';
    }
    if (kind === 'prioridad') {
      title = 'Establecer prioridad';
      fields = [
        {
          key: 'idPrioridad',
          label: 'Prioridad',
          options: this.catalogs()
            .prioridades.filter((p) => p['activo'])
            .map((p) => ({ value: String(p['idPrioridad']), label: p['nombrePrioridad'] })),
        },
        reason,
      ];
      draft['idPrioridad'] = String(this.report?.idPrioridad || '');
    }
    if (kind === 'duplicidad') {
      title = 'Revisar relación de duplicidad';
      fields = [
        {
          key: 'idReporteOriginal',
          label: 'Reporte original (vacío para desvincular)',
          optional: true,
          options: this.otherReports()
            .filter((r) => r.idReporte !== this.id)
            .map((r) => ({
              value: String(r.idReporte),
              label: `#${r.idReporte} · ${r.direccionReferencia}`,
            })),
        },
        reason,
      ];
      draft['idReporteOriginal'] = String(this.report?.idReporteOriginal || '');
    }
    if (kind === 'asignar' || kind === 'reasignar') {
      title = kind === 'asignar' ? 'Asignar atención' : 'Reasignar atención';
      path = `/reportes/${this.id}/atenciones` + (attention ? '/' + attention['idAtencion'] : '');
      method = attention ? 'PUT' : undefined;
      fields = [
        {
          key: 'idCuadrilla',
          label: 'Cuadrilla disponible',
          options: this.resources()
            ['cuadrillas'].filter(
              (c: Row) => c['disponible'] || c['idCuadrilla'] === attention?.['idCuadrilla'],
            )
            .map((c: Row) => ({ value: String(c['idCuadrilla']), label: c['nombreCuadrilla'] })),
        },
        {
          key: 'idVehiculo',
          label: 'Vehículo disponible',
          options: this.resources()
            ['vehiculos'].filter(
              (v: Row) => v['disponible'] || v['idVehiculo'] === attention?.['idVehiculo'],
            )
            .map((v: Row) => ({
              value: String(v['idVehiculo']),
              label: `${v['placa']} · ${v['marca']}`,
            })),
        },
        reason,
      ];
      draft['idCuadrilla'] = String(attention?.['idCuadrilla'] || '');
      draft['idVehiculo'] = String(attention?.['idVehiculo'] || '');
    }
    if (['iniciar', 'observar', 'finalizar'].includes(kind)) {
      title =
        kind === 'iniciar'
          ? 'Iniciar atención'
          : kind === 'finalizar'
            ? 'Finalizar intervención'
            : 'Registrar observación';
      path = `/atenciones/${attention!['idAtencion']}/${kind}`;
      if (kind === 'iniciar') draft['motivo'] = 'Inicio de labores de limpieza.';
    }
    if (kind === 'resolver') title = 'Validar resolución del reporte';
    if (kind === 'reabrir') title = 'Reabrir reporte';
    this.draft.set(draft);
    this.actionError.set('');
    this.action.set({ title, path, fields, extra, method });
  }
  setDraft(key: string, value: string) {
    this.draft.update((d) => ({ ...d, [key]: value }));
  }
  async submit(event: Event) {
    event.preventDefault();
    if (this.busy()) return;
    const a = this.action();
    if (!a) return;
    this.busy.set(true);
    this.actionError.set('');
    const payload: Row = { ...this.draft(), ...a.extra };
    for (const key of ['idPrioridad', 'idReporteOriginal', 'idCuadrilla', 'idVehiculo'])
      if (key in payload) payload[key] = payload[key] ? Number(payload[key]) : null;
    try {
      if (a.method === 'PUT') await this.api.put(a.path, payload);
      else await this.api.post(a.path, payload);
      this.action.set(null);
      this.notice.set('Operación guardada con su historial.');
      await this.load();
    } catch (e) {
      this.actionError.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  get canResolve() {
    const a = this.data()?.['atenciones'] as Row[] | undefined;
    return !!a?.length && a.every((x) => x['fechaFin']);
  }
  ngOnDestroy() {
    this.destroyed = true;
    if (this.photoUrl()) URL.revokeObjectURL(this.photoUrl());
  }
}
