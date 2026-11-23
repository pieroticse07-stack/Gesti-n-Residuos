"""Una conexión por operación; psycopg confirma o revierte la transacción."""

from contextlib import contextmanager
from collections.abc import Iterator

import psycopg
from psycopg.rows import dict_row
from psycopg.conninfo import conninfo_to_dict

from backend.config import get_settings


class DatabaseNotConfiguredError(Exception):
    pass


@contextmanager
def connection() -> Iterator[psycopg.Connection]:
    url = get_settings().database_url.get_secret_value()
    if not url:
        raise DatabaseNotConfiguredError()
    params = conninfo_to_dict(url)
    params.setdefault("sslmode", "require")
    params.setdefault("connect_timeout", "10")
    with psycopg.connect(**params, row_factory=dict_row) as conn:
        conn.execute("SET LOCAL statement_timeout = '15s'")
        conn.execute("SET LOCAL TIME ZONE 'America/Lima'")
        yield conn
