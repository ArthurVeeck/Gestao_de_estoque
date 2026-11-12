
// ======================================
// SUPERMARKET - ALTERNAR TEMA
// ======================================

// Recupera o tema salvo ou utiliza o escuro
let temaAtual = localStorage.getItem("temaSuperMarket") || "escuro";

// Aplica o tema na página
function aplicarTema() {

    document.documentElement.setAttribute("data-tema", temaAtual);

    // Atualiza o esquema de cores dos elementos nativos
    document.documentElement.style.colorScheme = temaAtual;

    // Atualiza o texto do botão
    const botaoTema = document.getElementById("alternarTema");

    if (botaoTema) {

        if (temaAtual === "escuro") {
            botaoTema.textContent = "☀️ Modo claro";
        } else {
            botaoTema.textContent = "🌙 Modo escuro";
        }

    }

}

// Alterna entre claro e escuro
function alternarTema() {

    temaAtual = temaAtual === "escuro" ? "claro" : "escuro";

    localStorage.setItem("temaSuperMarket", temaAtual);

    aplicarTema();

}

// Inicializa o tema
aplicarTema();

// Configura o botão
const botaoTema = document.getElementById("alternarTema");

if (botaoTema) {
    botaoTema.addEventListener("click", alternarTema);
}
