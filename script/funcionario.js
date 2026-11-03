
// ======================================
// DADOS DO SISTEMA
// ======================================

let produtos = JSON.parse(localStorage.getItem("produtos")) || [];
let categorias = JSON.parse(localStorage.getItem("categorias")) || [];

let produtoEditando = null;
let categoriaEditando = null;


// ======================================
// ELEMENTOS
// ======================================

const formProduto = document.getElementById("formProduto");
const formCategoria = document.getElementById("formCategoria");

const listaProdutos = document.getElementById("listaProdutos");
const listaCategorias = document.getElementById("listaCategorias");

const categoriaProduto = document.getElementById("categoriaProduto");


// ======================================
// SALVAR DADOS
// ======================================

function salvarDados() {

    localStorage.setItem("produtos", JSON.stringify(produtos));
    localStorage.setItem("categorias", JSON.stringify(categorias));

}


// ======================================
// NAVEGAÇÃO DO MENU
// ======================================

const opcoes = document.querySelectorAll(".opcao");
const paginas = document.querySelectorAll(".pagina");

opcoes.forEach(function(botao) {

    botao.addEventListener("click", function() {

        const paginaSelecionada = botao.dataset.pagina;

        opcoes.forEach(function(opcao) {
            opcao.classList.remove("ativa");
        });

        paginas.forEach(function(pagina) {
            pagina.classList.remove("ativa");
        });

        botao.classList.add("ativa");

        document.getElementById(paginaSelecionada).classList.add("ativa");

    });

});


// ======================================
// PROTEÇÃO DE TEXTO HTML
// ======================================

function escapar(texto) {

    return String(texto).replace(/[&<>"']/g, function(caractere) {

        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[caractere];

    });

}


// ======================================
// FORMATAÇÃO DE PREÇOS
// ======================================

function formatarPreco(valor) {

    return Number(valor).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });

}


// ======================================
// ATUALIZAR LISTA DE CATEGORIAS
// ======================================

function atualizarCategorias() {

    listaCategorias.innerHTML = "";

    categorias.forEach(function(categoria) {

        listaCategorias.innerHTML += `

            <div class="item-categoria">

                <span>${escapar(categoria.nome)}</span>

                <div>
                    <button class="acao editar"
                        data-editar-categoria="${categoria.id}">
                        Editar
                    </button>

                    <button class="acao excluir"
                        data-excluir-categoria="${categoria.id}">
                        Excluir
                    </button>
                </div>

            </div>

        `;

    });

    if (categorias.length === 0) {

        listaCategorias.innerHTML = `
            <p class="mensagem-vazia">
                Nenhuma categoria cadastrada.
            </p>
        `;

    }

    document.getElementById("totalCategorias").innerText =
        categorias.length + (categorias.length === 1 ? " categoria" : " categorias");


    // ATUALIZAR SELECT DOS PRODUTOS

    const categoriaAtual = categoriaProduto.value;

    categoriaProduto.innerHTML = `
        <option value="">Selecione uma categoria</option>
    `;

    categorias.forEach(function(categoria) {

        categoriaProduto.innerHTML += `
            <option value="${escapar(categoria.nome)}">
                ${escapar(categoria.nome)}
            </option>
        `;

    });

    if (categorias.some(c => c.nome === categoriaAtual)) {
        categoriaProduto.value = categoriaAtual;
    }

}


// ======================================
// CADASTRAR CATEGORIA
// ======================================

formCategoria.addEventListener("submit", function(event) {

    event.preventDefault();

    const nome = document.getElementById("nomeCategoria").value.trim();

    if (!nome) {
        alert("Digite o nome da categoria!");
        return;
    }

    // VERIFICAR CATEGORIA REPETIDA

    const repetida = categorias.some(function(categoria) {

        return categoria.nome.toLowerCase() === nome.toLowerCase()
            && categoria.id !== categoriaEditando;

    });

    if (repetida) {
        alert("Essa categoria já está cadastrada!");
        return;
    }


    // EDITAR CATEGORIA

    if (categoriaEditando !== null) {

        const categoriaAntiga = categorias.find(function(categoria) {
            return categoria.id === categoriaEditando;
        });

        if (categoriaAntiga) {

            const nomeAntigo = categoriaAntiga.nome;

            categoriaAntiga.nome = nome;

            // ATUALIZAR OS PRODUTOS QUE UTILIZAM A CATEGORIA

            produtos.forEach(function(produto) {

                if (produto.categoria === nomeAntigo) {
                    produto.categoria = nome;
                }

            });

        }

        alert("Categoria editada com sucesso!");

    } else {

        // NOVA CATEGORIA

        categorias.push({
            id: Date.now(),
            nome: nome
        });

        alert("Categoria cadastrada com sucesso!");

    }

    cancelarEdicaoCategoria();

    salvarDados();
    atualizarCategorias();
    atualizarProdutos();

});


// ======================================
// EDITAR CATEGORIA
// ======================================

function editarCategoria(id) {

    const categoria = categorias.find(function(item) {
        return item.id === id;
    });

    if (!categoria) return;

    categoriaEditando = id;

    document.getElementById("nomeCategoria").value = categoria.nome;

    document.getElementById("tituloCategoria").innerText = "Editar Categoria";

    document.getElementById("btnSalvarCategoria").innerText = "Salvar Alterações";

    document.getElementById("btnCancelarCategoria").style.display = "block";

}


// ======================================
// CANCELAR EDIÇÃO DE CATEGORIA
// ======================================

function cancelarEdicaoCategoria() {

    categoriaEditando = null;

    formCategoria.reset();

    document.getElementById("tituloCategoria").innerText = "Adicionar Categoria";

    document.getElementById("btnSalvarCategoria").innerText = "Adicionar Categoria";

    document.getElementById("btnCancelarCategoria").style.display = "none";

}

document.getElementById("btnCancelarCategoria").addEventListener("click", cancelarEdicaoCategoria);


// ======================================
// EXCLUIR CATEGORIA
// ======================================

function excluirCategoria(id) {

    const categoria = categorias.find(function(item) {
        return item.id === id;
    });

    if (!categoria) return;

    const emUso = produtos.some(function(produto) {
        return produto.categoria === categoria.nome;
    });

    if (emUso) {
        alert("Não é possível excluir essa categoria, pois existem produtos utilizando ela!");
        return;
    }

    if (confirm("Deseja realmente excluir essa categoria?")) {

        categorias = categorias.filter(function(item) {
            return item.id !== id;
        });

        salvarDados();
        atualizarCategorias();

    }

}


// ======================================
// CADASTRAR PRODUTO
// ======================================

formProduto.addEventListener("submit", function(event) {

    event.preventDefault();

    const nome = document.getElementById("nomeProduto").value.trim();
    const categoria = categoriaProduto.value;
    const fornecedor = document.getElementById("fornecedorProduto").value.trim();
    const codigo = document.getElementById("codigoBarras").value.trim();
    const custo = Number(document.getElementById("precoCusto").value);
    const venda = Number(document.getElementById("precoVenda").value);


    if (categorias.length === 0) {
        alert("Cadastre uma categoria antes de adicionar produtos!");
        return;
    }

    if (!categorias.some(c => c.nome === categoria)) {
        alert("Selecione uma categoria válida!");
        return;
    }

    if (!nome || !fornecedor || !categoria) {
        alert("Preencha todos os campos obrigatórios!");
        return;
    }

    if (codigo && !/^\d+$/.test(codigo)) {
        alert("O código de barras deve conter somente números!");
        return;
    }

    if (!Number.isFinite(custo) || !Number.isFinite(venda) || custo < 0 || venda < 0) {
        alert("Informe preços válidos!");
        return;
    }


    // VERIFICAR PRODUTO REPETIDO

    const repetido = produtos.some(function(produto) {

        if (produto.id === produtoEditando) {
            return false;
        }

        if (codigo && produto.codigo === codigo) {
            return true;
        }

        if (!codigo && !produto.codigo) {

            return produto.nome.toLowerCase() === nome.toLowerCase()
                && produto.categoria.toLowerCase() === categoria.toLowerCase();

        }

        return false;

    });

    if (repetido) {
        alert("Esse produto já está cadastrado!");
        return;
    }


    // OBJETO DO PRODUTO

    const novoProduto = {

        id: produtoEditando !== null ? produtoEditando : Date.now(),

        nome: nome,
        categoria: categoria,
        fornecedor: fornecedor,
        codigo: codigo,
        custo: custo,
        venda: venda

    };


    // EDITAR PRODUTO

    if (produtoEditando !== null) {

        const indice = produtos.findIndex(function(produto) {
            return produto.id === produtoEditando;
        });

        if (indice !== -1) {
            produtos[indice] = novoProduto;
        }

        alert("Produto editado com sucesso!");

    } else {

        // ADICIONAR PRODUTO

        produtos.push(novoProduto);

        alert("Produto cadastrado com sucesso!");

    }

    cancelarEdicaoProduto();

    salvarDados();
    atualizarProdutos();

});


// ======================================
// ATUALIZAR LISTA DE PRODUTOS
// ======================================

function atualizarProdutos() {

    listaProdutos.innerHTML = "";

    produtos.forEach(function(produto) {

        listaProdutos.innerHTML += `

            <tr>

                <td>${escapar(produto.nome)}</td>

                <td>${escapar(produto.categoria)}</td>

                <td>${escapar(produto.fornecedor)}</td>

                <td>${escapar(produto.codigo || "-")}</td>

                <td>${formatarPreco(produto.custo)}</td>

                <td>${formatarPreco(produto.venda)}</td>

                <td>

                    <button class="acao editar"
                        data-editar-produto="${produto.id}">
                        Editar
                    </button>

                    <button class="acao excluir"
                        data-excluir-produto="${produto.id}">
                        Excluir
                    </button>

                </td>

            </tr>

        `;

    });


    if (produtos.length === 0) {

        listaProdutos.innerHTML = `
            <tr>
                <td colspan="7" class="mensagem-vazia">
                    Nenhum produto cadastrado.
                </td>
            </tr>
        `;

    }

    document.getElementById("totalProdutos").innerText =
        produtos.length + (produtos.length === 1 ? " produto" : " produtos");

}


// ======================================
// EDITAR PRODUTO
// ======================================

function editarProduto(id) {

    const produto = produtos.find(function(item) {
        return item.id === id;
    });

    if (!produto) return;

    produtoEditando = id;

    document.getElementById("nomeProduto").value = produto.nome;
    categoriaProduto.value = produto.categoria;

    document.getElementById("fornecedorProduto").value = produto.fornecedor;
    document.getElementById("codigoBarras").value = produto.codigo;

    document.getElementById("precoCusto").value = produto.custo;
    document.getElementById("precoVenda").value = produto.venda;

    document.getElementById("tituloFormulario").innerText = "Editar Produto";

    document.getElementById("btnSalvar").innerText = "Salvar Alterações";

    document.getElementById("btnCancelar").style.display = "block";

    // VOLTAR PARA A ÁREA DE PRODUTOS

    opcoes.forEach(function(opcao) {
        opcao.classList.toggle("ativa", opcao.dataset.pagina === "produto");
    });

    paginas.forEach(function(pagina) {
        pagina.classList.toggle("ativa", pagina.id === "produto");
    });

    window.scrollTo(0, 0);

}


// ======================================
// CANCELAR EDIÇÃO DE PRODUTO
// ======================================

function cancelarEdicaoProduto() {

    produtoEditando = null;

    formProduto.reset();

    document.getElementById("tituloFormulario").innerText = "Adicionar Produto";

    document.getElementById("btnSalvar").innerText = "Adicionar Produto";

    document.getElementById("btnCancelar").style.display = "none";

}

document.getElementById("btnCancelar").addEventListener("click", cancelarEdicaoProduto);


// ======================================
// EXCLUIR PRODUTO
// ======================================

function excluirProduto(id) {

    if (confirm("Deseja realmente excluir esse produto?")) {

        produtos = produtos.filter(function(produto) {
            return produto.id !== id;
        });

        if (produtoEditando === id) {
            cancelarEdicaoProduto();
        }

        salvarDados();
        atualizarProdutos();

    }

}


// ======================================
// CLIQUES NOS BOTÕES DE EDIÇÃO E EXCLUSÃO
// ======================================

document.addEventListener("click", function(event) {

    const botao = event.target;

    if (botao.dataset.editarProduto) {
        editarProduto(Number(botao.dataset.editarProduto));
    }

    if (botao.dataset.excluirProduto) {
        excluirProduto(Number(botao.dataset.excluirProduto));
    }

    if (botao.dataset.editarCategoria) {
        editarCategoria(Number(botao.dataset.editarCategoria));
    }

    if (botao.dataset.excluirCategoria) {
        excluirCategoria(Number(botao.dataset.excluirCategoria));
    }

});


// ======================================
// INICIALIZAÇÃO
// ======================================

atualizarCategorias();
atualizarProdutos();
