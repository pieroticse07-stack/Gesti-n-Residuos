from datetime import date
from typing import Annotated, Literal
from fastapi import APIRouter, Depends, HTTPException, Path, Request, Response
from backend.config import get_settings
from backend.repositories.workflow_repository import WorkflowRepository
from backend.schemas.workflow import (Login,Registration,ReportCreate,Review,Priority,Duplicate,Reason,Assignment,CrewData,VehicleData,Membership,AccountData,StaffAccount,CatalogData,DniLookup,Geocode)
from backend.services import auth, integrations

router=APIRouter(prefix='/api',tags=['Gestión municipal'])
User=Annotated[dict,Depends(auth.current_user)]
Admin=Annotated[dict,Depends(auth.administrator)]
Identifier=Annotated[int,Path(gt=0)]


def get_workflow_repository():return WorkflowRepository()


Repo=Annotated[WorkflowRepository,Depends(get_workflow_repository)]


def set_session(response,token):
    settings=get_settings()
    response.set_cookie(auth.COOKIE,token,httponly=True,secure=settings.cookie_secure,samesite='lax',max_age=settings.session_hours*3600,path='/')


@router.post('/auth/registro',status_code=201)
def register(payload: Registration,request: Request,response: Response):
    auth.limiter.check('registro:'+request.client.host,10)
    token,user=auth.register(payload)
    set_session(response,token)
    return user


@router.post('/auth/login')
def login(payload: Login,request: Request,response: Response):
    auth.limiter.check('login:'+request.client.host,15)
    token,user=auth.login(payload)
    set_session(response,token)
    return user


@router.get('/auth/me')
def me(user: User):return user


@router.post('/auth/logout')
def logout(request: Request,response: Response):
    auth.logout(request.cookies.get(auth.COOKIE))
    response.delete_cookie(auth.COOKIE,path='/')
    return {'message':'Sesión cerrada.'}


@router.get('/config/publica')
def config():
    s=get_settings()
    return {'geoapifyKey':s.geoapify_api_key.get_secret_value(),'dniDisponible':bool(s.apisperu_token.get_secret_value()),'geocodificacionDisponible':bool(s.geoapify_api_key.get_secret_value())}


@router.post('/integraciones/dni/consulta')
def dni(payload: DniLookup,request: Request):
    auth.limiter.check('dni:'+request.client.host,20)
    return integrations.lookup_dni(payload.dni)


@router.post('/integraciones/geocodificacion')
def geocode(payload: Geocode,user: User,request: Request):
    auth.limiter.check('geo:'+str(user['idUsuario']),60)
    return integrations.geocode(payload.direccion)


@router.get('/catalogos')
def catalogs(user: User,repo: Repo):return repo.catalogs(user['rol']=='administrador')


@router.post('/catalogos/{kind}',status_code=201)
def create_catalog(kind: Literal['tipos','prioridades','estados'],payload: CatalogData,user: Admin,repo: Repo):
    if kind=='estados':raise HTTPException(409,'Los estados del flujo son fijos: pendiente, en proceso y resuelto.')
    return repo.save_catalog(kind,payload.model_dump())


@router.put('/catalogos/{kind}/{identifier}')
def update_catalog(kind: Literal['tipos','prioridades','estados'],identifier: Identifier,payload: CatalogData,user: Admin,repo: Repo):
    if kind=='estados':raise HTTPException(409,'Los estados del flujo se conservan activos para garantizar la trazabilidad.')
    return repo.save_catalog(kind,payload.model_dump(),identifier)


@router.get('/reportes')
def reports(user: User,repo: Repo):return repo.reports(user)


@router.post('/reportes',status_code=201)
def create_report(payload: ReportCreate,user: User,repo: Repo):
    if user['rol']!='ciudadano':raise HTTPException(403,'El registro ciudadano de reportes requiere rol ciudadano.')
    return repo.create_report(payload.model_dump(),user)


@router.get('/reportes/{identifier}')
def detail(identifier: Identifier,user: User,repo: Repo):return repo.detail(identifier,user)


@router.get('/reportes/{identifier}/foto',tags=['Evidencias fotográficas'])
def report_photo(identifier: Identifier,user: User,repo: Repo):
    photo=repo.report_photo(identifier,user)
    return Response(content=bytes(photo['contenido']),media_type=photo['tipoContenido'],headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'})


@router.post('/reportes/{identifier}/revision')
def review(identifier: Identifier,payload: Review,user: Admin,repo: Repo):return repo.review(identifier,payload.model_dump(),user)


@router.post('/reportes/{identifier}/prioridad')
def priority(identifier: Identifier,payload: Priority,user: Admin,repo: Repo):return repo.priority(identifier,payload.model_dump(),user)


@router.post('/reportes/{identifier}/duplicidad')
def duplicate(identifier: Identifier,payload: Duplicate,user: Admin,repo: Repo):return repo.duplicate(identifier,payload.model_dump(),user)


@router.post('/reportes/{identifier}/atenciones',status_code=201)
def assign(identifier: Identifier,payload: Assignment,user: Admin,repo: Repo):return repo.assign(identifier,payload.model_dump(),user)


@router.put('/reportes/{identifier}/atenciones/{attention_id}')
def reassign(identifier: Identifier,attention_id: Annotated[int,Path(gt=0)],payload: Assignment,user: Admin,repo: Repo):return repo.assign(identifier,payload.model_dump(),user,attention_id)


@router.post('/reportes/{identifier}/resolver')
def close(identifier: Identifier,payload: Reason,user: Admin,repo: Repo):return repo.close(identifier,payload.motivo,user)


@router.post('/reportes/{identifier}/reabrir')
def reopen(identifier: Identifier,payload: Reason,user: Admin,repo: Repo):return repo.close(identifier,payload.motivo,user,True)


@router.post('/atenciones/{identifier}/{action}')
def progress(identifier: Identifier,action: Literal['iniciar','observar','finalizar'],payload: Reason,user: User,repo: Repo):
    if user['rol'] not in ('administrador','cuadrilla'):raise HTTPException(403,'Solo la cuadrilla asignada o el administrador puede registrar avances.')
    return repo.attention_action(identifier,action,payload.motivo,user)


@router.get('/atenciones')
def attentions(user: User,repo: Repo):
    if user['rol']=='ciudadano':raise HTTPException(403,'Consulta tus intervenciones desde el detalle de tus reportes.')
    return repo.attentions(user)


@router.get('/recursos')
def resources(user: Admin,repo: Repo):return repo.resources()


@router.post('/cuadrillas',status_code=201)
def create_crew(payload: CrewData,user: Admin,repo: Repo):return repo.save_resource('cuadrillas',payload.model_dump())


@router.put('/cuadrillas/{identifier}')
def update_crew(identifier: Identifier,payload: CrewData,user: Admin,repo: Repo):return repo.save_resource('cuadrillas',payload.model_dump(),identifier)


@router.post('/vehiculos',status_code=201)
def create_vehicle(payload: VehicleData,user: Admin,repo: Repo):return repo.save_resource('vehiculos',payload.model_dump())


@router.put('/vehiculos/{identifier}')
def update_vehicle(identifier: Identifier,payload: VehicleData,user: Admin,repo: Repo):return repo.save_resource('vehiculos',payload.model_dump(),identifier)


@router.post('/cuadrillas/{identifier}/integrantes',status_code=201)
def membership(identifier: Identifier,payload: Membership,user: Admin,repo: Repo):return repo.membership(identifier,payload.idUsuario)


@router.post('/pertenencias/{identifier}/finalizar')
def end_membership(identifier: Identifier,user: Admin,repo: Repo):return repo.end_membership(identifier)


@router.get('/cuentas')
def accounts(user: Admin,repo: Repo):return repo.accounts()


@router.post('/cuentas',status_code=201)
def create_staff(payload: StaffAccount,user: Admin):return auth.create_staff(payload)


@router.put('/cuentas/{identifier}')
def account(identifier: Identifier,payload: AccountData,user: Admin,repo: Repo):return repo.save_account(identifier,payload.model_dump(),user)


@router.get('/indicadores')
def indicators(user: Admin,repo: Repo,desde: date | None=None,hasta: date | None=None):
    if desde and hasta and desde>hasta:raise HTTPException(422,'La fecha inicial no puede ser posterior a la final.')
    return repo.indicators(desde,hasta)
