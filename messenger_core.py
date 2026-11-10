import os
import asyncio
import io
import re
from telethon import TelegramClient
from telethon.tl.types import ReplyInlineMarkup
from dotenv import load_dotenv

load_dotenv()

API_ID = int(os.getenv("TELEGRAM_API_ID", 0))
API_HASH = os.getenv("TELEGRAM_API_HASH", "")
PHONE = os.getenv("TELEGRAM_PHONE", "")
TARGET_CHAT = os.getenv("TARGET_CHAT", "@centraldo7chat")

client = TelegramClient('session_userbot', API_ID, API_HASH)
query_lock = asyncio.Lock()


def validate_query_input(query_type: str, query_value: str) -> tuple[bool, str, str]:
    q_type = (query_type or "").strip().lower()
    q_val = (query_value or "").strip()

    if not q_val:
        return False, "", "O campo de pesquisa não pode estar vazio."

    digits_only = re.sub(r'\D', '', q_val)
    letters_only = re.sub(r'[^a-zA-ZÀ-ÿ\s]', '', q_val).strip()

    if q_type == "cpf":
        if re.search(r'[a-zA-ZÀ-ÿ]', q_val):
            return False, q_val, "Divergência: Você selecionou 'CPF', mas digitou letras/nome."
        if len(digits_only) != 11:
            return False, q_val, f"CPF inválido: Deve conter 11 dígitos."
        return True, digits_only, ""

    elif q_type == "nome":
        if len(digits_only) >= 8 or re.sub(r'[\.\-\/\(\)\s]', '', q_val).isdigit():
            return False, q_val, "Divergência: Você selecionou 'Nome', mas digitou número/CPF."
        if any(c.isdigit() for c in q_val):
            return False, q_val, "Nome inválido: Apenas letras e espaços."
        return True, re.sub(r'\s+', ' ', letters_only).strip(), ""

    elif q_type == "telefone":
        if digits_only.startswith("55") and len(digits_only) in (12, 13):
            digits_only = digits_only[2:]
        if len(digits_only) not in (10, 11):
            return False, q_val, "Telefone inválido: Informe DDD + Número."
        return True, digits_only, ""

    elif q_type == "placa":
        clean_plate = re.sub(r'[^a-zA-Z0-9]', '', q_val).upper()
        if not re.match(r'^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$', clean_plate):
            return False, q_val, "Placa inválida."
        return True, clean_plate, ""

    return True, q_val, ""


def sanitize_telegram_text(text: str) -> str:
    if not text:
        return ""
    unwanted = [
        r'by:\s*@?[\w\d_]+', r'user:\s*\d+', r'@voidsearch[\w\d_]*',
        r'voidsearch', r'^\s*👤\s*user', r'^\s*🤖\s*by', r'modulo\s*\w+'
    ]
    lines = text.splitlines()
    filtered = []
    for line in lines:
        stripped = line.strip()
        if any(re.search(pat, stripped, re.IGNORECASE) for pat in unwanted):
            continue
        filtered.append(line)
    return "\n".join(filtered).strip()


def parse_structured_txt_result(raw_text: str) -> str:
    if not raw_text or not raw_text.strip():
        return ""

    clean_raw = sanitize_telegram_text(raw_text)

    # Divide a resposta por múltiplos resultados (RESULTADO X, REGISTRO X)
    split_pattern = re.compile(
        r'(?im)(?:^|\n)\s*(?:[「\s]*)(RESULTADO\s*(?:\(\d+(?:/\d+)?\)|\d+)|REGISTRO\s*(?:\(\d+\)|\d+)|PESSOA\s*\d+):?'
    )
    
    parts = split_pattern.split(clean_raw)
    records = []

    if len(parts) > 2:
        for i in range(1, len(parts), 2):
            marker = parts[i].strip()
            body = parts[i + 1] if (i + 1) < len(parts) else ""
            clean_body = sanitize_telegram_text(body)
            if clean_body:
                records.append((marker, clean_body))
    else:
        # Se não houver marcação explícita, divide pelas ocorrências de "NOME:"
        nome_matches = list(re.finditer(r'(?im)^\s*(?:[•\-\*>👉👤]\s*)?NOME\s*:', clean_raw))
        if len(nome_matches) > 1:
            for idx_m, match in enumerate(nome_matches):
                start_pos = match.start()
                end_pos = nome_matches[idx_m + 1].start() if (idx_m + 1) < len(nome_matches) else len(clean_raw)
                chunk = sanitize_telegram_text(clean_raw[start_pos:end_pos])
                if chunk:
                    records.append((f"RESULTADO ({idx_m + 1})", chunk))
        else:
            records.append(("REGISTRO 1", clean_raw))

    if not records:
        return clean_raw

    output_blocks = []

    for idx, (marker, body) in enumerate(records, start=1):
        lines = body.splitlines()
        formatted_lines = []
        person_name = ""
        person_cpf = ""

        for line in lines:
            line_str = line.strip()
            if not line_str or re.match(r'^[\s\-_=─━*•#~═「」👤]+$', line_str):
                continue

            if "DADOS CADASTRAIS" in line_str.upper() or "CONSULTA NOME" in line_str.upper():
                continue

            colon_idx = line_str.find(":")
            if colon_idx > 0:
                k = line_str[:colon_idx].strip()
                v = line_str[colon_idx + 1:].strip()
                
                k_clean = re.sub(r'^[•\-\*>👉⚡️📍📞👨‍👩‍👧📋🚗💳🏢👤🔹\s]+', '', k).upper().strip()
                
                if "NOME" in k_clean and not person_name and not any(x in k_clean for x in ["MAE", "MÃE", "PAI"]):
                    person_name = v
                elif "CPF" in k_clean and not person_cpf:
                    person_cpf = v

                if k_clean and v:
                    formatted_lines.append(f"{k_clean}: {v}")
            else:
                val = re.sub(r'^[•\-\*\>\s]+', '', line_str).strip()
                if val:
                    formatted_lines.append(f"INFO: {val}")

        title = f"REGISTRO {idx}"
        if person_name:
            title += f" - {person_name}"
        if person_cpf:
            title += f" (CPF: {person_cpf})"

        block_content = f"📌 {title}\n" + "\n".join(formatted_lines)
        output_blocks.append(block_content)

    return "\n\n".join(output_blocks)


def clean_module_name(btn_text: str) -> str:
    cleaned = re.sub(r'^[^\w\d]+|[^\w\d\)\(\-]+$', '', btn_text).strip()
    return re.sub(r'^[•\-\>👉⚡️📍📞👨‍👩‍👧📋🚗💳🏢👤🔹📊🏛️🔄💉🗑️❌✖️\s]+', '', cleaned).strip() or btn_text.strip()


def is_button_match(target_base: str, btn_text: str) -> bool:
    bt_raw = (btn_text or "").strip()
    
    if any(forbidden in bt_raw for forbidden in ["🗑️", "🗑", "❌", "✖️", "FECHAR", "APAGAR", "EXCLUIR"]):
        return False

    tb = re.sub(r'[^A-Z0-9]', '', target_base.upper())
    bt = re.sub(r'[^A-Z0-9]', '', bt_raw.upper())
    
    if "COMPLETO" in bt or "COMPLETO" in tb:
        return False
        
    return tb in bt or bt in tb


async def initialize_client():
    if not client.is_connected():
        await client.connect()
    if not await client.is_user_authorized():
        raise Exception("Cliente Telegram não autorizado.")


async def execute_query(query_type: str, query_value: str, target_base: str):
    is_valid, clean_val, err_msg = validate_query_input(query_type, query_value)
    if not is_valid:
        print(f"[LOG] Validação falhou: {err_msg}")
        return {"status": "invalid_format", "message": err_msg, "result": err_msg}

    if target_base and "COMPLETO" in target_base.upper():
        return {"status": "error", "message": "A base 'COMPLETO' foi descontinuada."}

    async with query_lock:
        await initialize_client()
        command = f"/{query_type} {clean_val}"
        target_chat_entity = await client.get_entity(TARGET_CHAT)

        print(f"\n[LOG DIAGNÓSTICO] Enviando comando: {command} para chat {TARGET_CHAT}")
        sent_msg = await client.send_message(target_chat_entity, command)
        print(f"[LOG DIAGNÓSTICO] Comando enviado com sucesso. ID da mensagem enviada: {sent_msg.id}")
        
        await asyncio.sleep(1.0)

        response_message = None
        print(f"[LOG DIAGNÓSTICO] Varrendo chat em busca da resposta do bot com botões inline...")
        
        for tentativa in range(15):
            async for message in client.iter_messages(target_chat_entity, limit=6):
                if message.id > sent_msg.id:
                    has_markup = bool(message.reply_markup and isinstance(message.reply_markup, ReplyInlineMarkup) and message.reply_markup.rows)
                    print(f"[LOG MENSAGEM ID {message.id}] Texto: {repr((message.text or '')[:50])} | Tem botões inline? {has_markup}")
                    
                    if has_markup:
                        response_message = message
                        break
            if response_message:
                print(f"[LOG DIAGNÓSTICO] Resposta com botões encontrada na mensagem ID: {response_message.id}")
                break
            await asyncio.sleep(0.6)

        if not response_message or not response_message.reply_markup:
            print(f"[LOG ERRO] Timeout: O bot não retornou botões inline após o comando.")
            return {"status": "error", "message": "O bot não retornou os botões de seleção de base a tempo."}

        button_to_click = None
        available_modules = []

        for row in response_message.reply_markup.rows:
            for button in row.buttons:
                btn_text = (button.text or "").strip()
                if not btn_text or "COMPLETO" in btn_text.upper():
                    continue
                
                if any(forbidden in btn_text for forbidden in ["🗑️", "🗑", "❌", "✖️"]):
                    continue

                mod_name = clean_module_name(btn_text)
                available_modules.append(mod_name)
                print(f"[LOG BOTÃO DISPONÍVEL] Texto bruto: '{btn_text}' | Módulo limpo: '{mod_name}'")
                
                if target_base and is_button_match(target_base, btn_text):
                    button_to_click = button

        if not button_to_click:
            print(f"[LOG AVISO] Botão correspondente à base '{target_base}' não encontrado. Exibindo prompt de módulos.")
            return {
                "status": "modules_prompt",
                "query": command,
                "query_type": query_type,
                "query_value": clean_val,
                "requested_base": target_base,
                "available_modules": available_modules or ["SIMPLES", "SYNC", "RECEITA", "CREDLINK"],
                "message": "Selecione uma base disponível:"
            }

        print(f"[LOG DIAGNÓSTICO] Botão alvo encontrado para clique: '{button_to_click.text}'. Acionando...")
        await asyncio.sleep(0.5)

        try:
            if hasattr(button_to_click, 'click') and callable(button_to_click.click):
                await button_to_click.click()
            else:
                await response_message.click(text=button_to_click.text)
            print(f"[LOG DIAGNÓSTICO] Clique realizado com sucesso.")
        except Exception as ex_click:
            print(f"[LOG ERRO CLIQUE] Falha no clique direto: {ex_click}. Tentando enviar como texto...")
            try:
                await client.send_message(target_chat_entity, button_to_click.text)
            except Exception as e:
                print(f"[LOG ERRO FATAL] Falha total ao acionar botão: {e}")
                return {"status": "error", "message": f"Erro ao acionar o botão: {str(e)}"}

        final_result_text = None
        target_message_id = response_message.id
        print(f"[LOG DIAGNÓSTICO] Aguardando o resultado final (arquivo ou mensagem editada/enviada)...")

        for tentativa_res in range(30):
            try:
                edited_msg = await client.get_messages(target_chat_entity, ids=target_message_id)
                candidates = [edited_msg] if edited_msg else []

                async for message in client.iter_messages(target_chat_entity, limit=6):
                    if message.id >= target_message_id:
                        candidates.append(message)

                for msg in candidates:
                    if not msg:
                        continue

                    if msg.document:
                        print(f"[LOG DIAGNÓSTICO] Arquivo detectado na mensagem ID {msg.id}!")
                        file_bytes = await client.download_media(msg, file=io.BytesIO())
                        file_bytes.seek(0)
                        try:
                            raw_text = file_bytes.read().decode('utf-8')
                        except UnicodeDecodeError:
                            raw_text = file_bytes.read().decode('latin-1', errors='replace')
                        final_result_text = parse_structured_txt_result(raw_text)
                        print(f"[LOG SUCESSO] Resultado em arquivo .txt lido com sucesso ({len(final_result_text)} caracteres).")
                        break

                    txt = (msg.text or "").strip()
                    if txt and len(txt) > 15 and not any(k in txt.upper() for k in ["AGUARDE", "PROCESSANDO", "CONSULTANDO"]):
                        if any(k in txt.upper() for k in ["NOME:", "CPF:", "SITUAÇÃO", "DADOS", "RESULTADO", "REGISTRO"]):
                            final_result_text = parse_structured_txt_result(txt)
                            print(f"[LOG SUCESSO] Resultado em texto lido na mensagem ID {msg.id} ({len(final_result_text)} caracteres).")
                            break
            except Exception as ex_poll:
                print(f"[LOG AVISO POLL] Erro temporário na varredura de resultado: {ex_poll}")

            if final_result_text:
                break
            await asyncio.sleep(0.5)

        if not final_result_text:
            print(f"[LOG ERRO] Timeout: Botão clicado, mas nenhum resultado válido foi retornado a tempo.")
            return {"status": "error", "message": "A consulta foi enviada e o botão acionado, mas o bot não retornou os dados a tempo."}

        return {
            "status": "success",
            "query": command,
            "base": target_base,
            "result": final_result_text
        }