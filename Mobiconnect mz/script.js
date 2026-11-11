
/* ==================================
   CONFIGURAÇÃO DO SUPABASE
================================== */

// MobiConnect Mz

const SUPABASE_URL = "https://wbtzcckdebkpweshkykq.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_g3T9Z6_-yoHh3tWfBvL_dg_AtXuZmIQ";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

let currentUser = null;
let currentProfile = null;
let chart = null;
let isSignup = false;

const $ = id => document.getElementById(id);

function money(value) {
    return Number(value || 0).toLocaleString("pt-MZ") + " MT";
}

function showMessage(id, message, type = "error") {
    const element = $(id);
    element.textContent = message;
    element.style.color = type === "success" ? "green" : "red";
}


/* ==================================
   LOGIN E REGISTO
================================== */

function setAuthMode(signup) {
    isSignup = signup;


    $("nameLabel").classList.toggle("hidden", !signup);
    $("fullName").required = signup;

    $("authSubmit").textContent = signup
        ? "Criar conta"
        : "Entrar";

    $("switchText").textContent = signup
        ? "Já tem uma conta?"
        : "Ainda não tem conta?";

    $("switchAuth").textContent = signup
        ? "Entrar"
        : "Criar conta";
}

$("switchAuth").addEventListener("click", () => {
    setAuthMode(!isSignup);
});

$("authForm").addEventListener("submit", async event => {

    event.preventDefault();

    const email = $("email").value.trim();
    const password = $("password").value;
    const fullName = $("fullName").value.trim();

    try {

        if (isSignup) {

            const { data, error } = await db.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName
                    }
                }
            });

            if (error) throw error;

            if (data.session) {
                await loadApp(data.user);
            } else {
                showMessage(
                    "authMessage",
                    "Conta criada. Confirme o email para entrar.",
                    "success"
                );
            }

        } else {

            const { data, error } =
                await db.auth.signInWithPassword({
                    email,
                    password
                });

            if (error) throw error;

            await loadApp(data.user);
        }

    } catch (error) {

        showMessage("authMessage", error.message);

    }

});


/* ==================================
   CARREGAR A APLICAÇÃO
================================== */

async function loadApp(user) {

    currentUser = user;

    const { data, error } = await db
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    if (error) throw error;

    currentProfile = data;

    $("authScreen").classList.add("hidden");
    $("app").classList.remove("hidden");

    const name = data.full_name || user.email;

    $("sideName").textContent = name;
    $("sideEmail").textContent = user.email;
    $("topName").textContent = name;
    $("welcomeName").textContent = name;

    $("adminNav").classList.toggle(
        "hidden",
        data.role !== "admin"
    );

    await refreshProfile();
    await loadPackages();
    await loadHistory();

    if (data.role === "admin") {
        await loadAdmin();
    }

    showPage("overview");
}


/* ==================================
   NAVEGAÇÃO
================================== */

function showPage(page) {

    document.querySelectorAll(".page").forEach(element => {
        element.classList.remove("active");
    });

    document.querySelectorAll(".nav-link").forEach(element => {
        element.classList.toggle(
            "active",
            element.dataset.page === page
        );
    });

    $("page-" + page).classList.add("active");

    const titles = {
        overview: "Visão geral",
        packages: "Pacotes de Internet",
        recharge: "recarga",
        history: "Transacções",
        admin: "Administração"
    };

    $("pageTitle").textContent = titles[page];
}

document.querySelectorAll(".nav-link").forEach(button => {
    button.addEventListener("click", () => {
        showPage(button.dataset.page);
    });
});

document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => {
        showPage(button.dataset.go);
    });
});


/* ==================================
   SALDO
================================== */

async function refreshProfile() {

    const { data, error } = await db
        .from("profiles")
        .select("balance")
        .eq("id", currentUser.id)
        .single();

    if (error) throw error;

    $("balanceValue").textContent = money(data.balance);
    $("formBalance").textContent =
        "Saldo disponível: " + money(data.balance);

}


/* ==================================
   PACOTES DE INTERNET
================================== */

let currentOperatorFilter = "Todas";

async function loadPackages() {

    const { data, error } = await db
        .from("packages")
        .select("*")
        .eq("active", true)
        .order("price");

    if (error) throw error;

    const packages = currentOperatorFilter === "Todas"
        ? data
        : data.filter(p => p.operator === currentOperatorFilter);

    const grid = $("packageGrid");

    grid.innerHTML = "";

    packages.forEach(p => {

        const card = document.createElement("div");
        card.className = "package-card";

        const chip = document.createElement("span");
        chip.className = "operator-chip";
        chip.textContent = p.operator;

        const title = document.createElement("h3");
        title.textContent = p.data_label;

        const description = document.createElement("p");
        description.textContent = p.description || "Pacote demonstrativo";

        const price = document.createElement("div");
        price.className = "package-price";
        price.textContent = money(p.price);

        const validity = document.createElement("small");
        validity.textContent = "Validade: " + p.validity;

        card.append(chip, title, description, price, validity);

        grid.appendChild(card);

    });

}

$("operatorTabs").addEventListener("click", event => {

    const button = event.target.closest("[data-operator]");

    if (!button) return;

    currentOperatorFilter = button.dataset.operator;

    document.querySelectorAll(".operator-tabs button").forEach(btn => {
        btn.classList.toggle("selected", btn === button);
    });

    loadPackages().catch(console.error);

});


/* ==================================
   SIMULAR RECARGA
================================== */

$("rechargeForm").addEventListener("submit", async event => {

    event.preventDefault();

    const operator = $("operatorSelect").value;
    const phone = $("phone").value.replace(/\s/g, "");
    const amount = Number($("amount").value);

    if (!/^8[0-9]{8}$/.test(phone)) {
        return showMessage(
            "rechargeMessage",
            "Introduza um número válido de 9 dígitos começado por 8."
        );
    }

    if (!Number.isInteger(amount) || amount <= 0) {
        return showMessage(
            "rechargeMessage",
            "Introduza um valor inteiro superior a zero."
        );
    }

    try {

        const { error } = await db.rpc("simulate_topup", {
            p_operator: operator,
            p_phone: phone,
            p_amount: amount
        });

        if (error) throw error;

        showMessage(
            "rechargeMessage",
            "Recarga simulada com sucesso!",
            "success"
        );

        $("rechargeForm").reset();

        await refreshProfile();
        await loadHistory();

    } catch (error) {

        showMessage("rechargeMessage", error.message);

    }

});


/* ==================================
   HISTÓRICO
================================== */

async function loadHistory() {

    const { data, error } = await db
        .from("transactions")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });

    if (error) throw error;

    const body = $("historyBody");

    body.innerHTML = "";

    data.forEach(tx => {

        const row = document.createElement("tr");

        const values = [
            new Date(tx.created_at).toLocaleString("pt-PT"),
            tx.operator,
            tx.phone,
            money(tx.amount)
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        const statusCell = document.createElement("td");
        const status = document.createElement("span");

        status.className = "pill";
        status.textContent = tx.status;

        statusCell.appendChild(status);
        row.appendChild(statusCell);

        body.appendChild(row);

    });

    $("transactionCount").textContent = data.length;

    const total = data.reduce(
        (sum, tx) => sum + Number(tx.amount),
        0
    );

    $("spentValue").textContent = money(total);

    drawChart(data);

}


/* ==================================
   GRÁFICOS
================================== */

function drawChart(data) {

    const totals = {
        Vodacom: 0,
        Movitel: 0,
        Tmcel: 0
    };

    data.forEach(tx => {
        if (totals[tx.operator] !== undefined) {
            totals[tx.operator] += Number(tx.amount);
        }
    });

    if (chart) {
        chart.destroy();
    }

    chart = new Chart($("usageChart"), {

        type: "doughnut",

        data: {
            labels: Object.keys(totals),

            datasets: [{
                data: Object.values(totals),
                backgroundColor: [
                    "#12a6a0",
                    "#174d75",
                    "#e6a23c"
                ],
                borderWidth: 0
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false
        }

    });

}


/* ==================================
   PAINEL ADMINISTRATIVO
================================== */

async function loadAdmin() {

    if (currentProfile.role !== "admin") return;

    const { count, error: userError } = await db
        .from("profiles")
        .select("*", { count: "exact", head: true });

    if (userError) throw userError;

    const { data, error } = await db
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

    if (error) throw error;

    $("adminUsers").textContent = count || 0;

    $("adminTransactions").textContent = data.length;

    const total = data.reduce(
        (sum, tx) => sum + Number(tx.amount),
        0
    );

    $("adminVolume").textContent = money(total);

    const body = $("adminHistoryBody");

    body.innerHTML = "";

    data.forEach(tx => {

        const row = document.createElement("tr");

        const values = [
            new Date(tx.created_at).toLocaleString("pt-PT"),
            tx.user_id.slice(0, 8),
            tx.operator,
            tx.phone,
            money(tx.amount)
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        body.appendChild(row);

    });

}


/* ==================================
   ACTUALIZAÇÃO
================================== */

$("refreshHistory").addEventListener("click", () => {
    loadHistory().catch(console.error);
});

$("refreshAdmin").addEventListener("click", () => {
    loadAdmin().catch(console.error);
});


/* ==================================
   TERMINAR SESSÃO
================================== */

$("logoutBtn").addEventListener("click", async () => {

    await db.auth.signOut();

    currentUser = null;

    $("app").classList.add("hidden");
    $("authScreen").classList.remove("hidden");

});


/* ==================================
   INICIALIZAÇÃO
================================== */

async function startApp() {

    const { data: { session } } = await db.auth.getSession();

    if (session) {
        try {
            await loadApp(session.user);
        } catch (error) {
            console.error(error);
        }
    }

    db.auth.onAuthStateChange(async (event, session) => {

        if (session && !currentUser) {
            try {
                await loadApp(session.user);
            } catch (error) {
                console.error(error);
            }
        }

    });

}

startApp();

