// Central de Inteligência Corporativa - Full-Stack Client Engine
const SUPABASE_URL = "https://amfycxizytkvyoadjkva.supabase.co";
const SUPABASE_KEY = "sb_publishable_j7qozpKsctxBG4cNVMJjdQ_VOm4YRS9";

// Inicialização segura do cliente Supabase sem colisão de variáveis globais
if (!window.supabaseClient && window.supabase && typeof window.supabase.createClient === "function") {
    try {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (e) {
        console.warn("Supabase init warning:", e);
    }
}

const AVATAR_PRESETS = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80"
];

document.addEventListener("DOMContentLoaded", () => {
    let currentUser = JSON.parse(localStorage.getItem("corp_user")) || null;

    let activePixInterval = null;
    let accessTimerInterval = null;
    let trialCooldownInterval = null;
    let currentParsedData = null;
    let isPlainTextView = false;

    const userAuthContainer = document.getElementById("userAuthContainer");
    const authModal = document.getElementById("authModal");
    const userDashboardModal = document.getElementById("userDashboardModal");
    const adminModal = document.getElementById("adminModal");
    const adminPasswordPromptModal = document.getElementById("adminPasswordPromptModal");
    const plansModal = document.getElementById("plansModal");
    const pixModal = document.getElementById("pixModal");
    const faqModal = document.getElementById("faqModal");
    const termsModal = document.getElementById("termsModal");
    const trialCardModal = document.getElementById("trialCardModal");

    const searchForm = document.getElementById("searchForm");
    const queryType = document.getElementById("queryType");
    const targetBase = document.getElementById("targetBase");
    const queryValue = document.getElementById("queryValue");
    const clearInputBtn = document.getElementById("clearInputBtn");
    const inputHint = document.getElementById("inputHint");
    const submitBtn = document.getElementById("submitBtn");
    const submitText = document.getElementById("submitText");
    const submitIcon = document.getElementById("submitIcon");
    const loading = document.getElementById("loading");

    const fallbackCard = document.getElementById("fallbackCard");
    const fallbackRequestedBase = document.getElementById("fallbackRequestedBase");
    const fallbackModulesGrid = document.getElementById("fallbackModulesGrid");
    const errorCard = document.getElementById("errorCard");
    const errorMessage = document.getElementById("errorMessage");

    const resultContainer = document.getElementById("resultContainer");
    const cardsContainer = document.getElementById("cardsContainer");
    const plainTextContainer = document.getElementById("plainTextContainer");
    const plainTextOutput = document.getElementById("plainTextOutput");
    const toggleViewBtn = document.getElementById("toggleViewBtn");
    const toggleViewText = document.getElementById("toggleViewText");
    const copyAllBtn = document.getElementById("copyAllBtn");
    const copyAllText = document.getElementById("copyAllText");
    const copyAllIcon = document.getElementById("copyAllIcon");
    const resultBaseBadge = document.getElementById("resultBaseBadge");
    const resultFieldsCount = document.getElementById("resultFieldsCount");
    const printMetaInfo = document.getElementById("printMetaInfo");

    function saveCurrentUser(u) {
        currentUser = u;
        localStorage.setItem("corp_user", JSON.stringify(u));
        renderNavbarUser();
        checkAuthLockState();
        startAccessCountdown();
    }

    function checkAuthLockState() {
        const lockedViewBanner = document.getElementById("lockedViewBanner");
        const mainAppContent = document.getElementById("mainAppContent");
        const authCloseBtn = document.getElementById("authModalCloseBtn");
        const authModal = document.getElementById("authModal");

        const isAuth = !!(currentUser && currentUser.email && typeof currentUser.email === "string" && currentUser.email.trim().length > 3);

        if (!isAuth) {
            currentUser = null;
            if (mainAppContent) mainAppContent.classList.add("hidden");
            if (lockedViewBanner) lockedViewBanner.classList.remove("hidden");
            if (authCloseBtn) {
                authCloseBtn.classList.add("hidden");
                authCloseBtn.setAttribute("disabled", "true");
                authCloseBtn.style.display = "none";
            }
            if (authModal) {
                authModal.classList.remove("hidden");
                authModal.style.zIndex = "99999";
            }
        } else {
            if (mainAppContent) mainAppContent.classList.remove("hidden");
            if (lockedViewBanner) lockedViewBanner.classList.add("hidden");
            if (authModal) authModal.classList.add("hidden");
            if (authCloseBtn) {
                authCloseBtn.classList.remove("hidden");
                authCloseBtn.removeAttribute("disabled");
                authCloseBtn.style.display = "";
            }
        }
    }

    function logoutUser() {
        currentUser = null;
        localStorage.removeItem("corp_user");
        renderNavbarUser();
        checkAuthLockState();
    }

    function renderNavbarUser() {
        if (!userAuthContainer) return;
        userAuthContainer.innerHTML = "";

        if (currentUser && currentUser.email) {
            const isAdmin = currentUser.role === "admin" || currentUser.email === "admin@corporativo.com";
            const statusText = isAdmin ? "Admin Supremo" : (currentUser.is_trial ? "⏱️ Modo Trial" : "⏱️ Assinante Ativo");
            const chip = document.createElement("div");
            chip.className = "flex items-center space-x-2 bg-slate-900/90 border border-slate-700/80 rounded-xl p-1.5 pr-2.5 shadow-sm";
            chip.innerHTML = `
                <img src="${currentUser.avatar_url || AVATAR_PRESETS[0]}" alt="Avatar" class="w-7 h-7 rounded-lg object-cover ring-1 ring-cyan-500">
                <div class="hidden sm:block text-left">
                    <span class="block text-xs font-bold text-white truncate max-w-[110px]">${escapeHtml(currentUser.full_name || currentUser.email.split("@")[0])}</span>
                    <span class="block text-[10px] text-cyan-400 font-semibold" id="navTimeStatus">${statusText}</span>
                </div>
                ${isAdmin ? `
                <button type="button" id="btnAdminNav" class="px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-900 to-indigo-900 hover:from-purple-800 hover:to-indigo-800 border border-purple-500/60 text-purple-200 hover:text-white text-xs font-bold transition shadow-sm flex items-center space-x-1" title="Acessar Painel ADM">
                    <span>🛡️ Painel ADM</span>
                </button>
                ` : ''}
                <button type="button" id="btnOpenUserMenu" class="p-1 text-slate-400 hover:text-white transition" title="Opções de Conta">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                </button>
                <button type="button" id="btnLogoutNav" class="p-1 text-slate-400 hover:text-rose-400 transition" title="Sair da Conta">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                </button>
            `;
            userAuthContainer.appendChild(chip);

            chip.querySelector("#btnOpenUserMenu").addEventListener("click", () => openDashboardModal());
            chip.querySelector("#btnLogoutNav")?.addEventListener("click", () => logoutUser());
            chip.querySelector("#btnAdminNav")?.addEventListener("click", () => openAdminModal());
        } else {
            const btnLogin = document.createElement("button");
            btnLogin.type = "button";
            btnLogin.className = "px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition shadow-md";
            btnLogin.textContent = "Entrar / Cadastrar";
            btnLogin.addEventListener("click", () => window.openAuthModal("login"));
            userAuthContainer.appendChild(btnLogin);
        }
    }
    function formatTimeRemaining(seconds) {
        if (seconds <= 0) return "00:00:00";
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);

        if (d > 0) {
            return `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
        }
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function startAccessCountdown() {
        if (accessTimerInterval) clearInterval(accessTimerInterval);

        const floatingWidget = document.getElementById("floatingTimeWidget");
        const floatingText = document.getElementById("floatingTimeText");
        const floatingLabel = document.getElementById("floatingTimeLabel");
        const timeDot = document.getElementById("timeDotStatus");
        const timePing = document.getElementById("timePingAnim");
        const dashTimeRemaining = document.getElementById("dashTimeRemaining");
        const dashExpiresDate = document.getElementById("dashExpiresDate");
        const dashTimeIcon = document.getElementById("dashTimeIcon");
        const expiredCard = document.getElementById("expiredAccessCard");
        const mainApp = document.getElementById("mainAppContent");
        const trialBanner = document.getElementById("trialNoticeBanner");
        const trialRemainingText = document.getElementById("trialQueriesRemainingText");

        if (!currentUser || !currentUser.email) {
            if (floatingWidget) floatingWidget.classList.add("hidden");
            if (expiredCard) expiredCard.classList.add("hidden");
            if (trialBanner) trialBanner.classList.add("hidden");
            return;
        }

        const isAdmin = currentUser.role === "admin" || currentUser.email === "admin@corporativo.com";

        if (isAdmin) {
            if (floatingWidget) floatingWidget.classList.remove("hidden");
            if (floatingLabel) floatingLabel.textContent = "Acesso Vitalício";
            if (floatingText) floatingText.textContent = "👑 Ilimitado (Admin)";
            if (timeDot) timeDot.className = "relative inline-flex rounded-full h-3 w-3 bg-purple-500";
            if (timePing) timePing.className = "animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75";
            if (dashTimeRemaining) dashTimeRemaining.textContent = "Vitalício (Admin)";
            if (dashExpiresDate) dashExpiresDate.textContent = "Sem limite de vigência";
            if (expiredCard) expiredCard.classList.add("hidden");
            if (trialBanner) trialBanner.classList.add("hidden");
            if (mainApp) mainApp.classList.remove("hidden");
            return;
        }

        if (floatingWidget) floatingWidget.classList.remove("hidden");

        if (currentUser.is_trial) {
            if (trialBanner) trialBanner.classList.remove("hidden");
            const used = currentUser.trial_queries_count || 0;
            const remainingQueries = Math.max(0, 20 - used);
            if (trialRemainingText) trialRemainingText.textContent = `${remainingQueries} pesquisas restantes`;
        } else {
            if (trialBanner) trialBanner.classList.add("hidden");
        }

        function tick() {
            const now = Math.floor(Date.now() / 1000);
            const expires = currentUser.access_expires_at || 0;
            const diff = Math.max(0, expires - now);

            if (dashExpiresDate && expires) {
                const expDate = new Date(expires * 1000);
                dashExpiresDate.textContent = `Expira em: ${expDate.toLocaleDateString('pt-BR')} às ${expDate.toLocaleTimeString('pt-BR')}`;
            }

            if (diff <= 0) {
                if (floatingLabel) floatingLabel.textContent = "Vigência";
                if (floatingText) floatingText.textContent = "⚠️ Expirado";
                if (timeDot) timeDot.className = "relative inline-flex rounded-full h-3 w-3 bg-rose-500";
                if (timePing) timePing.className = "hidden";
                if (dashTimeRemaining) dashTimeRemaining.textContent = "Expirado";
                if (dashTimeIcon) dashTimeIcon.textContent = "⚠️";
                
                if (mainApp) mainApp.classList.add("hidden");
                if (expiredCard) expiredCard.classList.remove("hidden");
            } else {
                const formatted = formatTimeRemaining(diff);
                if (floatingLabel) floatingLabel.textContent = currentUser.is_trial ? "Teste (Trial)" : "Tempo Restante";
                if (floatingText) floatingText.textContent = formatted;
                if (timeDot) timeDot.className = "relative inline-flex rounded-full h-3 w-3 bg-emerald-500";
                if (timePing) timePing.className = "animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75";
                if (dashTimeRemaining) dashTimeRemaining.textContent = formatted;
                if (dashTimeIcon) dashTimeIcon.textContent = "⏱️";

                if (mainApp) mainApp.classList.remove("hidden");
                if (expiredCard) expiredCard.classList.add("hidden");
            }
        }

        tick();
        accessTimerInterval = setInterval(tick, 1000);
    }

    document.getElementById("btnFloatingRenew")?.addEventListener("click", () => plansModal.classList.remove("hidden"));
    document.getElementById("btnExpiredRenew")?.addEventListener("click", () => plansModal.classList.remove("hidden"));


    renderNavbarUser();
    checkAuthLockState();

    // Vinculação explícita e segura dos botões do banner bloqueado
    const btnAccessPortal = document.querySelector("#lockedViewBanner button:nth-child(1)");
    const btnRequestReg = document.querySelector("#lockedViewBanner button:nth-child(2)");

    if (btnAccessPortal) {
        btnAccessPortal.addEventListener("click", (e) => {
            e.preventDefault();
            window.openAuthModal('login');
        });
    }
    if (btnRequestReg) {
        btnRequestReg.addEventListener("click", (e) => {
            e.preventDefault();
            window.openAuthModal('register');
        });
    }

    // Modal Close Logic
    document.querySelectorAll(".close-modal-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const isAuth = !!(currentUser && currentUser.email && currentUser.email.trim().length > 3);
            if (!isAuth) {
                if (btn.id === "authModalCloseBtn" || authModal.contains(btn)) return;
            }
            document.querySelectorAll("#authModal, #userDashboardModal, #adminModal, #adminPasswordPromptModal, #plansModal, #pixModal, #faqModal, #termsModal, #trialCardModal").forEach(m => m.classList.add("hidden"));
            if (activePixInterval) clearInterval(activePixInterval);
            checkAuthLockState();
        });
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            const isAuth = !!(currentUser && currentUser.email);
            if (!isAuth) {
                e.preventDefault();
                return;
            }
            document.querySelectorAll("#authModal, #userDashboardModal, #adminModal, #adminPasswordPromptModal, #plansModal, #pixModal, #faqModal, #termsModal, #trialCardModal").forEach(m => m.classList.add("hidden"));
        }
    });

    document.getElementById("btnOpenFaq")?.addEventListener("click", () => faqModal.classList.remove("hidden"));
    document.getElementById("btnOpenTerms")?.addEventListener("click", () => termsModal.classList.remove("hidden"));
    document.getElementById("btnOpenPlans")?.addEventListener("click", () => plansModal.classList.remove("hidden"));
    document.getElementById("dashBtnRecharge")?.addEventListener("click", () => {
        userDashboardModal.classList.add("hidden");
        plansModal.classList.remove("hidden");
    });

    // Auth Modal Logic
    let currentAuthTab = "login";
    window.openAuthModal = function(tab = "login") {
        currentAuthTab = tab;
        if (authModal) {
            authModal.classList.remove("hidden");
            authModal.style.zIndex = "99999";
        }
        updateAuthTabUI();

        const authCloseBtn = document.getElementById("authModalCloseBtn");
        const isAuth = !!(currentUser && currentUser.email && currentUser.email.trim().length > 3);
        if (authCloseBtn) {
            if (!isAuth) {
                authCloseBtn.classList.add("hidden");
                authCloseBtn.setAttribute("disabled", "true");
                authCloseBtn.style.display = "none";
            } else {
                authCloseBtn.classList.remove("hidden");
                authCloseBtn.removeAttribute("disabled");
                authCloseBtn.style.display = "";
            }
        }
    };

    const tabAuthLogin = document.getElementById("tabAuthLogin");
    const tabAuthRegister = document.getElementById("tabAuthRegister");
    const tabAuthReset = document.getElementById("tabAuthReset");
    const authFullNameGroup = document.getElementById("authFullNameGroup");
    const authPasswordGroup = document.getElementById("authPasswordGroup");
    const authConfirmPasswordGroup = document.getElementById("authConfirmPasswordGroup");
    const authTermsGroup = document.getElementById("authTermsGroup");
    const authTermsCheckbox = document.getElementById("authTermsCheckbox");
    const authPasswordHint = document.getElementById("authPasswordHint");
    const authBonusNote = document.getElementById("authBonusNote");
    const authModalTitle = document.getElementById("authModalTitle");
    const authModalSubtitle = document.getElementById("authModalSubtitle");
    const authSubmitText = document.getElementById("authSubmitText");
    const authAlert = document.getElementById("authAlert");
    const linkOpenTermsInsideAuth = document.getElementById("linkOpenTermsInsideAuth");

    linkOpenTermsInsideAuth?.addEventListener("click", (e) => {
        e.preventDefault();
        termsModal.classList.remove("hidden");
    });

    function updateAuthTabUI() {
        authAlert.classList.add("hidden");
        tabAuthLogin.className = currentAuthTab === "login" ? "flex-1 py-2 rounded-lg bg-cyan-600 text-white transition shadow-sm" : "flex-1 py-2 rounded-lg text-slate-400 hover:text-white transition";
        tabAuthRegister.className = currentAuthTab === "register" ? "flex-1 py-2 rounded-lg bg-cyan-600 text-white transition shadow-sm" : "flex-1 py-2 rounded-lg text-slate-400 hover:text-white transition";
        tabAuthReset.className = currentAuthTab === "reset" ? "flex-1 py-2 rounded-lg bg-cyan-600 text-white transition shadow-sm" : "flex-1 py-2 rounded-lg text-slate-400 hover:text-white transition";

        if (currentAuthTab === "login") {
            authFullNameGroup?.classList.add("hidden");
            authPasswordGroup?.classList.remove("hidden");
            authConfirmPasswordGroup?.classList.add("hidden");
            authTermsGroup?.classList.add("hidden");
            authPasswordHint?.classList.add("hidden");
            authBonusNote?.classList.remove("hidden");
            authModalTitle.textContent = "Acessar Sistema";
            authModalSubtitle.textContent = "Faça login com suas credenciais corporativas";
            authSubmitText.textContent = "Entrar na Plataforma";
        } else if (currentAuthTab === "register") {
            authFullNameGroup?.classList.remove("hidden");
            authPasswordGroup?.classList.remove("hidden");
            authConfirmPasswordGroup?.classList.remove("hidden");
            authTermsGroup?.classList.remove("hidden");
            authPasswordHint?.classList.remove("hidden");
            authBonusNote?.classList.remove("hidden");
            authModalTitle.textContent = "Criar Nova Conta";
            authModalSubtitle.textContent = "Cadastre-se e ganhe 10 créditos para testar";
            authSubmitText.textContent = "Criar Conta & Liberar Créditos";
        } else {
            authFullNameGroup?.classList.add("hidden");
            authPasswordGroup?.classList.add("hidden");
            authConfirmPasswordGroup?.classList.add("hidden");
            authTermsGroup?.classList.add("hidden");
            authPasswordHint?.classList.add("hidden");
            authBonusNote?.classList.add("hidden");
            authModalTitle.textContent = "Recuperar Acesso";
            authModalSubtitle.textContent = "Informe seu e-mail para redefinir sua senha";
            authSubmitText.textContent = "Enviar E-mail de Recuperação";
        }
    }

    tabAuthLogin?.addEventListener("click", () => { currentAuthTab = "login"; updateAuthTabUI(); });
    tabAuthRegister?.addEventListener("click", () => { currentAuthTab = "register"; updateAuthTabUI(); });
    tabAuthReset?.addEventListener("click", () => { currentAuthTab = "reset"; updateAuthTabUI(); });

    document.getElementById("authForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        authAlert.classList.add("hidden");

        const email = document.getElementById("authEmail").value.trim().toLowerCase();
        const pwd = document.getElementById("authPassword").value;
        const fullName = document.getElementById("authFullName").value.trim();
        const confirmPwd = document.getElementById("authConfirmPassword")?.value || "";
        const termsChecked = document.getElementById("authTermsCheckbox")?.checked;

        // Sanitização e validação de e-mail contra injeções
        if (/[<>{}"'`\\;%()]/.test(email)) {
            authAlert.className = "p-3 rounded-xl text-xs bg-rose-950 text-rose-300 border border-rose-800";
            authAlert.textContent = "O e-mail contém caracteres inválidos ou proibidos.";
            authAlert.classList.remove("hidden");
            return;
        }

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)) {
            authAlert.className = "p-3 rounded-xl text-xs bg-rose-950 text-rose-300 border border-rose-800";
            authAlert.textContent = "Formato de e-mail inválido. Ex: usuario@empresa.com";
            authAlert.classList.remove("hidden");
            return;
        }

        if (currentAuthTab === "reset") {
            authAlert.className = "p-3 rounded-xl text-xs bg-emerald-950 text-emerald-300 border border-emerald-800";
            authAlert.textContent = "Instruções de recuperação enviadas para o e-mail informado!";
            authAlert.classList.remove("hidden");
            return;
        }

        if (currentAuthTab === "register") {
            // 1. Sanitização rigorosa do nome
            if (!fullName || fullName.length < 3 || fullName.length > 60) {
                authAlert.className = "p-3 rounded-xl text-xs bg-rose-950 text-rose-300 border border-rose-800";
                authAlert.textContent = "O nome deve conter entre 3 e 60 caracteres.";
                authAlert.classList.remove("hidden");
                return;
            }

            if (/[<>"\';%(){}\[\]\\\/]/.test(fullName)) {
                authAlert.className = "p-3 rounded-xl text-xs bg-rose-950 text-rose-300 border border-rose-800";
                authAlert.textContent = "O nome contém caracteres especiais proibidos.";
                authAlert.classList.remove("hidden");
                return;
            }

            const nameRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ\s.'-]{3,60}$/;
            if (!nameRegex.test(fullName)) {
                authAlert.className = "p-3 rounded-xl text-xs bg-rose-950 text-rose-300 border border-rose-800";
                authAlert.textContent = "Nome inválido. Use apenas letras e espaços (sem números ou símbolos).";
                authAlert.classList.remove("hidden");
                return;
            }

            // 2. Validação da senha
            if (pwd.length < 6) {
                authAlert.className = "p-3 rounded-xl text-xs bg-rose-950 text-rose-300 border border-rose-800";
                authAlert.textContent = "A senha deve conter no mínimo 6 caracteres.";
                authAlert.classList.remove("hidden");
                return;
            }

            // 3. Confirmação de senha
            if (pwd !== confirmPwd) {
                authAlert.className = "p-3 rounded-xl text-xs bg-rose-950 text-rose-300 border border-rose-800";
                authAlert.textContent = "As senhas não coincidem. Digite a mesma senha nos dois campos.";
                authAlert.classList.remove("hidden");
                return;
            }

            // 4. Termos de Uso obrigatórios (LGPD)
            if (!termsChecked) {
                authAlert.className = "p-3 rounded-xl text-xs bg-amber-950 text-amber-300 border border-amber-800";
                authAlert.textContent = "Você deve concordar com os Termos de Uso e Política de Privacidade (LGPD).";
                authAlert.classList.remove("hidden");
                return;
            }
        }

        const endpoint = currentAuthTab === "register" ? "/api/auth/register" : "/api/auth/login";
        const payload = currentAuthTab === "register" 
            ? { email, password: pwd, full_name: fullName } 
            : { email, password: pwd };

        try {
            const resp = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await resp.json();
            if (data.status === "success") {
                saveCurrentUser(data.profile);
                authModal.classList.add("hidden");
                checkAuthLockState();
            } else {
                authAlert.className = "p-3 rounded-xl text-xs bg-rose-950 text-rose-300 border border-rose-800";
                authAlert.textContent = data.message || "Credenciais inválidas. Tente novamente.";
                authAlert.classList.remove("hidden");
            }
        } catch (err) {
            authAlert.className = "p-3 rounded-xl text-xs bg-rose-950 text-rose-300 border border-rose-800";
            authAlert.textContent = "Erro de conexão com o servidor backend.";
            authAlert.classList.remove("hidden");
        }
    });

    // Admin Password Confirmation Prompt Logic
    const adminPromptPassword = document.getElementById("adminPromptPassword");
    const adminPromptAlert = document.getElementById("adminPromptAlert");

    function openAdminPasswordPrompt() {
        if (!currentUser || (currentUser.role !== "admin" && currentUser.email !== "admin@corporativo.com")) {
            alert("Acesso restrito ao Administrador.");
            return;
        }
        if (adminPromptPassword) adminPromptPassword.value = "";
        if (adminPromptAlert) adminPromptAlert.classList.add("hidden");
        if (adminPasswordPromptModal) {
            adminPasswordPromptModal.classList.remove("hidden");
            setTimeout(() => adminPromptPassword?.focus(), 150);
        }
    }

    document.getElementById("adminPasswordPromptForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const pwd = adminPromptPassword.value.trim();
        if (!pwd) return;

        try {
            const resp = await fetch("/api/admin/verify-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ admin_email: currentUser.email, password: pwd })
            });
            const data = await resp.json();
            if (data.status === "success") {
                adminPasswordPromptModal.classList.add("hidden");
                openAdminModal();
            } else {
                adminPromptAlert.textContent = data.message || "Senha de Administrador incorreta.";
                adminPromptAlert.classList.remove("hidden");
            }
        } catch (err) {
            adminPromptAlert.textContent = "Erro de conexão ao verificar senha.";
            adminPromptAlert.classList.remove("hidden");
        }
    });

    // User Dashboard Modal Logic
    function openDashboardModal() {
        if (!currentUser) return openAuthModal("login");
        document.getElementById("dashUserAvatar").src = currentUser.avatar_url || AVATAR_PRESETS[0];
        document.getElementById("dashUserName").textContent = currentUser.full_name || "Operador";
        document.getElementById("dashUserEmail").textContent = currentUser.email;
        document.getElementById("dashUserStatus").textContent = currentUser.is_active ? "Ativo" : "Pendente";
        document.getElementById("dashUserRole").textContent = currentUser.role === "admin" ? "Administrador" : (currentUser.is_trial ? "Operador (Trial)" : "Operador");
        document.getElementById("dashInputName").value = currentUser.full_name || "";

        const isAdmin = currentUser.role === "admin" || currentUser.email === "admin@corporativo.com";
        const timeRemainingEl = document.getElementById("dashTimeRemaining");
        const expiresDateEl = document.getElementById("dashExpiresDate");
        const timeIconEl = document.getElementById("dashTimeIcon");

        if (isAdmin) {
            if (timeRemainingEl) timeRemainingEl.textContent = "Vitalício (Admin)";
            if (expiresDateEl) expiresDateEl.textContent = "Acesso irrestrito sem expiração";
            if (timeIconEl) timeIconEl.textContent = "👑";
        } else {
            const now = Math.floor(Date.now() / 1000);
            const diff = Math.max(0, (currentUser.access_expires_at || 0) - now);
            if (timeRemainingEl) timeRemainingEl.textContent = diff > 0 ? formatTimeRemaining(diff) : "Expirado";
            if (timeIconEl) timeIconEl.textContent = diff > 0 ? "⏱️" : "⚠️";
            if (expiresDateEl && currentUser.access_expires_at) {
                const expDate = new Date(currentUser.access_expires_at * 1000);
                expiresDateEl.textContent = `Expira em: ${expDate.toLocaleDateString('pt-BR')} às ${expDate.toLocaleTimeString('pt-BR')}`;
            }
        }

        const presetsGrid = document.getElementById("avatarPresetsGrid");
        presetsGrid.innerHTML = "";
        AVATAR_PRESETS.forEach(url => {
            const img = document.createElement("img");
            img.src = url;
            img.className = "w-12 h-12 rounded-xl object-cover cursor-pointer border-2 hover:border-cyan-400 transition" + (currentUser.avatar_url === url ? " border-cyan-400 ring-2 ring-cyan-500/50" : " border-slate-700");
            img.addEventListener("click", async () => {
                currentUser.avatar_url = url;
                document.getElementById("dashUserAvatar").src = url;
                await fetch("/api/auth/update-profile", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: currentUser.email, avatar_url: url })
                });
                saveCurrentUser(currentUser);
                openDashboardModal();
            });
            presetsGrid.appendChild(img);
        });

        loadUserHistory();
        userDashboardModal.classList.remove("hidden");
    }

    document.getElementById("dashBtnRecharge")?.addEventListener("click", () => {
        userDashboardModal.classList.add("hidden");
        plansModal.classList.remove("hidden");
    });

    async function loadUserHistory() {
        const list = document.getElementById("dashHistoryList");
        if (!list) return;
        list.innerHTML = "<div class='text-xs text-slate-500 p-2'>Carregando histórico...</div>";
        try {
            const resp = await fetch(`/api/user/history?email=${encodeURIComponent(currentUser.email)}`);
            const data = await resp.json();
            list.innerHTML = "";

            const subHistory = currentUser.subscriptions_history || [];
            if (subHistory.length > 0) {
                subHistory.slice(0, 3).forEach(sub => {
                    const rowSub = document.createElement("div");
                    rowSub.className = "p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-800/50 text-xs flex items-center justify-between";
                    rowSub.innerHTML = `
                        <div>
                            <span class="font-bold text-cyan-300">⚡ ${escapeHtml(sub.plan_name)}</span>
                            <span class="block text-[10px] text-slate-400">Ativado em: ${sub.activated_at || "Recentemente"}</span>
                        </div>
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">Ativado</span>
                    `;
                    list.appendChild(rowSub);
                });
            }

            if (!data.history || data.history.length === 0) {
                if (subHistory.length === 0) {
                    list.innerHTML = "<div class='text-xs text-slate-500 p-2'>Nenhuma consulta recente registrada.</div>";
                }
                return;
            }
            data.history.forEach(item => {
                const row = document.createElement("div");
                row.className = "p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center justify-between";
                row.innerHTML = `
                    <div>
                        <span class="font-bold text-white uppercase">${escapeHtml(item.query_type)}: ${escapeHtml(item.query_value)}</span>
                        <span class="block text-[11px] text-slate-400">Base: ${escapeHtml(item.target_base)} • ${item.created_at || "Recente"}</span>
                    </div>
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">Concluída</span>
                `;
                list.appendChild(row);
            });
        } catch (e) {
            list.innerHTML = "<div class='text-xs text-slate-500 p-2'>Histórico temporariamente indisponível.</div>";
        }
    }

    document.getElementById("tabDashHistory")?.addEventListener("click", () => {
        document.getElementById("dashHistorySection").classList.remove("hidden");
        document.getElementById("dashConfigSection").classList.add("hidden");
        document.getElementById("tabDashHistory").className = "flex-1 py-2 rounded-lg bg-cyan-600 text-white transition";
        document.getElementById("tabDashConfig").className = "flex-1 py-2 rounded-lg text-slate-400 hover:text-white transition";
    });

    document.getElementById("tabDashConfig")?.addEventListener("click", () => {
        document.getElementById("dashConfigSection").classList.remove("hidden");
        document.getElementById("dashHistorySection").classList.add("hidden");
        document.getElementById("tabDashConfig").className = "flex-1 py-2 rounded-lg bg-cyan-600 text-white transition";
        document.getElementById("tabDashHistory").className = "flex-1 py-2 rounded-lg text-slate-400 hover:text-white transition";
    });

    document.getElementById("btnSaveProfile")?.addEventListener("click", async () => {
        const newName = document.getElementById("dashInputName").value.trim();
        if (newName) {
            currentUser.full_name = newName;
            await fetch("/api/auth/update-profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: currentUser.email, full_name: newName })
            });
            saveCurrentUser(currentUser);
            openDashboardModal();
        }
    });

    window.openAdminModal = async function() {
        if (!currentUser || (currentUser.role !== "admin" && currentUser.email !== "admin@corporativo.com")) {
            alert("Acesso restrito ao Administrador.");
            return;
        }
        adminModal.classList.remove("hidden");
        loadAdminUsers();
    };

    async function loadAdminUsers() {
        const tbody = document.getElementById("adminUsersTableBody");
        if (!tbody) return;
        tbody.innerHTML = "<tr><td colspan='5' class='p-3 text-slate-500'>Carregando...</td></tr>";
        try {
            const resp = await fetch(`/api/admin/users?admin_email=${encodeURIComponent(currentUser.email)}`);
            const data = await resp.json();
            tbody.innerHTML = "";
            (data.users || []).forEach(u => {
                const tr = document.createElement("tr");
                tr.className = "hover:bg-slate-900/60 transition";
                tr.innerHTML = `
                    <td class="p-3">
                        <span class="font-bold text-white block">${escapeHtml(u.full_name || u.email.split("@")[0])}</span>
                        <span class="text-[11px] text-slate-400">${escapeHtml(u.email)}</span>
                    </td>
                    <td class="p-3 font-mono font-bold text-cyan-400">${u.credits || 0}</td>
                    <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${u.role === 'admin' ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-slate-800 text-slate-300'}">${escapeHtml(u.role || 'user')}</span></td>
                    <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${u.is_active ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'}">${u.is_active ? 'Ativo' : 'Pendente'}</span></td>
                    <td class="p-3 text-right space-x-1">
                        <button type="button" class="btn-act px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200">${u.is_active ? 'Desativar' : 'Aprovar'}</button>
                        <button type="button" class="btn-crd px-2 py-1 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-[10px] text-cyan-300">+ Créditos</button>
                    </td>
                `;

                tr.querySelector(".btn-act").onclick = async () => {
                    await fetch("/api/admin/update-user", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ admin_email: currentUser.email, target_email: u.email, is_active: !u.is_active })
                    });
                    loadAdminUsers();
                };

                tr.querySelector(".btn-crd").onclick = async () => {
                    const amount = prompt(`Créditos para somar a ${u.email}:`, "20");
                    if (amount && !isNaN(parseInt(amount))) {
                        await fetch("/api/admin/update-user", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ admin_email: currentUser.email, target_email: u.email, credits: (u.credits || 0) + parseInt(amount) })
                        });
                        loadAdminUsers();
                    }
                };

                tbody.appendChild(tr);
            });
        } catch (e) {
            tbody.innerHTML = "<tr><td colspan='5' class='p-3 text-rose-400'>Erro ao listar usuários.</td></tr>";
        }
    }

    document.getElementById("btnAdminSubmitUser")?.addEventListener("click", async () => {
        const name = document.getElementById("adminNewName").value.trim();
        const email = document.getElementById("adminNewEmail").value.trim().toLowerCase();
        const credits = parseInt(document.getElementById("adminNewCredits").value) || 20;
        const role = document.getElementById("adminNewRole").value;
        if (!email) return alert("Informe o e-mail.");
        await fetch("/api/admin/create-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ admin_email: currentUser.email, email, full_name: name, credits, role })
        });
        alert(`Usuário cadastrado com ${credits} créditos!`);
        document.getElementById("tabAdminUsers").click();
    });

    document.getElementById("tabAdminUsers")?.addEventListener("click", () => {
        document.getElementById("adminUsersSection").classList.remove("hidden");
        document.getElementById("adminCreateSection").classList.add("hidden");
        document.getElementById("tabAdminUsers").className = "flex-1 py-2 rounded-lg bg-purple-600 text-white transition";
        document.getElementById("tabAdminCreate").className = "flex-1 py-2 rounded-lg text-slate-400 hover:text-white transition";
        loadAdminUsers();
    });

    document.getElementById("tabAdminCreate")?.addEventListener("click", () => {
        document.getElementById("adminCreateSection").classList.remove("hidden");
        document.getElementById("adminUsersSection").classList.add("hidden");
        document.getElementById("tabAdminCreate").className = "flex-1 py-2 rounded-lg bg-purple-600 text-white transition";
        document.getElementById("tabAdminUsers").className = "flex-1 py-2 rounded-lg text-slate-400 hover:text-white transition";
    });

    // Geração de Usuário Teste (Trial 20 min) pelo Administrador
    document.getElementById("btnAdminGenerateTrial")?.addEventListener("click", async () => {
        try {
            const resp = await fetch("/api/admin/generate-trial", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ admin_email: currentUser.email })
            });
            const data = await resp.json();
            if (data.status === "success") {
                const cardEl = document.getElementById("trialCardText");
                if (cardEl) cardEl.textContent = data.card_text;
                if (trialCardModal) trialCardModal.classList.remove("hidden");
            } else {
                alert("Erro ao gerar usuário de teste: " + (data.message || ""));
            }
        } catch (e) {
            alert("Erro de conexão ao gerar teste.");
        }
    });

    document.getElementById("btnCopyTrialCard")?.addEventListener("click", async () => {
        const text = document.getElementById("trialCardText")?.textContent;
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            const btnCopyText = document.getElementById("btnCopyTrialText");
            if (btnCopyText) {
                btnCopyText.textContent = "Cartão Copiado com Sucesso!";
                setTimeout(() => { btnCopyText.textContent = "Copiar Cartão Completo"; }, 2000);
            }
        } catch (e) {
            console.error(e);
        }
    });

    // Woovi Pix Payments Logic
    window.initiatePixCheckout = async function(planId, price, planName) {
        if (!currentUser) return openAuthModal("login");
        plansModal.classList.add("hidden");
        pixModal.classList.remove("hidden");

        const pName = planName || `Plano ${planId}`;
        document.getElementById("pixModalPackageName").textContent = pName;
        document.getElementById("pixModalAmount").textContent = `R$ ${price.toFixed(2).replace(".", ",")}`;
        document.getElementById("pixQrCodeImg").src = "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=Carregando";
        document.getElementById("pixCopiaColaText").value = "Gerando cobrança Pix segura via Woovi...";

        try {
            const resp = await fetch("/api/pix/create-charge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_email: currentUser.email, plan_id: planId, custom_amount: price })
            });
            const data = await resp.json();
            if (data.status === "success") {
                const tx = data.transaction;
                document.getElementById("pixQrCodeImg").src = tx.qr_code_url;
                document.getElementById("pixCopiaColaText").value = tx.pix_code;

                if (activePixInterval) clearInterval(activePixInterval);
                activePixInterval = setInterval(async () => {
                    const stResp = await fetch(`/api/pix/status/${tx.correlation_id}`);
                    const stData = await stResp.json();
                    if (stData.status === "success" && stData.transaction.status === "completed") {
                        clearInterval(activePixInterval);
                        await refreshUserProfile();
                        alert(`Pagamento Pix Confirmado com Sucesso! Seu plano '${pName}' foi ativado.`);
                        pixModal.classList.add("hidden");
                    }
                }, 3500);

                document.getElementById("btnSimulatePixPayment").onclick = async () => {
                    const simResp = await fetch(`/api/pix/confirm-mock/${tx.correlation_id}`, { method: "POST" });
                    const simData = await simResp.json();
                    if (simData.status === "success") {
                        if (activePixInterval) clearInterval(activePixInterval);
                        if (simData.profile) {
                            currentUser = simData.profile;
                            saveCurrentUser(currentUser);
                        }
                        alert(`Pagamento Pix Confirmado! Plano '${pName}' ativado com sucesso.`);
                        pixModal.classList.add("hidden");
                    }
                };

                document.getElementById("btnCheckPixStatus").onclick = async () => {
                    const stResp = await fetch(`/api/pix/status/${tx.correlation_id}`);
                    const stData = await stResp.json();
                    if (stData.status === "success" && stData.transaction.status === "completed") {
                        if (activePixInterval) clearInterval(activePixInterval);
                        await refreshUserProfile();
                        pixModal.classList.add("hidden");
                        alert("Pagamento verificado com sucesso!");
                    } else {
                        alert("Aguardando confirmação do banco... Se já pagou, a vigência será liberada em instantes.");
                    }
                };
            }
        } catch (e) {
            alert("Erro ao gerar Pix. Tente novamente.");
        }
    };

    async function refreshUserProfile() {
        if (!currentUser || !currentUser.email) return;
        try {
            const resp = await fetch("/api/auth/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: currentUser.email })
            });
            const data = await resp.json();
            if (data.status === "success" && data.profile) {
                saveCurrentUser(data.profile);
            }
        } catch (e) {}
    }

    document.getElementById("btnCopyPix")?.addEventListener("click", async () => {
        const code = document.getElementById("pixCopiaColaText").value;
        if (!code) return;
        try {
            await navigator.clipboard.writeText(code);
            const btnText = document.getElementById("btnCopyPixText");
            btnText.textContent = "Código Pix Copiado!";
            setTimeout(() => { btnText.textContent = "Copiar Código Pix"; }, 2000);
        } catch (e) {
            console.error(e);
        }
    });

    const queryHints = {
        cpf: { p: "Ex: 000.000.000-00", h: "Digite os 11 dígitos do CPF" },
        nome: { p: "Ex: CARLOS ALBERTO DA SILVA", h: "Digite o nome completo sem abreviações" },
        telefone: { p: "Ex: 11987654321", h: "Digite o DDD + Número" },
        placa: { p: "Ex: ABC1D23 ou ABC1234", h: "Digite a placa Mercosul ou padrão antigo" }
    };

    function updateInputHint() {
        const item = queryHints[queryType.value] || queryHints.cpf;
        queryValue.placeholder = item.p;
        if (inputHint) inputHint.textContent = item.h;
    }
    queryType.addEventListener("change", updateInputHint);
    updateInputHint();

    queryValue.addEventListener("input", () => {
        if (queryValue.value.trim().length > 0) clearInputBtn.classList.remove("hidden");
        else clearInputBtn.classList.add("hidden");
    });
    clearInputBtn.addEventListener("click", () => {
        queryValue.value = "";
        clearInputBtn.classList.add("hidden");
        queryValue.focus();
    });

    function escapeHtml(str) {
        if (!str) return "";
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function stripMarkdown(text) {
        if (!text) return "";
        return text
            .replace(/\*\*(.*?)\*\*/g, "$1")
            .replace(/\*(.*?)\*/g, "$1")
            .replace(/__(.*?)__/g, "$1")
            .replace(/_(.*?)_/g, "$1")
            .replace(/`{1,3}(.*?)`{1,3}/g, "$1")
            .replace(/~~(.*?)~~/g, "$1")
            .replace(/[*_`~]/g, "")
            .trim();
    }

    const ICONS = {
        user: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
        family: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
        shield: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
        pin: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z",
        phone: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z",
        card: "M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2",
        car: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4",
        info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    };
    const getIcon = (k, c) => `<svg class="w-5 h-5 ${c}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${ICONS[k] || ICONS.info}"/></svg>`;

    const CATEGORIES = {
        cadastrais: { name: "Dados Cadastrais", badge: "bg-cyan-950 text-cyan-300 border-cyan-800", header: "border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 to-slate-900", icon: getIcon("user", "text-cyan-400"), keys: ["CPF", "CNPJ", "NOME", "RAZAO SOCIAL", "NASCIMENTO", "IDADE", "SEXO", "GENERO", "SIGNO", "ESTADO CIVIL", "NACIONALIDADE", "OBITO", "ESCOLARIDADE", "CADASTRAIS", "DADOS"] },
        filiacao: { name: "Filiação & Relações", badge: "bg-purple-950 text-purple-300 border-purple-800", header: "border-purple-500/30 bg-gradient-to-r from-purple-950/40 to-slate-900", icon: getIcon("family", "text-purple-400"), keys: ["MAE", "PAI", "FILIACAO", "CONJUGE", "ESPOSA", "ESPOSO", "DEPENDENTE", "PARENTES", "PAIS"] },
        situacao: { name: "Situação Cadastral & Fiscal", badge: "bg-emerald-950 text-emerald-300 border-emerald-800", header: "border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 to-slate-900", icon: getIcon("shield", "text-emerald-400"), keys: ["SITUACAO", "STATUS", "REGULARIDADE", "DIGITO VERIFICADOR", "PROTOCOLO", "DATA SITUACAO", "RECEITA", "CNAE"] },
        endereco: { name: "Endereço & Localização", badge: "bg-amber-950 text-amber-300 border-amber-800", header: "border-amber-500/30 bg-gradient-to-r from-amber-950/40 to-slate-900", icon: getIcon("pin", "text-amber-400"), keys: ["ENDERECO", "LOGRADOURO", "RUA", "AVENIDA", "NUMERO", "COMPLEMENTO", "BAIRRO", "CIDADE", "MUNICIPIO", "UF", "ESTADO", "CEP", "LOCALIZACAO"] },
        contatos: { name: "Contatos & Telefones", badge: "bg-sky-950 text-sky-300 border-sky-800", header: "border-sky-500/30 bg-gradient-to-r from-sky-950/40 to-slate-900", icon: getIcon("phone", "text-sky-400"), keys: ["TELEFONE", "CELULAR", "FIXO", "WHATSAPP", "EMAIL", "CONTATO", "CONTATOS"] },
        documentos: { name: "Documentos Oficiais", badge: "bg-indigo-950 text-indigo-300 border-indigo-800", header: "border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 to-slate-900", icon: getIcon("card", "text-indigo-400"), keys: ["RG", "EMISSOR", "TITULO", "ELEITOR", "ZONA", "SECAO", "PIS", "PASEP", "NIS", "CNS", "CNH", "DOCUMENTOS"] },
        veiculos: { name: "Veículos & Bens", badge: "bg-rose-950 text-rose-300 border-rose-800", header: "border-rose-500/30 bg-gradient-to-r from-rose-950/40 to-slate-900", icon: getIcon("car", "text-rose-400"), keys: ["VEICULO", "VEICULOS", "PLACA", "CHASSI", "RENAVAM", "MODELO", "MARCA", "ANO", "COR", "COMBUSTIVEL"] },
        geral: { name: "Informações Adicionais", badge: "bg-slate-900 text-slate-300 border-slate-700", header: "border-slate-700 bg-slate-900/60", icon: getIcon("info", "text-slate-400"), keys: [] }
    };

    function matchCategoryForKey(k) {
        for (const [ck, cd] of Object.entries(CATEGORIES)) {
            if (ck === "geral") continue;
            for (const kw of cd.keys) {
                if (k === kw || k.startsWith(kw + " ") || k.endsWith(" " + kw) || k.includes(kw)) return ck;
            }
        }
        return "geral";
    }

    function matchCategoryFromTitle(t) {
        if (t.includes("CADASTRAIS") || t.includes("PESSOAIS")) return "cadastrais";
        if (t.includes("FILIAÇÃO") || t.includes("FILIACAO") || t.includes("PAIS")) return "filiacao";
        if (t.includes("SITUAÇÃO") || t.includes("SITUACAO") || t.includes("FISCAL")) return "situacao";
        if (t.includes("ENDEREÇO") || t.includes("ENDERECO") || t.includes("LOCALIZAÇÃO")) return "endereco";
        if (t.includes("CONTATO") || t.includes("TELEFONE") || t.includes("EMAIL")) return "contatos";
        if (t.includes("DOCUMENTO") || t.includes("RG") || t.includes("TITULO")) return "documentos";
        if (t.includes("VEÍCULO") || t.includes("VEICULO") || t.includes("PLACA")) return "veiculos";
        return null;
    }

    function parseTelegramReport(rawText) {
        if (!rawText) return [];
        const unwanted = [/by:\s*@?[\w\d_]+/i, /user:\s*\d+/i, /@voidsearch/i, /voidsearch/i, /modulo\s*cpf/i, /^\s*👤\s*user/i, /^\s*🤖\s*by/i, /consulta\s+realizada/i];
        const lines = rawText.split("\n");
        const cleanLines = [];
        for (let l of lines) {
            const tr = l.trim();
            if (!tr || unwanted.some(rx => rx.test(tr)) || /^[\s\-_=─━*•#~═]+$/.test(tr)) continue;
            cleanLines.push(tr);
        }

        const dict = {};
        Object.keys(CATEGORIES).forEach(k => { dict[k] = { id: k, def: CATEGORIES[k], fields: [] }; });
        let activeCat = "cadastrais";

        for (let line of cleanLines) {
            const stripped = stripMarkdown(line);
            if (!stripped) continue;
            const colonIdx = stripped.indexOf(":");
            const headerCat = matchCategoryFromTitle(stripped.toUpperCase());
            if (headerCat && (colonIdx === -1 || colonIdx > 35)) {
                activeCat = headerCat;
                continue;
            }

            if (colonIdx > 0 && colonIdx < 55) {
                let k = stripped.substring(0, colonIdx).replace(/^[•\->👉⚡️📍📞👨‍👩‍👧📋🚗💳🏢👤\s]+/, "").trim();
                let v = stripped.substring(colonIdx + 1).trim();
                if (k && v) {
                    const matchedCat = matchCategoryForKey(k.toUpperCase());
                    const target = matchedCat !== "geral" ? matchedCat : activeCat;
                    dict[target].fields.push({ key: k, value: v });
                }
            } else {
                const note = stripped.replace(/^[•\->👉\s]+/, "").trim();
                if (note && note.length > 2) {
                    dict[activeCat].fields.push({ key: "Informação", value: note });
                }
            }
        }
        return Object.values(dict).filter(c => c.fields.length > 0);
    }

    async function copyToClipboard(text, btn) {
        try {
            await navigator.clipboard.writeText(text);
            const txt = btn.querySelector(".copy-txt");
            const icon = btn.querySelector(".copy-ico");
            btn.classList.add("bg-emerald-950", "text-emerald-300", "border-emerald-600");
            btn.classList.remove("bg-slate-800", "text-slate-300", "border-slate-700");
            if (txt) txt.textContent = "Copiado!";
            if (icon) icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>';
            setTimeout(() => {
                btn.classList.remove("bg-emerald-950", "text-emerald-300", "border-emerald-600");
                btn.classList.add("bg-slate-800", "text-slate-300", "border-slate-700");
                if (txt) txt.textContent = "Copiar";
                if (icon) icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>';
            }, 2000);
        } catch (e) {
            console.error("Falha ao copiar:", e);
        }
    }

    function renderCategoryCards(categories, baseName) {
        cardsContainer.innerHTML = "";
        fallbackCard.classList.add("hidden");
        errorCard.classList.add("hidden");
        resultContainer.classList.remove("hidden");

        resultBaseBadge.textContent = `MÓDULO: ${baseName.toUpperCase()}`;
        let total = 0;
        categories.forEach(c => total += c.fields.length);
        resultFieldsCount.textContent = `${total} registro(s) estruturado(s)`;

        if (printMetaInfo) {
            printMetaInfo.textContent = `Consulta: ${queryType.value.toUpperCase()} - ${queryValue.value} | Base: ${baseName.toUpperCase()} | Data: ${new Date().toLocaleString("pt-BR")}`;
        }

        if (categories.length === 0) {
            cardsContainer.innerHTML = "<div class='bg-cardbg rounded-2xl border border-cardborder p-8 text-center text-slate-400 text-sm'>Nenhum dado cadastral localizado no retorno da base.</div>";
            return;
        }

        categories.forEach(cat => {
            const card = document.createElement("div");
            card.className = "category-card bg-cardbg rounded-2xl border border-cardborder shadow-xl overflow-hidden";
            
            const header = document.createElement("div");
            header.className = `p-4 sm:p-5 border-b flex items-center justify-between ${cat.def.header}`;
            header.innerHTML = `
                <div class="flex items-center space-x-3">
                    <div class="p-2 bg-slate-900/80 rounded-xl border border-slate-700/60">${cat.def.icon}</div>
                    <h3 class="text-sm sm:text-base font-bold text-white tracking-wide">${escapeHtml(cat.def.name)}</h3>
                </div>
                <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md border ${cat.def.badge}">${cat.fields.length} campos</span>
            `;
            card.appendChild(header);

            const grid = document.createElement("div");
            grid.className = "p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5";

            cat.fields.forEach(f => {
                const row = document.createElement("div");
                row.className = "field-row group bg-slate-900/80 hover:bg-slate-900 rounded-xl p-3 sm:p-3.5 border border-slate-800 hover:border-slate-700 transition flex items-start justify-between gap-2";
                row.innerHTML = `
                    <div class="min-w-0 flex-1">
                        <span class="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5 truncate">${escapeHtml(f.key)}</span>
                        <span class="block text-xs sm:text-sm font-medium text-slate-100 break-words leading-relaxed">${escapeHtml(f.value)}</span>
                    </div>
                    <button type="button" class="copy-btn flex-shrink-0 inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition shadow-sm">
                        <svg class="w-3.5 h-3.5 copy-ico text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                        <span class="copy-txt">Copiar</span>
                    </button>
                `;
                const btn = row.querySelector(".copy-btn");
                btn.addEventListener("click", () => copyToClipboard(f.value, btn));
                grid.appendChild(row);
            });

            card.appendChild(grid);
            cardsContainer.appendChild(card);
        });
    }

    // Fallback Interativo e Seleção Dinâmica de Bases (Sem 'COMPLETO')
    window.renderModuleUnavailable = function(requestedBase, availableModules, queryTypeVal, queryValueVal) {
        resultContainer.classList.add("hidden");
        errorCard.classList.add("hidden");
        fallbackCard.classList.remove("hidden");

        fallbackRequestedBase.textContent = requestedBase || "BASE SELECIONADA";
        fallbackModulesGrid.innerHTML = "";

        const cleanMods = (availableModules && availableModules.length > 0)
            ? availableModules.filter(m => !m.toUpperCase().includes("COMPLETO"))
            : ["SIMPLES", "SYNC", "RECEITA", "CREDLINK", "SI-PNI", "BIOMETRIA"];

        cleanMods.forEach(mod => {
            const cleanMod = mod.trim().toUpperCase();
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "group flex items-center justify-between p-3.5 rounded-xl bg-slate-900/90 hover:bg-cyan-950/40 border border-slate-700/80 hover:border-cyan-500/60 text-slate-200 hover:text-white transition shadow-md text-left cursor-pointer";
            btn.innerHTML = `
                <div class="flex items-center space-x-2">
                    <span class="w-2 h-2 rounded-full bg-cyan-400 group-hover:animate-ping"></span>
                    <span class="text-xs sm:text-sm font-bold tracking-wide">${escapeHtml(cleanMod)}</span>
                </div>
                <svg class="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            `;
            btn.addEventListener("click", () => selectAndRunModule(cleanMod, queryTypeVal, queryValueVal));
            fallbackModulesGrid.appendChild(btn);
        });
        fallbackCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    function selectAndRunModule(moduleName, queryTypeVal, queryValueVal) {
        if (moduleName.toUpperCase().includes("COMPLETO")) return;
        let exists = false;
        for (let i = 0; i < targetBase.options.length; i++) {
            if (targetBase.options[i].value.toUpperCase() === moduleName.toUpperCase()) {
                targetBase.selectedIndex = i;
                exists = true;
                break;
            }
        }
        if (!exists) {
            targetBase.add(new Option(moduleName.toUpperCase(), moduleName.toUpperCase(), true, true));
        }
        if (queryTypeVal) queryType.value = queryTypeVal;
        if (queryValueVal) queryValue.value = queryValueVal;

        fallbackCard.classList.add("hidden");
        searchForm.dispatchEvent(new Event("submit"));
    }

    if (copyAllBtn) {
        copyAllBtn.addEventListener("click", async () => {
            if (!currentParsedData) return;
            let report = `RELATÓRIO CORPORATIVO DE REGISTROS\n`;
            report += `Tipo: ${queryType.value.toUpperCase()} | Dado: ${queryValue.value}\n`;
            report += `Base: ${targetBase.value.toUpperCase()} | Data: ${new Date().toLocaleString("pt-BR")}\n`;
            report += `========================================\n\n`;
            currentParsedData.forEach(cat => {
                report += `[ ${cat.def.name.toUpperCase()} ]\n`;
                cat.fields.forEach(f => { report += `${f.key}: ${f.value}\n`; });
                report += `\n`;
            });
            try {
                await navigator.clipboard.writeText(report.trim());
                copyAllBtn.classList.add("bg-emerald-950", "text-emerald-300", "border-emerald-600");
                copyAllBtn.classList.remove("bg-slate-900", "text-slate-300", "border-slate-700");
                copyAllText.textContent = "Copiado!";
                copyAllIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>';
                setTimeout(() => {
                    copyAllBtn.classList.remove("bg-emerald-950", "text-emerald-300", "border-emerald-600");
                    copyAllBtn.classList.add("bg-slate-900", "text-slate-300", "border-slate-700");
                    copyAllText.textContent = "Copiar Tudo";
                    copyAllIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>';
                }, 2000);
            } catch (e) {
                console.error("Erro ao copiar tudo:", e);
            }
        });
    }

    if (toggleViewBtn) {
        toggleViewBtn.addEventListener("click", () => {
            isPlainTextView = !isPlainTextView;
            if (isPlainTextView) {
                cardsContainer.classList.add("hidden");
                plainTextContainer.classList.remove("hidden");
                toggleViewText.textContent = "Ver em Cards";
            } else {
                plainTextContainer.classList.add("hidden");
                cardsContainer.classList.remove("hidden");
                toggleViewText.textContent = "Ver Texto Limpo";
            }
        });
    }

    function startTrialCooldown(seconds) {
        if (trialCooldownInterval) clearInterval(trialCooldownInterval);
        let rem = seconds;
        const cooldownDiv = document.getElementById("trialCooldownTimer");
        if (cooldownDiv) cooldownDiv.classList.remove("hidden");
        submitBtn.disabled = true;

        function updateCool() {
            if (rem <= 0) {
                clearInterval(trialCooldownInterval);
                submitBtn.disabled = false;
                submitText.textContent = "Executar Consulta";
                if (cooldownDiv) cooldownDiv.classList.add("hidden");
            } else {
                submitText.textContent = `Aguarde ${rem}s...`;
                if (cooldownDiv) cooldownDiv.textContent = `⏳ Próxima consulta liberada em ${rem}s`;
                rem--;
            }
        }
        updateCool();
        trialCooldownInterval = setInterval(updateCool, 1000);
    }

    searchForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const qType = queryType.value;
        const tBase = targetBase.value;
        const qVal = queryValue.value.trim();

        if (!qVal) return;

        if (tBase.toUpperCase().includes("COMPLETO")) {
            alert("A base 'COMPLETO' foi descontinuada. Por favor selecione outra base.");
            return;
        }

        if (!currentUser) {
            openAuthModal("login");
            return;
        }

        const isAdmin = currentUser && (currentUser.role === "admin" || currentUser.email === "admin@corporativo.com");
        if (!isAdmin) {
            const now = Math.floor(Date.now() / 1000);
            if (currentUser.access_expires_at && now > currentUser.access_expires_at) {
                alert("Seu tempo de acesso expirou. Renove seu plano via Pix para continuar consultando sem limites.");
                startAccessCountdown();
                plansModal.classList.remove("hidden");
                return;
            }
        }

        loading.classList.remove("hidden");
        resultContainer.classList.add("hidden");
        fallbackCard.classList.add("hidden");
        errorCard.classList.add("hidden");
        submitBtn.disabled = true;
        submitText.textContent = "Consultando...";
        submitIcon.classList.add("animate-spin");

        try {
            const resp = await fetch("/api/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query_type: qType,
                    query_value: qVal,
                    target_base: tBase,
                    user_email: currentUser ? currentUser.email : "admin@corporativo.com"
                })
            });
            const data = await resp.json();

            loading.classList.add("hidden");
            submitBtn.disabled = false;
            submitText.textContent = "Executar Consulta";
            submitIcon.classList.remove("animate-spin");

            if (data.status === "time_expired" || data.status === "expired") {
                alert(data.message || "Seu tempo de acesso expirou. Renove seu plano via Pix.");
                startAccessCountdown();
                plansModal.classList.remove("hidden");
                return;
            }

            if (data.status === "trial_cooldown") {
                alert(data.message || `Modo Teste: Aguarde ${data.wait_seconds || 60}s antes da próxima consulta.`);
                startTrialCooldown(data.wait_seconds || 60);
                return;
            }

            if (data.status === "trial_limit_reached") {
                alert("Você atingiu o limite de 20 consultas do período de demonstração. Assine um plano para continuar.");
                plansModal.classList.remove("hidden");
                return;
            }

            if (data.status === "modules_prompt" || data.status === "module_unavailable") {
                window.renderModuleUnavailable(
                    data.requested_base || tBase,
                    data.available_modules || [],
                    data.query_type || qType,
                    data.query_value || qVal
                );
                return;
            }

            if (data.status === "invalid_format" || data.status === "error") {
                errorCard.classList.remove("hidden");
                errorMessage.textContent = stripMarkdown(data.message || data.result || "Erro ao processar consulta.");
                errorCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
                return;
            }

            if (data.status === "success") {
                const raw = data.result || "";

                if (raw.toUpperCase().includes("MÓDULO INDISPONÍVEL") || raw.toUpperCase().includes("BASE NÃO ENCONTRADA")) {
                    window.renderModuleUnavailable(tBase, data.available_modules || [], qType, qVal);
                    return;
                }

                if (currentUser && currentUser.is_trial) {
                    currentUser.trial_queries_count = (currentUser.trial_queries_count || 0) + 1;
                    saveCurrentUser(currentUser);
                    startTrialCooldown(60);
                }

                if (data.access_info && currentUser) {
                    startAccessCountdown();
                }

                plainTextOutput.textContent = stripMarkdown(raw);
                const categories = parseTelegramReport(raw);
                currentParsedData = categories;

                renderCategoryCards(categories, data.base || tBase);
                resultContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
            } else {
                errorCard.classList.remove("hidden");
                errorMessage.textContent = stripMarkdown(data.message || "Resposta inesperada.");
            }
        } catch (err) {
            loading.classList.add("hidden");
            submitBtn.disabled = false;
            submitText.textContent = "Executar Consulta";
            submitIcon.classList.remove("animate-spin");
            errorCard.classList.remove("hidden");
            errorMessage.textContent = "Falha de comunicação com o servidor backend. Verifique a conexão e tente novamente.";
        }
    });
});
