from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator
from backend.schemas.persona import PersonaCreate


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class Login(StrictModel):
    correo: str = Field(min_length=5, max_length=200, pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
    password: str = Field(min_length=10, max_length=128)

    @field_validator('correo')
    @classmethod
    def normalizar(cls, value):
        return value.lower()


class Registration(Login):
    persona: PersonaCreate


class ReportCreate(StrictModel):
    idTipoResiduo: int = Field(gt=0)
    descripcion: str = Field(min_length=10, max_length=3000)
    direccionReferencia: str = Field(min_length=5, max_length=500)
    latitud: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitud: float = Field(ge=-180, le=180, allow_inf_nan=False)
    imagenBase64: str | None = Field(default=None, max_length=7_000_000)


class Review(StrictModel):
    revision: Literal['aprobado', 'rechazado']
    validacionTerritorial: Literal['dentro', 'fuera']
    motivo: str = Field(min_length=5, max_length=1500)


class Reason(StrictModel):
    motivo: str = Field(min_length=5, max_length=1500)


class Priority(Reason):
    idPrioridad: int = Field(gt=0)


class Duplicate(Reason):
    idReporteOriginal: int | None = Field(default=None, gt=0)


class Assignment(Reason):
    idCuadrilla: int = Field(gt=0)
    idVehiculo: int = Field(gt=0)


class CrewData(StrictModel):
    nombreCuadrilla: str = Field(min_length=3, max_length=100)
    descripcion: str = Field(default='', max_length=500)
    activo: bool = True


class VehicleData(StrictModel):
    placa: str = Field(min_length=5, max_length=15)
    marca: str = Field(min_length=2, max_length=80)
    modelo: str = Field(min_length=1, max_length=80)
    capacidadToneladas: float = Field(gt=0, le=1000, allow_inf_nan=False)
    estadoOperativo: Literal['operativo', 'mantenimiento', 'fuera de servicio'] = 'operativo'
    activo: bool = True


class Membership(StrictModel):
    idUsuario: int = Field(gt=0)


class AccountData(StrictModel):
    rol: Literal['ciudadano','administrador','cuadrilla']
    activo: bool


class StaffAccount(Login):
    idPersona: int = Field(gt=0)
    rol: Literal['ciudadano','administrador','cuadrilla']


class CatalogData(StrictModel):
    nombre: str = Field(min_length=2, max_length=80)
    descripcion: str = Field(default='', max_length=500)
    orden: int = Field(default=1, gt=0)
    activo: bool = True


class DniLookup(StrictModel):
    dni: str = Field(pattern=r'^[0-9]{8}$')


class Geocode(StrictModel):
    direccion: str = Field(min_length=5, max_length=300)
