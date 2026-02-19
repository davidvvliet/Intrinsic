from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.chat import router as chat_router
from app.api.sheets import router as sheets_router
from app.api.lists import router as lists_router
from app.api.templates import router as templates_router
from app.api.workspaces import router as workspaces_router
from app.api.conversations import router as conversations_router
from app.api.sec import load_company_tickers
from app.storage.async_db import get_pool, close_pool as close_async_pool
from app.storage.search_db import close_pool as close_search_pool

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "https://intrinsic-kappa.vercel.app", "https://runintrinsic.com", "https://www.runintrinsic.com", "https://www.intrinsic-gvfgz.ondigitalocean.app", "https://intrinsic-gvfgz.ondigitalocean.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api")
app.include_router(sheets_router, prefix="/api")
app.include_router(lists_router, prefix="/api")
app.include_router(templates_router, prefix="/api")
app.include_router(workspaces_router, prefix="/api")
app.include_router(conversations_router, prefix="/api")


@app.on_event("startup")
async def startup_event():
    """Initialize database connection pools on FastAPI startup."""
    await get_pool()  # Eager initialization - creates pool at startup
    load_company_tickers()  # Load SEC ticker mappings
    print("Database pools initialized")


@app.on_event("shutdown")
async def shutdown_event():
    """Close database connection pools on FastAPI shutdown."""
    await close_async_pool()
    close_search_pool()
    print("Database pools closed")