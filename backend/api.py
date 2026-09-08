from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.fire_engine import get_current_fires

app = FastAPI(
    title="FireSight API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "FireSight API"
    }

@app.get("/fires")
def fires(
    latitude: float = 43.7001,
    longitude: float = -79.4163
):
    return get_current_fires(latitude, longitude)