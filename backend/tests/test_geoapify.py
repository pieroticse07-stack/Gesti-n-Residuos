from urllib.parse import parse_qs, urlparse
from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from backend.config import Settings
from backend.services import integrations


@pytest.fixture
def provider(monkeypatch):
    monkeypatch.setattr(integrations, 'get_settings', lambda: Settings(
        _env_file=None, geoapify_api_key='test-map-key'))
    fetch = Mock()
    monkeypatch.setattr(integrations, 'fetch_json', fetch)
    return fetch


def test_address_search_uses_peru_and_huancayo_bias(provider):
    provider.return_value = {'results': [
        {'formatted': 'Plaza Constitución, Huancayo, Perú', 'lat': -12.068, 'lon': -75.21}
    ]}
    assert integrations.geocode('Plaza Constitución') == [{
        'direccion': 'Plaza Constitución, Huancayo, Perú', 'latitud': -12.068, 'longitud': -75.21}]
    url = urlparse(provider.call_args.args[0])
    assert url.netloc == 'api.geoapify.com'
    query = parse_qs(url.query)
    assert query['text'] == ['Plaza Constitución']
    assert query['filter'] == ['countrycode:pe']
    assert query['bias'] == ['proximity:-75.2049,-12.0651']
    assert query['format'] == ['json']
    assert query['apiKey'] == ['test-map-key']


def test_no_address_matches(provider):
    provider.return_value = {'results': []}
    assert integrations.geocode('Sin coincidencias') == []


def test_invalid_provider_response_preserves_manual_fallback(provider):
    provider.return_value = {'error': 'Service unavailable'}
    with pytest.raises(HTTPException) as error:
        integrations.geocode('Huancayo')
    assert error.value.status_code == 503
    assert 'manualmente' in error.value.detail


def test_missing_key_does_not_call_provider(provider, monkeypatch):
    monkeypatch.setattr(integrations, 'get_settings', lambda: Settings(
        _env_file=None, geoapify_api_key=''))
    with pytest.raises(HTTPException) as error:
        integrations.geocode('Huancayo')
    assert error.value.status_code == 503
    provider.assert_not_called()


def test_invalid_coordinates_are_not_offered_to_user(provider):
    provider.return_value = {'results': [
        {'formatted': 'Sin coordenadas'},
        {'formatted': 'Fuera de rango', 'lat': 120, 'lon': -75},
        {'formatted': 'Válida', 'lat': -12.06, 'lon': -75.2},
    ]}
    assert integrations.geocode('Huancayo') == [
        {'direccion': 'Válida', 'latitud': -12.06, 'longitud': -75.2}]
