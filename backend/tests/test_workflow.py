from unittest.mock import Mock
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from backend.main import create_app
from backend.apis.workflow import get_workflow_repository
from backend.repositories.workflow_repository import WorkflowRepository
from backend.services.auth import current_user, password_hash, password_valid, RateLimiter

CITIZEN={'idUsuario':10,'idPersona':10,'rol':'ciudadano','nombres':'Prueba','apellidos':'Ciudadana','correo':'ciudadano@example.test'}


@pytest.fixture
def workflow():
    app=create_app();repository=Mock(spec=WorkflowRepository)
    app.dependency_overrides[get_workflow_repository]=lambda:repository
    with TestClient(app) as client:yield app,client,repository


def test_private_routes_require_login(workflow):
    _,client,repo=workflow
    for path in ['/api/reportes','/api/cuentas','/api/personas','/api/recursos','/api/catalogos','/api/atenciones','/api/indicadores']:
        assert client.get(path).status_code==401
    repo.reports.assert_not_called()


@pytest.mark.parametrize('path,payload',[
('/api/reportes/1/revision',{'revision':'aprobado','validacionTerritorial':'dentro','motivo':'Revisado correctamente'}),
('/api/reportes/1/prioridad',{'idPrioridad':1,'motivo':'Prioridad por evaluar'}),
('/api/reportes/1/atenciones',{'idCuadrilla':1,'idVehiculo':1,'motivo':'Asignación de prueba'}),
('/api/reportes/1/resolver',{'motivo':'Revisión del resultado'}),
('/api/cuadrillas',{'nombreCuadrilla':'Equipo prueba'}),
('/api/atenciones/1/iniciar',{'motivo':'Inicio de intervención'}),
])
def test_citizen_cannot_perform_municipal_actions(workflow,path,payload):
    app,client,repo=workflow;app.dependency_overrides[current_user]=lambda:CITIZEN
    assert client.post(path,json=payload).status_code==403
    assert not repo.mock_calls


def test_registration_cannot_choose_role(workflow):
    _,client,_=workflow
    data={'correo':'a@example.test','password':'Segura12345','rol':'administrador','persona':{'nombres':'Prueba','apellidos':'Cuenta','dni':'00000000','telefono':'900000000'}}
    assert client.post('/api/auth/registro',json=data).status_code==422


@pytest.mark.parametrize('change',[{'latitud':91},{'longitud':-181},{'idTipoResiduo':0},{'descripcion':'a'},{'direccionReferencia':'x'}])
def test_invalid_report_rejected_before_repository(workflow,change):
    app,client,repo=workflow;app.dependency_overrides[current_user]=lambda:CITIZEN
    report={'idTipoResiduo':1,'descripcion':'Acumulación de residuos','direccionReferencia':'Referencia de prueba','latitud':-12.06,'longitud':-75.2}
    assert client.post('/api/reportes',json={**report,**change}).status_code==422
    repo.create_report.assert_not_called()


def test_valid_report_uses_authenticated_owner(workflow):
    app,client,repo=workflow;app.dependency_overrides[current_user]=lambda:CITIZEN
    repo.create_report.return_value={'idReporte':1,'revision':'pendiente'}
    data={'idTipoResiduo':1,'descripcion':'Acumulación de residuos','direccionReferencia':'Referencia de prueba','latitud':-12.06,'longitud':-75.2}
    assert client.post('/api/reportes',json=data).status_code==201
    assert repo.create_report.call_args.args[1]['idUsuario']==10
    assert client.post('/api/reportes',json={**data,'idUsuarioReportante':22}).status_code==422


def test_dni_missing_configuration_is_graceful(workflow,monkeypatch):
    from backend.config import Settings
    monkeypatch.setattr('backend.services.integrations.get_settings',lambda:Settings(_env_file=None,apisperu_token=''))
    _,client,_=workflow
    r=client.post('/api/integraciones/dni/consulta',json={'dni':'00000000'})
    assert r.status_code==503
    assert 'manualmente' in r.json()['detail']


def test_config_never_exposes_private_tokens(workflow,monkeypatch):
    from backend.config import Settings
    monkeypatch.setattr('backend.apis.workflow.get_settings',lambda:Settings(_env_file=None,apisperu_token='private-token',database_url='postgresql://private-database',geoapify_api_key='restricted-public-key'))
    _,client,_=workflow;r=client.get('/api/config/publica')
    assert r.json()['geoapifyKey']=='restricted-public-key'
    assert r.json()['geocodificacionDisponible'] is True
    assert 'private-token' not in r.text and 'private-database' not in r.text


def test_cross_origin_write_rejected(workflow):
    _,client,_=workflow
    assert client.post('/api/auth/logout',headers={'Origin':'https://untrusted.example'}).status_code==403


def test_password_hash_is_salted_and_verifiable():
    a=password_hash('Segura12345');b=password_hash('Segura12345')
    assert a!=b and 'Segura12345' not in a
    assert password_valid('Segura12345',a)
    assert not password_valid('incorrecta',a)
    assert not password_valid('anything','bad-hash')


def test_rate_limit_blocks_repeated_requests():
    limiter=RateLimiter();limiter.check('test',2);limiter.check('test',2)
    with pytest.raises(HTTPException) as error:limiter.check('test',2)
    assert error.value.status_code==429
