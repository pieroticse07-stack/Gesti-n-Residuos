"""Consultas explícitas a proveedores; nunca registrar URLs con tokens o DNI."""
import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from fastapi import HTTPException
from backend.config import get_settings


def fetch_json(url):
    try:
        req = Request(url,headers={'Accept':'application/json','User-Agent':'ResiduosHuancayo/1.0'})
        with urlopen(req,timeout=min(get_settings().external_api_timeout_seconds,8)) as response:
            result = json.loads(response.read(1_000_000))
            if not isinstance(result,dict):
                raise ValueError()
            return result
    except HTTPError as exc:
        if exc.code == 404:
            raise HTTPException(404,'No se encontraron datos. Puedes completarlos manualmente.') from None
        raise HTTPException(503,'El proveedor no está disponible o alcanzó su límite. Utiliza el registro manual.') from None
    except (URLError,TimeoutError,ValueError,OSError):
        raise HTTPException(503,'No fue posible consultar el servicio. Conservamos tus datos; puedes continuar manualmente.') from None


def lookup_dni(dni):
    settings = get_settings()
    token = settings.apisperu_token.get_secret_value()
    if not token:
        raise HTTPException(503,'La consulta de DNI aún no está habilitada. Completa los datos manualmente.')
    # Contrato DNI/RUC de ApisPeru, configurable si el proveedor cambia su versión.
    data = fetch_json(f'{settings.apisperu_base_url.rstrip("/")}/dni/{dni}?'+urlencode({'token':token}))
    if not data.get('nombres'):
        raise HTTPException(404,'No se encontraron nombres para ese DNI. Completa los datos manualmente.')
    return {'dni':dni,'nombres':str(data['nombres']),
            'apellidos':' '.join(str(data.get(k) or '').strip() for k in ('apellidoPaterno','apellidoMaterno')).strip() or str(data.get('apellidos',''))}


def geocode(address):
    key = get_settings().geoapify_api_key.get_secret_value()
    if not key:
        raise HTTPException(503,'La búsqueda de direcciones aún no está habilitada. Selecciona el punto o introduce sus coordenadas.')
    data = fetch_json('https://api.geoapify.com/v1/geocode/search?'+urlencode({
        'text':address,'format':'json','filter':'countrycode:pe',
        'bias':'proximity:-75.2049,-12.0651','lang':'es','limit':5,'apiKey':key,
    }))
    results = data.get('results')
    if not isinstance(results,list):
        raise HTTPException(503,'No se pudo buscar la dirección. Selecciona el punto manualmente.')
    return [{'direccion':r['formatted'],'latitud':r['lat'],'longitud':r['lon']}
            for r in results[:5] if isinstance(r,dict) and r.get('formatted')
            and isinstance(r.get('lat'),(int,float)) and isinstance(r.get('lon'),(int,float))
            and -90 <= r['lat'] <= 90 and -180 <= r['lon'] <= 180]
