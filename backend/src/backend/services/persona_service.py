from backend.repositories.persona_repository import PersonaRepository
from backend.schemas.persona import PersonaCreate, PersonaUpdate
from backend.services.errors import PersonaNotFoundError


class PersonaService:
    def __init__(self, repository: PersonaRepository) -> None:
        self.repository = repository

    def list_personas(self) -> list[dict]:
        return self.repository.list_all()

    def get_persona(self, persona_id: int) -> dict:
        persona = self.repository.get(persona_id)
        if persona is None:
            raise PersonaNotFoundError()
        return persona

    def create_persona(self, data: PersonaCreate) -> dict:
        # La restricción UNIQUE en PostgreSQL también protege solicitudes simultáneas.
        return self.repository.create(data)

    def update_persona(self, persona_id: int, data: PersonaUpdate) -> dict:
        persona = self.repository.update(persona_id, data)
        if persona is None:
            raise PersonaNotFoundError()
        return persona

    def delete_persona(self, persona_id: int) -> None:
        if not self.repository.delete(persona_id):
            raise PersonaNotFoundError()
