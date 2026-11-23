import base64
from io import BytesIO
import pytest
from PIL import Image
from fastapi import HTTPException
from backend.services.report_photo import prepare_photo


def sample_photo():
    buffer=BytesIO()
    image=Image.new('RGB',(30,20),(20,110,60))
    exif=Image.Exif();exif[271]='Dato que no debe conservarse'
    image.save(buffer,format='JPEG',exif=exif)
    return 'data:image/jpeg;base64,'+base64.b64encode(buffer.getvalue()).decode()


def test_photo_is_decoded_and_metadata_removed():
    result=prepare_photo(sample_photo())
    assert result.startswith(b'\xff\xd8')
    with Image.open(BytesIO(result)) as output:
        assert output.size==(30,20)
        assert not output.getexif()


@pytest.mark.parametrize('photo',[
    'data:image/svg+xml;base64,PHN2Zy8+',
    'data:image/jpeg;base64,not-base64!',
    'data:image/png;base64,'+base64.b64encode(b'Not an image').decode(),
])
def test_invalid_photo_is_rejected_before_persistence(photo):
    with pytest.raises(HTTPException) as error:prepare_photo(photo)
    assert error.value.status_code==422


def test_missing_photo_is_optional():
    assert prepare_photo(None) is None


def test_large_photo_is_rejected():
    value='data:image/jpeg;base64,'+base64.b64encode(b'0'*(5*1024*1024+1)).decode()
    with pytest.raises(HTTPException) as error:prepare_photo(value)
    assert error.value.status_code==422
