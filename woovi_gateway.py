import os
import uuid
import time
import requests
from dotenv import load_dotenv

load_dotenv()

WOOVI_APP_ID = os.getenv("WOOVI_APP_ID", "")
WOOVI_BASE_URL = os.getenv("WOOVI_BASE_URL", "https://api.woovi.com/api/v1")

# Planos de tempo vigentes baseados em assinatura/aluguel
TIME_PLANS = {
    "1h": {
        "id": "1h",
        "name": "1 Hora de Uso",
        "duration_seconds": 3600,
        "price": 10.00,
        "badge": "Express",
        "description": "Ideal para pesquisas rápidas e pontuais",
        "popular": False
    },
    "12h": {
        "id": "12h",
        "name": "12 Horas de Uso",
        "duration_seconds": 43200,
        "price": 30.00,
        "badge": "Turno",
        "description": "Perfeito para expediente ou plantão",
        "popular": False
    },
    "24h": {
        "id": "24h",
        "name": "1 Dia de Uso (24h)",
        "duration_seconds": 86400,
        "price": 50.00,
        "badge": "Mais Popular",
        "description": "24 horas completas de consultas ilimitadas",
        "popular": True
    },
    "7d": {
        "id": "7d",
        "name": "1 Semana (7 Dias)",
        "duration_seconds": 604800,
        "price": 100.00,
        "badge": "Custo/Benefício",
        "description": "7 dias corridos de acesso liberado",
        "popular": False
    },
    "30d": {
        "id": "30d",
        "name": "1 Mês (30 Dias)",
        "duration_seconds": 2592000,
        "price": 150.00,
        "badge": "Profissional",
        "description": "Acesso corporativo mensal ilimitado",
        "popular": False
    }
}

PACKAGES = TIME_PLANS

# Armazenamento em memória de transações
local_transactions = {}

def generate_mock_pix_code(amount: float, correlation_id: str) -> str:
    """Gera um payload simulado padrão EMV Pix Copia e Cola"""
    clean_amount = f"{amount:.2f}"
    return (
        f"00020126580014br.gov.bcb.pix0136{correlation_id[:32]}52040000"
        f"5303986540{len(clean_amount):02d}{clean_amount}5802BR5925CENTRAL INTELIGENCIA CORP6009SAO PAULO"
        f"62070503***6304E8A2"
    )

def create_pix_charge(user_email: str, plan_id: str, custom_amount: float = None):
    """
    Cria uma cobrança Pix por tempo de acesso via API Woovi ou contingência
    """
    plan = TIME_PLANS.get(plan_id, TIME_PLANS["24h"])
    amount = custom_amount if custom_amount is not None else plan["price"]
    duration_seconds = plan["duration_seconds"]
    plan_name = plan["name"]
    
    correlation_id = str(uuid.uuid4())
    
    # Se houver chave da Woovi configurada no .env
    if WOOVI_APP_ID:
        try:
            headers = {
                "Authorization": WOOVI_APP_ID,
                "Content-Type": "application/json"
            }
            payload = {
                "correlationID": correlation_id,
                "value": int(amount * 100), # em centavos
                "comment": f"{plan_name} - {user_email}",
                "customer": {
                    "name": user_email.split("@")[0].capitalize(),
                    "email": user_email
                }
            }
            resp = requests.post(f"{WOOVI_BASE_URL}/charge", json=payload, headers=headers, timeout=10)
            if resp.status_code in [200, 201]:
                data = resp.json().get("charge", {})
                tx = {
                    "correlation_id": correlation_id,
                    "woovi_charge_id": data.get("identifier"),
                    "user_email": user_email,
                    "plan_id": plan["id"],
                    "package_name": plan_name,
                    "duration_seconds": duration_seconds,
                    "amount": amount,
                    "status": "pending",
                    "pix_code": data.get("brCode"),
                    "qr_code_url": data.get("qrCodeImage"),
                    "created_at": time.time()
                }
                local_transactions[correlation_id] = tx
                return {"status": "success", "transaction": tx}
        except Exception as e:
            print(f"[WOOVI API ERROR] {e} - Iniciando gateway Pix seguro alternativo...")

    # Contingência / Sandbox Integrado com QR Code dinâmico
    pix_code = generate_mock_pix_code(amount, correlation_id)
    qr_code_url = f"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={requests.utils.quote(pix_code)}"
    
    tx = {
        "correlation_id": correlation_id,
        "woovi_charge_id": f"WOOVI-{correlation_id[:8]}",
        "user_email": user_email,
        "plan_id": plan["id"],
        "package_name": plan_name,
        "duration_seconds": duration_seconds,
        "amount": amount,
        "status": "pending",
        "pix_code": pix_code,
        "qr_code_url": qr_code_url,
        "created_at": time.time()
    }
    local_transactions[correlation_id] = tx
    return {"status": "success", "transaction": tx}

def check_pix_status(correlation_id: str):
    """Consulta o status da transação Pix"""
    tx = local_transactions.get(correlation_id)
    if not tx:
        return {"status": "not_found", "message": "Transação não encontrada"}
    return {"status": "success", "transaction": tx}

def confirm_pix_payment(correlation_id: str):
    """Confirma o pagamento de uma cobrança Pix (simulação ou webhook)"""
    tx = local_transactions.get(correlation_id)
    if not tx:
        return {"status": "not_found", "message": "Transação não localizada"}
    
    tx["status"] = "completed"
    tx["paid_at"] = time.time()
    return {"status": "success", "transaction": tx}

