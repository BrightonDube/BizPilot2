from fastapi import FastAPI, Request
import uvicorn

app = FastAPI()

@app.get("/api/v1/auth/me")
async def me(request: Request):
    return {"id": "u1", "email": "demo@bizpilot.co.za", "is_active": True}

@app.post("/api/v1/auth/login")
async def login():
    return {"access_token": "mock-token", "token_type": "bearer"}

@app.post("/api/v1/auth/login/access-token")
async def login_token():
    return {"access_token": "mock-token", "token_type": "bearer"}

@app.get("/api/v1/business/status")
async def status():
    return {"status": "active"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
