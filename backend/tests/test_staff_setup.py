from contextlib import contextmanager
from unittest.mock import Mock
import pytest
from backend import setup


def configure_account(monkeypatch,correo='persona@example.test'):
    conn=Mock()
    conn.execute.side_effect=[Mock(fetchone=Mock(return_value={'idPersona':1})),Mock(fetchone=Mock(return_value={'idUsuario':5,'correo':correo})),Mock(),Mock()]
    @contextmanager
    def connection():yield conn
    monkeypatch.setattr(setup,'connection',connection)
    answers=iter(['administrador','persona@example.test','00000000','SI'])
    monkeypatch.setattr('builtins.input',lambda _:next(answers))
    getpass=Mock(side_effect=AssertionError('No se debe pedir ni cambiar la contraseña existente.'))
    monkeypatch.setattr(setup,'getpass',getpass)
    return conn,getpass


def test_existing_account_can_be_promoted_locally_without_resetting_password(monkeypatch):
    conn,getpass=configure_account(monkeypatch)
    setup.staff()
    statements=[c.args[0] for c in conn.execute.call_args_list]
    assert any('UPDATE public."USUARIO_SISTEMA"' in s and '"idRol"' in s for s in statements)
    assert any('DELETE FROM public."SESION"' in s for s in statements)
    assert not any('password' in s or 'INSERT' in s for s in statements)
    getpass.assert_not_called()


def test_account_email_must_match_before_changing_its_role(monkeypatch):
    conn,_=configure_account(monkeypatch,'otra@example.test')
    with pytest.raises(ValueError):setup.staff()
    assert not any('UPDATE' in c.args[0] for c in conn.execute.call_args_list)
