import { afterNextRender, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../services/api';
import { Auth } from '../../services/auth';
import { Catalogs, Report, Row } from '../../interfaces/platform';
import { Icon } from '../shared/icon';
import { LocationMap } from '../shared/location-map';
import { DialogFocus } from '../shared/dialog-focus';

interface EditorField {
  key: string;
  label: string;
  type?: string;
  options?: { value: string; label: string }[];
  optional?: boolean;
  min?: number;
}
@Component({
  selector: 'app-workspace',
  imports: [RouterLink, DatePipe, DecimalPipe, Icon, LocationMap, DialogFocus],
  templateUrl: './workspace.html',
})
export class Workspace {
  mode: string = inject(ActivatedRoute).snapshot.data['mode'];
  readonly auth = inject(Auth);
  private api = inject(Api);
  private router = inject(Router);
  reports = signal<Report[]>([]);
  attentions = signal<Row[]>([]);
  resources = signal<Row>({ cuadrillas: [], vehiculos: [], integrantes: [] });
  accounts = signal<Row[]>([]);
  people = signal<Row[]>([]);
  catalogs = signal<Catalogs>({ tipos: [], prioridades: [], estados: [] });
  indicators = signal<Row | null>(null);
  loading = signal(true);
  busy = signal(false);
  loaded = signal(false);
  error = signal('');
  notice = signal('');
  updated = signal<Date | null>(null);
  search = signal('');
  status = signal('');
  review = signal('');
  type = signal('');
  priority = signal('');
  from = signal('');
  to = signal('');
  view = signal<'list' | 'map'>('list');
  catalogKind = signal('tipos');
  editor = signal<{
    kind: string;
    id?: number;
    title: string;
    fields: EditorField[];
    path: string;
  } | null>(null);
  draft = signal<Record<string, string>>({});
  editorError = signal('');
  selectedCrew = signal<Row | null>(null);
  titles: Record<string, string> = {
    panel: 'Una ciudad que cuidamos juntos',
    reportes: 'Directorio de reportes',
    atenciones: 'Atenciones de limpieza',
    cuadrillas: 'Cuadrillas e integrantes',
    vehiculos: 'Vehículos recolectores',
    cuentas: 'Cuentas y permisos',
    catalogos: 'Catálogos del sistema',
    indicadores: 'Indicadores de gestión',
  };
  subtitles: Record<string, string> = {
    panel: 'Conoce el avance de los reportes y las acciones de atención.',
    reportes: 'Información organizada para dar seguimiento a cada incidente.',
    atenciones: 'Registra el avance de las intervenciones asignadas.',
    cuadrillas: 'Organiza el equipo que cuida los espacios de nuestra ciudad.',
    vehiculos: 'Consulta disponibilidad y mantén los recursos operativos.',
    cuentas: 'Administra el acceso de ciudadanos y personal municipal.',
    catalogos: 'Mantén las opciones utilizadas para clasificar los reportes.',
    indicadores: 'Consulta resultados reales, con periodos y criterios visibles.',
  };
  filtered = computed(() =>
    this.reports().filter((r) => {
      const q = this.search().trim().toLocaleLowerCase('es');
      return (
        (!q ||
          `${r.idReporte} ${r.nombreTipo} ${r.descripcion} ${r.direccionReferencia}`
            .toLocaleLowerCase('es')
            .includes(q)) &&
        (!this.status() || (r.revision === 'aprobado' && r.nombreEstado === this.status())) &&
        (!this.review() || r.revision === this.review()) &&
        (!this.type() || String(r.idTipoResiduo) === this.type()) &&
        (!this.priority() || String(r.idPrioridad) === this.priority()) &&
        (!this.from() || r.fechaReporte.slice(0, 10) >= this.from()) &&
        (!this.to() || r.fechaReporte.slice(0, 10) <= this.to())
      );
    }),
  );
  summary = computed(() => {
    if (this.auth.user()?.rol === 'administrador' && this.indicators()) return this.indicators()!;
    const rows = this.reports();
    return {
      total: rows.length,
      revision_pendiente: rows.filter((r) => r.revision === 'pendiente').length,
      pendientes: rows.filter((r) => r.revision === 'aprobado' && r.nombreEstado === 'pendiente')
        .length,
      en_proceso: rows.filter((r) => r.revision === 'aprobado' && r.nombreEstado === 'en proceso')
        .length,
      resueltos: rows.filter((r) => r.revision === 'aprobado' && r.nombreEstado === 'resuelto')
        .length,
    };
  });
  constructor() {
    afterNextRender(() => void this.load());
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      if (['panel', 'reportes'].includes(this.mode)) {
        const [reports, catalogs] = await Promise.all([
          this.api.get<Report[]>('/reportes'),
          this.api.get<Catalogs>('/catalogos'),
        ]);
        this.reports.set(reports);
        this.catalogs.set(catalogs);
        if (this.mode === 'panel' && this.auth.user()?.rol === 'administrador')
          this.indicators.set(await this.api.get<Row>('/indicadores'));
      } else if (this.mode === 'atenciones')
        this.attentions.set(await this.api.get<Row[]>('/atenciones'));
      else if (['cuadrillas', 'vehiculos'].includes(this.mode)) {
        this.resources.set(await this.api.get<Row>('/recursos'));
        if (this.mode === 'cuadrillas') this.accounts.set(await this.api.get<Row[]>('/cuentas'));
      } else if (this.mode === 'cuentas') {
        const [accounts, people] = await Promise.all([
          this.api.get<Row[]>('/cuentas'),
          this.api.get<Row[]>('/personas'),
        ]);
        this.accounts.set(accounts);
        this.people.set(people);
      } else if (this.mode === 'catalogos')
        this.catalogs.set(await this.api.get<Catalogs>('/catalogos'));
      else if (this.mode === 'indicadores') {
        const params = new URLSearchParams();
        if (this.from()) params.set('desde', this.from());
        if (this.to()) params.set('hasta', this.to());
        this.indicators.set(await this.api.get<Row>('/indicadores?' + params.toString()));
      }
      this.loaded.set(true);
      this.updated.set(new Date());
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
  openReport(id: number) {
    void this.router.navigate(['/reportes', id]);
  }
  badge(r: Report) {
    return r.revision === 'pendiente'
      ? 'Por revisar'
      : r.revision === 'rechazado'
        ? 'Rechazado'
        : r.nombreEstado === 'pendiente'
          ? 'Pendiente de atención'
          : r.nombreEstado === 'en proceso'
            ? 'En proceso'
            : 'Resuelto';
  }
  badgeClass(r: Report) {
    return r.revision === 'rechazado'
      ? 'red'
      : r.revision === 'pendiente'
        ? 'amber'
        : r.nombreEstado === 'resuelto'
          ? 'green'
          : r.nombreEstado === 'en proceso'
            ? 'blue'
            : 'neutral';
  }
  setDraft(key: string, value: string) {
    this.draft.update((d) => ({ ...d, [key]: value }));
  }
  crewMembers(id: number): Row[] {
    return this.resources()['integrantes'].filter(
      (m: Row) => m['idCuadrilla'] === id && !m['fechaFin'],
    );
  }
  clearFilters() {
    this.search.set('');
    this.status.set('');
    this.review.set('');
    this.type.set('');
    this.priority.set('');
    this.from.set('');
    this.to.set('');
  }
  edit(kind: string, row: Row | null = null) {
    this.editorError.set('');
    this.notice.set('');
    let fields: EditorField[] = [],
      draft: Record<string, string> = {},
      path = '',
      id: number | undefined,
      title = '';
    const active = {
      key: 'activo',
      label: 'Estado',
      options: [
        { value: 'true', label: 'Activo' },
        { value: 'false', label: 'De baja / inactivo' },
      ],
    };
    if (kind === 'cuadrillas') {
      id = row?.['idCuadrilla'];
      title = id ? 'Editar cuadrilla' : 'Nueva cuadrilla';
      path = '/cuadrillas';
      fields = [
        { key: 'nombreCuadrilla', label: 'Nombre de la cuadrilla' },
        { key: 'descripcion', label: 'Descripción', type: 'textarea', optional: true },
        active,
      ];
      draft = {
        nombreCuadrilla: row?.['nombreCuadrilla'] || '',
        descripcion: row?.['descripcion'] || '',
        activo: String(!row?.['fechaBaja']),
      };
    }
    if (kind === 'vehiculos') {
      id = row?.['idVehiculo'];
      title = id ? 'Editar vehículo' : 'Nuevo vehículo';
      path = '/vehiculos';
      fields = [
        { key: 'placa', label: 'Placa' },
        { key: 'marca', label: 'Marca' },
        { key: 'modelo', label: 'Modelo' },
        { key: 'capacidadToneladas', label: 'Capacidad (toneladas)', type: 'number', min: 0.01 },
        {
          key: 'estadoOperativo',
          label: 'Estado operativo',
          options: ['operativo', 'mantenimiento', 'fuera de servicio'].map((value) => ({
            value,
            label: value,
          })),
        },
        active,
      ];
      draft = {
        placa: row?.['placa'] || '',
        marca: row?.['marca'] || '',
        modelo: row?.['modelo'] || '',
        capacidadToneladas: String(row?.['capacidadToneladas'] || ''),
        estadoOperativo: row?.['estadoOperativo'] || 'operativo',
        activo: String(!row?.['fechaBaja']),
      };
    }
    if (kind === 'cuentas') {
      id = row?.['idUsuario'];
      title = id ? 'Permisos de la cuenta' : 'Nueva cuenta de personal';
      path = '/cuentas';
      fields = id
        ? []
        : [
            {
              key: 'idPersona',
              label: 'Persona sin cuenta',
              options: this.people()
                .filter((p) => !this.accounts().some((a) => a['idPersona'] === p['idPersona']))
                .map((p) => ({
                  value: String(p['idPersona']),
                  label: `${p['nombres']} ${p['apellidos']}`,
                })),
            },
            { key: 'correo', label: 'Correo', type: 'email' },
            {
              key: 'password',
              label: 'Contraseña inicial (mínimo 10 caracteres)',
              type: 'password',
            },
          ];
      fields.push({
        key: 'rol',
        label: 'Rol',
        options: ['ciudadano', 'administrador', 'cuadrilla'].map((value) => ({
          value,
          label: value,
        })),
      });
      if (id) fields.push(active);
      draft = {
        idPersona: '',
        correo: '',
        password: '',
        rol: row?.['rol'] || 'cuadrilla',
        activo: String(!row?.['fechaEliminacion']),
      };
    }
    if (kind === 'integrante') {
      path = `/cuadrillas/${row!['idCuadrilla']}/integrantes`;
      title = 'Vincular integrante';
      fields = [
        {
          key: 'idUsuario',
          label: 'Cuenta de cuadrilla',
          options: this.accounts()
            .filter((a) => a['rol'] === 'cuadrilla' && !a['fechaEliminacion'])
            .map((a) => ({ value: String(a['idUsuario']), label: a['nombre'] })),
        },
      ];
      draft = { idUsuario: '' };
    }
    if (kind === 'avance') {
      path = `/atenciones/${row!['idAtencion']}/${row!['accion']}`;
      title =
        row!['accion'] === 'iniciar'
          ? 'Iniciar atención'
          : row!['accion'] === 'finalizar'
            ? 'Finalizar intervención'
            : 'Registrar observación';
      fields = [
        { key: 'motivo', label: 'Observación (visible en el seguimiento)', type: 'textarea' },
      ];
      draft = { motivo: row!['accion'] === 'iniciar' ? 'Inicio de labores de limpieza.' : '' };
    }
    if (kind === 'catalogo') {
      const k = this.catalogKind();
      if (k === 'estados') return;
      id = row?.[k === 'tipos' ? 'idTipoResiduo' : 'idPrioridad'];
      path = '/catalogos/' + k;
      title = id ? 'Editar opción' : 'Nueva opción';
      fields = [{ key: 'nombre', label: 'Nombre' }];
      if (k === 'tipos')
        fields.push({ key: 'descripcion', label: 'Descripción', type: 'textarea', optional: true });
      if (k === 'prioridades')
        fields.push({
          key: 'orden',
          label: 'Orden de atención (1 = mayor prioridad)',
          type: 'number',
          min: 1,
        });
      fields.push(active);
      draft = {
        nombre: row?.[k === 'tipos' ? 'nombreTipo' : 'nombrePrioridad'] || '',
        descripcion: row?.['descripcion'] || '',
        orden: String(row?.['orden'] || 1),
        activo: String(row?.['activo'] ?? true),
      };
    }
    this.draft.set(draft);
    this.editor.set({ kind, id, title, fields, path });
  }
  async save(event: Event) {
    event.preventDefault();
    if (this.busy()) return;
    const e = this.editor();
    if (!e) return;
    const d = this.draft();
    let payload: Row = { ...d };
    this.busy.set(true);
    this.editorError.set('');
    if (e.kind === 'cuadrillas')
      payload = {
        nombreCuadrilla: d['nombreCuadrilla'],
        descripcion: d['descripcion'],
        activo: d['activo'] === 'true',
      };
    if (e.kind === 'vehiculos')
      payload = {
        ...d,
        capacidadToneladas: Number(d['capacidadToneladas']),
        activo: d['activo'] === 'true',
      };
    if (e.kind === 'cuentas')
      payload = e.id
        ? { rol: d['rol'], activo: d['activo'] === 'true' }
        : {
            idPersona: Number(d['idPersona']),
            correo: d['correo'],
            password: d['password'],
            rol: d['rol'],
          };
    if (e.kind === 'integrante') payload = { idUsuario: Number(d['idUsuario']) };
    if (e.kind === 'catalogo')
      payload = {
        nombre: d['nombre'],
        descripcion: d['descripcion'] || '',
        orden: Number(d['orden'] || 1),
        activo: d['activo'] === 'true',
      };
    try {
      if (e.id) await this.api.put(e.path + '/' + e.id, payload);
      else await this.api.post(e.path, payload);
      this.editor.set(null);
      this.notice.set('Los cambios se guardaron correctamente.');
      await this.load();
    } catch (error) {
      this.editorError.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
  advance(a: Row, action: string) {
    this.edit('avance', { ...a, accion: action });
  }
  async endMembership(id: number) {
    if (!confirm('¿Finalizar la pertenencia de este integrante? Se conservará su historial.'))
      return;
    this.busy.set(true);
    try {
      await this.api.post(`/pertenencias/${id}/finalizar`);
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  catalogRows(): Row[] {
    return this.catalogs()[this.catalogKind() as keyof Catalogs];
  }
}
