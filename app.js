/* ============================================================
   FESTAGEST PRO - Aplicação Principal
   SPA completa com gerenciamento de estado, persistência via
   LocalStorage e todos os módulos de gestão.
   ============================================================ */

// ===================== CONFIGURAÇÕES PADRÃO =====================
const DEFAULT_CONFIG = {
    empresa: 'Minha Barraca',
    logo: '🍔',
    tema: 'light',
    moeda: 'BRL',
    idioma: 'pt-BR',
    markupPadrao: 2.5,
    impostos: 0,
    arredondamento: '0.90'
};

// ===================== DADOS INICIAIS =====================
const INITIAL_DATA = {
    config: { ...DEFAULT_CONFIG },
    ingredientes: [],
    receitas: [],
    vendas: [],
    compras: [],
    caixa: {
        abertura: 0,
        entradas: [],
        saidas: [],
        saldoAtual: 0,
        fechado: false
    },
    estoqueMovimentacoes: []
};

// ===================== GERENCIADOR DE ESTADO =====================
class StateManager {
    constructor() {
        this.data = this.loadData();
        this.listeners = [];
    }

    loadData() {
        try {
            const saved = localStorage.getItem('festagest_data');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Garantir que config tenha todos os campos
                parsed.config = { ...DEFAULT_CONFIG, ...parsed.config };
                return parsed;
            }
        } catch (e) {
            console.error('Erro ao carregar dados:', e);
        }
        return JSON.parse(JSON.stringify(INITIAL_DATA));
    }

    saveData() {
        try {
            localStorage.setItem('festagest_data', JSON.stringify(this.data));
            this.notifyListeners();
        } catch (e) {
            console.error('Erro ao salvar dados:', e);
            this.showToast('Erro ao salvar dados!', 'error');
        }
    }

    getData() {
        return this.data;
    }

    updateConfig(key, value) {
        this.data.config[key] = value;
        this.saveData();
    }

    // Ingredientes
    addIngrediente(ingrediente) {
        ingrediente.id = Date.now().toString();
        ingrediente.createdAt = new Date().toISOString();
        // Calcular preços unitários
        this._calcularPrecosUnitarios(ingrediente);
        this.data.ingredientes.push(ingrediente);
        this.saveData();
        return ingrediente;
    }

    updateIngrediente(id, dados) {
        const index = this.data.ingredientes.findIndex(i => i.id === id);
        if (index !== -1) {
            this.data.ingredientes[index] = { ...this.data.ingredientes[index], ...dados };
            this._calcularPrecosUnitarios(this.data.ingredientes[index]);
            this.saveData();
        }
    }

    deleteIngrediente(id) {
        this.data.ingredientes = this.data.ingredientes.filter(i => i.id !== id);
        this.saveData();
    }

    _calcularPrecosUnitarios(ing) {
        const qtd = parseFloat(ing.quantidadeComprada) || 1;
        const preco = parseFloat(ing.precoPago) || 0;
        const perda = parseFloat(ing.perda) || 0;
        const qtdEfetiva = qtd * (1 - perda / 100);
        ing.precoPorUnidade = qtdEfetiva > 0 ? preco / qtdEfetiva : 0;

        const unidade = (ing.unidade || '').toLowerCase();
        if (unidade === 'kg' || unidade === 'kilo' || unidade === 'quilo') {
            ing.precoPorGrama = ing.precoPorUnidade / 1000;
            ing.precoPorKg = ing.precoPorUnidade;
            ing.precoPorMl = 0;
            ing.precoPorLitro = 0;
        } else if (unidade === 'g' || unidade === 'grama' || unidade === 'gramas') {
            ing.precoPorGrama = ing.precoPorUnidade;
            ing.precoPorKg = ing.precoPorUnidade * 1000;
            ing.precoPorMl = 0;
            ing.precoPorLitro = 0;
        } else if (unidade === 'ml' || unidade === 'mililitro') {
            ing.precoPorMl = ing.precoPorUnidade;
            ing.precoPorLitro = ing.precoPorUnidade * 1000;
            ing.precoPorGrama = 0;
            ing.precoPorKg = 0;
        } else if (unidade === 'l' || unidade === 'litro') {
            ing.precoPorMl = ing.precoPorUnidade / 1000;
            ing.precoPorLitro = ing.precoPorUnidade;
            ing.precoPorGrama = 0;
            ing.precoPorKg = 0;
        } else {
            ing.precoPorGrama = 0;
            ing.precoPorKg = 0;
            ing.precoPorMl = 0;
            ing.precoPorLitro = 0;
        }
    }

    // Receitas
    addReceita(receita) {
        receita.id = Date.now().toString();
        receita.createdAt = new Date().toISOString();
        receita.ingredientes = receita.ingredientes || [];
        this._calcularCustosReceita(receita);
        this.data.receitas.push(receita);
        this.saveData();
        return receita;
    }

    updateReceita(id, dados) {
        const index = this.data.receitas.findIndex(r => r.id === id);
        if (index !== -1) {
            this.data.receitas[index] = { ...this.data.receitas[index], ...dados };
            this._calcularCustosReceita(this.data.receitas[index]);
            this.saveData();
        }
    }

    deleteReceita(id) {
        this.data.receitas = this.data.receitas.filter(r => r.id !== id);
        this.saveData();
    }

    _calcularCustosReceita(receita) {
        let custoTotal = 0;
        if (receita.ingredientes) {
            receita.ingredientes.forEach(ingReceita => {
                const ingCadastrado = this.data.ingredientes.find(i => i.id === ingReceita.ingredienteId);
                if (ingCadastrado) {
                    const quantidadeUsada = parseFloat(ingReceita.quantidade) || 0;
                    const unidadeUsada = (ingReceita.unidadeUsada || '').toLowerCase();

                    let custoIngrediente = 0;
                    if (unidadeUsada === 'g' || unidadeUsada === 'grama') {
                        custoIngrediente = (ingCadastrado.precoPorGrama || 0) * quantidadeUsada;
                    } else if (unidadeUsada === 'kg') {
                        custoIngrediente = (ingCadastrado.precoPorKg || 0) * quantidadeUsada;
                    } else if (unidadeUsada === 'ml') {
                        custoIngrediente = (ingCadastrado.precoPorMl || 0) * quantidadeUsada;
                    } else if (unidadeUsada === 'l' || unidadeUsada === 'litro') {
                        custoIngrediente = (ingCadastrado.precoPorLitro || 0) * quantidadeUsada;
                    } else {
                        custoIngrediente = (ingCadastrado.precoPorUnidade || 0) * quantidadeUsada;
                    }
                    ingReceita.custo = custoIngrediente;
                    ingReceita.nome = ingCadastrado.nome;
                    custoTotal += custoIngrediente;
                }
            });
        }
        receita.custoTotal = custoTotal;
        const markup = parseFloat(receita.markup) || parseFloat(this.data.config.markupPadrao) || 2.5;
        receita.precoSugerido = custoTotal * markup;
        receita.precoArredondado = this._arredondarPreco(receita.precoSugerido);
        receita.margem = receita.precoArredondado - custoTotal;
        receita.lucro = receita.margem;
        receita.margemPercentual = receita.precoArredondado > 0 ? (receita.margem / receita.precoArredondado) * 100 : 0;
    }

    _arredondarPreco(preco) {
        if (preco <= 0) return 0;
        const inteiro = Math.floor(preco);
        const decimal = preco - inteiro;
        if (decimal <= 0.10) return inteiro + 0.90;
        if (decimal <= 0.40) return inteiro + 0.90;
        if (decimal <= 0.60) return inteiro + 0.90;
        return inteiro + 0.90;
    }

    // Vendas
    registrarVenda(venda) {
        venda.id = Date.now().toString();
        venda.data = new Date().toISOString();
        this.data.vendas.push(venda);

        // Atualizar caixa
        const valor = parseFloat(venda.valor) || 0;
        this.data.caixa.entradas.push({
            id: venda.id,
            tipo: 'venda',
            valor: valor,
            formaPagamento: venda.formaPagamento,
            descricao: 'Venda: ' + (venda.produtoNome || 'Produto'),
            data: venda.data
        });
        this.data.caixa.saldoAtual += valor;

        // Registrar saída de estoque (baixa)
        if (venda.receitaId) {
            const receita = this.data.receitas.find(r => r.id === venda.receitaId);
            if (receita && receita.ingredientes) {
                receita.ingredientes.forEach(ingReceita => {
                    this.data.estoqueMovimentacoes.push({
                        id: Date.now().toString() + Math.random(),
                        ingredienteId: ingReceita.ingredienteId,
                        tipo: 'saida',
                        quantidade: parseFloat(ingReceita.quantidade) || 0,
                        unidade: ingReceita.unidadeUsada || 'un',
                        motivo: 'Venda: ' + venda.id,
                        data: venda.data,
                        receitaId: venda.receitaId
                    });
                });
            }
        }

        this.saveData();
        return venda;
    }

    // Compras
    addCompra(compra) {
        compra.id = Date.now().toString();
        compra.data = new Date().toISOString();
        this.data.compras.push(compra);

        // Registrar entrada de estoque
        this.data.estoqueMovimentacoes.push({
            id: Date.now().toString() + Math.random(),
            ingredienteId: compra.ingredienteId,
            tipo: 'entrada',
            quantidade: parseFloat(compra.quantidade) || 0,
            unidade: compra.unidade || 'un',
            motivo: 'Compra: ' + (compra.nota || compra.id),
            data: compra.data,
            valor: parseFloat(compra.valor) || 0,
            fornecedor: compra.fornecedor || ''
        });

        // Atualizar custo do ingrediente
        const ing = this.data.ingredientes.find(i => i.id === compra.ingredienteId);
        if (ing) {
            const novaQtd = (parseFloat(ing.quantidadeComprada) || 0) + (parseFloat(compra.quantidade) || 0);
            const novoPreco = (parseFloat(compra.valor) || 0);
            // Média ponderada simples
            ing.precoPago = ((parseFloat(ing.precoPago) || 0) * (parseFloat(ing.quantidadeComprada) || 1) + novoPreco) / (novaQtd || 1);
            ing.quantidadeComprada = novaQtd;
            this._calcularPrecosUnitarios(ing);
        }

        // Atualizar caixa (saída)
        this.data.caixa.saidas.push({
            id: compra.id,
            tipo: 'compra',
            valor: parseFloat(compra.valor) || 0,
            descricao: 'Compra: ' + (compra.nota || ''),
            data: compra.data
        });
        this.data.caixa.saldoAtual -= (parseFloat(compra.valor) || 0);

        this.saveData();
        return compra;
    }

    // Caixa
    abrirCaixa(valorInicial) {
        this.data.caixa.abertura = parseFloat(valorInicial) || 0;
        this.data.caixa.saldoAtual = parseFloat(valorInicial) || 0;
        this.data.caixa.fechado = false;
        this.data.caixa.entradas = [];
        this.data.caixa.saidas = [];
        this.saveData();
    }

    fecharCaixa() {
        this.data.caixa.fechado = true;
        this.saveData();
    }

    // Dashboard - cálculos do dia
    getVendasHoje() {
        const hoje = new Date().toISOString().split('T')[0];
        return this.data.vendas.filter(v => v.data.startsWith(hoje));
    }

    getFaturamentoHoje() {
        return this.getVendasHoje().reduce((sum, v) => sum + (parseFloat(v.valor) || 0), 0);
    }

    getLucroHoje() {
        return this.getVendasHoje().reduce((sum, v) => {
            const receita = this.data.receitas.find(r => r.id === v.receitaId);
            if (receita) {
                return sum + (parseFloat(receita.margem) || 0);
            }
            return sum;
        }, 0);
    }

    getQuantidadeVendidaHoje() {
        return this.getVendasHoje().length;
    }

    // Estoque - quanto ainda pode ser produzido
    getProducaoPossivel(receitaId) {
        const receita = this.data.receitas.find(r => r.id === receitaId);
        if (!receita || !receita.ingredientes || receita.ingredientes.length === 0) return Infinity;

        let minProducoes = Infinity;
        receita.ingredientes.forEach(ingReceita => {
            const estoqueDisponivel = this.getEstoqueAtual(ingReceita.ingredienteId);
            const qtdNecessaria = parseFloat(ingReceita.quantidade) || 0;
            if (qtdNecessaria > 0) {
                const produzivel = Math.floor(estoqueDisponivel / qtdNecessaria);
                if (produzivel < minProducoes) minProducoes = produzivel;
            }
        });
        return minProducoes === Infinity ? 0 : minProducoes;
    }

    getEstoqueAtual(ingredienteId) {
        const entradas = this.data.estoqueMovimentacoes
            .filter(m => m.ingredienteId === ingredienteId && m.tipo === 'entrada')
            .reduce((sum, m) => sum + (parseFloat(m.quantidade) || 0), 0);
        const saidas = this.data.estoqueMovimentacoes
            .filter(m => m.ingredienteId === ingredienteId && m.tipo === 'saida')
            .reduce((sum, m) => sum + (parseFloat(m.quantidade) || 0), 0);
        return entradas - saidas;
    }

    // Backup
    exportarDados() {
        return JSON.stringify(this.data, null, 2);
    }

    importarDados(jsonString) {
        try {
            const dados = JSON.parse(jsonString);
            if (dados.config && dados.ingredientes && dados.receitas) {
                this.data = dados;
                this.data.config = { ...DEFAULT_CONFIG, ...this.data.config };
                this.saveData();
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    // Relatórios
    getRelatorio(periodo) {
        const agora = new Date();
        let dataInicio;
        switch (periodo) {
            case 'hoje':
                dataInicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
                break;
            case 'semana':
                dataInicio = new Date(agora);
                dataInicio.setDate(agora.getDate() - 7);
                break;
            case 'mes':
                dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
                break;
            case 'ano':
                dataInicio = new Date(agora.getFullYear(), 0, 1);
                break;
            default:
                dataInicio = new Date(0);
        }
        const dataInicioStr = dataInicio.toISOString();
        const vendasPeriodo = this.data.vendas.filter(v => v.data >= dataInicioStr);
        const faturamento = vendasPeriodo.reduce((s, v) => s + (parseFloat(v.valor) || 0), 0);
        const lucro = vendasPeriodo.reduce((s, v) => {
            const r = this.data.receitas.find(rec => rec.id === v.receitaId);
            return s + (r ? (parseFloat(r.margem) || 0) : 0);
        }, 0);
        return {
            periodo,
            quantidadeVendas: vendasPeriodo.length,
            faturamento,
            lucro,
            cmv: faturamento - lucro,
            margemPercentual: faturamento > 0 ? (lucro / faturamento) * 100 : 0,
            vendas: vendasPeriodo
        };
    }

    // Listeners para atualização da UI
    addListener(fn) {
        this.listeners.push(fn);
    }

    notifyListeners() {
        this.listeners.forEach(fn => fn(this.data));
    }

    showToast(message, type = 'info') {
        // Será sobrescrito pela UI
        if (window._showToast) window._showToast(message, type);
    }
}

// Instância global
const state = new StateManager();

// ===================== UI CONTROLLER =====================
class UIController {
    constructor() {
        this.currentPage = 'dashboard';
        this.currentModalCallback = null;
        this.init();
    }

    init() {
        // Esconder splash screen após carregamento
        setTimeout(() => {
            document.getElementById('splashScreen').classList.add('hidden');
            document.getElementById('appContainer').style.display = 'flex';
            this.renderPage('dashboard');
            this.setupEventListeners();
            this.applyTheme();
        }, 1200);

        // Registrar listener para atualizações
        state.addListener(() => {
            if (this.currentPage === 'dashboard') this.renderDashboard();
        });

        // Toast global
        window._showToast = (message, type) => this.showToast(message, type);
    }

    setupEventListeners() {
        // Navegação inferior
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.page;
                if (page === 'mais') {
                    this.toggleSidebar();
                } else {
                    this.navigateTo(page);
                }
            });
        });

        // Sidebar
        document.getElementById('sidebarOverlay').addEventListener('click', () => this.toggleSidebar(false));
        document.getElementById('menuToggle').addEventListener('click', () => this.toggleSidebar());

        // Tema
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());

        // FAB
        document.getElementById('fabButton').addEventListener('click', () => this.handleFabClick());

        // Fechar modal
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeModal();
        });
    }

    navigateTo(page) {
        this.currentPage = page;
        this.renderPage(page);
        this.updateActiveNav(page);
        this.updateFabButton(page);
        document.getElementById('headerTitle').textContent = this.getPageTitle(page);
        document.getElementById('mainContent').scrollTop = 0;
        if (document.getElementById('sidebar').classList.contains('open')) {
            this.toggleSidebar(false);
        }
    }

    getPageTitle(page) {
        const titles = {
            'dashboard': 'Dashboard',
            'vendas': 'Modo Festa 🎉',
            'estoque': 'Estoque',
            'receitas': 'Receitas',
            'ingredientes': 'Ingredientes',
            'compras': 'Compras',
            'caixa': 'Caixa',
            'relatorios': 'Relatórios',
            'configuracoes': 'Configurações',
            'backup': 'Backup',
            'markup': 'Calculadora Markup'
        };
        return titles[page] || page;
    }

    updateActiveNav(page) {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === page);
        });
        // Atualizar sidebar também
        document.querySelectorAll('#sidebarMenu a').forEach(a => {
            a.classList.toggle('active', a.dataset.page === page);
        });
    }

    updateFabButton(page) {
        const fab = document.getElementById('fabButton');
        const pagesWithFab = ['ingredientes', 'receitas', 'compras', 'vendas'];
        if (pagesWithFab.includes(page)) {
            fab.style.display = 'flex';
        } else {
            fab.style.display = 'none';
        }
    }

    handleFabClick() {
        switch (this.currentPage) {
            case 'ingredientes':
                this.showIngredienteForm();
                break;
            case 'receitas':
                this.showReceitaForm();
                break;
            case 'compras':
                this.showCompraForm();
                break;
            case 'vendas':
                // No modo festa, FAB pode abrir vendas rápidas ou lista
                this.showVendaRapidaModal();
                break;
        }
    }

    renderPage(page) {
        const main = document.getElementById('mainContent');
        this.currentPage = page;
        switch (page) {
            case 'dashboard': this.renderDashboard(); break;
            case 'vendas': this.renderModoFesta(); break;
            case 'estoque': this.renderEstoque(); break;
            case 'receitas': this.renderReceitas(); break;
            case 'ingredientes': this.renderIngredientes(); break;
            case 'compras': this.renderCompras(); break;
            case 'caixa': this.renderCaixa(); break;
            case 'relatorios': this.renderRelatorios(); break;
            case 'configuracoes': this.renderConfiguracoes(); break;
            case 'backup': this.renderBackup(); break;
            case 'markup': this.renderMarkup(); break;
            default: main.innerHTML = '<div class="empty-state"><div class="empty-icon">📄</div><h3>Página não encontrada</h3></div>';
        }
        this.renderSidebar();
    }

    // ===================== SIDEBAR =====================
    renderSidebar() {
        const menu = document.getElementById('sidebarMenu');
        const items = [
            { page: 'dashboard', icon: '📊', label: 'Dashboard' },
            { page: 'vendas', icon: '🎉', label: 'Modo Festa' },
            { page: 'estoque', icon: '📦', label: 'Estoque' },
            { page: 'receitas', icon: '📋', label: 'Receitas' },
            { page: 'ingredientes', icon: '🥩', label: 'Ingredientes' },
            { page: 'compras', icon: '🛒', label: 'Compras' },
            { page: 'caixa', icon: '💰', label: 'Caixa' },
            { page: 'markup', icon: '🔢', label: 'Calculadora Markup' },
            { page: 'relatorios', icon: '📈', label: 'Relatórios' },
            { page: 'configuracoes', icon: '⚙️', label: 'Configurações' },
            { page: 'backup', icon: '💾', label: 'Backup' }
        ];
        menu.innerHTML = items.map(item => `
            <li><a data-page="${item.page}" class="${this.currentPage === item.page ? 'active' : ''}">
                <span class="menu-icon">${item.icon}</span> ${item.label}
            </a></li>
        `).join('');

        // Event listeners sidebar
        menu.querySelectorAll('a').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateTo(a.dataset.page);
            });
        });
    }

    toggleSidebar(forceOpen = null) {
        const sidebar = document.getElementById('sidebar');
        if (forceOpen === true) sidebar.classList.add('open');
        else if (forceOpen === false) sidebar.classList.remove('open');
        else sidebar.classList.toggle('open');
    }

    // ===================== TEMA =====================
    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        state.updateConfig('tema', next);
        this.updateThemeIcons(next);
    }

    applyTheme() {
        const tema = state.getData().config.tema || 'light';
        document.documentElement.setAttribute('data-theme', tema);
        this.updateThemeIcons(tema);
    }

    updateThemeIcons(tema) {
        const sunIcon = document.querySelector('.sun-icon');
        const moonIcon = document.querySelector('.moon-icon');
        if (tema === 'dark') {
            if (sunIcon) sunIcon.style.display = 'none';
            if (moonIcon) moonIcon.style.display = 'block';
        } else {
            if (sunIcon) sunIcon.style.display = 'block';
            if (moonIcon) moonIcon.style.display = 'none';
        }
    }

    // ===================== TOAST =====================
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 3000);
    }

    // ===================== MODAL =====================
    openModal(htmlContent, callback = null) {
        document.getElementById('modalContent').innerHTML = htmlContent;
        document.getElementById('modalOverlay').style.display = 'flex';
        this.currentModalCallback = callback;

        // Adicionar evento de fechar no botão close
        const closeBtn = document.getElementById('modalContent').querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }
    }

    closeModal(result = null) {
        document.getElementById('modalOverlay').style.display = 'none';
        if (this.currentModalCallback) {
            this.currentModalCallback(result);
            this.currentModalCallback = null;
        }
    }

    // ===================== DASHBOARD =====================
    renderDashboard() {
        const data = state.getData();
        const vendasHoje = state.getVendasHoje();
        const faturamento = state.getFaturamentoHoje();
        const lucro = state.getLucroHoje();
        const qtdVendida = state.getQuantidadeVendidaHoje();
        const totalReceitas = data.receitas.length;
        const totalIngredientes = data.ingredientes.length;
        const saldoCaixa = data.caixa.saldoAtual || 0;

        const main = document.getElementById('mainContent');
        main.innerHTML = `
            <div class="dashboard-grid">
                <div class="dashboard-card" onclick="ui.navigateTo('vendas')">
                    <div class="dc-icon">💰</div>
                    <div class="dc-value">${this.formatarMoeda(faturamento)}</div>
                    <div class="dc-label">Faturamento Hoje</div>
                </div>
                <div class="dashboard-card">
                    <div class="dc-icon">📈</div>
                    <div class="dc-value">${this.formatarMoeda(lucro)}</div>
                    <div class="dc-label">Lucro Hoje</div>
                </div>
                <div class="dashboard-card">
                    <div class="dc-icon">🛒</div>
                    <div class="dc-value">${qtdVendida}</div>
                    <div class="dc-label">Vendas Hoje</div>
                </div>
                <div class="dashboard-card" onclick="ui.navigateTo('caixa')">
                    <div class="dc-icon">🏦</div>
                    <div class="dc-value">${this.formatarMoeda(saldoCaixa)}</div>
                    <div class="dc-label">Saldo Caixa</div>
                </div>
                <div class="dashboard-card" onclick="ui.navigateTo('receitas')">
                    <div class="dc-icon">📋</div>
                    <div class="dc-value">${totalReceitas}</div>
                    <div class="dc-label">Receitas</div>
                </div>
                <div class="dashboard-card" onclick="ui.navigateTo('ingredientes')">
                    <div class="dc-icon">🥩</div>
                    <div class="dc-value">${totalIngredientes}</div>
                    <div class="dc-label">Ingredientes</div>
                </div>
            </div>

            <div class="card mt-16">
                <div class="card-header">
                    <span class="card-title">📊 Vendas Recentes</span>
                </div>
                ${this.renderGraficoVendas()}
            </div>

            <div class="card">
                <div class="card-header">
                    <span class="card-title">🏆 Produtos Mais Vendidos</span>
                </div>
                ${this.renderTopProdutos()}
            </div>

            <div class="card">
                <div class="card-header">
                    <span class="card-title">⚠️ Alertas de Estoque</span>
                </div>
                ${this.renderAlertasEstoque()}
            </div>
        `;
        document.getElementById('headerTitle').textContent = 'Dashboard';
    }

    renderGraficoVendas() {
        const ultimos7dias = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dataStr = d.toISOString().split('T')[0];
            const vendasDia = state.getData().vendas.filter(v => v.data.startsWith(dataStr));
            const total = vendasDia.reduce((s, v) => s + (parseFloat(v.valor) || 0), 0);
            ultimos7dias.push({ data: dataStr.slice(5), total, label: d.toLocaleDateString('pt-BR', { weekday: 'short' }) });
        }
        const maxValor = Math.max(...ultimos7dias.map(d => d.total), 1);
        return `
            <div class="chart-bar-container">
                ${ultimos7dias.map(d => `
                    <div style="flex:1;text-align:center;">
                        <div class="chart-bar" style="height:${(d.total/maxValor)*100}%;" title="${this.formatarMoeda(d.total)}"></div>
                        <div class="chart-bar-label">${d.label}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderTopProdutos() {
        const vendas = state.getData().vendas;
        const contagem = {};
        vendas.forEach(v => {
            const nome = v.produtoNome || 'Produto';
            contagem[nome] = (contagem[nome] || 0) + 1;
        });
        const sorted = Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, 5);
        if (sorted.length === 0) return '<p class="text-center font-sm" style="color:var(--text-secondary)">Nenhuma venda registrada.</p>';
        return sorted.map(([nome, qtd], i) => `
            <div class="flex-between mb-8">
                <span>${i+1}. ${nome}</span>
                <span class="badge badge-info">${qtd} vendas</span>
            </div>
        `).join('');
    }

    renderAlertasEstoque() {
        const receitas = state.getData().receitas;
        const alertas = [];
        receitas.forEach(r => {
            const produzivel = state.getProducaoPossivel(r.id);
            if (produzivel < 10 && produzivel >= 0) {
                alertas.push({ nome: r.nome, produzivel });
            }
        });
        if (alertas.length === 0) return '<p class="text-center font-sm" style="color:var(--success)">✅ Estoque suficiente para todos os produtos.</p>';
        return alertas.map(a => `
            <div class="alert alert-warning">
                ⚠️ <strong>${a.nome}</strong>: Apenas ${a.produzivel} unidade(s) podem ser produzidas.
            </div>
        `).join('');
    }

    // ===================== MODO FESTA (VENDAS) =====================
    renderModoFesta() {
        const receitas = state.getData().receitas;
        const main = document.getElementById('mainContent');
        if (receitas.length === 0) {
            main.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎉</div>
                    <h3>Nenhum produto cadastrado</h3>
                    <p>Cadastre receitas primeiro para usar o Modo Festa.</p>
                    <button class="btn btn-accent mt-16" onclick="ui.navigateTo('receitas')">Cadastrar Receitas</button>
                </div>
            `;
        } else {
            main.innerHTML = `
                <p class="font-sm mb-16" style="color:var(--text-secondary)">Toque no produto para vender rapidamente! ⚡</p>
                <div class="festa-grid">
                    ${receitas.map(r => `
                        <button class="festa-btn" onclick="ui.venderProduto('${r.id}')" title="${r.nome}">
                            <span class="festa-emoji">${r.emoji || '🍔'}</span>
                            <span>${r.nome}</span>
                            <span class="festa-price">${this.formatarMoeda(r.precoArredondado)}</span>
                            ${state.getProducaoPossivel(r.id) < 5 ? '<span class="badge badge-warning">Baixo estoque</span>' : ''}
                        </button>
                    `).join('')}
                </div>
            `;
        }
        document.getElementById('headerTitle').textContent = 'Modo Festa 🎉';
    }

    venderProduto(receitaId) {
        const receita = state.getData().receitas.find(r => r.id === receitaId);
        if (!receita) return;

        const produzivel = state.getProducaoPossivel(receitaId);
        if (produzivel <= 0) {
            this.showToast('Estoque insuficiente para este produto!', 'error');
            return;
        }

        this.openModal(`
            <div class="modal-header">
                <h2 class="modal-title">Vender: ${receita.emoji || ''} ${receita.nome}</h2>
                <button class="modal-close">✕</button>
            </div>
            <p style="text-align:center;font-size:36px;font-weight:700;color:var(--accent-dark);margin:16px 0;">
                ${this.formatarMoeda(receita.precoArredondado)}
            </p>
            <p style="text-align:center;color:var(--text-secondary);margin-bottom:16px;">
                Selecione a forma de pagamento:
            </p>
            <div class="pagamento-options">
                <button class="pagamento-btn" data-pagamento="Pix" onclick="ui.confirmarVenda('${receitaId}', 'Pix')">
                    <span class="pay-icon">📱</span> Pix
                </button>
                <button class="pagamento-btn" data-pagamento="Dinheiro" onclick="ui.confirmarVenda('${receitaId}', 'Dinheiro')">
                    <span class="pay-icon">💵</span> Dinheiro
                </button>
                <button class="pagamento-btn" data-pagamento="Cartão" onclick="ui.confirmarVenda('${receitaId}', 'Cartão')">
                    <span class="pay-icon">💳</span> Cartão
                </button>
            </div>
            <p style="text-align:center;font-size:12px;color:var(--text-secondary);">
                📦 Podem ser produzidos: <strong>${produzivel}</strong>
            </p>
        `);
    }

    confirmarVenda(receitaId, formaPagamento) {
        const receita = state.getData().receitas.find(r => r.id === receitaId);
        if (!receita) return;
        const venda = {
            receitaId: receita.id,
            produtoNome: receita.nome,
            valor: receita.precoArredondado,
            formaPagamento: formaPagamento,
            quantidade: 1
        };
        state.registrarVenda(venda);
        this.closeModal();
        this.showToast(`✅ Vendido: ${receita.nome} - ${this.formatarMoeda(receita.precoArredondado)} (${formaPagamento})`, 'success');
        this.renderModoFesta();
        // Vibrar se disponível
        if (navigator.vibrate) navigator.vibrate(50);
    }

    showVendaRapidaModal() {
        // Venda rápida personalizada
        this.openModal(`
            <div class="modal-header">
                <h2 class="modal-title">Venda Rápida</h2>
                <button class="modal-close">✕</button>
            </div>
            <div class="form-group">
                <label class="form-label">Valor (R$)</label>
                <input type="number" class="form-input" id="vendaRapidaValor" placeholder="0.00" step="0.01" min="0">
            </div>
            <div class="form-group">
                <label class="form-label">Descrição</label>
                <input type="text" class="form-input" id="vendaRapidaDesc" placeholder="Ex: Bebida, Doce...">
            </div>
            <div class="pagamento-options">
                <button class="pagamento-btn" onclick="ui.finalizarVendaRapida('Pix')">📱 Pix</button>
                <button class="pagamento-btn" onclick="ui.finalizarVendaRapida('Dinheiro')">💵 Dinheiro</button>
                <button class="pagamento-btn" onclick="ui.finalizarVendaRapida('Cartão')">💳 Cartão</button>
            </div>
        `);
    }

    finalizarVendaRapida(formaPagamento) {
        const valor = parseFloat(document.getElementById('vendaRapidaValor')?.value) || 0;
        const desc = document.getElementById('vendaRapidaDesc')?.value || 'Venda rápida';
        if (valor <= 0) {
            this.showToast('Informe um valor válido!', 'error');
            return;
        }
        const venda = {
            receitaId: null,
            produtoNome: desc,
            valor: valor,
            formaPagamento: formaPagamento,
            quantidade: 1
        };
        state.registrarVenda(venda);
        this.closeModal();
        this.showToast(`✅ Venda registrada: ${this.formatarMoeda(valor)}`, 'success');
    }

    // ===================== ESTOQUE =====================
    renderEstoque() {
        const data = state.getData();
        const ingredientes = data.ingredientes;
        const main = document.getElementById('mainContent');

        let html = '<div class="search-bar"><input type="text" class="form-input" id="estoqueSearch" placeholder="🔍 Buscar ingrediente..." oninput="ui.renderEstoque()"></div>';
        const searchTerm = document.getElementById('estoqueSearch')?.value?.toLowerCase() || '';

        const filtrados = ingredientes.filter(i => i.nome.toLowerCase().includes(searchTerm));

        if (filtrados.length === 0) {
            html += '<div class="empty-state"><div class="empty-icon">📦</div><h3>Nenhum ingrediente encontrado</h3></div>';
        } else {
            html += filtrados.map(ing => {
                const estoqueAtual = state.getEstoqueAtual(ing.id);
                const statusEstoque = estoqueAtual <= 0 ? 'badge-danger' : estoqueAtual < 10 ? 'badge-warning' : 'badge-success';
                return `
                    <div class="card">
                        <div class="flex-between">
                            <div>
                                <strong>${ing.nome}</strong>
                                <span class="tag">${ing.categoria || 'Geral'}</span>
                            </div>
                            <span class="badge ${statusEstoque}">${estoqueAtual.toFixed(2)} ${ing.unidade || 'un'}</span>
                        </div>
                        <div class="progress-bar mt-8">
                            <div class="progress-fill" style="width:${Math.min((estoqueAtual/(parseFloat(ing.quantidadeComprada)||1))*100,100)}%"></div>
                        </div>
                        <div class="font-sm mt-8" style="color:var(--text-secondary)">
                            Preço/un: ${this.formatarMoeda(ing.precoPorUnidade)} | Estoque inicial: ${ing.quantidadeComprada} ${ing.unidade || 'un'}
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Receitas - quanto pode ser produzido
        html += '<h3 class="mt-16 mb-8">📋 Capacidade de Produção</h3>';
        data.receitas.forEach(r => {
            const prod = state.getProducaoPossivel(r.id);
            html += `
                <div class="card">
                    <div class="flex-between">
                        <span>${r.emoji || '🍔'} <strong>${r.nome}</strong></span>
                        <span class="badge ${prod < 5 ? 'badge-danger' : prod < 20 ? 'badge-warning' : 'badge-success'}">${prod === Infinity ? '∞' : prod} un</span>
                    </div>
                </div>
            `;
        });

        main.innerHTML = html;
        document.getElementById('headerTitle').textContent = 'Estoque';
    }

    // ===================== RECEITAS =====================
    renderReceitas() {
        const receitas = state.getData().receitas;
        const main = document.getElementById('mainContent');
        if (receitas.length === 0) {
            main.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <h3>Nenhuma receita cadastrada</h3>
                    <p>Toque no botão + para cadastrar sua primeira receita.</p>
                </div>
            `;
        } else {
            main.innerHTML = receitas.map(r => `
                <div class="card">
                    <div class="flex-between">
                        <h3>${r.emoji || '🍔'} ${r.nome}</h3>
                        <div>
                            <button class="btn btn-sm btn-outline" onclick="ui.showReceitaForm('${r.id}')">✏️</button>
                            <button class="btn btn-sm btn-danger" onclick="ui.deleteReceita('${r.id}')">🗑️</button>
                        </div>
                    </div>
                    <div class="card-row mt-8">
                        <div class="card-mini"><div class="mini-value">${this.formatarMoeda(r.custoTotal)}</div><div class="mini-label">Custo</div></div>
                        <div class="card-mini"><div class="mini-value">${this.formatarMoeda(r.precoArredondado)}</div><div class="mini-label">Preço</div></div>
                        <div class="card-mini"><div class="mini-value">${this.formatarMoeda(r.margem)}</div><div class="mini-label">Margem</div></div>
                        <div class="card-mini"><div class="mini-value">${(r.margemPercentual||0).toFixed(1)}%</div><div class="mini-label">% Margem</div></div>
                    </div>
                    <p class="font-sm mt-8" style="color:var(--text-secondary)">Ingredientes: ${(r.ingredientes||[]).map(i=>i.nome||'?').join(', ') || 'Nenhum'}</p>
                    <p class="font-sm" style="color:var(--text-secondary)">Produção possível: <strong>${state.getProducaoPossivel(r.id)}</strong> unidades</p>
                </div>
            `).join('');
        }
        document.getElementById('headerTitle').textContent = 'Receitas';
        document.getElementById('fabButton').style.display = 'flex';
    }

    showReceitaForm(id = null) {
        const receita = id ? state.getData().receitas.find(r => r.id === id) : null;
        const ingredientes = state.getData().ingredientes;
        const title = receita ? 'Editar Receita' : 'Nova Receita';

        let ingredientesHTML = '';
        if (receita && receita.ingredientes) {
            receita.ingredientes.forEach((ing, idx) => {
                ingredientesHTML += this.renderIngredienteReceitaRow(ing, idx);
            });
        }

        this.openModal(`
            <div class="modal-header">
                <h2 class="modal-title">${title}</h2>
                <button class="modal-close">✕</button>
            </div>
            <form id="receitaForm" onsubmit="event.preventDefault(); ui.salvarReceita('${id || ''}')">
                <div class="form-group">
                    <label class="form-label">Nome da Receita</label>
                    <input type="text" class="form-input" id="receitaNome" value="${receita?.nome || ''}" placeholder="Ex: Pão com Carne" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Emoji</label>
                    <input type="text" class="form-input" id="receitaEmoji" value="${receita?.emoji || '🍔'}" placeholder="🍔">
                </div>
                <div class="form-group">
                    <label class="form-label">Markup (multiplicador)</label>
                    <input type="number" class="form-input" id="receitaMarkup" value="${receita?.markup || state.getData().config.markupPadrao || 2.5}" step="0.1" min="1">
                </div>
                <h4 class="mb-8">Ingredientes</h4>
                <div id="ingredientesReceitaContainer">
                    ${ingredientesHTML || '<p class="font-sm" style="color:var(--text-secondary)">Nenhum ingrediente adicionado.</p>'}
                </div>
                <button type="button" class="btn btn-outline btn-sm mt-8 w-100" onclick="ui.adicionarIngredienteReceita()">+ Adicionar Ingrediente</button>
                <button type="submit" class="btn btn-accent btn-block mt-16">💾 Salvar Receita</button>
            </form>
        `);
    }

    renderIngredienteReceitaRow(ing, idx) {
        const ingredientes = state.getData().ingredientes;
        return `
            <div class="flex-between gap-8 mb-8 ingrediente-receita-row">
                <select class="form-select" style="flex:2" id="ingReceitaSelect_${idx}">
                    <option value="">Selecione...</option>
                    ${ingredientes.map(i => `<option value="${i.id}" ${i.id===ing.ingredienteId?'selected':''}>${i.nome}</option>`).join('')}
                </select>
                <input type="number" class="form-input" style="flex:1" placeholder="Qtd" value="${ing.quantidade||''}" step="0.001" id="ingReceitaQtd_${idx}">
                <select class="form-select" style="flex:1" id="ingReceitaUnidade_${idx}">
                    <option value="g" ${ing.unidadeUsada==='g'?'selected':''}>g</option>
                    <option value="kg" ${ing.unidadeUsada==='kg'?'selected':''}>kg</option>
                    <option value="ml" ${ing.unidadeUsada==='ml'?'selected':''}>ml</option>
                    <option value="l" ${ing.unidadeUsada==='l'?'selected':''}>l</option>
                    <option value="un" ${ing.unidadeUsada==='un'?'selected':''}>un</option>
                </select>
                <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">✕</button>
            </div>
        `;
    }

    adicionarIngredienteReceita() {
        const container = document.getElementById('ingredientesReceitaContainer');
        const idx = Date.now();
        const row = document.createElement('div');
        row.className = 'flex-between gap-8 mb-8 ingrediente-receita-row';
        row.innerHTML = this.renderIngredienteReceitaRow({}, idx).replace(/idx/g, idx);
        container.appendChild(row);
    }

    salvarReceita(id) {
        const nome = document.getElementById('receitaNome')?.value;
        const emoji = document.getElementById('receitaEmoji')?.value || '🍔';
        const markup = parseFloat(document.getElementById('receitaMarkup')?.value) || 2.5;

        if (!nome) {
            this.showToast('Nome da receita é obrigatório!', 'error');
            return;
        }

        const ingredientesRows = document.querySelectorAll('.ingrediente-receita-row');
        const ingredientes = [];
        ingredientesRows.forEach(row => {
            const select = row.querySelector('select');
            const qtdInput = row.querySelectorAll('input')[0];
            const unidadeSelect = row.querySelectorAll('select')[1];
            if (select && select.value) {
                ingredientes.push({
                    ingredienteId: select.value,
                    quantidade: parseFloat(qtdInput?.value) || 0,
                    unidadeUsada: unidadeSelect?.value || 'un'
                });
            }
        });

        const receitaData = { nome, emoji, markup, ingredientes };

        if (id) {
            state.updateReceita(id, receitaData);
            this.showToast('Receita atualizada! ✅', 'success');
        } else {
            state.addReceita(receitaData);
            this.showToast('Receita criada! ✅', 'success');
        }
        this.closeModal();
        this.renderReceitas();
    }

    deleteReceita(id) {
        if (confirm('Tem certeza que deseja excluir esta receita?')) {
            state.deleteReceita(id);
            this.showToast('Receita excluída.', 'warning');
            this.renderReceitas();
        }
    }

    // ===================== INGREDIENTES =====================
    renderIngredientes() {
        const ingredientes = state.getData().ingredientes;
        const main = document.getElementById('mainContent');
        const searchTerm = document.getElementById('ingredienteSearch')?.value?.toLowerCase() || '';

        let html = '<div class="search-bar"><input type="text" class="form-input" id="ingredienteSearch" placeholder="🔍 Buscar ingrediente..." oninput="ui.renderIngredientes()"></div>';
        const filtrados = ingredientes.filter(i => i.nome.toLowerCase().includes(searchTerm));

        if (filtrados.length === 0) {
            html += '<div class="empty-state"><div class="empty-icon">🥩</div><h3>Nenhum ingrediente</h3><p>Toque no + para cadastrar.</p></div>';
        } else {
            html += filtrados.map(ing => `
                <div class="card">
                    <div class="flex-between">
                        <div>
                            <strong>${ing.nome}</strong>
                            <span class="tag">${ing.categoria || 'Geral'}</span>
                        </div>
                        <div>
                            <button class="btn btn-sm btn-outline" onclick="ui.showIngredienteForm('${ing.id}')">✏️</button>
                            <button class="btn btn-sm btn-danger" onclick="ui.deleteIngrediente('${ing.id}')">🗑️</button>
                        </div>
                    </div>
                    <div class="card-row mt-8">
                        <div class="card-mini"><div class="mini-value">${this.formatarMoeda(ing.precoPago)}</div><div class="mini-label">Preço Pago</div></div>
                        <div class="card-mini"><div class="mini-value">${ing.quantidadeComprada} ${ing.unidade||'un'}</div><div class="mini-label">Qtd Comprada</div></div>
                        <div class="card-mini"><div class="mini-value">${this.formatarMoeda(ing.precoPorUnidade)}</div><div class="mini-label">Preço/Un</div></div>
                        <div class="card-mini"><div class="mini-value">${ing.perda||0}%</div><div class="mini-label">Perda</div></div>
                    </div>
                    ${ing.fornecedor ? `<p class="font-sm mt-8" style="color:var(--text-secondary)">Fornecedor: ${ing.fornecedor}</p>` : ''}
                    ${ing.observacoes ? `<p class="font-sm" style="color:var(--text-secondary)">Obs: ${ing.observacoes}</p>` : ''}
                </div>
            `).join('');
        }
        main.innerHTML = html;
        document.getElementById('headerTitle').textContent = 'Ingredientes';
        document.getElementById('fabButton').style.display = 'flex';
    }

    showIngredienteForm(id = null) {
        const ing = id ? state.getData().ingredientes.find(i => i.id === id) : null;
        const title = ing ? 'Editar Ingrediente' : 'Novo Ingrediente';
        this.openModal(`
            <div class="modal-header">
                <h2 class="modal-title">${title}</h2>
                <button class="modal-close">✕</button>
            </div>
            <form id="ingredienteForm" onsubmit="event.preventDefault(); ui.salvarIngrediente('${id || ''}')">
                <div class="form-group">
                    <label class="form-label">Nome *</label>
                    <input type="text" class="form-input" id="ingNome" value="${ing?.nome || ''}" required placeholder="Ex: Carne Moída">
                </div>
                <div class="form-group">
                    <label class="form-label">Categoria</label>
                    <input type="text" class="form-input" id="ingCategoria" value="${ing?.categoria || ''}" placeholder="Ex: Carnes, Laticínios...">
                </div>
                <div class="form-group">
                    <label class="form-label">Fornecedor</label>
                    <input type="text" class="form-input" id="ingFornecedor" value="${ing?.fornecedor || ''}" placeholder="Nome do fornecedor">
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div class="form-group">
                        <label class="form-label">Preço Pago (R$) *</label>
                        <input type="number" class="form-input" id="ingPrecoPago" value="${ing?.precoPago || ''}" step="0.01" required placeholder="0.00">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Qtd Comprada *</label>
                        <input type="number" class="form-input" id="ingQtdComprada" value="${ing?.quantidadeComprada || ''}" step="0.001" required placeholder="0">
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div class="form-group">
                        <label class="form-label">Unidade</label>
                        <select class="form-select" id="ingUnidade">
                            <option value="kg" ${ing?.unidade==='kg'?'selected':''}>Kg</option>
                            <option value="g" ${ing?.unidade==='g'?'selected':''}>g</option>
                            <option value="l" ${ing?.unidade==='l'?'selected':''}>Litro</option>
                            <option value="ml" ${ing?.unidade==='ml'?'selected':''}>ml</option>
                            <option value="un" ${ing?.unidade==='un'?'selected':''}>Unidade</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Perda (%)</label>
                        <input type="number" class="form-input" id="ingPerda" value="${ing?.perda || 0}" step="0.1" min="0" max="100">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Observações</label>
                    <textarea class="form-textarea" id="ingObservacoes">${ing?.observacoes || ''}</textarea>
                </div>
                <button type="submit" class="btn btn-accent btn-block mt-16">💾 Salvar Ingrediente</button>
            </form>
        `);
    }

    salvarIngrediente(id) {
        const dados = {
            nome: document.getElementById('ingNome')?.value,
            categoria: document.getElementById('ingCategoria')?.value,
            fornecedor: document.getElementById('ingFornecedor')?.value,
            precoPago: parseFloat(document.getElementById('ingPrecoPago')?.value) || 0,
            quantidadeComprada: parseFloat(document.getElementById('ingQtdComprada')?.value) || 0,
            unidade: document.getElementById('ingUnidade')?.value,
            perda: parseFloat(document.getElementById('ingPerda')?.value) || 0,
            observacoes: document.getElementById('ingObservacoes')?.value
        };
        if (!dados.nome) {
            this.showToast('Nome é obrigatório!', 'error');
            return;
        }
        if (id) {
            state.updateIngrediente(id, dados);
            this.showToast('Ingrediente atualizado! ✅', 'success');
        } else {
            state.addIngrediente(dados);
            this.showToast('Ingrediente cadastrado! ✅', 'success');
        }
        this.closeModal();
        this.renderIngredientes();
    }

    deleteIngrediente(id) {
        if (confirm('Tem certeza que deseja excluir este ingrediente?')) {
            state.deleteIngrediente(id);
            this.showToast('Ingrediente excluído.', 'warning');
            this.renderIngredientes();
        }
    }

    // ===================== COMPRAS =====================
    renderCompras() {
        const compras = state.getData().compras;
        const ingredientes = state.getData().ingredientes;
        const main = document.getElementById('mainContent');
        let html = '';
        if (compras.length === 0) {
            html += '<div class="empty-state"><div class="empty-icon">🛒</div><h3>Nenhuma compra registrada</h3></div>';
        } else {
            html += compras.slice().reverse().map(c => {
                const ing = ingredientes.find(i => i.id === c.ingredienteId);
                return `
                    <div class="card">
                        <div class="flex-between">
                            <strong>${ing?.nome || 'Ingrediente'}</strong>
                            <span class="badge badge-info">${new Date(c.data).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div class="card-row mt-8">
                            <span>Qtd: ${c.quantidade} ${c.unidade||'un'}</span>
                            <span>Valor: ${this.formatarMoeda(c.valor)}</span>
                            <span>Fornecedor: ${c.fornecedor || '-'}</span>
                        </div>
                        ${c.nota ? `<p class="font-sm mt-8">Nota: ${c.nota}</p>` : ''}
                    </div>
                `;
            }).join('');
        }
        main.innerHTML = html;
        document.getElementById('headerTitle').textContent = 'Compras';
        document.getElementById('fabButton').style.display = 'flex';
    }

    showCompraForm() {
        const ingredientes = state.getData().ingredientes;
        if (ingredientes.length === 0) {
            this.showToast('Cadastre ingredientes primeiro!', 'warning');
            return;
        }
        this.openModal(`
            <div class="modal-header">
                <h2 class="modal-title">Registrar Compra</h2>
                <button class="modal-close">✕</button>
            </div>
            <form onsubmit="event.preventDefault(); ui.salvarCompra()">
                <div class="form-group">
                    <label class="form-label">Ingrediente</label>
                    <select class="form-select" id="compraIngrediente" required>
                        <option value="">Selecione...</option>
                        ${ingredientes.map(i => `<option value="${i.id}">${i.nome}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Fornecedor</label>
                    <input type="text" class="form-input" id="compraFornecedor" placeholder="Nome do fornecedor">
                </div>
                <div class="form-group">
                    <label class="form-label">Nota Fiscal</label>
                    <input type="text" class="form-input" id="compraNota" placeholder="Número da nota">
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div class="form-group">
                        <label class="form-label">Quantidade</label>
                        <input type="number" class="form-input" id="compraQtd" step="0.001" required placeholder="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Unidade</label>
                        <select class="form-select" id="compraUnidade">
                            <option value="kg">Kg</option><option value="g">g</option><option value="l">Litro</option><option value="ml">ml</option><option value="un">Unidade</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Valor Total (R$)</label>
                    <input type="number" class="form-input" id="compraValor" step="0.01" required placeholder="0.00">
                </div>
                <button type="submit" class="btn btn-accent btn-block mt-16">💾 Registrar Compra</button>
            </form>
        `);
    }

    salvarCompra() {
        const compra = {
            ingredienteId: document.getElementById('compraIngrediente')?.value,
            fornecedor: document.getElementById('compraFornecedor')?.value,
            nota: document.getElementById('compraNota')?.value,
            quantidade: parseFloat(document.getElementById('compraQtd')?.value) || 0,
            unidade: document.getElementById('compraUnidade')?.value,
            valor: parseFloat(document.getElementById('compraValor')?.value) || 0
        };
        if (!compra.ingredienteId || compra.quantidade <= 0) {
            this.showToast('Preencha todos os campos obrigatórios!', 'error');
            return;
        }
        state.addCompra(compra);
        this.closeModal();
        this.showToast('Compra registrada e estoque atualizado! ✅', 'success');
        this.renderCompras();
    }

    // ===================== CAIXA =====================
    renderCaixa() {
        const caixa = state.getData().caixa;
        const main = document.getElementById('mainContent');
        const fechado = caixa.fechado;
        main.innerHTML = `
            <div class="card text-center">
                <div class="card-title">Saldo Atual</div>
                <div class="card-value">${this.formatarMoeda(caixa.saldoAtual || 0)}</div>
                <span class="badge ${fechado ? 'badge-danger' : 'badge-success'}">${fechado ? 'Caixa Fechado' : 'Caixa Aberto'}</span>
            </div>
            ${!fechado ? `
                <button class="btn btn-danger btn-block mt-8" onclick="ui.fecharCaixa()">🔒 Fechar Caixa</button>
            ` : `
                <div class="form-group mt-8">
                    <label class="form-label">Valor de Abertura</label>
                    <input type="number" class="form-input" id="aberturaValor" placeholder="0.00" step="0.01">
                </div>
                <button class="btn btn-accent btn-block mt-8" onclick="ui.abrirCaixa()">🔓 Abrir Caixa</button>
            `}
            <h3 class="mt-16 mb-8">📥 Entradas</h3>
            ${caixa.entradas.slice().reverse().slice(0,20).map(e => `
                <div class="card"><div class="flex-between"><span>${e.descricao}</span><span class="text-success">+${this.formatarMoeda(e.valor)}</span><span class="tag">${e.formaPagamento||''}</span></div></div>
            `).join('') || '<p class="font-sm text-center">Nenhuma entrada.</p>'}
            <h3 class="mt-16 mb-8">📤 Saídas</h3>
            ${caixa.saidas.slice().reverse().slice(0,20).map(s => `
                <div class="card"><div class="flex-between"><span>${s.descricao}</span><span class="text-danger">-${this.formatarMoeda(s.valor)}</span></div></div>
            `).join('') || '<p class="font-sm text-center">Nenhuma saída.</p>'}
        `;
        document.getElementById('headerTitle').textContent = 'Caixa';
    }

    abrirCaixa() {
        const valor = parseFloat(document.getElementById('aberturaValor')?.value) || 0;
        state.abrirCaixa(valor);
        this.showToast('Caixa aberto! ✅', 'success');
        this.renderCaixa();
    }

    fecharCaixa() {
        if (confirm('Tem certeza que deseja fechar o caixa? Esta ação não pode ser desfeita.')) {
            state.fecharCaixa();
            this.showToast('Caixa fechado! 🔒', 'warning');
            this.renderCaixa();
        }
    }

    // ===================== RELATÓRIOS =====================
    renderRelatorios() {
        const main = document.getElementById('mainContent');
        const periodos = ['hoje', 'semana', 'mes', 'ano'];
        main.innerHTML = `
            <div class="form-group">
                <label class="form-label">Período</label>
                <select class="form-select" id="relatorioPeriodo" onchange="ui.renderRelatorioDetalhado()">
                    <option value="hoje">Hoje</option>
                    <option value="semana">Última Semana</option>
                    <option value="mes">Este Mês</option>
                    <option value="ano">Este Ano</option>
                </select>
            </div>
            <div id="relatorioDetalhado"></div>
            <div class="flex-between gap-8 mt-16">
                <button class="btn btn-outline btn-sm" onclick="ui.exportarRelatorio('json')">📄 Exportar JSON</button>
                <button class="btn btn-outline btn-sm" onclick="ui.exportarRelatorio('csv')">📊 Exportar CSV</button>
                <button class="btn btn-outline btn-sm" onclick="window.print()">🖨️ Imprimir</button>
            </div>
        `;
        document.getElementById('headerTitle').textContent = 'Relatórios';
        this.renderRelatorioDetalhado();
    }

    renderRelatorioDetalhado() {
        const periodo = document.getElementById('relatorioPeriodo')?.value || 'hoje';
        const rel = state.getRelatorio(periodo);
        const div = document.getElementById('relatorioDetalhado');
        if (!div) return;
        div.innerHTML = `
            <div class="dashboard-grid">
                <div class="dashboard-card"><div class="dc-icon">💰</div><div class="dc-value">${this.formatarMoeda(rel.faturamento)}</div><div class="dc-label">Faturamento</div></div>
                <div class="dashboard-card"><div class="dc-icon">📈</div><div class="dc-value">${this.formatarMoeda(rel.lucro)}</div><div class="dc-label">Lucro</div></div>
                <div class="dashboard-card"><div class="dc-icon">🛒</div><div class="dc-value">${rel.quantidadeVendas}</div><div class="dc-label">Vendas</div></div>
                <div class="dashboard-card"><div class="dc-icon">📊</div><div class="dc-value">${rel.margemPercentual.toFixed(1)}%</div><div class="dc-label">Margem</div></div>
                <div class="dashboard-card"><div class="dc-icon">💸</div><div class="dc-value">${this.formatarMoeda(rel.cmv)}</div><div class="dc-label">CMV</div></div>
                <div class="dashboard-card"><div class="dc-icon">🎫</div><div class="dc-value">${this.formatarMoeda(rel.faturamento-rel.cmv)}</div><div class="dc-label">Contribuição</div></div>
            </div>
        `;
    }

    exportarRelatorio(formato) {
        const periodo = document.getElementById('relatorioPeriodo')?.value || 'hoje';
        const rel = state.getRelatorio(periodo);
        if (formato === 'json') {
            const blob = new Blob([JSON.stringify(rel, null, 2)], { type: 'application/json' });
            this.downloadBlob(blob, `relatorio_${periodo}.json`);
        } else if (formato === 'csv') {
            let csv = 'Data,Produto,Valor,Forma Pagamento\n';
            rel.vendas.forEach(v => {
                csv += `${v.data},${v.produtoNome},${v.valor},${v.formaPagamento}\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            this.downloadBlob(blob, `relatorio_${periodo}.csv`);
        }
        this.showToast('Relatório exportado! ✅', 'success');
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ===================== CONFIGURAÇÕES =====================
    renderConfiguracoes() {
        const config = state.getData().config;
        const main = document.getElementById('mainContent');
        main.innerHTML = `
            <div class="card">
                <div class="form-group">
                    <label class="form-label">Nome da Empresa/Barraca</label>
                    <input type="text" class="form-input" id="cfgEmpresa" value="${config.empresa || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Logo (Emoji)</label>
                    <input type="text" class="form-input" id="cfgLogo" value="${config.logo || '🍔'}">
                </div>
                <div class="form-group">
                    <label class="form-label">Markup Padrão</label>
                    <input type="number" class="form-input" id="cfgMarkup" value="${config.markupPadrao || 2.5}" step="0.1">
                </div>
                <div class="form-group">
                    <label class="form-label">Impostos (%)</label>
                    <input type="number" class="form-input" id="cfgImpostos" value="${config.impostos || 0}" step="0.1">
                </div>
                <button class="btn btn-accent btn-block" onclick="ui.salvarConfiguracoes()">💾 Salvar Configurações</button>
            </div>
            <div class="card mt-8">
                <h3 class="mb-8">Tema</h3>
                <button class="btn btn-outline w-100" onclick="ui.toggleTheme()">🌓 Alternar Tema Claro/Escuro</button>
            </div>
        `;
        document.getElementById('headerTitle').textContent = 'Configurações';
    }

    salvarConfiguracoes() {
        state.updateConfig('empresa', document.getElementById('cfgEmpresa')?.value || '');
        state.updateConfig('logo', document.getElementById('cfgLogo')?.value || '🍔');
        state.updateConfig('markupPadrao', parseFloat(document.getElementById('cfgMarkup')?.value) || 2.5);
        state.updateConfig('impostos', parseFloat(document.getElementById('cfgImpostos')?.value) || 0);
        this.showToast('Configurações salvas! ✅', 'success');
    }

    // ===================== BACKUP =====================
    renderBackup() {
        const main = document.getElementById('mainContent');
        main.innerHTML = `
            <div class="card">
                <h3 class="mb-8">💾 Exportar Dados</h3>
                <p class="font-sm mb-16" style="color:var(--text-secondary)">Faça backup de todos os dados do sistema.</p>
                <button class="btn btn-accent btn-block" onclick="ui.exportarBackup()">📤 Exportar JSON</button>
            </div>
            <div class="card mt-8">
                <h3 class="mb-8">📥 Importar Dados</h3>
                <p class="font-sm mb-8" style="color:var(--text-secondary)">Restaure um backup anterior. <strong>Atenção: isso substituirá todos os dados atuais!</strong></p>
                <input type="file" class="form-input" id="backupFile" accept=".json">
                <button class="btn btn-outline btn-block mt-8" onclick="ui.importarBackup()">📥 Restaurar Backup</button>
            </div>
            <div class="card mt-8">
                <h3 class="mb-8">⚠️ Limpar Dados</h3>
                <p class="font-sm mb-8" style="color:var(--danger)">Esta ação apagará todos os dados permanentemente.</p>
                <button class="btn btn-danger btn-block" onclick="ui.limparDados()">🗑️ Limpar Todos os Dados</button>
            </div>
        `;
        document.getElementById('headerTitle').textContent = 'Backup';
    }

    exportarBackup() {
        const dados = state.exportarDados();
        const blob = new Blob([dados], { type: 'application/json' });
        const dataStr = new Date().toISOString().split('T')[0];
        this.downloadBlob(blob, `festagest_backup_${dataStr}.json`);
        this.showToast('Backup exportado! ✅', 'success');
    }

    importarBackup() {
        const fileInput = document.getElementById('backupFile');
        const file = fileInput?.files[0];
        if (!file) {
            this.showToast('Selecione um arquivo JSON.', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const sucesso = state.importarDados(e.target.result);
            if (sucesso) {
                this.showToast('Dados restaurados com sucesso! ✅', 'success');
                this.renderDashboard();
            } else {
                this.showToast('Arquivo inválido!', 'error');
            }
        };
        reader.readAsText(file);
    }

    limparDados() {
        if (confirm('⚠️ Tem certeza? Todos os dados serão perdidos para sempre!')) {
            if (confirm('⚠️ Confirma novamente: Esta ação é IRREVERSÍVEL!')) {
                state.data = JSON.parse(JSON.stringify(INITIAL_DATA));
                state.saveData();
                this.showToast('Dados limpos.', 'warning');
                this.renderDashboard();
            }
        }
    }

    // ===================== CALCULADORA MARKUP =====================
    renderMarkup() {
        const main = document.getElementById('mainContent');
        main.innerHTML = `
            <div class="card">
                <h3 class="mb-8">🔢 Calculadora de Markup</h3>
                <div class="form-group">
                    <label class="form-label">Custo do Produto (R$)</label>
                    <input type="number" class="form-input" id="mkCusto" step="0.01" placeholder="0.00" oninput="ui.calcularMarkup()">
                </div>
                <div class="form-group">
                    <label class="form-label">Markup (Multiplicador)</label>
                    <input type="number" class="form-input" id="mkMarkup" value="2.5" step="0.1" oninput="ui.calcularMarkup()">
                </div>
                <div class="form-group">
                    <label class="form-label">Margem Desejada (%)</label>
                    <input type="number" class="form-input" id="mkMargem" step="0.1" placeholder="Calcular..." oninput="ui.calcularMarkupPorMargem()">
                </div>
            </div>
            <div class="card mt-8" id="mkResultados">
                <p class="font-sm text-center" style="color:var(--text-secondary)">Preencha os campos acima para calcular.</p>
            </div>
            <div class="card mt-8">
                <h3 class="mb-8">💡 Preços Arredondados</h3>
                <div id="mkArredondados"></div>
            </div>
        `;
        document.getElementById('headerTitle').textContent = 'Calculadora Markup';
    }

    calcularMarkup() {
        const custo = parseFloat(document.getElementById('mkCusto')?.value) || 0;
        const markup = parseFloat(document.getElementById('mkMarkup')?.value) || 2.5;
        const precoSugerido = custo * markup;
        const precoArredondado = state._arredondarPreco(precoSugerido);
        const lucro = precoArredondado - custo;
        const margem = precoArredondado > 0 ? (lucro / precoArredondado) * 100 : 0;

        document.getElementById('mkResultados').innerHTML = `
            <div class="card-row">
                <div class="card-mini"><div class="mini-value">${this.formatarMoeda(precoSugerido)}</div><div class="mini-label">Preço Sugerido</div></div>
                <div class="card-mini"><div class="mini-value">${this.formatarMoeda(precoArredondado)}</div><div class="mini-label">Preço Arredondado</div></div>
                <div class="card-mini"><div class="mini-value">${this.formatarMoeda(lucro)}</div><div class="mini-label">Lucro</div></div>
                <div class="card-mini"><div class="mini-value">${margem.toFixed(1)}%</div><div class="mini-label">Margem</div></div>
            </div>
        `;

        // Preços arredondados alternativos
        const alternativas = [24.90, 29.90, 34.90, 39.90, 49.90, 59.90, 69.90, 79.90, 89.90, 99.90];
        document.getElementById('mkArredondados').innerHTML = alternativas.map(p => {
            const l = p - custo;
            const m = p > 0 ? (l / p) * 100 : 0;
            return `<span class="tag" style="cursor:pointer" onclick="document.getElementById('mkMarkup').value='${(p/custo).toFixed(2)}';ui.calcularMarkup()">${this.formatarMoeda(p)} (${m.toFixed(0)}%)</span>`;
        }).join(' ');
    }

    calcularMarkupPorMargem() {
        const custo = parseFloat(document.getElementById('mkCusto')?.value) || 0;
        const margemDesejada = parseFloat(document.getElementById('mkMargem')?.value) || 0;
        if (custo > 0 && margemDesejada > 0 && margemDesejada < 100) {
            const markup = 1 / (1 - margemDesejada / 100);
            document.getElementById('mkMarkup').value = markup.toFixed(2);
            this.calcularMarkup();
        }
    }

    // ===================== UTILITÁRIOS =====================
    formatarMoeda(valor) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor || 0);
    }
}

// ===================== INICIALIZAÇÃO =====================
let ui;

document.addEventListener('DOMContentLoaded', () => {
    ui = new UIController();

    // Registrar Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('[SW] Registrado com sucesso:', registration.scope);
                })
                .catch(error => {
                    console.error('[SW] Falha ao registrar:', error);
                });
        });
    }

    // Expor ui globalmente para onclick handlers
    window.ui = ui;
    window.state = state;
});
