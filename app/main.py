from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .routers import auth, internal, item, project, user

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=settings.FRONTEND_URL,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    print(f"CRITICAL SYSTEM FAILURE: {exc}")

    return JSONResponse(status_code=500, content={"message": "Internal Server Error"})


app.include_router(item.router)
app.include_router(auth.router)
app.include_router(user.router)
app.include_router(internal.router)
app.include_router(project.router)


@app.get("/")
def root():
    return {"message": "Server is running"}
