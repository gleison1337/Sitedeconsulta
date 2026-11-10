-- ====================================================================
-- CENTRAL DE INTELIGÊNCIA CORPORATIVA - SUPABASE SCHEMA DEFINITIVO
-- ====================================================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABELA DE PERFIS DE USUÁRIOS (PROFILES)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT DEFAULT 'Operador Corporativo',
    credits INTEGER DEFAULT 10,
    is_active BOOLEAN DEFAULT TRUE,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    avatar_url TEXT DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    telegram_username TEXT,
    last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABELA DE HISTÓRICO DE CONSULTAS
CREATE TABLE IF NOT EXISTS public.query_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    query_type TEXT NOT NULL,
    query_value TEXT NOT NULL,
    target_base TEXT NOT NULL,
    result_data TEXT,
    credits_cost INTEGER DEFAULT 1,
    status TEXT DEFAULT 'success',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABELA DE TRANSAÇÕES PIX (WOOVI)
CREATE TABLE IF NOT EXISTS public.pix_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    package_name TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    credits INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'canceled')),
    pix_code TEXT,
    qr_code_url TEXT,
    correlation_id TEXT UNIQUE NOT NULL,
    woovi_charge_id TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TABELA DE CONFIGURAÇÕES DO SISTEMA
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. DADOS INICIAIS DE CONFIGURAÇÃO
INSERT INTO public.system_settings (key, value, description)
VALUES 
    ('telegram_support', '{"username": "@centraldo7chat", "url": "https://t.me/centraldo7chat", "name": "Suporte Oficial Telegram"}', 'Link e dados de contato do suporte'),
    ('credit_costs', '{"query_cost": 1, "initial_signup_credits": 10}', 'Custo de créditos por consulta e bônus de cadastro'),
    ('packages', '[
        {"id": "starter", "name": "Pacote Starter", "credits": 20, "price": 19.90, "badge": "Iniciante"},
        {"id": "pro", "name": "Pacote Pro", "credits": 60, "price": 49.90, "badge": "Mais Popular"},
        {"id": "enterprise", "name": "Pacote Enterprise", "credits": 150, "price": 99.90, "badge": "Melhor Custo/Benefício"},
        {"id": "vip", "name": "Pacote VIP Volume", "credits": 400, "price": 199.90, "badge": "Ilimitado"}
    ]', 'Pacotes de recarga de créditos')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 7. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_query_history_user ON public.query_history(user_id);
CREATE INDEX IF NOT EXISTS idx_pix_correlation ON public.pix_transactions(correlation_id);

-- 8. POLÍTICAS DE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pix_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Políticas de Leitura e Escrita Públicas / Anon (com chave pública do Supabase)
DROP POLICY IF EXISTS "Public access profiles" ON public.profiles;
CREATE POLICY "Public access profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access query_history" ON public.query_history;
CREATE POLICY "Public access query_history" ON public.query_history FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access pix_transactions" ON public.pix_transactions;
CREATE POLICY "Public access pix_transactions" ON public.pix_transactions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access system_settings" ON public.system_settings;
CREATE POLICY "Public access system_settings" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);

-- 9. USUÁRIO ADMINISTRADOR PADRÃO
INSERT INTO public.profiles (email, full_name, credits, is_active, role, avatar_url)
VALUES ('admin@corporativo.com', 'Administrador Chefe', 9999, TRUE, 'admin', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80')
ON CONFLICT (email) DO UPDATE SET role = 'admin', credits = 9999, is_active = TRUE;
