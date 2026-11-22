import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Personas } from './personas';
import { PersonaService } from '../../services/persona';

describe('Formulario de personas', () => {
  const persona = {
    idPersona: 1,
    nombres: 'Ana',
    apellidos: 'Torres',
    dni: '00123456',
    telefono: '987654321',
  };
  let service: Record<string, ReturnType<typeof vi.fn>>;
  beforeEach(async () => {
    service = {
      listar: vi.fn(() => of([persona])),
      obtener: vi.fn(() => of(persona)),
      crear: vi.fn(() => of(persona)),
      actualizar: vi.fn(() => of(persona)),
      eliminar: vi.fn(() => of(undefined)),
    };
    await TestBed.configureTestingModule({
      imports: [Personas],
      providers: [{ provide: PersonaService, useValue: service }],
    }).compileComponents();
  });

  async function iniciar() {
    const fixture = TestBed.createComponent(Personas);
    await fixture.whenStable();
    return fixture;
  }

  it('carga, filtra y muestra los registros reales del servicio', async () => {
    const fixture = await iniciar();
    const host = fixture.nativeElement as HTMLElement;
    expect(service['listar']).toHaveBeenCalledOnce();
    expect(host.textContent).toContain('Ana Torres');
    const search = host.querySelector('input[type=search]') as HTMLInputElement;
    search.value = 'no existe';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(host.textContent).toContain('No encontramos coincidencias');
  });

  it('valida antes de enviar y registra un formulario con signals', async () => {
    const fixture = await iniciar();
    const host = fixture.nativeElement as HTMLElement;
    const form = host.querySelector('form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(service['crear']).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Ingresa los nombres.');
    for (const [id, value] of Object.entries({
      nombres: 'Ana',
      apellidos: 'Torres',
      dni: '00123456',
      telefono: '987654321',
    })) {
      const input = host.querySelector(`#${id}`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await fixture.whenStable();
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(service['crear']).toHaveBeenCalledWith({
      nombres: 'Ana',
      apellidos: 'Torres',
      dni: '00123456',
      telefono: '987654321',
    });
    expect(host.textContent).toContain('Persona registrada correctamente.');
  });

  it('actualiza la validación al corregir DNI y teléfono y permite registrar', async () => {
    const fixture = await iniciar();
    const host = fixture.nativeElement as HTMLElement;
    const completar = (id: string, valor: string) => {
      const input = host.querySelector(`#${id}`) as HTMLInputElement;
      input.value = valor;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const enviar = () =>
      host
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    completar('nombres', 'Ana');
    completar('apellidos', 'Torres');
    completar('dni', '0012345');
    completar('telefono', '98765432');
    enviar();
    await fixture.whenStable();
    expect(service['crear']).not.toHaveBeenCalled();
    expect(host.querySelector('#error-telefono')?.textContent).toContain('9 dígitos');
    completar('dni', '00123456');
    completar('telefono', '987654321');
    await fixture.whenStable();
    expect(host.querySelector('#ayuda-dni')?.textContent).toContain('8/8');
    expect(host.querySelector('#ayuda-telefono')?.textContent).toContain('9/9');
    expect(host.querySelector('#error-telefono')?.textContent?.trim()).toBe('');
    enviar();
    await fixture.whenStable();
    expect(service['crear']).toHaveBeenCalledOnce();
    expect(host.textContent).toContain('Persona registrada correctamente.');
  });

  it('consulta y edita sin cambiar el identificador', async () => {
    const fixture = await iniciar();
    const host = fixture.nativeElement as HTMLElement;
    (host.querySelector('[aria-label="Editar a Ana"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(service['obtener']).toHaveBeenCalledWith(1);
    expect((host.querySelector('#dni') as HTMLInputElement).value).toBe('00123456');
    const nombres = host.querySelector('#nombres') as HTMLInputElement;
    nombres.value = 'María';
    nombres.dispatchEvent(new Event('input', { bubbles: true }));
    host
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(service['actualizar']).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ nombres: 'María' }),
    );
  });

  it('exige confirmación para eliminar', async () => {
    const fixture = await iniciar();
    const host = fixture.nativeElement as HTMLElement;
    (host.querySelector('[aria-label="Eliminar a Ana"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(service['eliminar']).not.toHaveBeenCalled();
    (host.querySelector('.delete-confirm .danger') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(service['eliminar']).toHaveBeenCalledWith(1);
    expect(host.textContent).toContain('Persona eliminada correctamente.');
  });

  it('informa cuando no hay conexión, sin inventar registros', async () => {
    service['listar'].mockReturnValue(throwError(() => new Error('Sin conexión a Supabase')));
    const fixture = await iniciar();
    expect(fixture.nativeElement.textContent).toContain('Sin conexión a Supabase');
    expect(fixture.nativeElement.querySelectorAll('tbody .person-cell').length).toBe(0);
  });
  it('permite corregir y reenviar después de un conflicto de DNI', async () => {
    service['crear'].mockReturnValueOnce(
      throwError(() => new Error('Ya existe una persona con ese DNI.')),
    );
    const fixture = await iniciar();
    const host = fixture.nativeElement as HTMLElement;
    for (const [id, value] of Object.entries({
      nombres: 'Ana',
      apellidos: 'Torres',
      dni: '00123456',
      telefono: '987654321',
    })) {
      const input = host.querySelector(`#${id}`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    host
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(host.textContent).toContain('Ya existe una persona con ese DNI.');
    const dni = host.querySelector('#dni') as HTMLInputElement;
    dni.value = '00987654';
    dni.dispatchEvent(new Event('input', { bubbles: true }));
    host
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(service['crear']).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('Persona registrada correctamente.');
  });
});
