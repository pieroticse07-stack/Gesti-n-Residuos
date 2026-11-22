from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from backend.apis.personas import get_persona_repository
from backend.main import create_app
from backend.repositories.persona_repository import PersonaRepository


@pytest.fixture
def repository():
    return Mock(spec=PersonaRepository)


@pytest.fixture
def client(repository):
    app = create_app()
    app.dependency_overrides[get_persona_repository] = lambda: repository
    with TestClient(app) as client:
        yield client
