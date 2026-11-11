const express = require("express");
const mysql = require("mysql2");
const caminho = require("path");
const bcrypt = require("bcryptjs");

const app = express();
const porta = 3000;

app.use(express.json());
// Pastas públicas do site
app.use("/assets", express.static(caminho.join(__dirname, "assets")));
app.use("/css", express.static(caminho.join(__dirname, "css")));
app.use("/script", express.static(caminho.join(__dirname, "script")));
app.use("/html", express.static(caminho.join(__dirname, "html")));

// ======================================
// BANCO DE DADOS
// ======================================

const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "gestaoestoque",
    waitForConnections: true,
    connectionLimit: 10
});

const db = pool.promise();

pool.getConnection(function(erro, conexao) {
    if (erro) {
        console.log("Erro ao conectar ao MySQL:", erro.message);
        return;
    }

    console.log("Conectado ao banco gestaoestoque!");
    conexao.release();
});

// Cria as tabelas de estoque e histórico caso ainda não existam
async function garantirTabelas() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS estoque (
                id_estoque INT AUTO_INCREMENT PRIMARY KEY,
                id_produto INT NOT NULL UNIQUE,
                nome_item VARCHAR(200),
                quantidade DECIMAL(10,3) NOT NULL DEFAULT 0,
                FOREIGN KEY (id_produto)
                    REFERENCES produto(id_produto)
                    ON UPDATE CASCADE
                    ON DELETE CASCADE
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS historico_estoque (
                id_historico INT AUTO_INCREMENT PRIMARY KEY,
                id_produto INT NULL,
                nome_produto VARCHAR(200) NOT NULL,
                acao VARCHAR(100) NOT NULL,
                id_fornecedor INT,
                id_cadastro INT NOT NULL,
                quantidade DECIMAL(10,3) NOT NULL,
                preco_unitario DECIMAL(10,2) NOT NULL,
                valor_total DECIMAL(12,2) NOT NULL,
                data_entrada DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (id_produto)
                    REFERENCES produto(id_produto)
                    ON UPDATE CASCADE
                    ON DELETE SET NULL,
                FOREIGN KEY (id_fornecedor)
                    REFERENCES fornecedor(id_fornecedor)
                    ON DELETE SET NULL,
                FOREIGN KEY (id_cadastro)
                    REFERENCES cadastro(id_cadastro)
            )
        `);

        console.log("Tabelas de estoque e histórico verificadas.");

    } catch (erro) {
        console.log("Erro ao verificar tabelas:", erro.message);
    }
}

garantirTabelas();


// ======================================
// FUNÇÕES AUXILIARES
// ======================================

// Erro com status HTTP para usar dentro das rotas
function erroHttp(status, mensagem) {
    const erro = new Error(mensagem);
    erro.status = status;
    return erro;
}

// Responde ao cliente de acordo com o tipo de erro
function responderErro(res, erro, mensagemPadrao) {
    if (erro.status) {
        return res.status(erro.status).json({ mensagem: erro.message });
    }

    if (erro.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
            mensagem: "Já existe um registro com esses dados (nome, código ou CPF/CNPJ repetido)."
        });
    }

    if (erro.code === "ER_ROW_IS_REFERENCED_2") {
        return res.status(409).json({
            mensagem: "Não é possível excluir: existem registros (vendas, compras ou histórico) usando este item."
        });
    }

    console.error(erro);

    res.status(500).json({
        mensagem: mensagemPadrao + (erro.sqlMessage ? " (" + erro.sqlMessage + ")" : "")
    });
}

// Texto vazio vira null (importante para campos UNIQUE como codigo_barras)
function textoOuNull(valor) {
    const texto = String(valor ?? "").trim();
    return texto === "" ? null : texto;
}

// CPF/CNPJ: guarda só os números (a coluna cpf_cnpj tem 14 posições)
function somenteNumeros(valor) {
    const numeros = String(valor ?? "").replace(/\D/g, "");

    if (numeros.length > 14) {
        throw erroHttp(400, "CPF/CNPJ deve ter no máximo 14 números.");
    }

    return numeros === "" ? null : numeros;
}

// Busca o fornecedor pelo nome (razão social); se não existir, cria
async function obterIdFornecedor(con, nomeFornecedor) {
    const nome = textoOuNull(nomeFornecedor);

    if (!nome) return null;

    const [existente] = await con.query(
        "SELECT id_fornecedor FROM fornecedor WHERE razao_social = ?",
        [nome]
    );

    if (existente.length > 0) {
        return existente[0].id_fornecedor;
    }

    const [novo] = await con.query(
        "INSERT INTO fornecedor (razao_social) VALUES (?)",
        [nome]
    );

    return novo.insertId;
}

// Valida os dados vindos do formulário de produto
function validarProduto(corpo) {
    const nome = String(corpo.nome ?? "").trim();
    const idCategoria = parseInt(corpo.categoria);
    const precoCusto = Number(corpo.preco_custo);
    const precoVenda = Number(corpo.preco_venda);
    const codigoBarras = textoOuNull(corpo.codigo_barras);

    if (!nome) {
        throw erroHttp(400, "Informe o nome do produto.");
    }

    if (!idCategoria) {
        throw erroHttp(400, "Selecione uma categoria.");
    }

    if (!Number.isFinite(precoCusto) || !Number.isFinite(precoVenda) ||
        precoCusto < 0 || precoVenda < 0) {
        throw erroHttp(400, "Informe preços válidos.");
    }

    if (codigoBarras && !/^\d+$/.test(codigoBarras)) {
        throw erroHttp(400, "O código de barras deve conter somente números.");
    }

    return {
        nome,
        idCategoria,
        precoCusto,
        precoVenda,
        codigoBarras,
        fornecedor: corpo.fornecedor
    };
}


// ======================================
// PÁGINA INICIAL (LOGIN)
// ======================================

app.get("/", function(req, res) {
    res.sendFile(caminho.join(__dirname, "html", "index.html"));
});


// ======================================
// LOGIN
// ======================================

app.post("/login", async function(req, res) {
    try {
        const nome = String(req.body.nome ?? "").trim();
        const senha = String(req.body.senha ?? "");

        if (!nome || !senha) {
            return res.status(400).json({
                mensagem: "Preencha o nome e a senha."
            });
        }

        // Aceita nome, e-mail ou CPF/CNPJ (com ou sem pontos e traço)
        const [dados] = await db.query(
            "SELECT * FROM cadastro WHERE nome = ? OR email = ? OR cpf_cnpj = ?",
            [nome, nome, nome.replace(/\D/g, "") || nome]
        );

        let usuario = null;

        for (const candidato of dados) {
            const salva = candidato.senha || "";
            let confere = false;

            if (salva.startsWith("$2")) {
                // senha já criptografada
                confere = await bcrypt.compare(senha, salva);
            } else {
                // senha em texto puro, como está no banco
                confere = senha === salva;

                // converte para hash automaticamente após o primeiro login
                if (confere) {
                    const hash = await bcrypt.hash(senha, 10);

                    await db.query(
                        "UPDATE cadastro SET senha = ? WHERE id_cadastro = ?",
                        [hash, candidato.id_cadastro]
                    );
                }
            }

            if (confere) {
                usuario = candidato;
                break;
            }
        }

        if (!usuario) {
            return res.status(401).json({
                mensagem: "Nome ou senha incorretos."
            });
        }

        res.json({
            mensagem: "Login realizado!",
            id_cadastro: usuario.id_cadastro,
            nome: usuario.nome,
            gerente: Boolean(usuario.gerente)
        });

    } catch (erro) {
        responderErro(res, erro, "Erro ao realizar login.");
    }
});


// ======================================
// CATEGORIAS
// ======================================

app.get("/categorias", async function(req, res) {
    try {
        const [categorias] = await db.query(
            "SELECT id_categoria, nome FROM categoria ORDER BY nome"
        );

        res.json(categorias);

    } catch (erro) {
        responderErro(res, erro, "Erro ao buscar categorias.");
    }
});

app.post("/categorias", async function(req, res) {
    try {
        const nome = String(req.body.nome ?? "").trim();

        if (!nome) {
            throw erroHttp(400, "Digite o nome da categoria.");
        }

        await db.query("INSERT INTO categoria (nome) VALUES (?)", [nome]);

        res.status(201).json({ mensagem: "Categoria cadastrada!" });

    } catch (erro) {
        if (erro.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ mensagem: "Essa categoria já está cadastrada." });
        }

        responderErro(res, erro, "Erro ao cadastrar categoria.");
    }
});

app.put("/categorias/:id", async function(req, res) {
    try {
        const nome = String(req.body.nome ?? "").trim();

        if (!nome) {
            throw erroHttp(400, "Digite o nome da categoria.");
        }

        const [resultado] = await db.query(
            "UPDATE categoria SET nome = ? WHERE id_categoria = ?",
            [nome, req.params.id]
        );

        if (resultado.affectedRows === 0) {
            throw erroHttp(404, "Categoria não encontrada.");
        }

        res.json({ mensagem: "Categoria atualizada!" });

    } catch (erro) {
        if (erro.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ mensagem: "Essa categoria já está cadastrada." });
        }

        responderErro(res, erro, "Erro ao atualizar categoria.");
    }
});

app.delete("/categorias/:id", async function(req, res) {
    try {
        const [emUso] = await db.query(
            "SELECT COUNT(*) AS total FROM produto WHERE id_categoria = ?",
            [req.params.id]
        );

        if (emUso[0].total > 0) {
            throw erroHttp(409, "Não é possível excluir: existem produtos usando esta categoria.");
        }

        const [resultado] = await db.query(
            "DELETE FROM categoria WHERE id_categoria = ?",
            [req.params.id]
        );

        if (resultado.affectedRows === 0) {
            throw erroHttp(404, "Categoria não encontrada.");
        }

        res.json({ mensagem: "Categoria excluída!" });

    } catch (erro) {
        responderErro(res, erro, "Erro ao excluir categoria.");
    }
});


// ======================================
// PRODUTOS
// ======================================

app.get("/produtos", async function(req, res) {
    try {
        const [produtos] = await db.query(`
            SELECT
                p.id_produto,
                p.id_categoria,
                p.nome,
                p.codigo_barras,
                p.preco_custo,
                p.preco_venda,
                c.nome AS categoria,
                f.razao_social AS fornecedor
            FROM produto p
            LEFT JOIN categoria c ON c.id_categoria = p.id_categoria
            LEFT JOIN fornecedor f ON f.id_fornecedor = p.id_fornecedor
            ORDER BY p.nome
        `);

        res.json(produtos);

    } catch (erro) {
        responderErro(res, erro, "Erro ao buscar produtos.");
    }
});

app.post("/produtos", async function(req, res) {
    let con;

    try {
        const p = validarProduto(req.body);

        con = await db.getConnection();
        await con.beginTransaction();

        const idFornecedor = await obterIdFornecedor(con, p.fornecedor);

        const [resultado] = await con.query(
            `INSERT INTO produto
                (id_categoria, id_fornecedor, nome, codigo_barras, preco_custo, preco_venda)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [p.idCategoria, idFornecedor, p.nome, p.codigoBarras, p.precoCusto, p.precoVenda]
        );

        // Cria o registro de estoque do produto com quantidade zero
        await con.query(
            "INSERT INTO estoque (id_produto, nome_item, quantidade) VALUES (?, ?, 0)",
            [resultado.insertId, p.nome]
        );

        await con.commit();

        res.status(201).json({ mensagem: "Produto cadastrado!" });

    } catch (erro) {
        if (con) await con.rollback();

        if (erro.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ mensagem: "Esse código de barras já está cadastrado." });
        }

        responderErro(res, erro, "Erro ao cadastrar produto.");

    } finally {
        if (con) con.release();
    }
});

app.put("/produtos/:id", async function(req, res) {
    let con;

    try {
        const p = validarProduto(req.body);

        con = await db.getConnection();
        await con.beginTransaction();

        const idFornecedor = await obterIdFornecedor(con, p.fornecedor);

        const [resultado] = await con.query(
            `UPDATE produto
                SET id_categoria = ?, id_fornecedor = ?, nome = ?,
                    codigo_barras = ?, preco_custo = ?, preco_venda = ?
              WHERE id_produto = ?`,
            [p.idCategoria, idFornecedor, p.nome, p.codigoBarras,
             p.precoCusto, p.precoVenda, req.params.id]
        );

        if (resultado.affectedRows === 0) {
            throw erroHttp(404, "Produto não encontrado.");
        }

        await con.query(
            "UPDATE estoque SET nome_item = ? WHERE id_produto = ?",
            [p.nome, req.params.id]
        );

        await con.commit();

        res.json({ mensagem: "Produto atualizado!" });

    } catch (erro) {
        if (con) await con.rollback();

        if (erro.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ mensagem: "Esse código de barras já está cadastrado." });
        }

        responderErro(res, erro, "Erro ao atualizar produto.");

    } finally {
        if (con) con.release();
    }
});

app.delete("/produtos/:id", async function(req, res) {
    try {
        const [resultado] = await db.query(
            "DELETE FROM produto WHERE id_produto = ?",
            [req.params.id]
        );

        if (resultado.affectedRows === 0) {
            throw erroHttp(404, "Produto não encontrado.");
        }

        res.json({ mensagem: "Produto excluído!" });

    } catch (erro) {
        responderErro(res, erro, "Erro ao excluir produto.");
    }
});


// ======================================
// ESTOQUE
// ======================================

app.get("/estoque", async function(req, res) {
    try {
        const [estoque] = await db.query(`
            SELECT
                e.id_estoque,
                e.id_produto,
                p.nome AS nome_item,
                e.quantidade
            FROM estoque e
            JOIN produto p ON p.id_produto = e.id_produto
            ORDER BY p.nome
        `);

        res.json(estoque);

    } catch (erro) {
        responderErro(res, erro, "Erro ao buscar estoque.");
    }
});

app.post("/estoque/atualizar", async function(req, res) {
    let con;

    try {
        const idProduto = parseInt(req.body.id_produto);
        const idCadastro = parseInt(req.body.id_cadastro);
        const quantidade = Number(req.body.quantidade);
        const acao = req.body.acao;

        if (!idProduto) {
            throw erroHttp(400, "Selecione um produto.");
        }

        if (!idCadastro) {
            throw erroHttp(400, "Usuário não identificado. Faça login novamente.");
        }

        if (!Number.isFinite(quantidade) || quantidade <= 0) {
            throw erroHttp(400, "Informe uma quantidade válida.");
        }

        if (acao !== "aumentar" && acao !== "diminuir") {
            throw erroHttp(400, "Selecione a ação do estoque.");
        }

        con = await db.getConnection();
        await con.beginTransaction();

        const [produtos] = await con.query(
            `SELECT id_produto, nome, id_fornecedor, preco_custo, preco_venda
               FROM produto
              WHERE id_produto = ?
                FOR UPDATE`,
            [idProduto]
        );

        if (produtos.length === 0) {
            throw erroHttp(404, "Produto não encontrado.");
        }

        const produto = produtos[0];

        // Garante que existe a linha de estoque do produto
        await con.query(
            `INSERT INTO estoque (id_produto, nome_item, quantidade)
             VALUES (?, ?, 0)
             ON DUPLICATE KEY UPDATE nome_item = VALUES(nome_item)`,
            [produto.id_produto, produto.nome]
        );

        const [linhas] = await con.query(
            "SELECT quantidade FROM estoque WHERE id_produto = ? FOR UPDATE",
            [idProduto]
        );

        const quantidadeAtual = Number(linhas[0].quantidade);

        if (acao === "diminuir" && quantidade > quantidadeAtual) {
            throw erroHttp(
                400,
                "Estoque insuficiente. Quantidade atual: " + quantidadeAtual
            );
        }

        const novaQuantidade = acao === "aumentar"
            ? quantidadeAtual + quantidade
            : quantidadeAtual - quantidade;

        await con.query(
            "UPDATE estoque SET quantidade = ? WHERE id_produto = ?",
            [novaQuantidade, idProduto]
        );

        // Entrada usa o preço de custo; saída usa o preço de venda
        const precoUnitario = acao === "aumentar"
            ? Number(produto.preco_custo)
            : Number(produto.preco_venda);

        await con.query(
            `INSERT INTO historico_estoque
                (id_produto, nome_produto, acao, id_fornecedor, id_cadastro,
                 quantidade, preco_unitario, valor_total)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                produto.id_produto,
                produto.nome,
                acao === "aumentar" ? "Entrada" : "Saída",
                produto.id_fornecedor,
                idCadastro,
                quantidade,
                precoUnitario,
                precoUnitario * quantidade
            ]
        );

        await con.commit();

        res.json({ mensagem: "Estoque atualizado!" });

    } catch (erro) {
        if (con) await con.rollback();

        responderErro(res, erro, "Erro ao atualizar estoque.");

    } finally {
        if (con) con.release();
    }
});


// ======================================
// HISTÓRICO
// ======================================

app.get("/historico", async function(req, res) {
    try {
        const [historico] = await db.query(`
            SELECT
                h.id_historico,
                h.acao,
                h.nome_produto,
                h.quantidade,
                h.preco_unitario,
                h.valor_total,
                h.data_entrada,
                c.nome AS nome_funcionario
            FROM historico_estoque h
            LEFT JOIN cadastro c ON c.id_cadastro = h.id_cadastro
            ORDER BY h.data_entrada DESC, h.id_historico DESC
        `);

        res.json(historico);

    } catch (erro) {
        responderErro(res, erro, "Erro ao buscar histórico.");
    }
});


// ======================================
// FUNCIONÁRIOS
// ======================================

// Converte o cargo recebido em true (gerente) ou false (funcionário)
function ehGerente(valor) {
    return valor === true || valor === 1 || valor === "1" || valor === "true" || valor === "gerente";
}

// Verifica se existe algum gerente além do usuário informado
async function existeOutroGerente(idIgnorar) {
    const [resultado] = await db.query(
        "SELECT COUNT(*) AS total FROM cadastro WHERE gerente = TRUE AND id_cadastro <> ?",
        [idIgnorar]
    );

    return resultado[0].total > 0;
}

app.get("/funcionarios", async function(req, res) {
    try {
        const [funcionarios] = await db.query(`
            SELECT id_cadastro, nome, cpf_cnpj, email, gerente
              FROM cadastro
             ORDER BY gerente DESC, nome
        `);

        res.json(funcionarios);

    } catch (erro) {
        responderErro(res, erro, "Erro ao buscar funcionários.");
    }
});

app.post("/funcionarios", async function(req, res) {
    try {
        const nome = String(req.body.nome ?? "").trim();
        const cpfCnpj = somenteNumeros(req.body.cpf_cnpj);
        const email = textoOuNull(req.body.email);
        const senha = String(req.body.senha ?? "");
        const gerente = ehGerente(req.body.gerente);

        if (!nome || !cpfCnpj) {
            throw erroHttp(400, "Informe o nome e o CPF/CNPJ.");
        }

        if (!senha) {
            throw erroHttp(400, "Informe uma senha para o funcionário.");
        }

        const senhaCriptografada = await bcrypt.hash(senha, 10);

        await db.query(
            `INSERT INTO cadastro (nome, senha, cpf_cnpj, email, gerente)
             VALUES (?, ?, ?, ?, ?)`,
            [nome, senhaCriptografada, cpfCnpj, email, gerente]
        );

        res.status(201).json({ mensagem: "Funcionário cadastrado!" });

    } catch (erro) {
        if (erro.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ mensagem: "Esse CPF/CNPJ já está cadastrado." });
        }

        responderErro(res, erro, "Erro ao cadastrar funcionário.");
    }
});

app.put("/funcionarios/:id", async function(req, res) {
    try {
        const nome = String(req.body.nome ?? "").trim();
        const cpfCnpj = somenteNumeros(req.body.cpf_cnpj);
        const email = textoOuNull(req.body.email);
        const senha = String(req.body.senha ?? "");
        const gerente = ehGerente(req.body.gerente);

        if (!nome || !cpfCnpj) {
            throw erroHttp(400, "Informe o nome e o CPF/CNPJ.");
        }

        // Nunca deixa o sistema sem nenhum gerente
        if (!gerente && !(await existeOutroGerente(req.params.id))) {
            throw erroHttp(409, "Deve existir pelo menos um gerente no sistema.");
        }

        let resultado;

        if (senha) {
            // Só altera a senha se uma nova foi digitada
            const senhaCriptografada = await bcrypt.hash(senha, 10);

            [resultado] = await db.query(
                `UPDATE cadastro
                    SET nome = ?, cpf_cnpj = ?, email = ?, gerente = ?, senha = ?
                  WHERE id_cadastro = ?`,
                [nome, cpfCnpj, email, gerente, senhaCriptografada, req.params.id]
            );
        } else {
            [resultado] = await db.query(
                `UPDATE cadastro
                    SET nome = ?, cpf_cnpj = ?, email = ?, gerente = ?
                  WHERE id_cadastro = ?`,
                [nome, cpfCnpj, email, gerente, req.params.id]
            );
        }

        if (resultado.affectedRows === 0) {
            throw erroHttp(404, "Funcionário não encontrado.");
        }

        res.json({ mensagem: "Funcionário atualizado!" });

    } catch (erro) {
        if (erro.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ mensagem: "Esse CPF/CNPJ já está cadastrado." });
        }

        responderErro(res, erro, "Erro ao atualizar funcionário.");
    }
});

app.delete("/funcionarios/:id", async function(req, res) {
    try {
        // Nunca deixa o sistema sem nenhum gerente
        if (!(await existeOutroGerente(req.params.id))) {
            const [alvo] = await db.query(
                "SELECT gerente FROM cadastro WHERE id_cadastro = ?",
                [req.params.id]
            );

            if (alvo.length > 0 && alvo[0].gerente) {
                throw erroHttp(409, "Deve existir pelo menos um gerente no sistema.");
            }
        }

        const [resultado] = await db.query(
            "DELETE FROM cadastro WHERE id_cadastro = ?",
            [req.params.id]
        );

        if (resultado.affectedRows === 0) {
            throw erroHttp(404, "Funcionário não encontrado.");
        }

        res.json({ mensagem: "Funcionário excluído!" });

    } catch (erro) {
        responderErro(res, erro, "Erro ao excluir funcionário.");
    }
});


// ======================================
// INICIAR SERVIDOR
// ======================================

app.listen(porta, function() {
    console.log("SuperMarket: http://localhost:" + porta);
});