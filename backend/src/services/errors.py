class PersonaNotFoundError(Exception):
    def __init__(self) -> None:
        super().__init__("La persona solicitada no existe.")
