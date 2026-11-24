from unittest.mock import Mock

import pytest

from backend import main


@pytest.mark.parametrize('value,expected', [(None, 10000), ('18001', 18001)])
def test_container_listens_on_render_port_without_reload(monkeypatch, value, expected):
    monkeypatch.delenv('PORT', raising=False)
    if value is not None:
        monkeypatch.setenv('PORT', value)
    run = Mock()
    monkeypatch.setattr(main.uvicorn, 'run', run)
    main.serve()
    run.assert_called_once_with('backend.main:app', host='0.0.0.0', port=expected, reload=False)


@pytest.mark.parametrize('value', ['', 'not-a-port', '0', '-1', '65536'])
def test_invalid_port_stops_before_starting_server(monkeypatch, value):
    monkeypatch.setenv('PORT', value)
    run = Mock()
    monkeypatch.setattr(main.uvicorn, 'run', run)
    with pytest.raises(ValueError, match='PORT'):
        main.serve()
    run.assert_not_called()


def test_local_command_remains_on_loopback(monkeypatch):
    run = Mock()
    monkeypatch.setattr(main.uvicorn, 'run', run)
    main.run()
    run.assert_called_once_with('backend.main:app', host='127.0.0.1', port=8001, reload=False)
