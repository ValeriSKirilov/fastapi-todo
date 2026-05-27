from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app.routers import items

app = FastAPI()


@app.exception_handler(Exception)
def global_exception_handler(request: Request, exc: Exception):
    print(f"CRITICAL SYSTEM FAILURE: {exc}")

    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error"}
    )


app.include_router(items.router)


@app.get("/")
def root():
    return {"message": "Hello World"}
