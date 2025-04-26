/**
 * DNA Explorer - Main Application
 * 
 * Automated workflow with step-by-step guidance
 */

import ProxyManager from './modules/proxyManager.js';
import DataManager from './modules/dataManager.js';
import UIManager from './modules/uiManager.js';
import FileProcessor from './modules/fileProcessor.js';
import ChartManager from './modules/chartManager.js';
import SNPediaManager from './modules/snpediaManager.js';
import GeneDiscovery from './modules/geneDiscovery.js';

// Expose ProxyManager for easier debugging in console
window.proxyManager = ProxyManager;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing DNA Explorer...');

  // Initialize managers
  UIManager.init();
  ChartManager.init();
  DataManager.init();

  // Initialize the ProxyManager in the background
  ProxyManager.initialize();

  // Add SNPedia attribution to the footer
  addSNPediaAttribution();
  
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
      UIManager.showLoading('Reading DNA file...');
      const dnaData = await FileProcessor.processDnaFile(file);
      
      // Update status with initial counts
      UIManager.updateStatusMessage(`Processed ${dnaData.length.toLocaleString()} SNPs`);
      
      // Initialize connection to external APIs
      UIManager.updateProgress({ 
        loaded: 0,
        total: 3,
        stage: 'Establishing API connections...'
      });
      
      const proxyReady = await ProxyManager.initialize();
      if (!proxyReady) {
        UIManager.updateStatusMessage('Warning: Limited API connectivity');
      } else {
        UIManager.updateStatusMessage('API connections established');
      }
      
      // Step 3: Initial analysis of sample SNPs
      UIManager.updateProgress({ 
        loaded: 1,
        total: 3,
        stage: 'Analyzing sample SNPs...'
      });
      
      const analysisResults = await FileProcessor.analyzeDnaData(dnaData);
      
      // Step 4: Generate charts
      UIManager.updateProgress({ 
        loaded: 2,
        total: 3,
        stage: 'Generating visualization...'
      });
      
      // Create charts (will be displayed when that section is viewed)
      const genoChartCanvas = document.getElementById('genoChart');
      ChartManager.createGenotypeChart(genoChartCanvas, dnaData);
      
      const chromChartCanvas = document.getElementById('chromChart');
      ChartManager.createChromosomeDistributionChart(chromChartCanvas, dnaData);
      
      // Step 5: Move to gene discovery step automatically
      UIManager.goToStep('discovery');
      
      // Step 6: Run gene discovery
      // Initialize the gene discovery module with user data
      GeneDiscovery.init(dnaData);
      
      // Discover relevant genes with progress reporting
      const geneResults = await GeneDiscovery.discoverRelevantGenes(progress => {
        UIManager.updateDiscoveryProgress(progress);
      });
      
      // Step 7: Store gene results and update the UI
      DataManager.geneDiscoveryResults = geneResults;
      
      // Step 8: Move to results step and show the processed data
      UIManager.goToStep('results');
      UIManager.updateUI(analysisResults);
      
      // Display gene results in the appropriate section
      UIManager.displayGeneResults(geneResults);
      
      // Show success message
      UIManager.updateStatusMessage('Analysis complete - Explore your results');
      
    } catch (error) {
      console.error("Error processing DNA:", error);
      UIManager.showError(error.message);
    }
  });

  // Add click handler for SNP links
  window.fetchDetails = async (rsid) => {
    await UIManager.fetchDetails(rsid);
  };
  
  console.log('DNA Explorer successfully initialized!');
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
