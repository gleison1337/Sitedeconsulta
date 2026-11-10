import os
import time
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://amfycxizytkvyoadjkva.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "sb_publishable_j7qozpKsctxBG4cNVMJjdQ_VOm4YRS9")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

# Armazenamento local de contingência caso as tabelas no Supabase não tenham sido criadas
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123#corp")

_local_passwords = {
    "admin@corporativo.com": ADMIN_PASSWORD
}

_local_profiles = {
    "admin@corporativo.com": {
        "id": "00000000-0000-0000-0000-000000000001",
        "email": "admin@corporativo.com",
        "full_name": "Administrador Chefe",
        "role": "admin",
        "is_active": True,
        "is_unlimited": True,
        "access_expires_at": 9999999999,
        "subscriptions_history": [
            {
                "plan_name": "Acesso Vitalício de Administrador",
                "duration_seconds": 9999999999,
                "amount": 0.0,
                "activated_at": "2026-11-09 00:00:00"
            }
        ],
        "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        "last_login": "Agora",
        "created_at": "2026-11-08"
    }
}
_local_queries = []

def verify_admin_password(password: str) -> bool:
    return password.strip() == ADMIN_PASSWORD

def verify_user_credentials(email: str, password: str) -> dict:
    email = email.strip().lower()
    if email == "admin@corporativo.com":
        if password.strip() == ADMIN_PASSWORD:
            return {"status": "success", "profile": get_profile(email)}
        else:
            return {"status": "error", "message": "Senha de Administrador incorreta."}
            
    prof = get_profile(email)
    if not prof:
        return {"status": "error", "message": "Usuário não encontrado. Cadastre-se primeiro."}
        
    stored = _local_passwords.get(email)
    if stored and stored != password.strip():
        return {"status": "error", "message": "Senha incorreta."}
        
    return {"status": "success", "profile": prof}

def register_user_with_password(email: str, password: str, full_name: str = None) -> dict:
    import re
    email = email.strip().lower()
    if email == "admin@corporativo.com":
        return {"status": "error", "message": "Este e-mail é de uso exclusivo da administração."}
        
    # Sanitização e validação de segurança
    if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
        return {"status": "error", "message": "Formato de e-mail inválido."}
        
    if full_name:
        clean_name = full_name.strip()
        if re.search(r'[<>"\';%(){}\[\]\\\/]', clean_name):
            return {"status": "error", "message": "O nome contém caracteres inválidos ou proibidos."}
        if len(clean_name) < 3 or len(clean_name) > 60:
            return {"status": "error", "message": "O nome deve conter entre 3 e 60 caracteres."}
            
    if len(password.strip()) < 6:
        return {"status": "error", "message": "A senha deve conter no mínimo 6 caracteres."}
        
    existing = get_profile(email)
    if existing:
        return {"status": "error", "message": "Este e-mail já está cadastrado. Faça login."}
        
    _local_passwords[email] = password.strip()
    prof = get_or_create_profile(email, full_name=full_name, role="user")
    return {"status": "success", "profile": prof}


def get_profile(email: str):
    email = email.strip().lower()
    try:
        url = f"{SUPABASE_URL}/rest/v1/profiles?email=eq.{email}&select=*"
        resp = requests.get(url, headers=HEADERS, timeout=1.5)
        if resp.status_code == 200:
            data = resp.json()
            if data:
                return data[0]
    except Exception:
        pass
        
    return _local_profiles.get(email)

def get_or_create_profile(email: str, full_name: str = None, role: str = "user"):
    email = email.strip().lower()
    prof = get_profile(email)
    if prof:
        return prof
    
    # Cria perfil padrão
    now = time.time()
    is_adm = (role == "admin" or email == "admin@corporativo.com")
    initial_expires = 9999999999 if is_adm else (now + 3600) # 1 hora cortesia de boas-vindas
    actual_role = "admin" if is_adm else role
    new_prof = {
        "email": email,
        "full_name": full_name or email.split("@")[0].capitalize(),
        "is_active": True,
        "role": actual_role,
        "is_unlimited": is_adm,
        "access_expires_at": initial_expires,
        "is_trial": False,
        "subscriptions_history": [
            {
                "plan_name": "Acesso Vitalício Admin" if is_adm else "Bônus de Boas-Vindas (1h de uso)",
                "duration_seconds": 9999999999 if is_adm else 3600,
                "amount": 0.0,
                "activated_at": time.strftime("%Y-%m-%d %H:%M:%S")
            }
        ],
        "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
    }
    
    try:
        url = f"{SUPABASE_URL}/rest/v1/profiles"
        resp = requests.post(url, json=new_prof, headers=HEADERS, timeout=5)
        if resp.status_code in [200, 201]:
            data = resp.json()
            if data:
                return data[0]
    except Exception as e:
        print(f"[SUPABASE REST CREATE PROFILE ERROR] {e}")
        
    _local_profiles[email] = new_prof
    return new_prof

def update_credits(email: str, delta: int = None, absolute_value: int = None):
    email = email.strip().lower()
    prof = get_profile(email) or get_or_create_profile(email)
    
    if absolute_value is not None:
        new_val = max(0, absolute_value)
    elif delta is not None:
        new_val = max(0, prof.get("credits", 0) + delta)
    else:
        new_val = prof.get("credits", 0)
        
    try:
        url = f"{SUPABASE_URL}/rest/v1/profiles?email=eq.{email}"
        resp = requests.patch(url, json={"credits": new_val}, headers=HEADERS, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            if data:
                return data[0]
    except Exception as e:
        print(f"[SUPABASE REST UPDATE CREDITS ERROR] {e}")
        
    if email in _local_profiles:
        _local_profiles[email]["credits"] = new_val
    return {"email": email, "credits": new_val}

def add_user_access_time(email: str, duration_seconds: int, plan_name: str, amount: float = 0.0):
    email = email.strip().lower()
    prof = get_profile(email) or get_or_create_profile(email)
    now = time.time()
    current_expires = prof.get("access_expires_at", 0)
    
    if current_expires and current_expires > now:
        new_expires = current_expires + duration_seconds
    else:
        new_expires = now + duration_seconds
        
    history = prof.get("subscriptions_history", [])
    history.insert(0, {
        "plan_name": plan_name,
        "duration_seconds": duration_seconds,
        "amount": amount,
        "activated_at": time.strftime("%Y-%m-%d %H:%M:%S")
    })
    
    update_data = {
        "access_expires_at": new_expires,
        "subscriptions_history": history,
        "is_trial": False
    }
    
    update_profile(email, update_data)
    prof.update(update_data)
    return prof

def check_user_access(email: str):
    email = email.strip().lower()
    prof = get_profile(email) or get_or_create_profile(email)
    is_admin = prof.get("role") == "admin" or email == "admin@corporativo.com"
    if is_admin:
        return {"allowed": True, "is_admin": True, "time_remaining_seconds": 999999999, "status": "vitalicio"}
        
    now = time.time()
    expires_at = prof.get("access_expires_at", 0)
    if now > expires_at:
        return {
            "allowed": False,
            "is_admin": False,
            "time_remaining_seconds": 0,
            "status": "expired",
            "message": "Seu plano de acesso expirou. Renove seu tempo via Pix para continuar consultando."
        }
        
    if prof.get("is_trial", False):
        queries_count = prof.get("trial_queries_count", 0)
        max_queries = prof.get("trial_max_queries", 20)
        if queries_count >= max_queries:
            return {
                "allowed": False,
                "is_trial": True,
                "time_remaining_seconds": max(0, int(expires_at - now)),
                "status": "trial_limit_reached",
                "message": f"Você atingiu o limite de {max_queries} pesquisas do teste gratuito. Assine um plano para continuar."
            }
            
        last_query = prof.get("last_query_timestamp", 0)
        cooldown = 60
        elapsed = now - last_query
        if elapsed < cooldown:
            wait_s = int(cooldown - elapsed)
            return {
                "allowed": False,
                "is_trial": True,
                "time_remaining_seconds": max(0, int(expires_at - now)),
                "status": "trial_cooldown",
                "wait_seconds": wait_s,
                "message": f"Modo Teste: Por favor aguarde {wait_s}s antes da próxima consulta (delay obrigatório de 1 min)."
            }
            
    time_remaining = max(0, int(expires_at - now))
    return {
        "allowed": True,
        "is_admin": False,
        "is_trial": prof.get("is_trial", False),
        "trial_queries_count": prof.get("trial_queries_count", 0),
        "trial_max_queries": prof.get("trial_max_queries", 20),
        "time_remaining_seconds": time_remaining,
        "status": "active"
    }

def register_query_performed(email: str):
    email = email.strip().lower()
    prof = get_profile(email)
    if prof and prof.get("is_trial", False):
        prof["last_query_timestamp"] = time.time()
        prof["trial_queries_count"] = prof.get("trial_queries_count", 0) + 1

def generate_trial_user():
    import random, string
    token = ''.join(random.choices(string.ascii_lowercase + string.digits, k=4))
    email = f"guest_{token}@corporativo.com"
    pwd = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    
    now = time.time()
    expires_at = now + 1200 # 20 minutos
    
    trial_prof = {
        "id": f"trial-{token}",
        "email": email,
        "full_name": f"Operador Teste {token.upper()}",
        "role": "user",
        "is_active": True,
        "is_trial": True,
        "trial_queries_count": 0,
        "trial_max_queries": 20,
        "last_query_timestamp": 0,
        "access_expires_at": expires_at,
        "subscriptions_history": [
            {
                "plan_name": "Demonstração Gratuita (Trial 20 min)",
                "duration_seconds": 1200,
                "amount": 0.0,
                "activated_at": time.strftime("%Y-%m-%d %H:%M:%S")
            }
        ],
        "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    
    _local_profiles[email] = trial_prof
    _local_passwords[email] = pwd
    
    card_text = (
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "⚡ ACESSO TESTE - CENTRAL CORPORATIVA\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 Usuário: {email}\n"
        f"🔑 Senha: {pwd}\n"
        "⏱️ Vigência: 20 minutos de uso\n"
        "🔍 Limite: Até 20 consultas (delay 1 min)\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "🔗 Acesse agora o portal e teste ao vivo!"
    )
    
    return {"profile": trial_prof, "password": pwd, "card_text": card_text}

def update_profile(email: str, fields: dict):
    email = email.strip().lower()
    try:
        url = f"{SUPABASE_URL}/rest/v1/profiles?email=eq.{email}"
        resp = requests.patch(url, json=fields, headers=HEADERS, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            if data:
                return data[0]
    except Exception as e:
        print(f"[SUPABASE REST UPDATE PROFILE ERROR] {e}")
        
    if email in _local_profiles:
        _local_profiles[email].update(fields)
    return _local_profiles.get(email)

def list_all_users():
    try:
        url = f"{SUPABASE_URL}/rest/v1/profiles?select=*&order=created_at.desc"
        resp = requests.get(url, headers=HEADERS, timeout=5)
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        print(f"[SUPABASE REST LIST USERS ERROR] {e}")
        
    return list(_local_profiles.values())

def activate_user(email: str, is_active: bool):
    return update_profile(email, {"is_active": is_active})

def log_query(user_email: str, query_type: str, query_value: str, target_base: str, result_data: str, credits_cost: int = 1):
    entry = {
        "user_email": user_email.strip().lower(),
        "query_type": query_type,
        "query_value": query_value,
        "target_base": target_base,
        "result_data": result_data[:1000] if result_data else "",
        "credits_cost": credits_cost,
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    
    try:
        url = f"{SUPABASE_URL}/rest/v1/query_history"
        requests.post(url, json=entry, headers=HEADERS, timeout=5)
    except Exception:
        pass
        
    _local_queries.insert(0, entry)
    if len(_local_queries) > 100:
        _local_queries.pop()

def get_user_history(user_email: str):
    email = user_email.strip().lower()
    try:
        url = f"{SUPABASE_URL}/rest/v1/query_history?user_email=eq.{email}&order=created_at.desc&limit=15"
        resp = requests.get(url, headers=HEADERS, timeout=5)
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
        
    return [q for q in _local_queries if q["user_email"] == email][:15]
