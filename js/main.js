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

// Expor ProxyManager para facilitar o debug na console
window.proxyManager = ProxyManager;

// Inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  console.log('Inicializando DNA Explorer...');

  // Inicializar gerenciadores
  UIManager.init();
  ChartManager.init();

  // Inicializar o ProxyManager em segundo plano
  ProxyManager.initialize();

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

  // Adicionar função para baixar relatório
  window.fetchDetails = async (rsid) => {
    await UIManager.fetchDetails(rsid);
  };
  
  console.log('DNA Explorer inicializado com sucesso!');
});
