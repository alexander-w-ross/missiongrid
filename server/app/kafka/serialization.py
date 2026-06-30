import json
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel

def _default(o):
    if isinstance(o, datetime): return o.isoformat()
    if isinstance(o, UUID): return str(o)
    raise TypeError(f"not JSON-serializable {type(o)}")


def serialize(message: BaseModel | dict) -> bytes:
    # Accept either Pydantic envelope or plain dict
    data = message.model_dump(mode="json") if isinstance(message, BaseModel) else message
    return json.dumps(data, default=_default).encode("utf-8")

def deserialize(raw: bytes) -> dict:
    event = json.loads(raw.decode("utf-8"))
    for field in ("id", "type"):
        if field not in event:
            raise ValueError(f"envelope missing '{field}': {event!r}")
    
    return event