from pydantic import BaseModel, ConfigDict, Field


class PersonaBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    nombres: str = Field(min_length=1, max_length=100)
    apellidos: str = Field(min_length=1, max_length=100)
    dni: str = Field(pattern=r"^[0-9]{8}$", examples=["12345678"])
    telefono: str = Field(pattern=r"^[0-9]{9}$", examples=["987654321"])


class PersonaCreate(PersonaBase):
    pass


class PersonaUpdate(PersonaBase):
    """PUT reemplaza los cuatro datos editables; el ID se conserva."""


class PersonaRead(PersonaBase):
    idPersona: int
