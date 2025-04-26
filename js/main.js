/**
 * DNA Explorer - Aplicação principal
 * 
 * Este arquivo inicializa e coordena todos os módulos da aplicação
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
