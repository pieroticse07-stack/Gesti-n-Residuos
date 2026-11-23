"""Herramientas locales explícitas: migraciones y alta segura de personal municipal."""
import argparse
from getpass import getpass
from pathlib import Path
import psycopg
from backend.database import connection
from backend.schemas.workflow import Registration
from backend.services.auth import password_hash


def migrate():
    folder=Path(__file__).parent/'migrations'
    with connection() as conn:
        conn.execute('SELECT pg_advisory_xact_lock(728402)')
        conn.execute('CREATE TABLE IF NOT EXISTS public."MIGRACION_SISTEMA" (nombre text PRIMARY KEY, fecha timestamptz NOT NULL DEFAULT now())')
        for path in sorted(folder.glob('*.sql')):
            if conn.execute('SELECT 1 FROM public."MIGRACION_SISTEMA" WHERE nombre=%s',(path.name,)).fetchone():continue
            conn.execute(path.read_text(encoding='utf-8'),prepare=False)
            conn.execute('INSERT INTO public."MIGRACION_SISTEMA" (nombre) VALUES (%s)',(path.name,))
            print('Migración aplicada:',path.name)
    print('Esquema preparado. Persona y sus registros se conservan.')


def staff():
    print('Alta local de una cuenta de personal. No se crea ninguna contraseña predeterminada.')
    role=input('Rol (administrador/cuadrilla): ').strip()
    if role not in ('administrador','cuadrilla'):raise ValueError('Rol no válido.')
    email=input('Correo: ').strip().lower()
    dni=input('DNI: ').strip()
    with connection() as conn:
        person=conn.execute('SELECT "idPersona" FROM public."Persona" WHERE dni=%s',(dni,)).fetchone()
        if person:
            account=conn.execute('SELECT "idUsuario",correo FROM public."USUARIO_SISTEMA" WHERE "idPersona"=%s',(person['idPersona'],)).fetchone()
            if account:
                if account['correo']!=email:
                    raise ValueError('El correo no corresponde a la cuenta vinculada con ese DNI.')
                print('La persona ya tiene una cuenta. Se conservará su contraseña y sus reportes.')
                if input('¿Asignar el rol '+role+' a esa cuenta? Escribe SI para confirmar: ')!='SI':return
                conn.execute('UPDATE public."USUARIO_SISTEMA" SET "idRol"=(SELECT "idRol" FROM public."ROL" WHERE "nombreRol"=%s AND activo),"fechaEliminacion"=NULL WHERE "idUsuario"=%s',(role,account['idUsuario']))
                conn.execute('DELETE FROM public."SESION" WHERE "idUsuario"=%s',(account['idUsuario'],))
                print('Rol actualizado. Cierra sesión e ingresa nuevamente con tu contraseña habitual.')
                return
            if input('Existe una Persona con ese DNI. ¿Vincular esta cuenta? Escribe SI: ')!='SI':return
            person_id=person['idPersona']
        else:
            names=input('Nombres: ').strip();surnames=input('Apellidos: ').strip();phone=input('Teléfono: ').strip()
        password=getpass('Contraseña (mínimo 10 caracteres): ')
        if password!=getpass('Repetir contraseña: '):raise ValueError('Las contraseñas no coinciden.')
        # Validación común sin imprimir información ni contraseñas.
        validated=Registration(correo=email,password=password,persona={'nombres':'Validación' if person else names,'apellidos':'Cuenta' if person else surnames,'dni':dni,'telefono':'900000000' if person else phone})
        if not person:
            person_id=conn.execute('INSERT INTO public."Persona" (nombres,apellidos,dni,telefono) VALUES (%s,%s,%s,%s) RETURNING "idPersona"',(names,surnames,dni,phone)).fetchone()['idPersona']
        conn.execute('''INSERT INTO public."USUARIO_SISTEMA" ("idPersona","idRol",correo,password) VALUES (%s,(SELECT "idRol" FROM public."ROL" WHERE "nombreRol"=%s),%s,%s)''',(person_id,role,validated.correo,password_hash(validated.password)))
    print('Cuenta creada. Ya puede iniciar sesión.')


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('action',choices=['migrate','crear-personal']);args=parser.parse_args()
    try:
        migrate() if args.action=='migrate' else staff()
    except psycopg.Error as exc:
        raise SystemExit('No se pudo completar la operación ('+type(exc).__name__+'). Revisa conexión, migraciones y valores únicos.') from None
    except ValueError:
        raise SystemExit('Datos no válidos. Revisa correo, DNI, teléfono y contraseña.') from None


if __name__=='__main__':main()
