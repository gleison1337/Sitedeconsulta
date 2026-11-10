import asyncio
import messenger_core

def test_query_lock_exists():
    assert hasattr(messenger_core, 'query_lock')
    assert isinstance(messenger_core.query_lock, asyncio.Lock)
    print("[PASS] query_lock is present and is an asyncio.Lock")

def test_batch_txt_parser_isolation():
    raw_telegram_txt = """
    RESULTADOS ENCONTRADOS (2):

    RESULTADO (1):
    NOME: JOAO DA SILVA
    CPF: 111.222.333-44
    NASCIMENTO: 10/10/1980
    SEXO: MASCULINO
    MAE: MARIA DA SILVA
    RENDA: R$ 3.000,00
    TELEFONES:
    (11) 99999-1111 - WHATSAPP
    (11) 3333-2222 - FIXO
    ENDEREÇO: RUA DAS FLORES, 10
    BY: @centraldo7chat
    USER: 1234567

    ------------------------------------------------------------

    RESULTADO (2):
    NOME: JOAO DA SILVA JUNIOR
    CPF: 555.666.777-88
    NASCIMENTO: 20/05/2005
    SEXO: MASCULINO
    MAE: ANA PAULA SILVA
    RENDA: R$ 1.500,00
    TELEFONES:
    (21) 98888-3333 - CELULAR
    ENDEREÇO: AV BRASIL, 200
    BY: @centraldo7chat
    USER: 1234567
    """

    parsed = messenger_core.parse_structured_txt_result(raw_telegram_txt)
    
    # 1. Deve conter os identificadores rígidos para isolar cada pessoa
    assert "[REGISTRO 1] NOME: JOAO DA SILVA" in parsed
    assert "[REGISTRO 1] CPF: 111.222.333-44" in parsed
    assert "[REGISTRO 1] MAE: MARIA DA SILVA" in parsed
    assert "[REGISTRO 1] TELEFONE (1): (11) 99999-1111 - WHATSAPP" in parsed
    assert "[REGISTRO 1] TELEFONE (2): (11) 3333-2222 - FIXO" in parsed

    assert "[REGISTRO 2] NOME: JOAO DA SILVA JUNIOR" in parsed
    assert "[REGISTRO 2] CPF: 555.666.777-88" in parsed
    assert "[REGISTRO 2] MAE: ANA PAULA SILVA" in parsed
    assert "[REGISTRO 2] TELEFONE (1): (21) 98888-3333 - CELULAR" in parsed

    # 2. Rodapés indesejados devem ter sido removidos isoladamente de todos os blocos
    assert "BY: @centraldo7chat" not in parsed
    assert "USER: 1234567" not in parsed
    assert "@centraldo7chat" not in parsed
    
    print("[PASS] Batch .TXT parser isolation and footer scrubbing verified successfully")

def test_single_txt_record_handling():
    single_raw = """
    NOME: MARCOS SOUZA
    CPF: 999.888.777-66
    NASCIMENTO: 12/12/1990
    MAE: TEREZA SOUZA
    TELEFONES:
    (31) 97777-8888
    BY: @bot
    USER: 99999
    """
    parsed = messenger_core.parse_structured_txt_result(single_raw)
    assert "NOME: MARCOS SOUZA" in parsed
    assert "CPF: 999.888.777-66" in parsed
    assert "BY: @bot" not in parsed
    assert "USER: 99999" not in parsed
    print("[PASS] Single record handling verified successfully")

if __name__ == "__main__":
    test_query_lock_exists()
    test_batch_txt_parser_isolation()
    test_single_txt_record_handling()
    print("ALL MESSENGER LOCK & PARSER TESTS PASSED!")
