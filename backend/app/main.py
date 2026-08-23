from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.database import init_db
from app.api import customers, parts, invoices
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.APP_NAME,
    description="Modern invoice and quotation management system for rice mill parts",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    logger.info("Starting Jagannath Enterprises Invoice System...")
    init_db()
    logger.info("Database initialized successfully")


@app.get("/")
async def root():
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "company": settings.COMPANY_NAME,
        "owner": settings.OWNER_NAME,
        "docs": "/docs",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": settings.APP_NAME}


app.include_router(customers.router, prefix="/api/customers", tags=["Customers"])
app.include_router(parts.router, prefix="/api/parts", tags=["Parts"])
app.include_router(invoices.router, prefix="/api/invoices", tags=["Invoices"])


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Global exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "message": str(exc)}
    )
