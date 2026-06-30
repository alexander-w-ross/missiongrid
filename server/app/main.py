import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.http import router as http_router
from app.api.websocket import router as ws_router, ws_broadcaster
from app.config import settings
from app.kafka.client import start_producer, stop_producer


@asynccontextmanager
async def lifespan(app):
    await start_producer()
    # Background task: fan mission events out to connected WebSocket clients.
    broadcaster = asyncio.create_task(ws_broadcaster())
    yield
    broadcaster.cancel()
    try:
        await broadcaster
    except asyncio.CancelledError:
        pass
    await stop_producer()


app = FastAPI(title="MissionGrid API", lifespan=lifespan)
# CORS: the browser preflights the JSON POSTs and the DELETE /mountains/{x}/{y}
# the frontend sends, so we must explicitly allow those methods + the
# Content-Type header. NOTE: CORSMiddleware does NOT govern the WebSocket
# handshake — validate the WS Origin in the WS endpoint if needed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


app.include_router(http_router)
app.include_router(ws_router)
