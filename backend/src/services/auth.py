"""Contraseñas con PBKDF2 y sesiones opacas revocables; sin credenciales en el cliente."""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from threading import Lock
from time import monotonic

from fastapi import Depends, HTTPException, Request
from backend.database import connection
from backend.config import get_settings

COOKIE = 'residuos_session'
ITERATIONS = 600_000


def password_hash(password: str, *, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), ITERATIONS).hex()
    return f'pbkdf2_sha256${ITERATIONS}${salt}${digest}'


def password_valid(password: str, encoded: str) -> bool:
    try:
        algorithm, rounds, salt, expected = encoded.split('$')
        if algorithm != 'pbkdf2_sha256' or not 100_000 <= int(rounds) <= 2_000_000:
            return False
        digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), int(rounds)).hex()
        return hmac.compare_digest(digest, expected)
    except (ValueError, TypeError):
        return False


DUMMY_HASH = password_hash('not-an-account-password')


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class RateLimiter:
    """Límite por proceso para desarrollo; reemplazar por contador compartido al escalar."""
    def __init__(self):
        self.entries = {}
        self.lock = Lock()

    def check(self, key: str, limit: int, window: int = 600):
        with self.lock:
            now = monotonic()
            self.entries = {k: v for k, v in self.entries.items() if v[0] > now - window}
            since, count = self.entries.get(key, (now, 0))
            if count >= limit:
                raise HTTPException(429, 'Has realizado demasiados intentos. Espera unos minutos.')
            self.entries[key] = (since, count + 1)


limiter = RateLimiter()


USER_SELECT = '''SELECT u."idUsuario",u."idPersona",u.correo,r."nombreRol" AS rol,
 p.nombres,p.apellidos FROM public."USUARIO_SISTEMA" u
 JOIN public."ROL" r ON r."idRol"=u."idRol"
 JOIN public."Persona" p ON p."idPersona"=u."idPersona" '''


def current_user(request: Request) -> dict:
    token = request.cookies.get(COOKIE, '')
    if not token or len(token) > 128:
        raise HTTPException(401, 'Inicia sesión para continuar.')
    with connection() as conn:
        user = conn.execute(USER_SELECT + '''JOIN public."SESION" s ON s."idUsuario"=u."idUsuario"
        WHERE s.token=%s AND s.expira>now() AND u."fechaEliminacion" IS NULL AND r.activo''', (token_hash(token),)).fetchone()
    if not user:
        raise HTTPException(401, 'Tu sesión terminó. Vuelve a iniciar sesión.')
    return user


def administrator(user: dict = Depends(current_user)) -> dict:
    if user['rol'] != 'administrador':
        raise HTTPException(403, 'Esta operación corresponde al administrador municipal.')
    return user


def create_session(conn, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    conn.execute('DELETE FROM public."SESION" WHERE expira < now()')
    conn.execute('INSERT INTO public."SESION" (token,"idUsuario",expira) VALUES (%s,%s,%s)',
                 (token_hash(token), user_id, datetime.now(timezone.utc) + timedelta(hours=get_settings().session_hours)))
    return token


def register(data):
    with connection() as conn:
        # Nunca apropiarse de una Persona preexistente solo con conocer su DNI.
        person = conn.execute('INSERT INTO public."Persona" (nombres,apellidos,dni,telefono) VALUES (%s,%s,%s,%s) RETURNING "idPersona"',
            (data.persona.nombres,data.persona.apellidos,data.persona.dni,data.persona.telefono)).fetchone()
        user = conn.execute('''INSERT INTO public."USUARIO_SISTEMA" ("idPersona","idRol",correo,password)
        VALUES (%s,(SELECT "idRol" FROM public."ROL" WHERE "nombreRol"='ciudadano' AND activo),%s,%s) RETURNING "idUsuario"''',
            (person['idPersona'],data.correo,password_hash(data.password))).fetchone()
        token = create_session(conn,user['idUsuario'])
        result = conn.execute(USER_SELECT+'WHERE u."idUsuario"=%s',(user['idUsuario'],)).fetchone()
        return token,result


def login(data):
    with connection() as conn:
        row = conn.execute('''SELECT u."idUsuario",u.password FROM public."USUARIO_SISTEMA" u
        JOIN public."ROL" r ON r."idRol"=u."idRol" WHERE u.correo=%s AND u."fechaEliminacion" IS NULL AND r.activo''',(data.correo,)).fetchone()
        valid = password_valid(data.password,row['password'] if row else DUMMY_HASH)
        if not row or not valid:
            raise HTTPException(401,'Correo o contraseña incorrectos.')
        token = create_session(conn,row['idUsuario'])
        user = conn.execute(USER_SELECT+'WHERE u."idUsuario"=%s',(row['idUsuario'],)).fetchone()
        return token,user


def logout(token):
    if token:
        with connection() as conn:
            conn.execute('DELETE FROM public."SESION" WHERE token=%s',(token_hash(token),))


def create_staff(data):
    with connection() as conn:
        person=conn.execute('SELECT "idPersona" FROM public."Persona" WHERE "idPersona"=%s',(data.idPersona,)).fetchone()
        if not person:raise HTTPException(404,'Primero registra la persona para vincular su cuenta.')
        role=conn.execute('SELECT "idRol" FROM public."ROL" WHERE "nombreRol"=%s AND activo',(data.rol,)).fetchone()
        if not role:raise HTTPException(409,'El rol no está disponible.')
        return conn.execute('''INSERT INTO public."USUARIO_SISTEMA" ("idPersona","idRol",correo,password) VALUES (%s,%s,%s,%s) RETURNING "idUsuario",correo''',(data.idPersona,role['idRol'],data.correo,password_hash(data.password))).fetchone()
