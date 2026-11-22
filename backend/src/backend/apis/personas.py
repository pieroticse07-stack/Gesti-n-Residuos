from typing import Annotated

from fastapi import APIRouter, Depends, Path, Response

from backend.repositories.persona_repository import PersonaRepository
from backend.schemas.persona import PersonaCreate, PersonaRead, PersonaUpdate
from backend.services.persona_service import PersonaService

router = APIRouter(prefix="/api/personas", tags=["Personas"])
PersonaId = Annotated[int, Path(gt=0)]


def get_persona_repository() -> PersonaRepository:
    return PersonaRepository()


def get_persona_service(
    repository: Annotated[PersonaRepository, Depends(get_persona_repository)],
) -> PersonaService:
    return PersonaService(repository)


Service = Annotated[PersonaService, Depends(get_persona_service)]


@router.get("", response_model=list[PersonaRead], summary="Listar personas")
def list_personas(service: Service):
    return service.list_personas()


@router.get("/{persona_id}", response_model=PersonaRead, summary="Consultar persona")
def get_persona(persona_id: PersonaId, service: Service):
    return service.get_persona(persona_id)


@router.post("", response_model=PersonaRead, status_code=201, summary="Registrar persona")
def create_persona(payload: PersonaCreate, response: Response, service: Service):
    persona = service.create_persona(payload)
    response.headers["Location"] = f'/api/personas/{persona["idPersona"]}'
    return persona


@router.put("/{persona_id}", response_model=PersonaRead, summary="Actualizar persona")
def update_persona(persona_id: PersonaId, payload: PersonaUpdate, service: Service):
    return service.update_persona(persona_id, payload)


@router.delete("/{persona_id}", status_code=204, summary="Eliminar persona")
def delete_persona(persona_id: PersonaId, service: Service) -> Response:
    service.delete_persona(persona_id)
    return Response(status_code=204)
