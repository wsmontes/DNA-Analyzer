/**
 * DNA Explorer - Main Application
 * 
 * Enhanced with API diagnostics and robust gene discovery
 */

import ProxyManager from './modules/proxyManager.js';
import DataManager from './modules/dataManager.js';
import UIManager from './modules/uiManager.js';
import FileProcessor from './modules/fileProcessor.js';
import ChartManager from './modules/chartManager.js';
import SNPediaManager from './modules/snpediaManager.js';
import GeneDiscovery from './modules/geneDiscovery.js';
import APIDiagnostics from './modules/apiDiagnostics.js';
import Logger from './modules/logger.js';

// Expose modules for easier debugging in console
window.proxyManager = ProxyManager;
window.logger = Logger;
window.dataManager = DataManager;
window.apiDiagnostics = APIDiagnostics;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  Logger.info('Initializing DNA Explorer...');

  // Initialize managers
  UIManager.init();
  ChartManager.init();
  DataManager.init();
  SNPediaManager.init();
  
  // Initialize API diagnostics
  APIDiagnostics.init({
    snpedia: document.getElementById('snpedia-status'),
    ensembl: document.getElementById('ensembl-status'),
    geneDb: document.getElementById('gene-db-status')
  });

  // Initialize the ProxyManager in the background
  ProxyManager.initialize();
  
  // Test API connections
  APIDiagnostics.checkAllConnections()
    .then(results => {
      Logger.info('API connection check results:', results);
      // If SNPedia is down, show a warning
      if (!results.snpedia?.ok) {
        Logger.warn('SNPedia connection failed. Gene discovery may be limited.');
        APIDiagnostics.logToDebugPanel('SNPedia connection failed. Gene discovery may be limited.', 'warning');
      }
    })
    .catch(err => {
      Logger.error('Error checking API connections:', err);
    });

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
      UIManager.showLoading('Reading DNA file...');
      const dnaData = await FileProcessor.processDnaFile(file);
      
      // Update status with initial counts
      UIManager.updateStatusMessage(`Processed ${dnaData.length.toLocaleString()} SNPs`);
      Logger.info(`Processed ${dnaData.length} SNPs from file ${file.name}`);
      
      // Check connection status before proceeding
      APIDiagnostics.logToDebugPanel('Checking API connections before analysis...', 'info');
      const apiStatus = await APIDiagnostics.checkAllConnections();
      
      // Initialize connection to external APIs
      UIManager.updateProgress({ 
        loaded: 0,
        total: 4,
        stage: 'Establishing API connections...'
      });
      
      const proxyReady = await ProxyManager.initialize();
      if (!proxyReady) {
        UIManager.updateStatusMessage('Warning: Limited API connectivity');
        APIDiagnostics.logToDebugPanel('Proxy initialization failed. Using direct connections.', 'warning');
      } else {
        UIManager.updateStatusMessage('API connections established');
        APIDiagnostics.logToDebugPanel('Proxy initialized successfully.', 'success');
      }
      
      // Step 3: Comprehensive analysis of SNPs against SNPedia database
      UIManager.updateProgress({ 
        loaded: 1,
        total: 4,
        stage: 'Starting comprehensive analysis...'
      });
      
      // Log a sample of the DNA data
      Logger.debug('DNA data sample:', dnaData.slice(0, 3));
      
      const analysisResults = await FileProcessor.analyzeDnaData(dnaData, progress => {
        UIManager.updateProgress({
          ...progress,
          total: progress.total || 'ongoing',
          loaded: progress.loaded || 0
        });
        
        // Also log progress to debug panel
        if (progress.stage && progress.stage !== 'last-stage') {
          APIDiagnostics.logToDebugPanel(progress.stage, 'info');
          // Store last stage to avoid duplicate logs
          window.lastStage = progress.stage;
        }
      });
      
      // Log analysis completion
      Logger.info('DNA analysis complete with results:', {
        snpCount: analysisResults.allResults.length,
        clinicalFindings: Object.keys(analysisResults.clinCounts).map(k => 
          `${k}: ${analysisResults.clinCounts[k]}`).join(', '),
        traitCount: Object.keys(analysisResults.traitCounts).length,
        error: analysisResults.error
      });
      
      UIManager.updateProgress({ 
        loaded: 2,
        total: 4,
        stage: 'Generating visualizations...'
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
        stage: 'Discovering relevant genes...'
      });
      
      // Initialize the gene discovery module with user data
      GeneDiscovery.init(dnaData);
      APIDiagnostics.logToDebugPanel('Gene discovery started...', 'info');
      
      // Discover relevant genes with progress reporting
      const geneResults = await GeneDiscovery.discoverRelevantGenes(progress => {
        UIManager.updateDiscoveryProgress(progress);
        
        // Log significant stages to debug panel
        if (progress.stage && progress.stage.includes('complete') || 
            progress.stage && progress.stage.includes('Found')) {
          APIDiagnostics.logToDebugPanel(progress.stage, 'info');
        }
      });
      
      // Log gene discovery results
      Logger.info('Gene discovery complete:', {
        totalSnps: geneResults.stats?.totalFound || 0,
        geneCount: geneResults.stats?.geneCount || 0,
        error: geneResults.error
      });
      
      if (geneResults.error) {
        APIDiagnostics.logToDebugPanel(`Gene discovery error: ${geneResults.error}`, 'error');
      } else {
        APIDiagnostics.logToDebugPanel(
          `Gene discovery found ${geneResults.stats?.totalFound || 0} SNPs in ${geneResults.stats?.geneCount || 0} genes`, 
          'success'
        );
      }
      
      // Step 5: Store gene results and update the UI
      DataManager.geneDiscoveryResults = geneResults;
      
      // Step 6: Move to results step and show the processed data
      UIManager.goToStep('results');
      UIManager.updateUI(analysisResults);
      
      // Display gene results in the appropriate section
      UIManager.displayGeneResults(geneResults);
      
      // Show success message
      UIManager.updateStatusMessage('Analysis complete - Explore your results');
      
    } catch (error) {
      console.error("Error processing DNA:", error);
      UIManager.showError(error.message);
      APIDiagnostics.logToDebugPanel(`Error: ${error.message}`, 'error');
    }
  });

  // Add click handler for SNP links
  window.fetchDetails = async (rsid) => {
    await UIManager.fetchDetails(rsid);
  };
  
  console.log('DNA Explorer initialized successfully!');
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
    console.log('All API Responses:', Logger.getApiLogs());
    console.log('Success Responses:', Logger.getApiLogs('success'));
    console.log('Error Responses:', Logger.getApiLogs('error'));
    console.log('Cache Hits:', Logger.getApiLogs('cache'));
    
    // Add API diagnostics
    const apiStatus = window.apiDiagnostics.lastStatus;
    console.log('Current API Status:', apiStatus);
    
    // MediaWiki API help
    console.log('MediaWiki API Documentation: https://www.mediawiki.org/wiki/API');
    console.log('SNPedia API Endpoint: https://bots.snpedia.com/api.php');
    console.log('To view more details, access window.logger.getApiLogs()');
    console.groupEnd();
  });
  
  footer.appendChild(logButton);
  
  // Add diagnostics button
  const diagButton = document.createElement('button');
  diagButton.className = 'btn btn-sm btn-outline';
  diagButton.innerText = 'Test APIs';
  diagButton.addEventListener('click', async () => {
    diagButton.disabled = true;
    diagButton.textContent = 'Testing...';
    try {
      const results = await APIDiagnostics.checkAllConnections();
      console.log('API Connection Test Results:', results);
      alert(
        `SNPedia: ${results.snpedia?.ok ? 'Connected' : 'Failed'}\n` +
        `Ensembl: ${results.ensembl?.ok ? 'Connected' : 'Failed'}\n` +
        `Gene DB: ${results.geneDb?.ok ? 'Connected' : 'Failed'}`
      );
    } catch (err) {
      console.error('API test error:', err);
      alert('API test failed: ' + err.message);
    } finally {
      diagButton.disabled = false;
      diagButton.textContent = 'Test APIs';
    }
  });
  
  footer.appendChild(diagButton);
}
