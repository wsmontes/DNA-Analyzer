/**
 * DNA Explorer - Main Application
 * 
 * Automated workflow with comprehensive analysis and API logging
 */

import ProxyManager from './modules/proxyManager.js';
import DataManager from './modules/dataManager.js';
import UIManager from './modules/uiManager.js';
import FileProcessor from './modules/fileProcessor.js';
import ChartManager from './modules/chartManager.js';
import SNPediaManager from './modules/snpediaManager.js';
import GeneDiscovery from './modules/geneDiscovery.js';
import Logger from './modules/logger.js';

// Expose modules for easier debugging in console
window.proxyManager = ProxyManager;
window.logger = Logger;
window.dataManager = DataManager;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  Logger.info('Initializing DNA Explorer...');

  // Initialize managers
  UIManager.init();
  ChartManager.init();
  DataManager.init();
  SNPediaManager.init();

  // Initialize the ProxyManager in the background
  ProxyManager.initialize();

  // Add SNPedia attribution to the footer
  addSNPediaAttribution();
  
  // Create log viewer button in footer
  addLogViewerButton();
  
  // Set up event listener for file upload with automated workflow
  const fileInput = document.getElementById('fileInput');
  
  fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      // Reset UI before starting
      UIManager.resetUI();
      
      // Step 1: Move to processing step
      UIManager.goToStep('processing');
      
      // Step 2: Process DNA file
      UIManager.showLoading('Lendo arquivo de DNA...');
      const dnaData = await FileProcessor.processDnaFile(file);
      
      // Update status with initial counts
      UIManager.updateStatusMessage(`Processados ${dnaData.length.toLocaleString()} SNPs`);
      
      // Initialize connection to external APIs
      UIManager.updateProgress({ 
        loaded: 0,
        total: 4,
        stage: 'Estabelecendo conexões com APIs...'
      });
      
      const proxyReady = await ProxyManager.initialize();
      if (!proxyReady) {
        UIManager.updateStatusMessage('Aviso: Conectividade de API limitada');
      } else {
        UIManager.updateStatusMessage('Conexões com APIs estabelecidas');
      }
      
      // Step 3: Comprehensive analysis of SNPs against SNPedia database
      UIManager.updateProgress({ 
        loaded: 1,
        total: 4,
        stage: 'Iniciando análise abrangente...'
      });
      
      const analysisResults = await FileProcessor.analyzeDnaData(dnaData, progress => {
        UIManager.updateProgress({
          ...progress,
          total: progress.total || 'continua',
          loaded: progress.loaded || 0
        });
      });
      
      UIManager.updateProgress({ 
        loaded: 2,
        total: 4,
        stage: 'Gerando visualizações...'
      });
      
      // Create charts
      const genoChartCanvas = document.getElementById('genoChart');
      ChartManager.createGenotypeChart(genoChartCanvas, dnaData);
      
      const chromChartCanvas = document.getElementById('chromChart');
      ChartManager.createChromosomeDistributionChart(chromChartCanvas, dnaData);
      
      // Step 4: Move to gene discovery step automatically
      UIManager.goToStep('discovery');
      
      UIManager.updateProgress({ 
        loaded: 3,
        total: 4,
        stage: 'Descobrindo genes relevantes...'
      });
      
      // Initialize the gene discovery module with user data
      GeneDiscovery.init(dnaData);
      
      // Discover relevant genes with progress reporting
      const geneResults = await GeneDiscovery.discoverRelevantGenes(progress => {
        UIManager.updateDiscoveryProgress(progress);
      });
      
      // Step 5: Store gene results and update the UI
      DataManager.geneDiscoveryResults = geneResults;
      
      // Step 6: Move to results step and show the processed data
      UIManager.goToStep('results');
      UIManager.updateUI(analysisResults);
      
      // Display gene results in the appropriate section
      UIManager.displayGeneResults(geneResults);
      
      // Show success message
      UIManager.updateStatusMessage('Análise completa - Explore seus resultados');
      
    } catch (error) {
      console.error("Erro ao processar DNA:", error);
      UIManager.showError(error.message);
    }
  });

  // Add click handler for SNP links
  window.fetchDetails = async (rsid) => {
    await UIManager.fetchDetails(rsid);
  };
  
  console.log('DNA Explorer inicializado com sucesso!');
});

// Function to add SNPedia attribution
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

// Function to add log viewer button to footer
function addLogViewerButton() {
  const footer = document.querySelector('#status-footer .action-buttons');
  if (!footer) return;
  
  const logButton = document.createElement('button');
  logButton.className = 'btn btn-sm btn-outline';
  logButton.innerText = 'View API Logs';
  logButton.addEventListener('click', () => {
    console.groupCollapsed('DNA Explorer API Logs');
    console.log('API Response Logs:', Logger.getApiLogs());
    console.log('To view more details, access window.logger.getApiLogs()');
    console.groupEnd();
  });
  
  footer.appendChild(logButton);
}
