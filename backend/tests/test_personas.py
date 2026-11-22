import psycopg
import pytest

from backend.database import DatabaseNotConfiguredError

DATOS = {"nombres": "María Elena", "apellidos": "Torres Mendoza", "dni": "00123456", "telefono": "987654321"}
PERSONA = {"idPersona": 1, **DATOS}


def test_crud_contract(client, repository):
    repository.create.return_value = PERSONA
    created = client.post("/api/personas", json=DATOS)
    assert created.status_code == 201
    assert created.headers["location"] == "/api/personas/1"
    assert created.json() == PERSONA
    assert repository.create.call_args.args[0].dni == "00123456"

    repository.list_all.return_value = [PERSONA]
    assert client.get("/api/personas").json() == [PERSONA]
    repository.get.return_value = PERSONA
    assert client.get("/api/personas/1").json() == PERSONA

    cambios = {**DATOS, "nombres": "Ana", "dni": "00987654"}
    repository.update.return_value = {"idPersona": 1, **cambios}
    updated = client.put("/api/personas/1", json=cambios)
    assert updated.status_code == 200
    assert updated.json() == {"idPersona": 1, **cambios}
    repository.delete.return_value = True
    deleted = client.delete("/api/personas/1")
    assert deleted.status_code == 204
    assert deleted.content == b""


@pytest.mark.parametrize("cambios", [
    {"dni": "123"}, {"dni": "abcdefgh"}, {"dni": "１２３４５６７８"},
    {"telefono": "123"}, {"nombres": "   "}, {"apellidos": ""},
    {"nombres": "x" * 101}, {"idPersona": 10}, {"correo": "extra@example.test"},
])
def test_invalid_payloads(client, repository, cambios):
    assert client.post("/api/personas", json={**DATOS, **cambios}).status_code == 422
    repository.create.assert_not_called()


def test_put_requires_all_fields(client):
    assert client.put("/api/personas/1", json={"nombres": "Ana"}).status_code == 422


def test_trims_names(client, repository):
    repository.create.return_value = PERSONA
    assert client.post("/api/personas", json={**DATOS, "nombres": "  María Elena  "}).status_code == 201
    assert repository.create.call_args.args[0].nombres == "María Elena"


@pytest.mark.parametrize("method", ["get", "put", "delete"])
def test_missing_person(client, repository, method):
    repository.get.return_value = None
    repository.update.return_value = None
    repository.delete.return_value = False
    response = client.request(method, "/api/personas/999", **({"json": DATOS} if method == "put" else {}))
    assert response.status_code == 404


@pytest.mark.parametrize("method", ["create", "update"])
def test_duplicate_dni(client, repository, method):
    getattr(repository, method).side_effect = psycopg.errors.UniqueViolation()
    response = client.post("/api/personas", json=DATOS) if method == "create" else client.put("/api/personas/1", json=DATOS)
    assert response.status_code == 409
    assert "DNI" in response.json()["detail"]


@pytest.mark.parametrize("error", [DatabaseNotConfiguredError(), psycopg.OperationalError("secret-password"), psycopg.errors.UndefinedTable()])
def test_database_unavailable(client, repository, error):
    repository.list_all.side_effect = error
    response = client.get("/api/personas")
    assert response.status_code == 503
    assert "secret-password" not in response.text


def test_no_database_needed_for_liveness(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_invalid_id(client):
    assert client.get("/api/personas/0").status_code == 422


def test_cors(client):
    allowed = client.options("/api/personas", headers={"Origin": "http://localhost:4200", "Access-Control-Request-Method": "POST"})
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:4200"
    rejected = client.options("/api/personas", headers={"Origin": "https://otro.example", "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in rejected.headers
