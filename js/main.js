/**
 * DNA Explorer - Main Application
 * 
 * Enhanced with API diagnostics and robust gene discovery
 */

import DataManager from './modules/dataManager.js';
import FileProcessor from './modules/fileProcessor.js';
import UIManager from './modules/uiManager.js';
import ProxyManager from './modules/proxyManager.js';
import APIDiagnostics from './modules/apiDiagnostics.js';
import Logger from './modules/logger.js';

document.addEventListener('DOMContentLoaded', () => {
  // Get file input element
  const fileInput = document.getElementById('dna-file');
  
  // Set up file input handler
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
      
      // Perform local analysis first without API calls
      UIManager.updateProgress({
        loaded: 0,
        total: 2,
        stage: 'Performing local analysis...'
      });
      
      // Process data locally
      // Ensure DataManager is initialized
      DataManager.init();
      const localResults = await DataManager.performLocalAnalysis(dnaData);
      
      // Update UI with local results
      UIManager.updateProgress({
        loaded: 2,
        total: 2,
        stage: 'Local analysis complete'
      });
      
      // Move to results step
      UIManager.goToStep('results');
      UIManager.hideLoading();
      
      // Update UI with local results
      UIManager.updateUI(localResults);
      
      // Make API analysis function available globally for the button
      window.performApiAnalysis = async () => {
        // Check connection status before proceeding
        const apiStatus = await APIDiagnostics.checkAllConnections();
        
        // Initialize connection to external APIs
        const proxyReady = await ProxyManager.initialize();
        
        if (!proxyReady) {
          throw new Error('Limited API connectivity. Some features may not work properly.');
        }
        
        // Perform extended analysis using APIs
        const apiResults = await DataManager.performApiAnalysis(localResults.allResults);
        
        return apiResults;
      };
      
    } catch (error) {
      // Handle errors
      console.error("Error processing file:", error);
      UIManager.showError(error.message || 'An unexpected error occurred.');
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
