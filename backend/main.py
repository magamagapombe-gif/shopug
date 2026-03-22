from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from auth    import router as auth_router
from products import router as products_router
from orders  import router as orders_router
from suppliers import router as suppliers_router
from admin   import router as admin_router

app = FastAPI(title="ShopUG API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://shopug-tan.vercel.app",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(products_router)
app.include_router(orders_router)
app.include_router(suppliers_router)
app.include_router(admin_router)


@app.on_event("startup")
def startup():
    init_db()


@app.get("/")
def root():
    return {"status": "ShopUG API running", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
