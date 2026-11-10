from typing import Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from messenger_core import execute_query, validate_query_input
import supabase_client
import woovi_gateway

app = FastAPI(title="Central de Inteligência Corporativa - API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")

class QueryRequest(BaseModel):
    query_type: str  # cpf, nome, telefone, placa
    query_value: str
    target_base: str # SIMPLES, SYNC, RECEITA, CREDLINK, SI-PNI, BIOMETRIA, NACIONAL
    user_email: Optional[str] = "admin@corporativo.com"

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None

class AdminPasswordVerifyRequest(BaseModel):
    admin_email: str
    password: str

class ProfileRequest(BaseModel):
    email: str
    full_name: Optional[str] = None
    role: Optional[str] = "user"

class ProfileUpdateRequest(BaseModel):
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None

class AdminUserUpdateRequest(BaseModel):
    admin_email: str
    target_email: str
    credits: Optional[int] = None
    is_active: Optional[bool] = None
    role: Optional[str] = None

class AdminCreateUserRequest(BaseModel):
    admin_email: str
    email: str
    full_name: str
    credits: int = 10
    role: str = "user"

class PixChargeRequest(BaseModel):
    user_email: str
    plan_id: Optional[str] = "24h"
    package_id: Optional[str] = None # alias
    custom_amount: Optional[float] = None

class GenerateTrialRequest(BaseModel):
    admin_email: Optional[str] = "admin@corporativo.com"

@app.post("/api/auth/login")
async def auth_login(payload: LoginRequest):
    return supabase_client.verify_user_credentials(payload.email, payload.password)

@app.post("/api/auth/register")
async def auth_register(payload: RegisterRequest):
    return supabase_client.register_user_with_password(payload.email, payload.password, payload.full_name)

@app.post("/api/admin/verify-password")
async def admin_verify_password(payload: AdminPasswordVerifyRequest):
    email = payload.admin_email.strip().lower()
    prof = supabase_client.get_profile(email)
    if not prof or prof.get("role") != "admin":
        return {"status": "error", "message": "Acesso negado: Perfil não é administrador."}
    
    if supabase_client.verify_admin_password(payload.password):
        return {"status": "success", "message": "Acesso administrativo concedido."}
    return {"status": "error", "message": "Senha de Administrador incorreta."}

@app.post("/api/admin/generate-trial")
async def admin_generate_trial(payload: GenerateTrialRequest):
    trial_data = supabase_client.generate_trial_user()
    return {"status": "success", **trial_data}

@app.post("/api/query")
async def run_query(payload: QueryRequest):
    user_email = (payload.user_email or "admin@corporativo.com").strip().lower()
    profile = supabase_client.get_or_create_profile(user_email)
    
    # 1. Validação estrita de entrada (Anti-Erro)
    is_valid, clean_val, err_msg = validate_query_input(payload.query_type, payload.query_value)
    if not is_valid:
        return {
            "status": "invalid_format",
            "message": err_msg,
            "query": f"/{payload.query_type} {payload.query_value}",
            "base": payload.target_base,
            "result": err_msg
        }

    # 2. Validação de vigência de tempo / assinatura
    access = supabase_client.check_user_access(user_email)
    if not access.get("allowed", False):
        status_code = access.get("status", "expired")
        return {
            "status": status_code,
            "message": access.get("message", "Acesso expirado."),
            "wait_seconds": access.get("wait_seconds", 0),
            "access_info": access
        }

    # 3. Bloqueio estrito da base COMPLETO
    if payload.target_base and "COMPLETO" in payload.target_base.upper():
        return {
            "status": "error",
            "message": "A base 'COMPLETO' foi descontinuada e não é suportada sob nenhuma hipótese. Por favor, selecione outra base válida (Simples, Sync, Receita, Credlink, etc.)."
        }

    try:
        result = await execute_query(
            query_type=payload.query_type,
            query_value=clean_val,
            target_base=payload.target_base
        )
        
        # Se for prompt dinâmico de escolha de módulos
        if result.get("status") == "modules_prompt":
            result["access_info"] = access
            return result
        
        if result.get("status") == "success":
            supabase_client.register_query_performed(user_email)
            supabase_client.log_query(
                user_email=user_email,
                query_type=payload.query_type,
                query_value=payload.query_value,
                target_base=payload.target_base,
                result_data=result.get("result", ""),
                credits_cost=0
            )
            
        result["access_info"] = supabase_client.check_user_access(user_email)
        return result
    except Exception as e:
        return {
            "status": "error",
            "message": f"Erro interno no processamento da consulta: {str(e)}"
        }


# ====================================================================
# ROTAS DE USUÁRIO E AUTENTICAÇÃO (SUPABASE)
# ====================================================================

@app.post("/api/auth/profile")
async def get_or_create_user_profile(payload: ProfileRequest):
    profile = supabase_client.get_or_create_profile(payload.email, payload.full_name, payload.role)
    return {"status": "success", "profile": profile}

@app.post("/api/auth/update-profile")
async def update_user_profile(payload: ProfileUpdateRequest):
    fields = {}
    if payload.full_name is not None:
        fields["full_name"] = payload.full_name
    if payload.avatar_url is not None:
        fields["avatar_url"] = payload.avatar_url
        
    updated = supabase_client.update_profile(payload.email, fields)
    return {"status": "success", "profile": updated}

@app.get("/api/user/history")
async def get_history(email: str):
    history = supabase_client.get_user_history(email)
    return {"status": "success", "history": history}

# ====================================================================
# ROTAS DO PAINEL ADMINISTRATIVO (ADM)
# ====================================================================

@app.get("/api/admin/users")
async def admin_list_users(admin_email: str):
    admin = supabase_client.get_profile(admin_email)
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")
    users = supabase_client.list_all_users()
    return {"status": "success", "users": users}

@app.post("/api/admin/update-user")
async def admin_update_user(payload: AdminUserUpdateRequest):
    admin = supabase_client.get_profile(payload.admin_email)
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")
        
    fields = {}
    if payload.is_active is not None:
        fields["is_active"] = payload.is_active
    if payload.role is not None:
        fields["role"] = payload.role
    if payload.credits is not None:
        fields["credits"] = payload.credits
        
    updated = supabase_client.update_profile(payload.target_email, fields)
    return {"status": "success", "user": updated}

@app.post("/api/admin/create-user")
async def admin_create_user(payload: AdminCreateUserRequest):
    admin = supabase_client.get_profile(payload.admin_email)
    if not admin or admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")
        
    new_user = supabase_client.get_or_create_profile(
        email=payload.email,
        full_name=payload.full_name,
        role=payload.role
    )
    if payload.credits is not None:
        new_user = supabase_client.update_credits(payload.email, absolute_value=payload.credits)
        
    return {"status": "success", "user": new_user}

# ====================================================================
# ROTAS DE COBRANÇA PIX (WOOVI)
# ====================================================================

@app.post("/api/pix/create-charge")
async def create_pix(payload: PixChargeRequest):
    selected_plan = payload.plan_id or payload.package_id or "24h"
    result = woovi_gateway.create_pix_charge(
        user_email=payload.user_email,
        plan_id=selected_plan,
        custom_amount=payload.custom_amount
    )
    return result

@app.get("/api/pix/status/{correlation_id}")
async def get_pix_status(correlation_id: str):
    return woovi_gateway.check_pix_status(correlation_id)

@app.post("/api/pix/confirm-mock/{correlation_id}")
async def confirm_mock_payment(correlation_id: str):
    status_resp = woovi_gateway.confirm_pix_payment(correlation_id)
    if status_resp.get("status") == "success":
        tx = status_resp["transaction"]
        user_email = tx["user_email"]
        duration = tx.get("duration_seconds", 86400)
        plan_name = tx.get("package_name", "Plano por Tempo")
        amount = tx.get("amount", 0.0)
        
        updated_profile = supabase_client.add_user_access_time(user_email, duration, plan_name, amount)
        return {
            "status": "success",
            "message": f"Pagamento confirmado com sucesso! Plano '{plan_name}' ativado.",
            "transaction": tx,
            "profile": updated_profile,
            "access_info": supabase_client.check_user_access(user_email)
        }
    return status_resp

@app.post("/api/pix/webhook")
async def woovi_webhook(request: Request):
    try:
        body = await request.json()
        charge = body.get("charge", {})
        correlation_id = charge.get("correlationID")
        if correlation_id:
            woovi_gateway.confirm_pix_payment(correlation_id)
            tx = woovi_gateway.local_transactions.get(correlation_id)
            if tx:
                supabase_client.add_user_access_time(
                    tx["user_email"],
                    tx.get("duration_seconds", 86400),
                    tx.get("package_name", "Plano por Tempo"),
                    tx.get("amount", 0.0)
                )
        return {"status": "received"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/config")
def get_public_config():
    return {
        "supabase_url": supabase_client.SUPABASE_URL,
        "supabase_key": supabase_client.SUPABASE_KEY,
        "telegram_support": {
            "username": "@centraldo7chat",
            "url": "https://t.me/centraldo7chat",
            "name": "Suporte Oficial Telegram"
        },
        "time_plans": woovi_gateway.TIME_PLANS,
        "packages": woovi_gateway.PACKAGES
    }

@app.get("/")
def read_root():
    from fastapi.responses import FileResponse
    return FileResponse("static/index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8001, reload=False)