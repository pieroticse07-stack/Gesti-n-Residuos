"""Prueba optativa real. Requiere un proyecto de pruebas con Persona creada."""

import os
import secrets

import pytest
from fastapi.testclient import TestClient

from backend.config import get_settings
from backend.main import create_app


@pytest.mark.skipif(not os.getenv("TEST_DATABASE_URL"), reason="Falta TEST_DATABASE_URL para la prueba real de Supabase")
def test_real_supabase_crud(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    get_settings.cache_clear()
    persona_id = None
    datos = {"nombres": "Prueba integración", "apellidos": "Temporal", "dni": f"{secrets.randbelow(100_000_000):08d}", "telefono": "999999999"}
    try:
        with TestClient(create_app()) as client:
            assert client.get("/health/db").status_code == 200
            created = client.post("/api/personas", json=datos)
            assert created.status_code == 201, created.text
            persona_id = created.json()["idPersona"]
            try:
                assert client.get(f"/api/personas/{persona_id}").json()["dni"] == datos["dni"]
                assert any(p["idPersona"] == persona_id for p in client.get("/api/personas").json())
                duplicate = client.post("/api/personas", json=datos)
                assert duplicate.status_code == 409
                updated = client.put(f"/api/personas/{persona_id}", json={**datos, "nombres": "Actualizada"})
                assert updated.status_code == 200
                assert updated.json()["nombres"] == "Actualizada"
            finally:
                assert client.delete(f"/api/personas/{persona_id}").status_code == 204
            assert client.get(f"/api/personas/{persona_id}").status_code == 404
    finally:
        get_settings.cache_clear()
