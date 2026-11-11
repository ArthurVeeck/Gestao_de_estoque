// ======================================
// CONFIGURAÇÕES
// ======================================

const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));

let produtos = [];
let categorias = [];
let estoque = [];
let funcionarios = [];

let produtoEditando = null;
let categoriaEditando = null;
let idFuncionarioEditando = null;


// ======================================
// FUNÇÕES AUXILIARES
// ======================================

async function requisicao(url, metodo = "GET", dados = null) {
    const configuracao = {
        method: metodo,
        headers: {
            "Content-Type": "application/json"
        }
    };

    if (dados) {
        configuracao.body = JSON.stringify(dados);
    }

    const resposta = await fetch(url, configuracao);
    const resultado = await resposta.json();

    if (!resposta.ok) {
        throw new Error(resultado.mensagem || "Ocorreu um erro.");
    }

    return resultado;
}

function escapar(texto) {
    return String(texto ?? "").replace(/[&<>"']/g, function(caractere) {
        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[caractere];
    });
}

function dinheiro(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function obterIdUsuario() {
    if (!usuarioLogado || !usuarioLogado.id_cadastro) {
        alert("Não foi possível identificar o usuário. Faça login novamente.");
        return null;
    }

    return usuarioLogado.id_cadastro;
}


// ======================================
// NAVEGAÇÃO
// ======================================

const opcoes = document.querySelectorAll(".opcao");
const paginas = document.querySelectorAll(".pagina");

opcoes.forEach(function(opcao) {
    opcao.addEventListener("click", function() {
        const paginaSelecionada = opcao.dataset.pagina;

        opcoes.forEach(function(item) {
            item.classList.remove("ativa");
        });

        paginas.forEach(function(pagina) {
            pagina.classList.remove("ativa");
        });

        opcao.classList.add("ativa");

        document.getElementById(paginaSelecionada).classList.add("ativa");

        if (paginaSelecionada === "estoque") {
            carregarEstoque();
        }

        if (paginaSelecionada === "historico") {
            carregarHistorico();
        }

        if (paginaSelecionada === "funcionarios") {
            carregarFuncionarios();
        }
    });
});

function sair() {
    localStorage.removeItem("usuarioLogado");
    window.location.href = "index.html";
}


// ======================================
// PRODUTOS
// ======================================

async function carregarProdutos() {
    try {
        produtos = await requisicao("/produtos");

        const lista = document.getElementById("listaProdutos");
        const total = document.getElementById("totalProdutos");

        lista.innerHTML = "";

        produtos.forEach(function(produto) {
            lista.innerHTML += `
                <tr>
                    <td>${escapar(produto.nome)}</td>
                    <td>${escapar(produto.categoria || "Sem categoria")}</td>
                    <td>${escapar(produto.fornecedor || "Não informado")}</td>
                    <td>${escapar(produto.codigo_barras || "Não informado")}</td>
                    <td>${dinheiro(produto.preco_custo)}</td>
                    <td>${dinheiro(produto.preco_venda)}</td>
                    <td>
                        <button onclick="editarProduto(${produto.id_produto})">
                            Editar
                        </button>

                        <button onclick="excluirProduto(${produto.id_produto})">
                            Excluir
                        </button>
                    </td>
                </tr>
            `;
        });

        total.textContent = produtos.length;

        atualizarSelectProdutos();

    } catch (erro) {
        alert("Erro ao carregar produtos: " + erro.message);
    }
}

document.getElementById("formProduto").addEventListener("submit", async function(event) {
    event.preventDefault();

    const produto = {
        nome: document.getElementById("nomeProduto").value,
        categoria: document.getElementById("categoriaProduto").value,
        fornecedor: document.getElementById("fornecedorProduto").value,
        codigo_barras: document.getElementById("codigoBarras").value,
        preco_custo: document.getElementById("precoCusto").value,
        preco_venda: document.getElementById("precoVenda").value
    };

    try {
        if (produtoEditando) {
            await requisicao("/produtos/" + produtoEditando, "PUT", produto);
            alert("Produto atualizado!");
        } else {
            await requisicao("/produtos", "POST", produto);
            alert("Produto cadastrado!");
        }

        cancelarEdicaoProduto();
        await carregarProdutos();

    } catch (erro) {
        alert(erro.message);
    }
});

function editarProduto(id) {
    const produto = produtos.find(function(item) {
        return item.id_produto === id;
    });

    if (!produto) return;

    produtoEditando = id;

    document.getElementById("tituloFormulario").textContent = "Editar produto";
    document.getElementById("nomeProduto").value = produto.nome;
    document.getElementById("categoriaProduto").value = produto.id_categoria || "";
    document.getElementById("fornecedorProduto").value = produto.fornecedor || "";
    document.getElementById("codigoBarras").value = produto.codigo_barras || "";
    document.getElementById("precoCusto").value = produto.preco_custo;
    document.getElementById("precoVenda").value = produto.preco_venda;

    document.getElementById("btnSalvar").textContent = "Salvar alterações";
    document.getElementById("btnCancelar").style.display = "block";

    window.scrollTo(0, 0);
}

function cancelarEdicaoProduto() {
    produtoEditando = null;

    document.getElementById("formProduto").reset();
    document.getElementById("tituloFormulario").textContent = "Cadastrar produto";
    document.getElementById("btnSalvar").textContent = "Salvar produto";
    document.getElementById("btnCancelar").style.display = "none";
}

async function excluirProduto(id) {
    if (!confirm("Deseja realmente excluir este produto?")) return;

    try {
        await requisicao("/produtos/" + id, "DELETE");

        alert("Produto excluído!");

        await carregarProdutos();
        await carregarEstoque();

    } catch (erro) {
        alert(erro.message);
    }
}


// ======================================
// CATEGORIAS
// ======================================

async function carregarCategorias() {
    try {
        categorias = await requisicao("/categorias");

        const lista = document.getElementById("listaCategorias");
        const total = document.getElementById("totalCategorias");
        const select = document.getElementById("categoriaProduto");

        lista.innerHTML = "";
        select.innerHTML = '<option value="">Selecione uma categoria</option>';

        categorias.forEach(function(categoria) {
            lista.innerHTML += `
                <tr>
                    <td>${escapar(categoria.nome)}</td>
                    <td>
                        <button onclick="editarCategoria(${categoria.id_categoria})">
                            Editar
                        </button>

                        <button onclick="excluirCategoria(${categoria.id_categoria})">
                            Excluir
                        </button>
                    </td>
                </tr>
            `;

            select.innerHTML += `
                <option value="${categoria.id_categoria}">
                    ${escapar(categoria.nome)}
                </option>
            `;
        });

        total.textContent = categorias.length;

    } catch (erro) {
        alert("Erro ao carregar categorias: " + erro.message);
    }
}

document.getElementById("formCategoria").addEventListener("submit", async function(event) {
    event.preventDefault();

    const nome = document.getElementById("nomeCategoria").value;

    try {
        if (categoriaEditando) {
            await requisicao("/categorias/" + categoriaEditando, "PUT", {
                nome: nome
            });

            alert("Categoria atualizada!");
        } else {
            await requisicao("/categorias", "POST", {
                nome: nome
            });

            alert("Categoria cadastrada!");
        }

        cancelarEdicaoCategoria();
        await carregarCategorias();
        await carregarProdutos();

    } catch (erro) {
        alert(erro.message);
    }
});

function editarCategoria(id) {
    const categoria = categorias.find(function(item) {
        return item.id_categoria === id;
    });

    if (!categoria) return;

    categoriaEditando = id;

    document.getElementById("nomeCategoria").value = categoria.nome;
    document.getElementById("tituloCategoria").textContent = "Editar categoria";
    document.getElementById("btnSalvarCategoria").textContent = "Salvar alterações";
    document.getElementById("btnCancelarCategoria").style.display = "block";
}

function cancelarEdicaoCategoria() {
    categoriaEditando = null;

    document.getElementById("formCategoria").reset();
    document.getElementById("tituloCategoria").textContent = "Cadastrar categoria";
    document.getElementById("btnSalvarCategoria").textContent = "Salvar categoria";
    document.getElementById("btnCancelarCategoria").style.display = "none";
}

async function excluirCategoria(id) {
    if (!confirm("Deseja excluir esta categoria?")) return;

    try {
        await requisicao("/categorias/" + id, "DELETE");

        alert("Categoria excluída!");

        await carregarCategorias();
        await carregarProdutos();

    } catch (erro) {
        alert(erro.message);
    }
}


// ======================================
// ESTOQUE
// ======================================

function atualizarSelectProdutos() {
    const select = document.getElementById("produtoEstoque");

    select.innerHTML = '<option value="">Selecione um produto</option>';

    produtos.forEach(function(produto) {
        select.innerHTML += `
            <option value="${produto.id_produto}">
                ${escapar(produto.nome)}
            </option>
        `;
    });
}

async function carregarEstoque() {
    try {
        estoque = await requisicao("/estoque");

        const lista = document.getElementById("listaEstoque");

        lista.innerHTML = "";

        estoque.forEach(function(item) {
            lista.innerHTML += `
                <tr>
                    <td>${escapar(item.nome_item || item.nome)}</td>
                    <td>${Number(item.quantidade).toLocaleString("pt-BR")}</td>
                </tr>
            `;
        });

    } catch (erro) {
        alert("Erro ao carregar estoque: " + erro.message);
    }
}

document.getElementById("formEstoque").addEventListener("submit", async function(event) {
    event.preventDefault();

    const idCadastro = obterIdUsuario();

    if (!idCadastro) return;

    const dados = {
        id_produto: document.getElementById("produtoEstoque").value,
        quantidade: document.getElementById("quantidadeEstoque").value,
        acao: document.getElementById("acaoEstoque").value,
        id_cadastro: idCadastro
    };

    try {
        await requisicao("/estoque/atualizar", "POST", dados);

        alert("Estoque atualizado!");

        document.getElementById("formEstoque").reset();

        await carregarEstoque();
        await carregarHistorico();

    } catch (erro) {
        alert(erro.message);
    }
});


// ======================================
// HISTÓRICO
// ======================================

async function carregarHistorico() {
    try {
        const historico = await requisicao("/historico");

        const lista = document.getElementById("listaHistorico");

        lista.innerHTML = "";

        historico.forEach(function(item) {
            const data = item.data_entrada
                ? new Date(item.data_entrada).toLocaleString("pt-BR")
                : "Data não informada";

            lista.innerHTML += `
                <tr>
                    <td>${escapar(item.acao)}</td>
                    <td>${escapar(item.nome_produto)}</td>
                    <td>${Number(item.quantidade).toLocaleString("pt-BR")}</td>
                    <td>${escapar(item.nome_funcionario || "Não informado")}</td>
                    <td>${data}</td>
                </tr>
            `;
        });

    } catch (erro) {
        alert("Erro ao carregar histórico: " + erro.message);
    }
}


// ======================================
// FUNCIONÁRIOS
// ======================================

async function carregarFuncionarios() {
    try {
        funcionarios = await requisicao("/funcionarios");

        const lista = document.getElementById("listaFuncionarios");
        const total = document.getElementById("totalFuncionarios");

        lista.innerHTML = "";

        funcionarios.forEach(function(funcionario) {
            lista.innerHTML += `
                <tr>
                    <td>${escapar(funcionario.nome)}</td>
                    <td>${escapar(funcionario.cpf_cnpj || "")}</td>
                    <td>${escapar(funcionario.email || "")}</td>
                    <td>${funcionario.gerente ? "Gerente" : "Funcionário"}</td>
                    <td>
                        <button onclick="editarFuncionario(${funcionario.id_cadastro})">
                            Editar
                        </button>

                        <button onclick="excluirFuncionario(${funcionario.id_cadastro})">
                            Excluir
                        </button>
                    </td>
                </tr>
            `;
        });

        total.textContent = funcionarios.length;

    } catch (erro) {
        alert("Erro ao carregar funcionários: " + erro.message);
    }
}

document.getElementById("formFuncionario").addEventListener("submit", async function(event) {
    event.preventDefault();

    const funcionario = {
        nome: document.getElementById("nomeFuncionario").value,
        cpf_cnpj: document.getElementById("cpfFuncionario").value,
        email: document.getElementById("emailFuncionario").value,
        senha: document.getElementById("senhaFuncionario").value,

        // true = gerente, false = funcionário
        gerente: document.getElementById("cargoFuncionario").value === "gerente"
    };

    if (idFuncionarioEditando && usuarioLogado &&
        idFuncionarioEditando === usuarioLogado.id_cadastro && !funcionario.gerente) {
        alert("Você não pode remover o seu próprio cargo de gerente.");
        return;
    }

    try {
        if (idFuncionarioEditando) {
            await requisicao(
                "/funcionarios/" + idFuncionarioEditando,
                "PUT",
                funcionario
            );

            alert("Funcionário atualizado!");
        } else {
            if (!funcionario.senha) {
                alert("Informe uma senha para o funcionário.");
                return;
            }

            await requisicao("/funcionarios", "POST", funcionario);

            alert("Funcionário cadastrado!");
        }

        cancelarEdicaoFuncionario();
        await carregarFuncionarios();

    } catch (erro) {
        alert(erro.message);
    }
});

function editarFuncionario(id) {
    const funcionario = funcionarios.find(function(item) {
        return item.id_cadastro === id;
    });

    if (!funcionario) return;

    idFuncionarioEditando = id;

    document.getElementById("nomeFuncionario").value = funcionario.nome;
    document.getElementById("cpfFuncionario").value = funcionario.cpf_cnpj || "";
    document.getElementById("emailFuncionario").value = funcionario.email || "";
    document.getElementById("senhaFuncionario").value = "";
    document.getElementById("cargoFuncionario").value =
        funcionario.gerente ? "gerente" : "funcionario";

    document.getElementById("senhaFuncionario").placeholder =
        "Digite somente se quiser alterar a senha";

    document.getElementById("tituloFuncionario").textContent = "Editar funcionário";
    document.getElementById("btnSalvarFuncionario").textContent = "Salvar alterações";
    document.getElementById("btnCancelarFuncionario").style.display = "block";
}

function cancelarEdicaoFuncionario() {
    idFuncionarioEditando = null;

    document.getElementById("formFuncionario").reset();

    document.getElementById("tituloFuncionario").textContent =
        "Cadastrar funcionário";

    document.getElementById("btnSalvarFuncionario").textContent =
        "Salvar funcionário";

    document.getElementById("senhaFuncionario").placeholder = "Senha";
    document.getElementById("btnCancelarFuncionario").style.display = "none";
}

async function excluirFuncionario(id) {
    if (usuarioLogado && id === usuarioLogado.id_cadastro) {
        alert("Você não pode excluir o seu próprio usuário.");
        return;
    }

    if (!confirm("Deseja realmente excluir este funcionário?")) return;

    try {
        await requisicao("/funcionarios/" + id, "DELETE");

        alert("Funcionário excluído!");

        await carregarFuncionarios();

    } catch (erro) {
        alert(erro.message);
    }
}


// ======================================
// INICIALIZAÇÃO
// ======================================

async function iniciarSistema() {
    if (!usuarioLogado || !usuarioLogado.gerente) {
        alert("Acesso permitido somente para gerentes.");
        window.location.href = "index.html";
        return;
    }

    await carregarCategorias();
    await carregarProdutos();
    await carregarEstoque();
    await carregarHistorico();
    await carregarFuncionarios();
}

iniciarSistema();