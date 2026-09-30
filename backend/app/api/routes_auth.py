from fastapi import APIRouter, HTTPException, Depends
from backend.app.schemas.schemas import LoginRequest, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(credentials: LoginRequest):
    if credentials.username in ["admin", "operator", "viewer"] and credentials.password in ["admin123", "password", "demo123"]:
        role = "ADMIN" if credentials.username == "admin" else ("OPERATOR" if credentials.username == "operator" else "VIEWER")
        return {
            "access_token": f"mock-jwt-token-{credentials.username}",
            "token_type": "bearer",
            "user": {
                "username": credentials.username,
                "role": role,
                "full_name": f"{credentials.username.title()} User",
            },
        }
    raise HTTPException(status_code=401, detail="Invalid username or password")


@router.get("/me")
def get_current_user():
    return {
        "username": "admin",
        "role": "ADMIN",
        "full_name": "Traffic Command Admin",
    }
