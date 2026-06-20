from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError, HTTPException
from .routers import item

app = FastAPI()


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print(f"INVALID USER INPUT: {exc}")

    return JSONResponse(
        status_code=400,
        content={"message": exc.errors()},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    print(f"HTTP {exc.status_code}: {exc.detail}")

    return JSONResponse(
        status_code=exc.status_code,
        content={"message": exc.detail}
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    print(f"CRITICAL SYSTEM FAILURE: {exc}")

    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error"}
    )


app.include_router(item.router)


@app.get("/")
def root():
    return {"message": "Hello World"}
