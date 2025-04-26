/**
 * UIManager
 * 
 * Responsável por gerenciar a interface do usuário e renderização
 */
import DataManager from './dataManager.js';

const UIManager = {
  elements: {}, // Armazenar referências a elementos DOM
  tableEl: null,

  // Inicializar referências aos elementos DOM
  init() {
    this.elements = {
      loading: document.getElementById('loading'),
      tableContainer: document.getElementById('table'),
      paginationEl: document.getElementById('pagination'),
      detailsEl: document.getElementById('details'),
      searchInput: document.getElementById('searchInput'),
      chromFilter: document.getElementById('chromFilter'),
      downloadBtn: document.getElementById('downloadBtn'),
      dashboardEl: document.getElementById('dashboard'),
      insightsEl: document.getElementById('insights'),
      insightSection: document.getElementById('insightSection'),
      dataSection: document.getElementById('dataSection'),
      traitsEl: document.getElementById('traits'),
      uploadArea: document.getElementById('uploadArea'),
      fileInput: document.getElementById('fileInput')
    };

    // Configurar tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        tabPanels.forEach(panel => panel.classList.remove('active'));
        document.getElementById(btn.dataset.tab).classList.add('active');
      });
    });

    // Configurar área de upload (drag & drop)
    this.elements.uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.elements.uploadArea.classList.add('dragover');
    });
    
    this.elements.uploadArea.addEventListener('dragleave', () => {
      this.elements.uploadArea.classList.remove('dragover');
    });
    
    this.elements.uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      this.elements.uploadArea.classList.remove('dragover');
      
      if (e.dataTransfer.files.length) {
        this.elements.fileInput.files = e.dataTransfer.files;
        // Disparar o evento change manualmente
        const event = new Event('change');
        this.elements.fileInput.dispatchEvent(event);
      }
    });

    // Adicionar event listeners
    this.elements.searchInput.addEventListener('input', () => this.handleFilterChange());
    this.elements.chromFilter.addEventListener('change', () => this.handleFilterChange());
    this.elements.downloadBtn.addEventListener('click', () => this.downloadReport());
  },

  // Mostrar indicador de carregamento
  showLoading(message = 'Processando dados de DNA...') {
    this.elements.loading.style.display = 'block';
    this.elements.loading.innerHTML = `<span class="spinner"></span> ${message}`;
  },

  // Ocultar indicador de carregamento
  hideLoading() {
    this.elements.loading.style.display = 'none';
  },

  // Redefinir UI para o estado inicial
  resetUI() {
    this.elements.dashboardEl.innerHTML = '';
    this.elements.dashboardEl.style.display = 'none';
    this.elements.insightsEl.innerHTML = '';
    this.elements.insightSection.style.display = 'none';
    this.elements.dataSection.style.display = 'none';
    document.getElementById('summary')?.remove();
    this.elements.tableContainer.innerHTML = '';
    this.elements.paginationEl.innerHTML = '';
    document.getElementById('charts').innerHTML = '<canvas id="genoChart" width="600" height="300"></canvas>';
    this.elements.detailsEl.innerHTML = '';
    this.elements.detailsEl.style.display = 'none';
    this.elements.searchInput.value = '';
    this.elements.chromFilter.value = '';
    this.elements.chromFilter.innerHTML = '<option value="">All chromosomes</option>';
    this.elements.traitsEl.innerHTML = '';
  },

  // Atualizar UI com resultados da análise
  updateUI(data) {
    const { allResults, clinCounts, traitCounts, ancestryHints, clinSummary, traitSummary, topInsights } = data;
    
    // Mostrar dashboard e seções
    this.elements.dashboardEl.style.display = 'block';
    this.elements.insightSection.style.display = 'block';
    this.elements.dataSection.style.display = 'block';

    // Dashboard
    this.elements.dashboardEl.innerHTML = `
      <div class="dashboard-card">
        <div class="number">${allResults.length.toLocaleString()}</div>
        <div class="label">Total SNPs</div>
      </div>
      <div class="dashboard-card">
        <div class="number">${(clinCounts.pathogenic + clinCounts.likely_pathogenic)}</div>
        <div class="label">Potencialmente Patogênico</div>
      </div>
      <div class="dashboard-card">
        <div class="number">${Object.keys(traitCounts).length}</div>
        <div class="label">Traços/Fenótipos</div>
      </div>
      <div class="dashboard-card">
        <div class="number">${ancestryHints}</div>
        <div class="label">Marcadores de Ancestralidade</div>
      </div>
    `;

    // Insights
    this.elements.insightsEl.innerHTML = `
      <h3>Principais Insights</h3>
      ${topInsights.length ? topInsights.map(i=>`<div class="insight-item">${i}</div>`).join('') : '<div class="insight-item">Nenhuma descoberta de alta prioridade nos primeiros 50 SNPs.</div>'}
      <div style="margin-top:10px;font-size:0.9em;color:var(--gray);">(Clique em um SNP na tabela para mais detalhes. Apenas os primeiros 50 SNPs são analisados profundamente para velocidade.)</div>
    `;

    // Aba de Traços/Saúde
    let traitHtml = '';
    if (traitSummary.length) {
      traitHtml += `<h3>Saúde & Traços</h3>`;
      traitHtml += `<table><thead><tr><th>rsID</th><th>Gene</th><th>Traços</th><th>Fenótipos</th></tr></thead><tbody>`;
      for (const t of traitSummary) {
        traitHtml += `<tr>
          <td><span class="snp-link" data-rsid="${t.rsid}">${t.rsid}</span></td>
          <td>${t.gene}</td>
          <td>${t.traits.map(tr=>`<span class="trait-keyword">${tr}</span>`).join('')}</td>
          <td>${t.phenotypes.map(p=>p.description).join('; ')}</td>
        </tr>`;
      }
      traitHtml += `</tbody></table>`;
    } else {
      traitHtml = `<div>Nenhuma associação de traço/fenótipo encontrada nos primeiros 50 SNPs.</div>`;
    }
    this.elements.traitsEl.innerHTML = traitHtml;

    // Configurar tabela e filtros de cromossomo
    this.setupTable();
    this.setupChromosomeFilter(allResults);
    this.renderTablePage();
    this.setupPagination();

    // Adicionar listeners para links de SNP
    document.querySelectorAll('.snp-link').forEach(link => {
      link.addEventListener('click', () => this.fetchDetails(link.dataset.rsid || link.textContent));
    });
  },

  // Configurar tabela principal
  setupTable() {
    this.tableEl = document.createElement('table');
    this.tableEl.innerHTML = `<thead><tr><th>rsID</th><th>Cromossomo</th><th>Posição</th><th>Genótipo</th></tr></thead><tbody></tbody>`;
    this.elements.tableContainer.innerHTML = '';
    this.elements.tableContainer.append(this.tableEl);
  },

  // Configurar filtro de cromossomos
  setupChromosomeFilter(results) {
    const chroms = [...new Set(results.map(r => r.chromosome))].sort((a, b) => {
      const na = parseInt(a); const nb = parseInt(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      if (!isNaN(na)) return -1; if (!isNaN(nb)) return 1;
      return a.localeCompare(b);
    });
    
    this.elements.chromFilter.innerHTML = '<option value="">Todos os cromossomos</option>';
    chroms.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = `Cromossomo ${c}`;
      this.elements.chromFilter.append(opt);
    });
  },

  // Renderizar página da tabela
  renderTablePage() {
    if (!this.tableEl) return;
    
    const start = (DataManager.currentPage - 1) * DataManager.rowsPerPage;
    const end = start + DataManager.rowsPerPage;
    const pageData = DataManager.filteredResults.slice(start, end);

    const tbody = this.tableEl.querySelector('tbody');
    tbody.innerHTML = pageData.map(r => `
      <tr data-rsid="${r.rsid}" style="cursor:pointer;">
        <td><span class="snp-link" data-rsid="${r.rsid}">${r.rsid}</span></td>
        <td>${r.chromosome}</td>
        <td>${r.position}</td>
        <td>${r.Genotype}</td>
      </tr>`).join('');

    // Adicionar listeners de clique às novas linhas (para acessibilidade por teclado)
    tbody.querySelectorAll('tr[data-rsid]').forEach(row => {
      row.addEventListener('click', (e) => {
        // Não disparar se clicaram diretamente no link
        if (!e.target.classList.contains('snp-link')) {
          this.fetchDetails(row.dataset.rsid);
        }
      });
    });

    tbody.querySelectorAll('.snp-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.fetchDetails(link.dataset.rsid);
      });
    });
  },

  // Configurar paginação
  setupPagination() {
    this.elements.paginationEl.innerHTML = '';
    const totalPages = Math.ceil(DataManager.filteredResults.length / DataManager.rowsPerPage);

    if (totalPages <= 1) return;

    const prevButton = document.createElement('button');
    prevButton.textContent = 'Anterior';
    prevButton.disabled = DataManager.currentPage === 1;
    prevButton.addEventListener('click', () => {
      if (DataManager.currentPage > 1) {
        DataManager.currentPage--;
        this.renderTablePage();
        this.setupPagination();
      }
    });
    this.elements.paginationEl.appendChild(prevButton);

    const pageInfo = document.createElement('span');
    pageInfo.textContent = ` Página ${DataManager.currentPage} de ${totalPages} `;
    pageInfo.style.margin = '0 10px';
    this.elements.paginationEl.appendChild(pageInfo);

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Próximo';
    nextButton.disabled = DataManager.currentPage === totalPages;
    nextButton.addEventListener('click', () => {
      if (DataManager.currentPage < totalPages) {
        DataManager.currentPage++;
        this.renderTablePage();
        this.setupPagination();
      }
    });
    this.elements.paginationEl.appendChild(nextButton);
  },

  // Lidar com alteração no filtro
  handleFilterChange() {
    const searchQuery = this.elements.searchInput.value;
    const chromosomeFilter = this.elements.chromFilter.value;
    
    DataManager.filterResults(searchQuery, chromosomeFilter);
    this.renderTablePage();
    this.setupPagination();
  },

  // Baixar relatório
  downloadReport() {
    if (DataManager.allResults.length === 0) {
      alert("Nenhum dado carregado para download.");
      return;
    }
    const dataToDownload = DataManager.allResults;
    const blob = new Blob([JSON.stringify(dataToDownload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dna_report.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Buscar e exibir detalhes de um SNP
  async fetchDetails(rsid) {
    if (!rsid) return;
    
    this.elements.detailsEl.style.display = 'block';
    this.elements.detailsEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <span class="spinner"></span>
        <p>Carregando detalhes para ${rsid}...</p>
      </div>
    `;
    
    // Rolar para os detalhes
    this.elements.detailsEl.scrollIntoView({behavior: 'smooth'});
    
    let ensemblInfo = {};
    let popFreq = {};
    let snpediaSummary = 'Não foi possível buscar o resumo do SNPedia.';
    let errorMessages = [];

    try {
      // Usar dataManager para buscar os dados
      ensemblInfo = await DataManager.fetchSnp(rsid);
    } catch (err) {
      errorMessages.push(`Falha ao buscar dados de variação do Ensembl: ${err.message}`);
    }

    // Buscar frequências populacionais
    if (ensemblInfo.name) {
      try {
        const pfData = await DataManager.fetchPopulationFrequencies(rsid);
        if (pfData && pfData.length > 0) {
          popFreq = pfData.reduce((acc, p) => {
            acc[p.population] = p.frequency !== undefined ? p.frequency.toFixed(4) : 'N/A';
            return acc;
          }, {});
        } else {
          popFreq = { 'Info': 'Nenhum dado populacional disponível.' };
        }
      } catch (err) {
        errorMessages.push(`Falha ao buscar frequências populacionais: ${err.message}`);
        popFreq = { 'Erro': 'Não foi possível carregar os dados.' };
      }
    } else {
      popFreq = { 'Info': 'Ignorado devido a erro na busca de variação.' };
    }

    // Buscar resumo do SNPedia
    try {
      snpediaSummary = await DataManager.fetchSnpediaSummary(rsid);
    } catch (err) {
      errorMessages.push(`Falha ao buscar resumo do SNPedia: ${err.message}`);
    }

    // --- Exibir resultados ---
    const clinicalSignificance = (ensemblInfo.clinical_significance || []).join(', ') || 'nenhuma';
    const popFreqHtml = Object.entries(popFreq).length > 0 
      ? Object.entries(popFreq).map(([pop, freq]) => `<li>${pop}: ${freq}</li>`).join('') 
      : '<li>Nenhum dado populacional disponível</li>';
    const phenotypesHtml = (ensemblInfo.phenotypes || []).length > 0
      ? (ensemblInfo.phenotypes || []).map(p => `<li>${p.description}</li>`).join('')
      : '<li>Nenhum dado de fenótipo disponível</li>';

    // Exibir qual proxy está sendo usado (se houver)
    let proxyInfo = '<span style="font-size:0.9em;color:var(--gray)">Status do proxy: Não inicializado</span>';
    if (window.proxyManager && window.proxyManager.isInitialized && window.proxyManager.currentProxy) {
      proxyInfo = window.proxyManager.currentProxy.url
        ? `<span style="font-size:0.9em;color:var(--gray)">Usando: proxy ${window.proxyManager.currentProxy.name}</span>`
        : '<span style="font-size:0.9em;color:var(--gray)">Usando: Acesso direto à API</span>';
    }
    
    // Adicionar estilo de significância clínica
    let clinicalClass = '';
    let clinText = clinicalSignificance;
    if (clinicalSignificance.includes('pathogenic')) {
      clinicalClass = 'clin-pathogenic';
    } else if (clinicalSignificance.includes('benign')) {
      clinicalClass = 'clin-benign';
    } else if (clinicalSignificance.includes('uncertain')) {
      clinicalClass = 'clin-uncertain';
    }

    this.elements.detailsEl.innerHTML = `
      <h2>
        Detalhes para ${rsid}
        <small>${proxyInfo}</small>
      </h2>
      
      ${errorMessages.length > 0 ? 
        `<div style="padding:12px;background:rgba(230,57,70,0.1);border-radius:var(--radius);margin-bottom:20px;">
           <strong>⚠️ Nota:</strong> ${errorMessages.join('<br>')}
         </div>` : ''}
      
      <div class="external-links">
        <a href="https://www.snpedia.com/index.php/${rsid}" target="_blank">SNPedia</a>
        <a href="https://www.ncbi.nlm.nih.gov/snp/${rsid}" target="_blank">dbSNP</a>
        <a href="https://grch37.ensembl.org/Homo_sapiens/Variation/Summary?v=${rsid}" target="_blank">Ensembl</a>
      </div>
      
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:24px;margin-bottom:24px;">
        <div>
          <p><strong>Consequência Mais Grave:</strong> ${ensemblInfo.most_severe_consequence || 'N/A'}</p>
          <p><strong>Alelo Ancestral:</strong> ${ensemblInfo.ancestral_allele || 'N/A'}</p>
          <p><strong>Significância Clínica:</strong> <span class="${clinicalClass}">${clinText}</span></p>
          <p><strong>Gene Mapeado:</strong> ${ensemblInfo.mapped_genes?.[0]?.gene_symbol || 'N/A'}</p>
        </div>
        <div>
          <p><strong>Alelo Menor:</strong> ${ensemblInfo.minor_allele || 'N/A'}</p>
          <p><strong>MAF:</strong> ${ensemblInfo.MAF ? ensemblInfo.MAF.toFixed(4) : 'N/A'}</p>
          <p><strong>Assembly:</strong> ${ensemblInfo.assembly_name || 'N/A'}</p>
        </div>
      </div>

      <h3>Frequências Populacionais</h3>
      <ul class="freq-list">${popFreqHtml}</ul>
      
      <h3>Fenótipos</h3>
      <ul class="phenotype-list">${phenotypesHtml}</ul>
      
      <h3>Resumo do SNPedia</h3>
      <div style="padding:16px;background:#f8f9fa;border-radius:var(--radius);">${snpediaSummary.replace(/\n/g, '<br>')}</div>
      
      <details>
        <summary>JSON de Variação Completo do Ensembl</summary>
        <pre>${JSON.stringify(ensemblInfo, null, 2)}</pre>
      </details>
    `;
  },

  // Exibir mensagem de erro
  showError(errorMessage) {
    this.resetUI();
    this.hideLoading();
    
    const errorHtml = `
      <div class="section" style="text-align:center;margin-top:40px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="#e63946" viewBox="0 0 16 16">
          <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
          <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
        </svg>
        <h2 style="margin:20px 0">Erro ao Processar Arquivo DNA</h2>
        <p style="color:var(--danger)">${errorMessage}</p>
        <button class="btn btn-primary" style="margin-top:20px;" onclick="location.reload()">Tentar Novamente</button>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', errorHtml);
  }
};

export default UIManager;
