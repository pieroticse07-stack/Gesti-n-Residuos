"""Prueba real optativa. Todas las filas creadas se revierten al finalizar."""
import os
from contextlib import contextmanager
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from backend.database import connection
from backend.main import create_app
from backend.services import auth
from test_report_photo import sample_photo

pytestmark=pytest.mark.skipif(os.getenv('RUN_WORKFLOW_DB_TESTS')!='1',reason='Optativa: requiere Supabase y RUN_WORKFLOW_DB_TESTS=1; revierte todos los datos de prueba.')


def test_real_citizen_review_resources_and_resolution(monkeypatch):
    with connection() as conn:
        with conn.transaction(force_rollback=True):
            @contextmanager
            def isolated_connection():
                with conn.transaction():yield conn
            for module in ['backend.services.auth','backend.repositories.workflow_repository','backend.repositories.persona_repository','backend.main']:
                monkeypatch.setattr(module+'.connection',isolated_connection)
            auth.limiter.entries.clear()
            with TestClient(create_app(),headers={'Origin':'http://localhost:4200'}) as client:
                users={};suffix=uuid4().hex[:12]
                for index,role in enumerate(['ciudadano','administrador','cuadrilla']):
                    client.cookies.clear()
                    dni=str(int(uuid4().hex[:8],16)%90_000_000+10_000_000)
                    data={'correo':f'{role}-{suffix}@example.test','password':'PruebaSegura98765','persona':{'nombres':'Prueba','apellidos':role,'dni':dni,'telefono':'900000000'}}
                    response=client.post('/api/auth/registro',json=data)
                    assert response.status_code==201,response.text
                    user=response.json();users[role]=(client.cookies.get(auth.COOKIE),user)
                    if role!='ciudadano':
                        conn.execute('UPDATE public."USUARIO_SISTEMA" SET "idRol"=(SELECT "idRol" FROM public."ROL" WHERE "nombreRol"=%s) WHERE "idUsuario"=%s',(role,user['idUsuario']))

                def call(role,method,path,data=None):
                    client.cookies.clear();client.cookies.set(auth.COOKIE,users[role][0])
                    return client.request(method,'/api'+path,**({'json':data} if data is not None else {}))

                cats=call('ciudadano','GET','/catalogos').json()
                data={'idTipoResiduo':cats['tipos'][0]['idTipoResiduo'],'descripcion':'Prueba de reporte con residuos sólidos','direccionReferencia':'Ubicación ficticia para verificación transaccional','latitud':-12.0651,'longitud':-75.2049}
                first=call('ciudadano','POST','/reportes',{**data,'imagenBase64':sample_photo()});assert first.status_code==201,first.text
                report=first.json()['idReporte']
                photo=call('ciudadano','GET',f'/reportes/{report}/foto')
                assert photo.status_code==200 and photo.headers['content-type']=='image/jpeg'
                assert photo.content.startswith(b'\xff\xd8')
                assert call('cuadrilla','GET',f'/reportes/{report}/foto').status_code==403
                assert call('ciudadano','GET',f'/reportes/{report}').json()['reporte']['fotoDisponible'] is True
                second=call('ciudadano','POST','/reportes',data).json()['idReporte']
                decision={'revision':'aprobado','validacionTerritorial':'dentro','motivo':'Ámbito revisado para la prueba.'}
                assert call('ciudadano','POST',f'/reportes/{report}/revision',decision).status_code==403
                assert call('administrador','POST',f'/reportes/{report}/revision',{**decision,'validacionTerritorial':'fuera'}).status_code==409
                assert call('administrador','POST',f'/reportes/{report}/revision',decision).status_code==200
                assert call('administrador','POST',f'/reportes/{report}/prioridad',{'idPrioridad':cats['prioridades'][0]['idPrioridad'],'motivo':'Prioridad de prueba justificada.'}).status_code==200
                crew=call('administrador','POST','/cuadrillas',{'nombreCuadrilla':'Equipo de prueba '+suffix,'descripcion':'Solo transacción de prueba.','activo':True});assert crew.status_code==201,crew.text
                crew_id=crew.json()['idCuadrilla']
                def vehicle(plate):
                    r=call('administrador','POST','/vehiculos',{'placa':plate,'marca':'Prueba','modelo':'Temporal','capacidadToneladas':2,'estadoOperativo':'operativo','activo':True});assert r.status_code==201,r.text;return r.json()['idVehiculo']
                v1=vehicle('T'+suffix[:7]);v2=vehicle('U'+suffix[:7])
                member=call('administrador','POST',f'/cuadrillas/{crew_id}/integrantes',{'idUsuario':users['cuadrilla'][1]['idUsuario']});assert member.status_code==201,member.text
                assignment={'idCuadrilla':crew_id,'idVehiculo':v1,'motivo':'Asignación inicial de prueba.'}
                assigned=call('administrador','POST',f'/reportes/{report}/atenciones',assignment);assert assigned.status_code==201,assigned.text
                attention=assigned.json()['idAtencion']
                assert call('administrador','POST',f'/reportes/{second}/atenciones',assignment).status_code==409
                assert call('administrador','POST',f'/reportes/{second}/revision',decision).status_code==200
                assert call('administrador','POST',f'/reportes/{second}/prioridad',{'idPrioridad':cats['prioridades'][0]['idPrioridad'],'motivo':'Prioridad de prueba justificada.'}).status_code==200
                assert call('administrador','POST',f'/reportes/{second}/atenciones',assignment).status_code==409
                reassigned=call('administrador','PUT',f'/reportes/{report}/atenciones/{attention}',{**assignment,'idVehiculo':v2,'motivo':'Cambio de vehículo con historial.'});assert reassigned.status_code==200,reassigned.text
                assert call('administrador','POST',f'/reportes/{report}/resolver',{'motivo':'Validar antes de finalizar.'}).status_code==409
                assert call('cuadrilla','POST',f'/atenciones/{attention}/finalizar',{'motivo':'Intento antes de iniciar.'}).status_code==409
                assert call('cuadrilla','POST',f'/atenciones/{attention}/iniciar',{'motivo':'Inicio de labores de prueba.'}).status_code==200
                assert call('cuadrilla','POST',f'/atenciones/{attention}/observar',{'motivo':'Observación conservada en historial.'}).status_code==200
                assert call('cuadrilla','POST',f'/atenciones/{attention}/finalizar',{'motivo':'Intervención de prueba finalizada.'}).status_code==200
                detail=call('ciudadano','GET',f'/reportes/{report}');assert detail.status_code==200,detail.text
                assert detail.json()['reporte']['nombreEstado']=='en proceso'
                assert call('administrador','POST',f'/reportes/{report}/resolver',{'motivo':'Resolución municipal validada.'}).status_code==200
                assert call('ciudadano','GET',f'/reportes/{report}').json()['reporte']['nombreEstado']=='resuelto'
                assert call('administrador','POST',f'/reportes/{report}/reabrir',{'motivo':'Nueva revisión de la situación.'}).status_code==200
                assert call('administrador','POST',f'/reportes/{report}/duplicidad',{'idReporteOriginal':second,'motivo':'Relación revisada durante prueba.'}).status_code==200
                assert call('administrador','POST',f'/reportes/{second}/duplicidad',{'idReporteOriginal':report,'motivo':'Intento de relación circular.'}).status_code==409
                metrics=call('administrador','GET','/indicadores');assert metrics.status_code==200,metrics.text
                assert metrics.json()['aprobados']>=2
                resources=call('administrador','GET','/recursos');assert resources.status_code==200,resources.text
                assert any(c['idCuadrilla']==crew_id and c['disponible'] for c in resources.json()['cuadrillas'])
                history=call('administrador','GET',f'/reportes/{report}').json()
                assert len(history['asignaciones'])==2 and history['asignaciones'][0]['fechaFin']
                assert len(history['estados'])>=5 and len(history['revisiones'])==1
                assert call('administrador','POST',f'/pertenencias/{member.json()["idPertenencia"]}/finalizar').status_code==200
                assert call('cuadrilla','GET',f'/reportes/{report}').status_code==403
                assert call('ciudadano','POST','/auth/logout').status_code==200
                assert call('ciudadano','GET','/auth/me').status_code==401
