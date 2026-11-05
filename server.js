
const express = require("express");
const mysql = require("mysql2");
const caminho = require("path");
const bcrypt = require("bcryptjs");

const app = express();
const porta = 3000;

app.use(express.json());
app.use(express.static(__dirname));

const conexao = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "gestaoestoque"
});

const db = conexao.promise();

conexao.connect(function(erro) {
    if (erro) {
        console.log("Erro ao conectar ao MySQL:", erro.message);
        return;
    }

    console.log("Conectado ao banco gestaoestoque!");
});

// ABRIR LOGIN
app.get("/", function(req, res) {
    res.sendFile(caminho.join(__dirname, "html", "index.html"));
});

// REALIZAR LOGIN
app.post("/login", async function(req, res) {
    try {
        const { nome, senha } = req.body;

        if (!nome || !senha) {
            return res.status(400).json({
                mensagem: "Preencha o nome e a senha."
            });
        }

        const [dados] = await db.query(
            "SELECT * FROM cadastro WHERE nome = ?",
            [nome]
        );

        if (dados.length === 0) {
            return res.status(401).json({
                mensagem: "Nome ou senha incorretos."
            });
        }

        const usuario = dados[0];

        const senhaCorreta = await bcrypt.compare(
            senha,
            usuario.senha
        );

        if (!senhaCorreta) {
            return res.status(401).json({
                mensagem: "Nome ou senha incorretos."
            });
        }

        res.json({
            mensagem: "Login realizado!",
            gerente: Boolean(usuario.gerente)
        });

    } catch (erro) {
        console.error(erro);

        res.status(500).json({
            mensagem: "Erro ao realizar login."
        });
    }
});

// INICIAR SERVIDOR
app.listen(porta, function() {
    console.log("SuperMarket: http://localhost:" + porta);
});
