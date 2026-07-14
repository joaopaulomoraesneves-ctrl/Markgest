/* ============================================================
   FESTAGEST PRO - v1.3 (Correção total dos cálculos)
   ============================================================ */
const DEFAULT_CONFIG = {
    empresa: 'Minha Barraca', logo: '🍔', tema: 'light', moeda: 'BRL',
    idioma: 'pt-BR', markupPadrao: 2.5, impostos: 0, arredondamento: '0.90'
};

const INITIAL_DATA = {
    config: { ...DEFAULT_CONFIG }, ingredientes: [], receitas: [], vendas: [],
    compras: [], caixa: { abertura:0, entradas:[], saidas:[], saldoAtual:0, fechado:false },
    estoqueMovimentacoes: []
};

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
                parsed.config = { ...DEFAULT_CONFIG, ...parsed.config };
                return parsed;
            }
        } catch (e) { console.error(e); }
        return JSON.parse(JSON.stringify(INITIAL_DATA));
    }
    saveData() {
        localStorage.setItem('festagest_data', JSON.stringify(this.data));
        this.notifyListeners();
    }
    getData() { return this.data; }
    updateConfig(k, v) { this.data.config[k] = v; this.saveData(); }

    _calcularPrecosUnitarios(ing) {
        const qtd = parseFloat(ing.quantidadeComprada) || 1;
        const preco = parseFloat(ing.precoPago) || 0;
        const perda = parseFloat(ing.perda) || 0;
        const qtdEfetiva = qtd * (1 - perda / 100);
        ing.precoPorUnidade = qtdEfetiva > 0 ? preco / qtdEfetiva : 0;
        const u = (ing.unidade || '').toLowerCase();
        if (u === 'kg' || u === 'kilo') {
            ing.precoPorGrama = ing.precoPorUnidade / 1000;
            ing.precoPorKg = ing.precoPorUnidade;
        } else if (u === 'g' || u === 'grama') {
            ing.precoPorGrama = ing.precoPorUnidade;
            ing.precoPorKg = ing.precoPorUnidade * 1000;
        } else if (u === 'l' || u === 'litro') {
            ing.precoPorMl = ing.precoPorUnidade / 1000;
            ing.precoPorLitro = ing.precoPorUnidade;
        } else if (u === 'ml') {
            ing.precoPorMl = ing.precoPorUnidade;
            ing.precoPorLitro = ing.precoPorUnidade * 1000;
        } else {
            ing.precoPorGrama = ing.precoPorKg = ing.precoPorMl = ing.precoPorLitro = 0;
        }
    }

    addIngrediente(ing) {
        ing.id = Date.now().toString();
        ing.createdAt = new Date().toISOString();
        this._calcularPrecosUnitarios(ing);
        this.data.ingredientes.push(ing);
        this.saveData();
        return ing;
    }
    updateIngrediente(id, dados) {
        const idx = this.data.ingredientes.findIndex(i => i.id === id);
        if (idx !== -1) {
            this.data.ingredientes[idx] = { ...this.data.ingredientes[idx], ...dados };
            this._calcularPrecosUnitarios(this.data.ingredientes[idx]);
            this.saveData();
        }
    }
    deleteIngrediente(id) {
        this.data.ingredientes = this.data.ingredientes.filter(i => i.id !== id);
        this.saveData();
    }

    _calcularCustosReceita(receita) {
        let custo = 0;
        if (receita.ingredientes) {
            receita.ingredientes.forEach(ingR => {
                const ing = this.data.ingredientes.find(i => i.id === ingR.ingredienteId);
                if (ing) {
                    const qtd = parseFloat(ingR.quantidade) || 0;
                    const un = (ingR.unidadeUsada || '').toLowerCase();
                    let c = 0;
                    if (un === 'g' || un === 'grama') c = (ing.precoPorGrama || 0) * qtd;
                    else if (un === 'kg') c = (ing.precoPorKg || 0) * qtd;
                    else if (un === 'ml') c = (ing.precoPorMl || 0) * qtd;
                    else if (un === 'l' || un === 'litro') c = (ing.precoPorLitro || 0) * qtd;
                    else c = (ing.precoPorUnidade || 0) * qtd;
                    ingR.custo = c; ingR.nome = ing.nome; custo += c;
                }
            });
        }
        receita.custoTotal = custo;
        const precoManual = parseFloat(receita.precoManual);
        if (precoManual > 0) {
            receita.precoArredondado = precoManual;
            receita.precoSugerido = precoManual;
            receita.margem = precoManual - custo;
        } else {
            const mk = parseFloat(receita.markup) || parseFloat(this.data.config.markupPadrao) || 2.5;
            receita.precoSugerido = custo * mk;
            receita.precoArredondado = this._arredondarPreco(receita.precoSugerido);
            receita.margem = receita.precoArredondado - custo;
        }
        receita.lucro = receita.margem;
        receita.margemPercentual = receita.precoArredondado > 0 ? (receita.margem / receita.precoArredondado) * 100 : 0;
    }

    _arredondarPreco(p) { return p <= 0 ? 0 : Math.floor(p) + 0.90; }

    addReceita(r) {
        r.id = Date.now().toString();
        r.createdAt = new Date().toISOString();
        r.ingredientes = r.ingredientes || [];
        this._calcularCustosReceita(r);
        this.data.receitas.push(r);
        this.saveData();
        return r;
    }
    updateReceita(id, dados) {
        const idx = this.data.receitas.findIndex(r => r.id === id);
        if (idx !== -1) {
            this.data.receitas[idx] = { ...this.data.receitas[idx], ...dados };
            this._calcularCustosReceita(this.data.receitas[idx]);
            this.saveData();
        }
    }
    deleteReceita(id) { this.data.receitas = this.data.receitas.filter(r => r.id !== id); this.saveData(); }

    registrarVenda(venda) {
        venda.id = Date.now().toString();
        venda.data = new Date().toISOString();
        this.data.vendas.push(venda);
        this.data.caixa.entradas.push({ id:venda.id, tipo:'venda', valor:parseFloat(venda.valor)||0, formaPagamento:venda.formaPagamento, descricao:'Venda: '+(venda.produtoNome||'Produto'), data:venda.data });
        this.data.caixa.saldoAtual += parseFloat(venda.valor)||0;
        if (venda.receitaId) {
            const rec = this.data.receitas.find(r => r.id === venda.receitaId);
            if (rec?.ingredientes) {
                rec.ingredientes.forEach(ingR => {
                    this.data.estoqueMovimentacoes.push({
                        id: Date.now().toString()+Math.random(), ingredienteId: ingR.ingredienteId,
                        tipo:'saida', quantidade: parseFloat(ingR.quantidade)||0,
                        unidade: ingR.unidadeUsada||'un', motivo:'Venda: '+venda.id,
                        data: venda.data, receitaId: venda.receitaId
                    });
                });
            }
        }
        this.saveData();
        return venda;
    }

    addCompra(compra) {
        compra.id = Date.now().toString();
        compra.data = new Date().toISOString();
        this.data.compras.push(compra);
        this.data.estoqueMovimentacoes.push({
            id: Date.now().toString()+Math.random(), ingredienteId: compra.ingredienteId,
            tipo:'entrada', quantidade: parseFloat(compra.quantidade)||0,
            unidade: compra.unidade||'un', motivo:'Compra: '+(compra.nota||compra.id),
            data: compra.data, valor: parseFloat(compra.valor)||0, fornecedor: compra.fornecedor||''
        });
        const ing = this.data.ingredientes.find(i => i.id === compra.ingredienteId);
        if (ing) {
            const novaQtd = (parseFloat(ing.quantidadeComprada)||0) + (parseFloat(compra.quantidade)||0);
            ing.precoPago = ((parseFloat(ing.precoPago)||0)*(parseFloat(ing.quantidadeComprada)||1)+(parseFloat(compra.valor)||0))/(novaQtd||1);
            ing.quantidadeComprada = novaQtd;
            this._calcularPrecosUnitarios(ing);
        }
        this.data.caixa.saidas.push({ id:compra.id, tipo:'compra', valor:parseFloat(compra.valor)||0, descricao:'Compra: '+(compra.nota||''), data:compra.data });
        this.data.caixa.saldoAtual -= parseFloat(compra.valor)||0;
        this.saveData();
        return compra;
    }

    abrirCaixa(valor) { this.data.caixa.abertura=parseFloat(valor)||0; this.data.caixa.saldoAtual=parseFloat(valor)||0; this.data.caixa.fechado=false; this.data.caixa.entradas=[]; this.data.caixa.saidas=[]; this.saveData(); }
    fecharCaixa() { this.data.caixa.fechado=true; this.saveData(); }

    getVendasHoje() { const hoje=new Date().toISOString().split('T')[0]; return this.data.vendas.filter(v=>v.data.startsWith(hoje)); }
    getFaturamentoHoje() { return this.getVendasHoje().reduce((s,v)=>s+(parseFloat(v.valor)||0),0); }
    getLucroHoje() { return this.getVendasHoje().reduce((s,v)=>{ const r=this.data.receitas.find(rec=>rec.id===v.receitaId); return s+(r?parseFloat(r.margem)||0:0); },0); }
    getQuantidadeVendidaHoje() { return this.getVendasHoje().length; }

    _converterUnidade(quantidade, de, para) {
        const paraGramas = { 'kg':1000, 'kilo':1000, 'quilo':1000, 'g':1, 'grama':1, 'gramas':1 };
        const paraMl = { 'l':1000, 'litro':1000, 'ml':1, 'mililitro':1 };
        const deL = (de||'').toLowerCase(), paraL = (para||'').toLowerCase();
        if (paraGramas[deL] !== undefined && paraGramas[paraL] !== undefined) {
            return (quantidade * paraGramas[deL]) / paraGramas[paraL];
        }
        if (paraMl[deL] !== undefined && paraMl[paraL] !== undefined) {
            return (quantidade * paraMl[deL]) / paraMl[paraL];
        }
        return quantidade;
    }

    getEstoqueAtual(ingredienteId) {
        const ing = this.data.ingredientes.find(i => i.id === ingredienteId);
        if (!ing) return 0;
        const unIng = ing.unidade || 'un';
        let total = parseFloat(ing.quantidadeComprada) || 0;
        this.data.estoqueMovimentacoes
            .filter(m => m.ingredienteId === ingredienteId && m.tipo === 'entrada')
            .forEach(m => total += this._converterUnidade(parseFloat(m.quantidade)||0, m.unidade||unIng, unIng));
        this.data.estoqueMovimentacoes
            .filter(m => m.ingredienteId === ingredienteId && m.tipo === 'saida')
            .forEach(m => total -= this._converterUnidade(parseFloat(m.quantidade)||0, m.unidade||unIng, unIng));
        console.log(`Estoque de ${ing.nome}: ${total} ${unIng}`);
        return Math.max(0, total);
    }

    getProducaoPossivel(receitaId) {
        const rec = this.data.receitas.find(r => r.id === receitaId);
        if (!rec) return 0;
        if (!rec.ingredientes || rec.ingredientes.length === 0) {
            console.warn(`Receita ${rec.nome} sem ingredientes.`);
            return Infinity; // manter para indicar "sem ingredientes"
        }
        let min = Infinity;
        rec.ingredientes.forEach(ingR => {
            const ing = this.data.ingredientes.find(i => i.id === ingR.ingredienteId);
            if (!ing) {
                console.warn(`Ingrediente não encontrado para ${ingR.nome || 'desconhecido'} na receita ${rec.nome}`);
                return;
            }
            const estoque = this.getEstoqueAtual(ing.id);
            const qtdNecessaria = this._converterUnidade(parseFloat(ingR.quantidade)||0, ingR.unidadeUsada||'un', ing.unidade||'un');
            if (qtdNecessaria > 0) {
                const possivel = Math.floor(estoque / qtdNecessaria);
                if (possivel < min) min = possivel;
            }
        });
        const resultado = min === Infinity ? Infinity : min;
        console.log(`Produção possível de ${rec.nome}: ${resultado}`);
        return resultado;
    }

    getValorTotalVendasPossiveis() {
        let total = 0;
        this.data.receitas.forEach(r => {
            const qtd = this.getProducaoPossivel(r.id);
            if (qtd > 0 && qtd !== Infinity) {
                total += qtd * (parseFloat(r.precoArredondado)||0);
            }
        });
        console.log('Valor total de vendas possível:', total);
        return total;
    }

    getRelatorio(periodo) {
        const agora = new Date(); let inicio;
        switch (periodo) {
            case 'hoje': inicio=new Date(agora.getFullYear(),agora.getMonth(),agora.getDate()); break;
            case 'semana': inicio=new Date(agora); inicio.setDate(agora.getDate()-7); break;
            case 'mes': inicio=new Date(agora.getFullYear(),agora.getMonth(),1); break;
            case 'ano': inicio=new Date(agora.getFullYear(),0,1); break;
            default: inicio=new Date(0);
        }
        const vendas = this.data.vendas.filter(v=>v.data>=inicio.toISOString());
        const fat = vendas.reduce((s,v)=>s+(parseFloat(v.valor)||0),0);
        const lucro = vendas.reduce((s,v)=>{ const r=this.data.receitas.find(rec=>rec.id===v.receitaId); return s+(r?parseFloat(r.margem)||0:0); },0);
        return { periodo, quantidadeVendas:vendas.length, faturamento:fat, lucro, cmv:fat-lucro, margemPercentual:fat>0?(lucro/fat)*100:0, vendas };
    }

    exportarDados() { return JSON.stringify(this.data, null, 2); }
    importarDados(json) {
        try {
            const dados = JSON.parse(json);
            if (dados.config && dados.ingredientes && dados.receitas) {
                this.data = dados; this.data.config = {...DEFAULT_CONFIG, ...this.data.config};
                this.saveData(); return true;
            }
        } catch(e) {}
        return false;
    }

    addListener(fn) { this.listeners.push(fn); }
    notifyListeners() { this.listeners.forEach(fn => fn(this.data)); }
}

const state = new StateManager();

// ===================== UI CONTROLLER =====================
class UIController {
    constructor() {
        this.currentPage = 'dashboard';
        this.init();
    }

    init() {
        setTimeout(() => {
            document.getElementById('splashScreen').classList.add('hidden');
            document.getElementById('appContainer').style.display = 'flex';
            this.renderPage('dashboard');
            this.setupEvents();
            this.applyTheme();
        }, 1000);
        state.addListener(() => { if (this.currentPage === 'dashboard') this.renderDashboard(); });
        window._showToast = (msg, type) => this.showToast(msg, type);
    }

    setupEvents() {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = btn.dataset.page;
                p === 'mais' ? this.toggleSidebar() : this.navigateTo(p);
            });
        });
        document.getElementById('sidebarOverlay').addEventListener('click', () => this.toggleSidebar(false));
        document.getElementById('menuToggle').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        document.getElementById('fabButton').addEventListener('click', () => this.handleFab());
        document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) this.closeModal(); });
    }

    navigateTo(page) {
        this.currentPage = page;
        this.renderPage(page);
        this.updateActiveNav(page);
        this.updateFab(page);
        document.getElementById('headerTitle').textContent = this.getTitle(page);
        document.getElementById('mainContent').scrollTop = 0;
        if (document.getElementById('sidebar').classList.contains('open')) this.toggleSidebar(false);
    }

    getTitle(p) {
        const t = { dashboard:'Dashboard', vendas:'Modo Festa 🎉', estoque:'Estoque', receitas:'Receitas', ingredientes:'Ingredientes', compras:'Compras', caixa:'Caixa', relatorios:'Relatórios', configuracoes:'Configurações', backup:'Backup', markup:'Calculadora Markup' };
        return t[p] || p;
    }

    updateActiveNav(page) {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
        document.querySelectorAll('#sidebarMenu a').forEach(a => a.classList.toggle('active', a.dataset.page === page));
    }

    updateFab(page) { document.getElementById('fabButton').style.display = ['ingredientes','receitas','compras','vendas'].includes(page) ? 'flex' : 'none'; }

    handleFab() {
        switch(this.currentPage) {
            case 'ingredientes': this.showIngredienteForm(); break;
            case 'receitas': this.showReceitaForm(); break;
            case 'compras': this.showCompraForm(); break;
            case 'vendas': this.showVendaRapidaModal(); break;
        }
    }

    renderPage(page) {
        this.currentPage = page;
        const m = document.getElementById('mainContent');
        switch(page) {
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
            default: m.innerHTML = '<div class="empty-state"><div class="empty-icon">📄</div><h3>Página não encontrada</h3></div>';
        }
        this.renderSidebar();
    }

    renderSidebar() {
        const items = [
            { page:'dashboard', icon:'📊', label:'Dashboard' },{ page:'vendas', icon:'🎉', label:'Modo Festa' },
            { page:'estoque', icon:'📦', label:'Estoque' },{ page:'receitas', icon:'📋', label:'Receitas' },
            { page:'ingredientes', icon:'🥩', label:'Ingredientes' },{ page:'compras', icon:'🛒', label:'Compras' },
            { page:'caixa', icon:'💰', label:'Caixa' },{ page:'markup', icon:'🔢', label:'Calculadora Markup' },
            { page:'relatorios', icon:'📈', label:'Relatórios' },{ page:'configuracoes', icon:'⚙️', label:'Configurações' },
            { page:'backup', icon:'💾', label:'Backup' }
        ];
        document.getElementById('sidebarMenu').innerHTML = items.map(i => `<li><a data-page="${i.page}" class="${this.currentPage===i.page?'active':''}"><span class="menu-icon">${i.icon}</span> ${i.label}</a></li>`).join('');
        document.querySelectorAll('#sidebarMenu a').forEach(a => a.addEventListener('click', e => { e.preventDefault(); this.navigateTo(a.dataset.page); }));
    }

    toggleSidebar(force) {
        const s = document.getElementById('sidebar');
        if (force === true) s.classList.add('open');
        else if (force === false) s.classList.remove('open');
        else s.classList.toggle('open');
    }

    toggleTheme() {
        const cur = document.documentElement.getAttribute('data-theme') || 'light';
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        state.updateConfig('tema', next);
        this.updateThemeIcons(next);
    }

    applyTheme() {
        const t = state.getData().config.tema || 'light';
        document.documentElement.setAttribute('data-theme', t);
        this.updateThemeIcons(t);
    }

    updateThemeIcons(t) {
        const sun = document.querySelector('.sun-icon'), moon = document.querySelector('.moon-icon');
        if (t === 'dark') { if(sun) sun.style.display='none'; if(moon) moon.style.display='block'; }
        else { if(sun) sun.style.display='block'; if(moon) moon.style.display='none'; }
    }

    showToast(msg, type) {
        const c = document.getElementById('toastContainer');
        const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = msg;
        c.appendChild(t); setTimeout(() => t.remove(), 3000);
    }

    openModal(html, cb) {
        document.getElementById('modalContent').innerHTML = html;
        document.getElementById('modalOverlay').style.display = 'flex';
        this._modalCb = cb;
        const close = document.querySelector('#modalContent .modal-close');
        if (close) close.addEventListener('click', () => this.closeModal());
    }

    closeModal(res) {
        document.getElementById('modalOverlay').style.display = 'none';
        if (this._modalCb) { this._modalCb(res); this._modalCb = null; }
    }

    formatarMoeda(v) { return new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(v||0); }

    // ===================== DASHBOARD =====================
    renderDashboard() {
        const main = document.getElementById('mainContent');
        main.innerHTML = `
            <div class="dashboard-grid">
                <div class="dashboard-card" onclick="ui.navigateTo('vendas')"><div class="dc-icon">💰</div><div class="dc-value">${this.formatarMoeda(state.getFaturamentoHoje())}</div><div class="dc-label">Faturamento Hoje</div></div>
                <div class="dashboard-card"><div class="dc-icon">📈</div><div class="dc-value">${this.formatarMoeda(state.getLucroHoje())}</div><div class="dc-label">Lucro Hoje</div></div>
                <div class="dashboard-card"><div class="dc-icon">🛒</div><div class="dc-value">${state.getQuantidadeVendidaHoje()}</div><div class="dc-label">Vendas Hoje</div></div>
                <div class="dashboard-card" onclick="ui.navigateTo('caixa')"><div class="dc-icon">🏦</div><div class="dc-value">${this.formatarMoeda(state.getData().caixa.saldoAtual||0)}</div><div class="dc-label">Saldo Caixa</div></div>
                <div class="dashboard-card" onclick="ui.navigateTo('receitas')"><div class="dc-icon">📋</div><div class="dc-value">${state.getData().receitas.length}</div><div class="dc-label">Receitas</div></div>
                <div class="dashboard-card" onclick="ui.navigateTo('ingredientes')"><div class="dc-icon">🥩</div><div class="dc-value">${state.getData().ingredientes.length}</div><div class="dc-label">Ingredientes</div></div>
                <div class="dashboard-card full-width"><div class="dc-icon">💵</div><div class="dc-value">${this.formatarMoeda(state.getValorTotalVendasPossiveis())}</div><div class="dc-label">Receita Potencial (estoque atual)</div></div>
            </div>
            <div class="card mt-16"><div class="card-header"><span class="card-title">📊 Vendas Recentes</span></div>${this.renderGraficoVendas()}</div>
            <div class="card"><div class="card-header"><span class="card-title">🏆 Produtos Mais Vendidos</span></div>${this.renderTopProdutos()}</div>
            <div class="card"><div class="card-header"><span class="card-title">⚠️ Alertas de Estoque</span></div>${this.renderAlertasEstoque()}</div>
        `;
        document.getElementById('headerTitle').textContent = 'Dashboard';
    }

    renderGraficoVendas() {
        const dias = [];
        for (let i=6; i>=0; i--) {
            const d = new Date(); d.setDate(d.getDate()-i);
            const str = d.toISOString().split('T')[0];
            const total = state.getData().vendas.filter(v=>v.data.startsWith(str)).reduce((s,v)=>s+(parseFloat(v.valor)||0),0);
            dias.push({total, label:d.toLocaleDateString('pt-BR',{weekday:'short'})});
        }
        const max = Math.max(...dias.map(d=>d.total),1);
        return `<div class="chart-bar-container">${dias.map(d=>`<div style="flex:1;text-align:center;"><div class="chart-bar" style="height:${(d.total/max)*100}%"></div><div class="chart-bar-label">${d.label}</div></div>`).join('')}</div>`;
    }

    renderTopProdutos() {
        const cont = {};
        state.getData().vendas.forEach(v=>{ const n=v.produtoNome||'Produto'; cont[n]=(cont[n]||0)+1; });
        const sorted = Object.entries(cont).sort((a,b)=>b[1]-a[1]).slice(0,5);
        return sorted.length ? sorted.map(([n,q],i)=>`<div class="flex-between mb-8"><span>${i+1}. ${n}</span><span class="badge badge-info">${q} vendas</span></div>`).join('') : '<p class="text-center font-sm">Nenhuma venda.</p>';
    }

    renderAlertasEstoque() {
        const alerts = [];
        state.getData().receitas.forEach(r=>{ const p=state.getProducaoPossivel(r.id); if(p<10 && p>=0) alerts.push({nome:r.nome, p}); });
        return alerts.length ? alerts.map(a=>`<div class="alert alert-warning">⚠️ <strong>${a.nome}</strong>: Apenas ${a.p} unidade(s) podem ser produzidas.</div>`).join('') : '<p class="text-center font-sm text-success">✅ Estoque suficiente.</p>';
    }

    // ===================== MODO FESTA =====================
    renderModoFesta() {
        const receitas = state.getData().receitas;
        if (!receitas.length) {
            document.getElementById('mainContent').innerHTML = '<div class="empty-state"><div class="empty-icon">🎉</div><h3>Nenhum produto</h3><p>Cadastre receitas primeiro.</p><button class="btn btn-accent mt-16" onclick="ui.navigateTo(\'receitas\')">Cadastrar</button></div>';
        } else {
            document.getElementById('mainContent').innerHTML = `<p class="font-sm mb-16">Toque para vender ⚡</p><div class="festa-grid">${receitas.map(r=>`<button class="festa-btn" onclick="ui.venderProduto('${r.id}')"><span class="festa-emoji">${r.emoji||'🍔'}</span><span>${r.nome}</span><span class="festa-price">${this.formatarMoeda(r.precoArredondado)}</span>${state.getProducaoPossivel(r.id)<5?'<span class="badge badge-warning">Baixo estoque</span>':''}</button>`).join('')}</div>`;
        }
        document.getElementById('headerTitle').textContent = 'Modo Festa 🎉';
    }

    venderProduto(rid) {
        const r = state.getData().receitas.find(r=>r.id===rid);
        if (!r) return;
        const prod = state.getProducaoPossivel(rid);
        if (prod <= 0) { this.showToast('Estoque insuficiente!','error'); return; }
        this.openModal(`<div class="modal-header"><h2 class="modal-title">Vender: ${r.emoji||''} ${r.nome}</h2><button class="modal-close">✕</button></div>
            <p style="text-align:center;font-size:36px;font-weight:700;color:var(--accent-dark);margin:16px 0;">${this.formatarMoeda(r.precoArredondado)}</p>
            <p style="text-align:center;">Forma de pagamento:</p>
            <div class="pagamento-options">
                <button class="pagamento-btn" onclick="ui.confirmarVenda('${rid}','Pix')"><span class="pay-icon">📱</span>Pix</button>
                <button class="pagamento-btn" onclick="ui.confirmarVenda('${rid}','Dinheiro')"><span class="pay-icon">💵</span>Dinheiro</button>
                <button class="pagamento-btn" onclick="ui.confirmarVenda('${rid}','Cartão')"><span class="pay-icon">💳</span>Cartão</button>
            </div><p style="text-align:center;font-size:12px;">📦 Produção possível: <strong>${prod}</strong></p>`);
    }

    confirmarVenda(rid, pgto) {
        const r = state.getData().receitas.find(r=>r.id===rid);
        state.registrarVenda({ receitaId:rid, produtoNome:r.nome, valor:r.precoArredondado, formaPagamento:pgto, quantidade:1 });
        this.closeModal();
        this.showToast(`✅ Vendido: ${r.nome} - ${this.formatarMoeda(r.precoArredondado)} (${pgto})`, 'success');
        this.renderModoFesta();
        if (navigator.vibrate) navigator.vibrate(50);
    }

    showVendaRapidaModal() {
        this.openModal(`<div class="modal-header"><h2 class="modal-title">Venda Rápida</h2><button class="modal-close">✕</button></div>
            <div class="form-group"><label class="form-label">Valor (R$)</label><input type="number" class="form-input" id="vendaRapidaValor" step="0.01"></div>
            <div class="form-group"><label class="form-label">Descrição</label><input type="text" class="form-input" id="vendaRapidaDesc"></div>
            <div class="pagamento-options">
                <button class="pagamento-btn" onclick="ui.finalizarVendaRapida('Pix')">📱 Pix</button>
                <button class="pagamento-btn" onclick="ui.finalizarVendaRapida('Dinheiro')">💵 Dinheiro</button>
                <button class="pagamento-btn" onclick="ui.finalizarVendaRapida('Cartão')">💳 Cartão</button>
            </div>`);
    }

    finalizarVendaRapida(pgto) {
        const v = parseFloat(document.getElementById('vendaRapidaValor')?.value)||0;
        const d = document.getElementById('vendaRapidaDesc')?.value||'Venda rápida';
        if (v<=0) { this.showToast('Valor inválido','error'); return; }
        state.registrarVenda({ receitaId:null, produtoNome:d, valor:v, formaPagamento:pgto, quantidade:1 });
        this.closeModal(); this.showToast(`✅ Venda: ${this.formatarMoeda(v)}`, 'success');
    }

    // ===================== ESTOQUE =====================
    renderEstoque() {
        const ings = state.getData().ingredientes;
        const main = document.getElementById('mainContent');
        const search = document.getElementById('estoqueSearch')?.value?.toLowerCase() || '';
        let html = '<div class="search-bar"><input type="text" class="form-input" id="estoqueSearch" placeholder="🔍 Buscar ingrediente..." oninput="ui.renderEstoque()"></div>';
        const filtrados = ings.filter(i=>i.nome.toLowerCase().includes(search));
        if (!filtrados.length) {
            html += '<div class="empty-state"><div class="empty-icon">📦</div><h3>Nenhum ingrediente</h3></div>';
        } else {
            filtrados.forEach(ing => {
                const est = state.getEstoqueAtual(ing.id);
                const cls = est<=0?'badge-danger':est<10?'badge-warning':'badge-success';
                html += `<div class="card"><div class="flex-between"><div><strong>${ing.nome}</strong><span class="tag">${ing.categoria||'Geral'}</span></div><span class="badge ${cls}">${est.toFixed(2)} ${ing.unidade||'un'}</span></div><div class="progress-bar mt-8"><div class="progress-fill" style="width:${Math.min((est/(parseFloat(ing.quantidadeComprada)||1))*100,100)}%"></div></div><p class="font-sm mt-8">Preço/un: ${this.formatarMoeda(ing.precoPorUnidade)}</p></div>`;
            });
        }
        html += '<h3 class="mt-16 mb-8">📋 Capacidade de Produção</h3>';
        const receitas = state.getData().receitas;
        if (receitas.length) {
            receitas.forEach(r => {
                const p = state.getProducaoPossivel(r.id);
                const badgeClass = p===Infinity?'badge-info':p<5?'badge-danger':p<20?'badge-warning':'badge-success';
                const texto = p===Infinity?'Sem ingredientes':`${p} un`;
                html += `<div class="card"><div class="flex-between"><span>${r.emoji||'🍔'} <strong>${r.nome}</strong></span><span class="badge ${badgeClass}">${texto}</span></div></div>`;
            });
        } else {
            html += '<p class="text-center font-sm">Nenhuma receita cadastrada.</p>';
        }
        const totalValor = state.getValorTotalVendasPossiveis();
        html += `<div class="card mt-8"><div class="flex-between"><span class="card-title">💵 Valor total possível de vendas</span><span class="card-value">${this.formatarMoeda(totalValor)}</span></div></div>`;
        main.innerHTML = html;
        document.getElementById('headerTitle').textContent = 'Estoque';
    }

    // ===================== RECEITAS =====================
    renderReceitas() {
        const recs = state.getData().receitas;
        const main = document.getElementById('mainContent');
        if (!recs.length) main.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><h3>Nenhuma receita</h3><p>Toque no + para criar.</p></div>';
        else main.innerHTML = recs.map(r=>`<div class="card"><div class="flex-between"><h3>${r.emoji||'🍔'} ${r.nome}</h3><div><button class="btn btn-sm btn-outline" onclick="ui.showReceitaForm('${r.id}')">✏️</button><button class="btn btn-sm btn-danger" onclick="ui.deleteReceita('${r.id}')">🗑️</button></div></div><div class="card-row mt-8"><div class="card-mini"><div class="mini-value">${this.formatarMoeda(r.custoTotal)}</div><div class="mini-label">Custo</div></div><div class="card-mini"><div class="mini-value">${this.formatarMoeda(r.precoArredondado)}</div><div class="mini-label">Preço</div></div><div class="card-mini"><div class="mini-value">${this.formatarMoeda(r.margem)}</div><div class="mini-label">Margem</div></div><div class="card-mini"><div class="mini-value">${(r.margemPercentual||0).toFixed(1)}%</div><div class="mini-label">% Margem</div></div></div><p class="font-sm mt-8">Produção possível: <strong>${state.getProducaoPossivel(r.id)===Infinity?'Sem ingredientes':state.getProducaoPossivel(r.id)+' un'}</strong></p></div>`).join('');
        document.getElementById('headerTitle').textContent = 'Receitas';
        document.getElementById('fabButton').style.display = 'flex';
    }

    showReceitaForm(id=null) {
        const rec = id ? state.getData().receitas.find(r=>r.id===id) : null;
        const ings = state.getData().ingredientes;
        let ingHTML = '';
        if (rec?.ingredientes) rec.ingredientes.forEach((ing,idx)=>{ ingHTML += this.renderIngredienteReceitaRow(ing, idx); });
        this.openModal(`<div class="modal-header"><h2 class="modal-title">${rec?'Editar':'Nova'} Receita</h2><button class="modal-close">✕</button></div>
            <form onsubmit="event.preventDefault(); ui.salvarReceita('${id||''}')">
                <div class="form-group"><label class="form-label">Nome</label><input class="form-input" id="receitaNome" value="${rec?.nome||''}" required></div>
                <div class="form-group"><label class="form-label">Emoji</label><input class="form-input" id="receitaEmoji" value="${rec?.emoji||'🍔'}"></div>
                <div class="form-group"><label class="form-label">Markup</label><input type="number" class="form-input" id="receitaMarkup" value="${rec?.markup||state.getData().config.markupPadrao||2.5}" step="0.1"><small>Ignorado se preço manual preenchido.</small></div>
                <div class="form-group"><label class="form-label">Preço Manual (opcional)</label><input type="number" class="form-input" id="receitaPrecoManual" value="${rec?.precoManual||''}" step="0.01" placeholder="Ex: 15.00"></div>
                <h4>Ingredientes</h4><div id="ingredientesReceitaContainer">${ingHTML||'<p class="font-sm">Nenhum ingrediente.</p>'}</div>
                <button type="button" class="btn btn-outline btn-sm mt-8 w-100" onclick="ui.adicionarIngredienteReceita()">+ Adicionar</button>
                <button type="submit" class="btn btn-accent btn-block mt-16">💾 Salvar</button>
            </form>`);
    }

    renderIngredienteReceitaRow(ing, idx) {
        const ings = state.getData().ingredientes;
        return `<div class="flex-between gap-8 mb-8 ingrediente-receita-row">
            <select class="form-select" style="flex:2" id="ingReceitaSelect_${idx}"><option value="">Selecione...</option>${ings.map(i=>`<option value="${i.id}" ${i.id===ing.ingredienteId?'selected':''}>${i.nome}</option>`).join('')}</select>
            <input type="number" class="form-input" style="flex:1" placeholder="Qtd" value="${ing.quantidade||''}" step="0.001" id="ingReceitaQtd_${idx}">
            <select class="form-select" style="flex:1" id="ingReceitaUnidade_${idx}">
                <option value="g" ${ing.unidadeUsada==='g'?'selected':''}>g</option><option value="kg" ${ing.unidadeUsada==='kg'?'selected':''}>kg</option><option value="ml" ${ing.unidadeUsada==='ml'?'selected':''}>ml</option><option value="l" ${ing.unidadeUsada==='l'?'selected':''}>l</option><option value="un" ${ing.unidadeUsada==='un'?'selected':''}>un</option>
            </select>
            <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">✕</button>
        </div>`;
    }

    adicionarIngredienteReceita() {
        const c = document.getElementById('ingredientesReceitaContainer');
        const idx = Date.now();
        const row = document.createElement('div');
        row.className = 'flex-between gap-8 mb-8 ingrediente-receita-row';
        row.innerHTML = this.renderIngredienteReceitaRow({}, idx);
        c.appendChild(row);
    }

    salvarReceita(id) {
        const nome = document.getElementById('receitaNome')?.value;
        if (!nome) { this.showToast('Nome obrigatório','error'); return; }
        const data = {
            nome, emoji: document.getElementById('receitaEmoji')?.value||'🍔',
            markup: parseFloat(document.getElementById('receitaMarkup')?.value)||2.5,
            precoManual: parseFloat(document.getElementById('receitaPrecoManual')?.value)||0,
            ingredientes: []
        };
        document.querySelectorAll('.ingrediente-receita-row').forEach(row => {
            const s = row.querySelector('select');
            const q = row.querySelectorAll('input')[0];
            const u = row.querySelectorAll('select')[1];
            if (s?.value) data.ingredientes.push({ ingredienteId:s.value, quantidade:parseFloat(q?.value)||0, unidadeUsada:u?.value||'un' });
        });
        console.log('Salvando receita:', data);
        id ? state.updateReceita(id, data) : state.addReceita(data);
        this.closeModal(); this.showToast('Receita salva! ✅','success'); this.renderReceitas();
    }

    deleteReceita(id) { if(confirm('Excluir receita?')){ state.deleteReceita(id); this.renderReceitas(); } }

    // ===================== INGREDIENTES =====================
    renderIngredientes() {
        const ings = state.getData().ingredientes;
        const search = document.getElementById('ingredienteSearch')?.value?.toLowerCase()||'';
        let html = '<div class="search-bar"><input class="form-input" id="ingredienteSearch" placeholder="🔍 Buscar..." oninput="ui.renderIngredientes()"></div>';
        const filt = ings.filter(i=>i.nome.toLowerCase().includes(search));
        if (!filt.length) html += '<div class="empty-state"><div class="empty-icon">🥩</div><h3>Nenhum ingrediente</h3></div>';
        else filt.forEach(ing => html += `<div class="card"><div class="flex-between"><div><strong>${ing.nome}</strong><span class="tag">${ing.categoria||'Geral'}</span></div><div><button class="btn btn-sm btn-outline" onclick="ui.showIngredienteForm('${ing.id}')">✏️</button><button class="btn btn-sm btn-danger" onclick="ui.deleteIngrediente('${ing.id}')">🗑️</button></div></div><div class="card-row mt-8"><div class="card-mini"><div class="mini-value">${this.formatarMoeda(ing.precoPago)}</div><div class="mini-label">Preço Pago</div></div><div class="card-mini"><div class="mini-value">${ing.quantidadeComprada} ${ing.unidade||'un'}</div><div class="mini-label">Qtd</div></div><div class="card-mini"><div class="mini-value">${this.formatarMoeda(ing.precoPorUnidade)}</div><div class="mini-label">Preço/Un</div></div></div></div>`);
        document.getElementById('mainContent').innerHTML = html;
        document.getElementById('headerTitle').textContent = 'Ingredientes';
        document.getElementById('fabButton').style.display = 'flex';
    }

    showIngredienteForm(id=null) {
        const ing = id ? state.getData().ingredientes.find(i=>i.id===id) : null;
        this.openModal(`<div class="modal-header"><h2 class="modal-title">${ing?'Editar':'Novo'} Ingrediente</h2><button class="modal-close">✕</button></div>
            <form onsubmit="event.preventDefault(); ui.salvarIngrediente('${id||''}')">
                <div class="form-group"><label class="form-label">Nome</label><input class="form-input" id="ingNome" value="${ing?.nome||''}" required></div>
                <div class="form-group"><label class="form-label">Categoria</label><input class="form-input" id="ingCategoria" value="${ing?.categoria||''}"></div>
                <div class="form-group"><label class="form-label">Fornecedor</label><input class="form-input" id="ingFornecedor" value="${ing?.fornecedor||''}"></div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div class="form-group"><label class="form-label">Preço Pago (R$)</label><input type="number" class="form-input" id="ingPrecoPago" value="${ing?.precoPago||''}" step="0.01" required></div>
                    <div class="form-group"><label class="form-label">Qtd Comprada</label><input type="number" class="form-input" id="ingQtdComprada" value="${ing?.quantidadeComprada||''}" step="0.001" required></div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div class="form-group"><label class="form-label">Unidade</label><select class="form-select" id="ingUnidade"><option value="kg" ${ing?.unidade==='kg'?'selected':''}>Kg</option><option value="g" ${ing?.unidade==='g'?'selected':''}>g</option><option value="l" ${ing?.unidade==='l'?'selected':''}>Litro</option><option value="ml" ${ing?.unidade==='ml'?'selected':''}>ml</option><option value="un" ${ing?.unidade==='un'?'selected':''}>Unidade</option></select></div>
                    <div class="form-group"><label class="form-label">Perda (%)</label><input type="number" class="form-input" id="ingPerda" value="${ing?.perda||0}" step="0.1" min="0" max="100"></div>
                </div>
                <div class="form-group"><label class="form-label">Observações</label><textarea class="form-textarea" id="ingObservacoes">${ing?.observacoes||''}</textarea></div>
                <button type="submit" class="btn btn-accent btn-block mt-16">💾 Salvar</button>
            </form>`);
    }

    salvarIngrediente(id) {
        const d = {
            nome: document.getElementById('ingNome')?.value,
            categoria: document.getElementById('ingCategoria')?.value,
            fornecedor: document.getElementById('ingFornecedor')?.value,
            precoPago: parseFloat(document.getElementById('ingPrecoPago')?.value)||0,
            quantidadeComprada: parseFloat(document.getElementById('ingQtdComprada')?.value)||0,
            unidade: document.getElementById('ingUnidade')?.value,
            perda: parseFloat(document.getElementById('ingPerda')?.value)||0,
            observacoes: document.getElementById('ingObservacoes')?.value
        };
        if (!d.nome) { this.showToast('Nome obrigatório','error'); return; }
        id ? state.updateIngrediente(id, d) : state.addIngrediente(d);
        this.closeModal(); this.renderIngredientes(); this.showToast('Salvo! ✅','success');
    }

    deleteIngrediente(id) { if(confirm('Excluir?')) { state.deleteIngrediente(id); this.renderIngredientes(); } }

    // ===================== COMPRAS =====================
    renderCompras() {
        const compras = state.getData().compras;
        const ings = state.getData().ingredientes;
        let html = compras.length ? compras.slice().reverse().map(c=>`<div class="card"><div class="flex-between"><strong>${ings.find(i=>i.id===c.ingredienteId)?.nome||'?'}</strong><span class="badge badge-info">${new Date(c.data).toLocaleDateString('pt-BR')}</span></div><div class="card-row mt-8"><span>Qtd: ${c.quantidade} ${c.unidade||'un'}</span><span>Valor: ${this.formatarMoeda(c.valor)}</span></div></div>`).join('') : '<div class="empty-state"><div class="empty-icon">🛒</div><h3>Nenhuma compra</h3></div>';
        document.getElementById('mainContent').innerHTML = html;
        document.getElementById('headerTitle').textContent = 'Compras';
        document.getElementById('fabButton').style.display = 'flex';
    }

    showCompraForm() {
        const ings = state.getData().ingredientes;
        if (!ings.length) { this.showToast('Cadastre ingredientes primeiro!','warning'); return; }
        this.openModal(`<div class="modal-header"><h2 class="modal-title">Registrar Compra</h2><button class="modal-close">✕</button></div>
            <form onsubmit="event.preventDefault();ui.salvarCompra()">
                <div class="form-group"><label class="form-label">Ingrediente</label><select class="form-select" id="compraIngrediente" required><option value="">Selecione...</option>${ings.map(i=>`<option value="${i.id}">${i.nome}</option>`).join('')}</select></div>
                <div class="form-group"><label class="form-label">Fornecedor</label><input class="form-input" id="compraFornecedor"></div>
                <div class="form-group"><label class="form-label">Nota Fiscal</label><input class="form-input" id="compraNota"></div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div class="form-group"><label class="form-label">Quantidade</label><input type="number" class="form-input" id="compraQtd" step="0.001" required></div>
                    <div class="form-group"><label class="form-label">Unidade</label><select class="form-select" id="compraUnidade"><option value="kg">Kg</option><option value="g">g</option><option value="l">Litro</option><option value="ml">ml</option><option value="un">Unidade</option></select></div>
                </div>
                <div class="form-group"><label class="form-label">Valor Total (R$)</label><input type="number" class="form-input" id="compraValor" step="0.01" required></div>
                <button type="submit" class="btn btn-accent btn-block mt-16">💾 Registrar</button>
            </form>`);
    }

    salvarCompra() {
        const c = {
            ingredienteId: document.getElementById('compraIngrediente')?.value,
            fornecedor: document.getElementById('compraFornecedor')?.value,
            nota: document.getElementById('compraNota')?.value,
            quantidade: parseFloat(document.getElementById('compraQtd')?.value)||0,
            unidade: document.getElementById('compraUnidade')?.value,
            valor: parseFloat(document.getElementById('compraValor')?.value)||0
        };
        if (!c.ingredienteId || c.quantidade<=0) { this.showToast('Campos obrigatórios!','error'); return; }
        state.addCompra(c); this.closeModal(); this.renderCompras(); this.showToast('Compra registrada! ✅','success');
    }

    // ===================== CAIXA =====================
    renderCaixa() {
        const cx = state.getData().caixa;
        document.getElementById('mainContent').innerHTML = `
            <div class="card text-center"><div class="card-title">Saldo Atual</div><div class="card-value">${this.formatarMoeda(cx.saldoAtual||0)}</div><span class="badge ${cx.fechado?'badge-danger':'badge-success'}">${cx.fechado?'Fechado':'Aberto'}</span></div>
            ${cx.fechado ? `<div class="form-group mt-8"><label class="form-label">Valor de Abertura</label><input type="number" class="form-input" id="aberturaValor" step="0.01"></div><button class="btn btn-accent btn-block mt-8" onclick="ui.abrirCaixa()">🔓 Abrir Caixa</button>` : `<button class="btn btn-danger btn-block mt-8" onclick="ui.fecharCaixa()">🔒 Fechar Caixa</button>`}
            <h3 class="mt-16 mb-8">📥 Entradas</h3>${cx.entradas.slice().reverse().slice(0,20).map(e=>`<div class="card"><div class="flex-between"><span>${e.descricao}</span><span class="text-success">+${this.formatarMoeda(e.valor)}</span><span class="tag">${e.formaPagamento||''}</span></div></div>`).join('')||'<p class="text-center font-sm">Nenhuma.</p>'}
            <h3 class="mt-16 mb-8">📤 Saídas</h3>${cx.saidas.slice().reverse().slice(0,20).map(s=>`<div class="card"><div class="flex-between"><span>${s.descricao}</span><span class="text-danger">-${this.formatarMoeda(s.valor)}</span></div></div>`).join('')||'<p class="text-center font-sm">Nenhuma.</p>'}`;
        document.getElementById('headerTitle').textContent = 'Caixa';
    }

    abrirCaixa() { state.abrirCaixa(parseFloat(document.getElementById('aberturaValor')?.value)||0); this.renderCaixa(); }
    fecharCaixa() { if(confirm('Fechar caixa?')) { state.fecharCaixa(); this.renderCaixa(); } }

    // ===================== RELATÓRIOS =====================
    renderRelatorios() {
        document.getElementById('mainContent').innerHTML = `
            <div class="form-group"><label class="form-label">Período</label><select class="form-select" id="relatorioPeriodo" onchange="ui.renderRelatorioDetalhado()"><option value="hoje">Hoje</option><option value="semana">Última Semana</option><option value="mes">Este Mês</option><option value="ano">Este Ano</option></select></div>
            <div id="relatorioDetalhado"></div>
            <div class="flex-between gap-8 mt-16"><button class="btn btn-outline btn-sm" onclick="ui.exportarRelatorio('json')">📄 JSON</button><button class="btn btn-outline btn-sm" onclick="ui.exportarRelatorio('csv')">📊 CSV</button><button class="btn btn-outline btn-sm" onclick="window.print()">🖨️ Imprimir</button></div>`;
        document.getElementById('headerTitle').textContent = 'Relatórios';
        this.renderRelatorioDetalhado();
    }

    renderRelatorioDetalhado() {
        const rel = state.getRelatorio(document.getElementById('relatorioPeriodo')?.value||'hoje');
        document.getElementById('relatorioDetalhado').innerHTML = `<div class="dashboard-grid">
            <div class="dashboard-card"><div class="dc-icon">💰</div><div class="dc-value">${this.formatarMoeda(rel.faturamento)}</div><div class="dc-label">Faturamento</div></div>
            <div class="dashboard-card"><div class="dc-icon">📈</div><div class="dc-value">${this.formatarMoeda(rel.lucro)}</div><div class="dc-label">Lucro</div></div>
            <div class="dashboard-card"><div class="dc-icon">🛒</div><div class="dc-value">${rel.quantidadeVendas}</div><div class="dc-label">Vendas</div></div>
            <div class="dashboard-card"><div class="dc-icon">📊</div><div class="dc-value">${rel.margemPercentual.toFixed(1)}%</div><div class="dc-label">Margem</div></div>
            <div class="dashboard-card"><div class="dc-icon">💸</div><div class="dc-value">${this.formatarMoeda(rel.cmv)}</div><div class="dc-label">CMV</div></div>
            <div class="dashboard-card"><div class="dc-icon">🎫</div><div class="dc-value">${this.formatarMoeda(rel.faturamento-rel.cmv)}</div><div class="dc-label">Contribuição</div></div>
        </div>`;
    }

    exportarRelatorio(fmt) {
        const rel = state.getRelatorio(document.getElementById('relatorioPeriodo')?.value||'hoje');
        if (fmt==='json') this.downloadBlob(new Blob([JSON.stringify(rel,null,2)],{type:'application/json'}), `relatorio_${rel.periodo}.json`);
        else if (fmt==='csv') {
            let csv = 'Data,Produto,Valor,Forma Pagamento\n';
            rel.vendas.forEach(v=>csv+=`${v.data},${v.produtoNome},${v.valor},${v.formaPagamento}\n`);
            this.downloadBlob(new Blob([csv],{type:'text/csv'}), `relatorio_${rel.periodo}.csv`);
        }
        this.showToast('Exportado! ✅','success');
    }

    downloadBlob(blob, nome) { const u=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=u; a.download=nome; a.click(); URL.revokeObjectURL(u); }

    // ===================== CONFIGURAÇÕES =====================
    renderConfiguracoes() {
        const c = state.getData().config;
        document.getElementById('mainContent').innerHTML = `<div class="card">
            <div class="form-group"><label class="form-label">Empresa</label><input class="form-input" id="cfgEmpresa" value="${c.empresa||''}"></div>
            <div class="form-group"><label class="form-label">Logo</label><input class="form-input" id="cfgLogo" value="${c.logo||'🍔'}"></div>
            <div class="form-group"><label class="form-label">Markup Padrão</label><input type="number" class="form-input" id="cfgMarkup" value="${c.markupPadrao||2.5}" step="0.1"></div>
            <div class="form-group"><label class="form-label">Impostos (%)</label><input type="number" class="form-input" id="cfgImpostos" value="${c.impostos||0}" step="0.1"></div>
            <button class="btn btn-accent btn-block" onclick="ui.salvarConfiguracoes()">💾 Salvar</button></div>
            <div class="card mt-8"><h3>Tema</h3><button class="btn btn-outline w-100" onclick="ui.toggleTheme()">🌓 Alternar</button></div>`;
        document.getElementById('headerTitle').textContent = 'Configurações';
    }

    salvarConfiguracoes() {
        ['empresa','logo','markupPadrao','impostos'].forEach(k => state.updateConfig(k, document.getElementById('cfg'+k.charAt(0).toUpperCase()+k.slice(1))?.value));
        this.showToast('Configurações salvas! ✅','success');
    }

    // ===================== BACKUP =====================
    renderBackup() {
        document.getElementById('mainContent').innerHTML = `<div class="card"><h3>💾 Exportar</h3><button class="btn btn-accent btn-block" onclick="ui.exportarBackup()">📤 Exportar JSON</button></div>
            <div class="card mt-8"><h3>📥 Importar</h3><input type="file" class="form-input" id="backupFile" accept=".json"><button class="btn btn-outline btn-block mt-8" onclick="ui.importarBackup()">📥 Restaurar</button></div>
            <div class="card mt-8"><h3>⚠️ Limpar</h3><button class="btn btn-danger btn-block" onclick="ui.limparDados()">🗑️ Limpar Tudo</button></div>`;
        document.getElementById('headerTitle').textContent = 'Backup';
    }

    exportarBackup() { this.downloadBlob(new Blob([state.exportarDados()],{type:'application/json'}), `festagest_backup_${new Date().toISOString().split('T')[0]}.json`); this.showToast('Backup exportado!','success'); }

    importarBackup() {
        const f = document.getElementById('backupFile')?.files[0];
        if (!f) { this.showToast('Selecione um arquivo','error'); return; }
        const r = new FileReader();
        r.onload = e => { if (state.importarDados(e.target.result)) { this.showToast('Restaurado! ✅','success'); this.renderDashboard(); } else this.showToast('Arquivo inválido!','error'); };
        r.readAsText(f);
    }

    limparDados() { if(confirm('⚠️ Apagar todos os dados?')) if(confirm('⚠️ Confirma?')) { state.data = JSON.parse(JSON.stringify(INITIAL_DATA)); state.saveData(); this.renderDashboard(); } }

    // ===================== MARKUP =====================
    renderMarkup() {
        document.getElementById('mainContent').innerHTML = `<div class="card"><h3>🔢 Calculadora</h3>
            <div class="form-group"><label class="form-label">Custo (R$)</label><input type="number" class="form-input" id="mkCusto" step="0.01" oninput="ui.calcularMarkup()"></div>
            <div class="form-group"><label class="form-label">Markup</label><input type="number" class="form-input" id="mkMarkup" value="2.5" step="0.1" oninput="ui.calcularMarkup()"></div>
            <div class="form-group"><label class="form-label">Margem Desejada (%)</label><input type="number" class="form-input" id="mkMargem" step="0.1" oninput="ui.calcularMarkupPorMargem()"></div>
        </div><div class="card mt-8" id="mkResultados"><p class="text-center font-sm">Preencha os campos.</p></div>
        <div class="card mt-8"><h3>💡 Arredondados</h3><div id="mkArredondados"></div></div>`;
        document.getElementById('headerTitle').textContent = 'Calculadora Markup';
    }

    calcularMarkup() {
        const custo = parseFloat(document.getElementById('mkCusto')?.value)||0;
        const mk = parseFloat(document.getElementById('mkMarkup')?.value)||2.5;
        const sug = custo*mk;
        const arr = state._arredondarPreco(sug);
        const luc = arr-custo;
        const marg = arr>0?(luc/arr)*100:0;
        document.getElementById('mkResultados').innerHTML = `<div class="card-row"><div class="card-mini"><div class="mini-value">${this.formatarMoeda(sug)}</div><div class="mini-label">Sugerido</div></div><div class="card-mini"><div class="mini-value">${this.formatarMoeda(arr)}</div><div class="mini-label">Arredondado</div></div><div class="card-mini"><div class="mini-value">${this.formatarMoeda(luc)}</div><div class="mini-label">Lucro</div></div><div class="card-mini"><div class="mini-value">${marg.toFixed(1)}%</div><div class="mini-label">Margem</div></div></div>`;
        const alt = [24.9,29.9,34.9,39.9,49.9,59.9,69.9,79.9,89.9,99.9];
        document.getElementById('mkArredondados').innerHTML = alt.map(p=>{ const l=p-custo; const m=p>0?(l/p)*100:0; return `<span class="tag" style="cursor:pointer" onclick="document.getElementById('mkMarkup').value='${(p/custo).toFixed(2)}';ui.calcularMarkup()">${this.formatarMoeda(p)} (${m.toFixed(0)}%)</span>`; }).join(' ');
    }

    calcularMarkupPorMargem() {
        const custo = parseFloat(document.getElementById('mkCusto')?.value)||0;
        const m = parseFloat(document.getElementById('mkMargem')?.value)||0;
        if (custo>0 && m>0 && m<100) {
            document.getElementById('mkMarkup').value = (1/(1-m/100)).toFixed(2);
            this.calcularMarkup();
        }
    }
}

let ui;
document.addEventListener('DOMContentLoaded', () => {
    ui = new UIController();
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js'));
    }
    window.ui = ui; window.state = state;
});
