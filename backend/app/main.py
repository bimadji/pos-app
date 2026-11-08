"""Main FastAPI application entry point."""
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.core.config import settings
from app.api.v1.router import api_v1_router

openapi_tags = [
    {"name": "Customer Menu", "description": "Portal publik pelanggan meja via scan stiker QR HMAC (tanpa login)."},
    {"name": "Orders", "description": "Siklus hidup bon meja, pemesanan multi-round per babak, dan void stok atomik."},
    {"name": "Payments", "description": "Pelunasan bon kasir (Tunai & STATIC_QRIS) dengan header Idempotency-Key."},
    {"name": "Cashier Shifts", "description": "Manajemen modal kas laci awal, live omzet kasir, tutup shift & audit riwayat."},
    {"name": "Realtime SSE", "description": "Server-Sent Events streaming satu arah notifikasi dapur dan status meja."},
    {"name": "Reports & Analytics", "description": "Laporan omzet penjualan harian, tren mingguan, rekap bulanan, dan ekspor CSV."},
    {"name": "Categories", "description": "Pengelolaan kategori menu makanan, minuman, dan snack."},
    {"name": "Products", "description": "Katalog produk, manajemen stok bahan baku, dan saklar ketersediaan menu."},
    {"name": "Tables", "description": "Manajemen denah meja kafe dan generator stiker QR bertanda-tangan kriptografis."},
    {"name": "Authentication", "description": "Autentikasi staf kasir dan pemilik kafe berbasis token JWT Bearer."},
    {"name": "Health", "description": "Pemeriksaan kesehatan sistem dan status lingkungan deployment."},
]

app = FastAPI(
    title="Kafe Dine-in Web POS API",
    description=(
        "Backend REST API & SSE Realtime untuk aplikasi Point of Sale (POS) Dine-in kafe mandiri skala 10-25 meja.\n\n"
        "### Tiga Portal Operasional:\n"
        "- **Pelanggan Meja:** Memesan via QR bertanda-tangan kriptografis tanpa login akun.\n"
        "- **Kasir & Dapur:** Mengontrol denah meja, antrean masak per babak, buka/tutup shift laci, dan pelunasan bon.\n"
        "- **Pemilik Kafe:** Memantau metrik finansial realtime, audit pergantian shift kasir, dan unduh CSV pembukuan."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    openapi_tags=openapi_tags,
)

# CORS Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler: Standard JSON response for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # exc.errors() can contain bytes input; stringify only the offending input field
    details = [
        {k: (v.decode(errors="ignore") if isinstance(v, bytes) else v) for k, v in err.items()}
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Format data masukan tidak valid.",
                "details": details,
            },
        },
    )


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
    }


# Include API v1 router
app.include_router(api_v1_router)
