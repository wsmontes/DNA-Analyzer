/**
 * DNA Explorer - Aplicação principal
 * 
 * Updated to support new SNPedia features with continuation
 */

import ProxyManager from './modules/proxyManager.js';
import DataManager from './modules/dataManager.js';
import UIManager from './modules/uiManager.js';
import FileProcessor from './modules/fileProcessor.js';
import ChartManager from './modules/chartManager.js';
import SNPediaManager from './modules/snpediaManager.js';

// Expor ProxyManager para facilitar o debug na console
window.proxyManager = ProxyManager;

// Inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  console.log('Inicializando DNA Explorer...');

  // Inicializar gerenciadores
  UIManager.init();
  ChartManager.init();
  DataManager.init();

  // Inicializar o ProxyManager em segundo plano
  ProxyManager.initialize();

  // Adicionar atribuição do SNPedia ao rodapé
  addSNPediaAttribution();
  
  // Configuração do event listener para upload de arquivo
  const fileInput = document.getElementById('fileInput');
  
  fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      // Resetar UI e mostrar carregamento
      UIManager.resetUI();
      UIManager.showLoading('Processando arquivo...');
      
      // Processar o arquivo DNA
      const dnaData = await FileProcessor.processDnaFile(file);
      
      // Garantir que temos um proxy funcionando
      UIManager.showLoading('Inicializando conexões...');
      const proxyReady = await ProxyManager.initialize();
      if (!proxyReady) {
        alert("Não foi possível estabelecer conexão com APIs externas. Algumas funcionalidades podem ser limitadas.");
      }
      
      // Analisar dados para obter insights
      UIManager.showLoading('Analisando amostra de SNPs...');
      const analysisResults = await FileProcessor.analyzeDnaData(dnaData);
      
      // Atualizar a UI com os resultados
      UIManager.updateUI(analysisResults);
      
      // Criar gráficos
      const genoChartCanvas = document.getElementById('genoChart');
      ChartManager.createGenotypeChart(genoChartCanvas, dnaData);
      
      const chromChartCanvas = document.getElementById('chromChart');
      ChartManager.createChromosomeDistributionChart(chromChartCanvas, dnaData);
      
    } catch (error) {
      console.error("Erro ao processar DNA:", error);
      UIManager.showError(error.message);
    } finally {
      UIManager.hideLoading();
    }
  });

  // Adicionar função para buscar detalhes de um SNP
  window.fetchDetails = async (rsid) => {
    await UIManager.fetchDetails(rsid);
  };
  
  console.log('DNA Explorer inicializado com sucesso!');

  // Add UI element for comprehensive SNPedia analysis
  const dataSection = document.getElementById('dataSection');
  if (dataSection) {
    const btnContainer = document.createElement('div');
    btnContainer.className = 'action-buttons';
    btnContainer.style.marginTop = '20px';
    btnContainer.style.textAlign = 'center';
    
    const snpediaBtn = document.createElement('button');
    snpediaBtn.className = 'btn btn-primary';
    snpediaBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M13.5 3a.5.5 0 0 1 .5.5V11H2V3.5a.5.5 0 0 1 .5-.5h11zm-11-1A1.5 1.5 0 0 0 1 3.5v10A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-10A1.5 1.5 0 0 0 13.5 2h-11zM0 12.5h16a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 12.5z"/>
      </svg>
      Comprehensive SNPedia Analysis
    `;
    
    snpediaBtn.addEventListener('click', async () => {
      UIManager.showLoading('Starting comprehensive SNPedia analysis...');
      
      try {
        // Get all SNPs from SNPedia that match user data
        await DataManager.getRelevantSnpediaSNPs(progress => {
          UIManager.updateProgress(progress);
        });
        
        // Display results in a new section
        createSnpediaResultsSection();
        
      } catch (error) {
        console.error("Error during comprehensive SNPedia analysis:", error);
        UIManager.showError("Failed to complete SNPedia analysis: " + error.message);
      } finally {
        UIManager.hideLoading();
      }
    });
    
    btnContainer.appendChild(snpediaBtn);
    dataSection.appendChild(btnContainer);
  }

  function createSnpediaResultsSection() {
    const container = document.querySelector('main.container');
    
    // Create new section for SNPedia results
    const section = document.createElement('section');
    section.id = 'snpediaResultsSection';
    section.className = 'section';
    
    section.innerHTML = `
      <div class="section-header">
        <h2 class="section-title">SNPedia Analysis Results</h2>
        <div>
          <span style="font-size:0.8em;color:var(--gray)">
            Data from SNPedia under <a href="https://creativecommons.org/licenses/by-nc-sa/3.0/us/" target="_blank">CC BY-NC-SA 3.0 US</a>
          </span>
        </div>
      </div>
      <div id="snpediaResults">
        <p>Detailed SNPedia analysis complete. Results will be displayed here.</p>
      </div>
    `;
    
    // Insert before the details section
    const detailsEl = document.getElementById('details');
    container.insertBefore(section, detailsEl);
  }

  // Add Gene Analysis button to the UI
  function addGeneAnalysisButton() {
    const dataSection = document.getElementById('dataSection');
    if (!dataSection) return;
    
    // Create container for gene analysis section
    const geneAnalysisSection = document.createElement('section');
    geneAnalysisSection.id = 'geneAnalysisSection';
    geneAnalysisSection.className = 'section';
    geneAnalysisSection.style.display = 'none';
    document.querySelector('main.container').insertBefore(geneAnalysisSection, document.getElementById('details'));
    
    // Store reference in the UI manager
    UIManager.elements.geneAnalysisEl = geneAnalysisSection;
    
    // Add button to data section
    const btnContainer = document.createElement('div');
    btnContainer.className = 'action-buttons';
    btnContainer.style.marginTop = '20px';
    btnContainer.style.textAlign = 'center';
    
    const geneAnalysisBtn = document.createElement('button');
    geneAnalysisBtn.className = 'btn btn-primary';
    geneAnalysisBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
        <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
      </svg>
      Prioritized Gene Analysis
    `;
    
    geneAnalysisBtn.addEventListener('click', async () => {
      UIManager.showLoading('Starting gene prioritization analysis...');
      
      try {
        // Run gene prioritization analysis
        const prioritizedData = await DataManager.getPrioritizedGeneSNPs(progress => {
          UIManager.updateProgress(progress);
        });
        
        // Display the results
        UIManager.displayPrioritizedGeneAnalysis(prioritizedData);
        
        // Scroll to the results
        document.getElementById('geneAnalysisSection').scrollIntoView({ behavior: 'smooth' });
        
      } catch (error) {
        console.error("Error in gene prioritization:", error);
        UIManager.showError("Failed to complete gene prioritization: " + error.message);
      } finally {
        UIManager.hideLoading();
      }
    });
    
    btnContainer.appendChild(geneAnalysisBtn);
    dataSection.appendChild(btnContainer);
  }

  // Call this during initialization after the UI is setup
  addGeneAnalysisButton();
});

// Função para adicionar atribuição do SNPedia
function addSNPediaAttribution() {
  const footer = document.createElement('footer');
  footer.className = 'attribution-footer';
  footer.innerHTML = `
    <div class="container">
      <p>
        SNP data provided by <a href="https://www.snpedia.com/" target="_blank">SNPedia</a>. 
        SNPedia content is available under a 
        <a href="https://creativecommons.org/licenses/by-nc-sa/3.0/us/" target="_blank">
          Creative Commons Attribution-Noncommercial-Share Alike 3.0 United States License
        </a>.
      </p>
    </div>
  `;
  document.body.appendChild(footer);
}
