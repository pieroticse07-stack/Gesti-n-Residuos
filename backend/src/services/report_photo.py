"""Evidencia fotográfica: verificar, reducir tamaño y retirar metadatos de la imagen."""
import base64
import binascii
from io import BytesIO
import warnings

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_INPUT = 5 * 1024 * 1024


def prepare_photo(value: str | None) -> bytes | None:
    if not value:
        return None
    try:
        header, encoded = value.split(',', 1)
        if header not in ('data:image/jpeg;base64','data:image/png;base64','data:image/webp;base64'):
            raise ValueError()
        data = base64.b64decode(encoded, validate=True)
        if not data or len(data) > MAX_INPUT:
            raise ValueError()
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as source:
                if source.format not in ('JPEG','PNG','WEBP') or source.width*source.height > 20_000_000:
                    raise ValueError()
                source.load()
                image = ImageOps.exif_transpose(source)
                image.thumbnail((1600,1600))
                # Fondo blanco y píxeles nuevos: no se conservan EXIF, GPS ni otros metadatos.
                pixels = Image.new('RGB', image.size, 'white')
                if image.mode in ('RGBA','LA') or 'transparency' in image.info:
                    rgba=image.convert('RGBA');pixels.paste(rgba,mask=rgba.getchannel('A'))
                else:
                    pixels.paste(image.convert('RGB'))
                result=BytesIO();pixels.save(result,format='JPEG',quality=85,optimize=True)
                if result.tell()>2*1024*1024:
                    raise ValueError()
                return result.getvalue()
    except (ValueError,TypeError,binascii.Error,OSError,UnidentifiedImageError,Image.DecompressionBombWarning,Image.DecompressionBombError):
        raise HTTPException(422,'La foto debe ser JPG, PNG o WebP válida, de hasta 5 MB y 20 megapíxeles.') from None
