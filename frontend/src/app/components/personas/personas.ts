import { afterNextRender, Component, computed, inject, signal } from '@angular/core';
import { form, FormField, FormRoot, maxLength, pattern, required } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { Persona, PersonaDatos } from '../../interfaces/persona';
import { PersonaService } from '../../services/persona';

const vacio = (): PersonaDatos => ({ nombres: '', apellidos: '', dni: '', telefono: '' });

@Component({
  selector: 'app-personas',
  imports: [FormField, FormRoot],
  templateUrl: './personas.html',
  styleUrl: './personas.css',
})
export class Personas {
  private readonly service = inject(PersonaService);
  protected readonly personas = signal<Persona[]>([]);
  protected readonly cargando = signal(true);
  protected readonly conectado = signal(false);
  protected readonly error = signal('');
  protected readonly aviso = signal('');
  protected readonly busqueda = signal('');
  protected readonly seleccionada = signal<Persona | null>(null);
  protected readonly modo = signal<'crear' | 'editar' | 'ver'>('crear');
  protected readonly pendienteEliminar = signal<Persona | null>(null);
  protected readonly eliminando = signal(false);
  protected readonly consultando = signal(false);
  protected readonly errorFormulario = signal('');
  protected readonly sugerenciaDni = signal<{
    dni: string;
    nombres: string;
    apellidos: string;
  } | null>(null);
  protected readonly mensajeDni = signal('');
  protected readonly modelo = signal<PersonaDatos>(vacio());
  protected readonly formulario = form(
    this.modelo,
    (path) => {
      required(path.nombres, { message: 'Ingresa los nombres.' });
      pattern(path.nombres, /\S/, { message: 'Ingresa un nombre válido.' });
      maxLength(path.nombres, 100, { message: 'Máximo 100 caracteres.' });
      required(path.apellidos, { message: 'Ingresa los apellidos.' });
      pattern(path.apellidos, /\S/, { message: 'Ingresa apellidos válidos.' });
      maxLength(path.apellidos, 100, { message: 'Máximo 100 caracteres.' });
      required(path.dni, { message: 'Ingresa el DNI.' });
      pattern(path.dni, /^[0-9]{8}$/, { message: 'El DNI debe tener 8 dígitos.' });
      required(path.telefono, { message: 'Ingresa el teléfono.' });
      pattern(path.telefono, /^[0-9]{9}$/, { message: 'El teléfono debe tener 9 dígitos.' });
    },
    { submission: { action: async () => this.guardar() } },
  );
  protected readonly ocupado = computed(
    () => this.formulario().submitting() || this.eliminando() || this.consultando(),
  );
  protected readonly tituloFormulario = computed(() =>
    this.modo() === 'editar'
      ? 'Editar persona'
      : this.modo() === 'ver'
        ? 'Detalle de persona'
        : 'Registrar persona',
  );
  protected readonly filtradas = computed(() => {
    const texto = this.busqueda().trim().toLocaleLowerCase('es');
    return this.personas().filter((p) =>
      `${p.nombres} ${p.apellidos} ${p.dni} ${p.telefono}`.toLocaleLowerCase('es').includes(texto),
    );
  });
  constructor() {
    // Solo consultar desde el navegador, después de hidratar; nunca durante prerender.
    afterNextRender(() => {
      void this.cargar();
    });
  }
  protected async cargar(): Promise<void> {
    if (this.ocupado()) return;
    this.cargando.set(true);
    this.error.set('');
    try {
      this.personas.set(await firstValueFrom(this.service.listar()));
      this.conectado.set(true);
    } catch (error) {
      this.error.set(this.mensaje(error));
      this.conectado.set(false);
    } finally {
      this.cargando.set(false);
    }
  }
  protected nuevo(): void {
    if (this.ocupado()) return;
    this.modo.set('crear');
    this.seleccionada.set(null);
    this.formulario().reset(vacio());
    this.errorFormulario.set('');
    this.pendienteEliminar.set(null);
  }
  protected async abrir(persona: Persona, modo: 'editar' | 'ver'): Promise<void> {
    if (this.ocupado()) return;
    this.consultando.set(true);
    this.errorFormulario.set('');
    this.aviso.set('');
    this.pendienteEliminar.set(null);
    try {
      const actual = await firstValueFrom(this.service.obtener(persona.idPersona));
      this.seleccionada.set(actual);
      this.modo.set(modo);
      const { nombres, apellidos, dni, telefono } = actual;
      this.formulario().reset({ nombres, apellidos, dni, telefono });
      document.getElementById('titulo-formulario')?.focus();
    } catch (error) {
      this.errorFormulario.set(this.mensaje(error));
    } finally {
      this.consultando.set(false);
    }
  }
  protected confirmarEliminar(persona: Persona): void {
    if (this.ocupado()) return;
    this.pendienteEliminar.set(persona);
    this.error.set('');
    this.aviso.set('');
  }
  protected async eliminar(): Promise<void> {
    const persona = this.pendienteEliminar();
    if (!persona || this.ocupado()) return;
    this.eliminando.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.service.eliminar(persona.idPersona));
      this.personas.update((lista) => lista.filter((p) => p.idPersona !== persona.idPersona));
      this.pendienteEliminar.set(null);
      this.aviso.set('Persona eliminada correctamente.');
      if (this.seleccionada()?.idPersona === persona.idPersona) {
        this.modo.set('crear');
        this.seleccionada.set(null);
        this.formulario().reset(vacio());
      }
    } catch (error) {
      this.error.set(this.mensaje(error));
    } finally {
      this.eliminando.set(false);
    }
  }
  protected iniciales(persona: Persona): string {
    return `${persona.nombres.charAt(0)}${persona.apellidos.charAt(0)}`.toLocaleUpperCase('es');
  }
  protected async consultarDni(): Promise<void> {
    const dni = this.modelo().dni;
    this.sugerenciaDni.set(null);
    this.mensajeDni.set('');
    if (!/^[0-9]{8}$/.test(dni)) {
      this.mensajeDni.set('Introduce un DNI de 8 dígitos.');
      return;
    }
    if (this.ocupado()) return;
    this.consultando.set(true);
    try {
      const sugerencia = await firstValueFrom(this.service.consultarDni(dni));
      if (this.modelo().dni === dni) this.sugerenciaDni.set(sugerencia);
    } catch (error) {
      this.mensajeDni.set(this.mensaje(error));
    } finally {
      this.consultando.set(false);
    }
  }
  protected usarSugerencia(): void {
    const s = this.sugerenciaDni();
    if (s && s.dni === this.modelo().dni)
      this.modelo.update((m) => ({ ...m, nombres: s.nombres, apellidos: s.apellidos }));
    this.sugerenciaDni.set(null);
  }
  private async guardar() {
    if (this.modo() === 'ver') return;
    this.errorFormulario.set('');
    this.aviso.set('');
    const datos = this.modelo();
    const payload = { ...datos, nombres: datos.nombres.trim(), apellidos: datos.apellidos.trim() };
    try {
      const actual = this.seleccionada();
      const guardada = await firstValueFrom(
        actual ? this.service.actualizar(actual.idPersona, payload) : this.service.crear(payload),
      );
      this.personas.update((lista) =>
        actual
          ? lista.map((p) => (p.idPersona === guardada.idPersona ? guardada : p))
          : [guardada, ...lista],
      );
      this.conectado.set(true);
      this.error.set('');
      this.aviso.set(
        actual ? 'Cambios guardados correctamente.' : 'Persona registrada correctamente.',
      );
      this.modo.set('crear');
      this.seleccionada.set(null);
      this.formulario().reset(vacio());
    } catch (error) {
      const mensaje = this.mensaje(error);
      this.errorFormulario.set(mensaje);
      return { kind: 'server', message: mensaje };
    }
    return undefined;
  }
  private mensaje(error: unknown): string {
    return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
  }
}
