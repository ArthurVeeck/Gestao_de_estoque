const formLogin = document.getElementById("formLogin");

formLogin.addEventListener("submit", async function(event) {

    event.preventDefault();

    const nome = document.getElementById("nome").value.trim();
    const senha = document.getElementById("senha").value;
    const mensagem = document.getElementById("mensagem");

    mensagem.textContent = "";

    try {

        const resposta = await fetch("/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                nome: nome,
                senha: senha
            })
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            mensagem.textContent = dados.mensagem;
            return;
        }

        // Guarda o usuário para o gerente.js / funcionario.js
        localStorage.setItem("usuarioLogado", JSON.stringify(dados));

        if (dados.gerente) {
            window.location.href = "/html/gerente.html";
        } else {
            window.location.href = "/html/funcionario.html";
        }

    } catch (erro) {

        mensagem.textContent = "Erro ao conectar com o servidor.";

        console.log(erro);

    }

});