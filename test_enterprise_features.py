import asyncio
from main import (
    app, run_query, QueryRequest, create_pix, PixChargeRequest, 
    confirm_mock_payment, admin_generate_trial, GenerateTrialRequest
)
from messenger_core import validate_query_input, is_transient_status, parse_structured_txt_result
import supabase_client
import woovi_gateway

def test_time_plans_configuration():
    plans = woovi_gateway.TIME_PLANS
    for k in ["1h", "12h", "24h", "7d", "30d"]:
        assert k in plans and plans[k]["price"] > 0

def test_admin_vitalicio_access():
    access = supabase_client.check_user_access("admin@corporativo.com")
    assert access["allowed"] is True and access["is_admin"] is True

def test_trial_user_generation_and_cooldown():
    trial = supabase_client.generate_trial_user()
    assert trial["profile"]["is_trial"] is True
    email = trial["profile"]["email"]
    assert supabase_client.check_user_access(email)["allowed"] is True
    supabase_client.register_query_performed(email)
    assert supabase_client.check_user_access(email)["status"] == "trial_cooldown"

async def test_anti_error_input_validation():
    # CPF com letras
    r1 = await run_query(QueryRequest(query_type="cpf", query_value="1234567890a", target_base="SIMPLES"))
    assert r1["status"] == "invalid_format" and "Divergência" in r1["message"]

    # CPF com dígitos insuficientes
    r2 = await run_query(QueryRequest(query_type="cpf", query_value="123456", target_base="SIMPLES"))
    assert r2["status"] == "invalid_format"

    # Nome digitado como CPF
    r3 = await run_query(QueryRequest(query_type="nome", query_value="12345678900", target_base="SIMPLES"))
    assert r3["status"] == "invalid_format" and "Divergência" in r3["message"]

    # Nome com 1 palavra só
    r4 = await run_query(QueryRequest(query_type="nome", query_value="Carlos", target_base="SIMPLES"))
    assert r4["status"] == "invalid_format" and "incompleto" in r4["message"].lower()

def test_transient_status_detection():
    assert is_transient_status("Consultando base de dados...") is True
    assert is_transient_status("NOME: JOAO\nCPF: 12345678900") is False

def test_batch_txt_parser_strict_grouping():
    raw_sample = """
    RESULTADOS ENCONTRADOS (2):

    RESULTADO (1):
    NOME: ROBERTO SANTOS
    CPF: 111.222.333-44
    MAE: MARIA SANTOS
    TELEFONES:
    (11) 99999-1111 - VIVO
    BY: @centraldo7chat
    USER: 1234567

    RESULTADO (2):
    NOME: ROBERTO SANTOS FILHO
    CPF: 555.666.777-88
    MAE: JULIA LIMA
    TELEFONES:
    (21) 98888-3333 - CLARO
    BY: @centraldo7chat
    USER: 1234567
    """
    parsed = parse_structured_txt_result(raw_sample)
    assert "[REGISTRO 1] NOME: ROBERTO SANTOS" in parsed
    assert "[REGISTRO 1] TELEFONE (1): (11) 99999-1111 - VIVO" in parsed
    assert "[REGISTRO 2] NOME: ROBERTO SANTOS FILHO" in parsed
    assert "[REGISTRO 2] TELEFONE (1): (21) 98888-3333 - CLARO" in parsed
    assert "BY: @centraldo7chat" not in parsed

async def test_time_subscription_pix_flow():
    user = "cliente_plano@empresa.com"
    supabase_client.get_or_create_profile(user)
    data = await create_pix(PixChargeRequest(user_email=user, plan_id="24h"))
    cid = data["transaction"]["correlation_id"]
    await confirm_mock_payment(cid)
    assert supabase_client.check_user_access(user)["time_remaining_seconds"] > 86000

async def test_completo_module_banned():
    data = await run_query(QueryRequest(query_type="cpf", query_value="12345678900", target_base="COMPLETO"))
    assert data["status"] == "error" and "descontinuada" in data["message"]

async def test_admin_generate_trial_endpoint():
    data = await admin_generate_trial(GenerateTrialRequest())
    assert data["status"] == "success" and data["profile"]["email"].startswith("guest_")

async def main_tests():
    test_time_plans_configuration()
    test_admin_vitalicio_access()
    test_trial_user_generation_and_cooldown()
    await test_anti_error_input_validation()
    test_transient_status_detection()
    test_batch_txt_parser_strict_grouping()
    await test_time_subscription_pix_flow()
    await test_completo_module_banned()
    await test_admin_generate_trial_endpoint()
    print("ALL DEFINITIVE ENTERPRISE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(main_tests())


