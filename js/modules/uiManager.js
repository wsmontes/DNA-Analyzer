/**
 * UIManager
 * 
 * Enhanced with automated workflow and better progress indicators
 */
import DataManager from './dataManager.js';

const UIManager = {
  elements: {}, // Store DOM element references
  tableEl: null,
  currentStep: 'upload',
  
  // Initialize DOM element references
  init() {
    this.elements = {
      // Step elements
      stepElements: {
        upload: document.getElementById('step-upload'),
        processing: document.getElementById('step-processing'),
        discovery: document.getElementById('step-discovery'),
        results: document.getElementById('step-results')
      },
      stepContents: {
        upload: document.getElementById('step-content-upload'),
        processing: document.getElementById('step-content-processing'),
        discovery: document.getElementById('step-content-discovery'),
        results: document.getElementById('step-content-results')
      },
      
      // Core elements
      sidebar: document.getElementById('sidebar'),
      sidebarSummary: document.getElementById('sidebar-summary'),
      statusIndicator: document.getElementById('status-indicator'),
      statusFooter: document.getElementById('status-footer'),
      statusMessage: document.querySelector('.status-message'),
      
      // Processing elements
      loading: document.getElementById('loading'),
      discoveryProgress: document.getElementById('discovery-progress'),
      
      // Results elements
      dashboardEl: document.getElementById('dashboard'),
      insightsEl: document.getElementById('insights'),
      tableContainer: document.getElementById('table'),
      paginationEl: document.getElementById('pagination'),
      detailsEl: document.getElementById('details'),
      detailsContent: document.querySelector('.details-content'),
      searchInput: document.getElementById('searchInput'),
      chromFilter: document.getElementById('chromFilter'),
      downloadBtn: document.getElementById('downloadBtn'),
      traitsEl: document.getElementById('traits'),
      genesEl: document.getElementById('genes'),
      uploadArea: document.getElementById('uploadArea'),
      fileInput: document.getElementById('fileInput'),
      apiAnalysisBtn: document.getElementById('apiAnalysisBtn') // Add API analysis button element
    };

    // Setup tab functionality for results
    const sectionTabs = document.querySelectorAll('.section-tab');
    const resultSections = document.querySelectorAll('.result-section');
    
    sectionTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        sectionTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const sectionId = tab.dataset.section + '-section';
        resultSections.forEach(section => {
          section.classList.toggle('active', section.id === sectionId);
        });
      });
    });
    
    // Setup collapsible sections
    document.querySelectorAll('.collapsible-header').forEach(header => {
      header.addEventListener('click', () => {
        const section = header.closest('.collapsible-section');
        section.classList.toggle('open');
      });
    });

    // Close details panel
    document.getElementById('close-details')?.addEventListener('click', () => {
      this.hideDetails();
    });

    // Restart button
    document.getElementById('restart-btn')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to restart analysis? All current results will be lost.')) {
        window.location.reload();
      }
    });

    // Setup drag & drop for upload area
    this.setupDragAndDrop();

    // Setup event listeners
    this.elements.searchInput?.addEventListener('input', () => this.handleFilterChange());
    this.elements.chromFilter?.addEventListener('change', () => this.handleFilterChange());
    this.elements.downloadBtn?.addEventListener('click', () => this.downloadReport());
    this.elements.apiAnalysisBtn?.addEventListener('click', () => this.performApiAnalysis());
  },
  
  // Setup drag and drop functionality
  setupDragAndDrop() {
    const uploadArea = this.elements.uploadArea;
    const fileInput = this.elements.fileInput;
    
    if (!uploadArea || !fileInput) return;
    
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      
      if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        // Trigger change event manually
        const event = new Event('change');
        fileInput.dispatchEvent(event);
      }
    });
  },

  // Show loading indicator with message
  showLoading(message = 'Processing DNA data...') {
    if (!this.elements.loading) return;
    
    this.elements.loading.style.display = 'block';
    this.elements.loading.innerHTML = `<span class="spinner"></span> <div class="progress-message">${message}</div>`;
  },
  
  // Update progress with detailed information
  updateProgress(progress) {
    if (!this.elements.loading) return;
    
    let progressHtml = '';
    if (progress && typeof progress === 'object') {
      const { loaded, total, stage } = progress;
      
      if (loaded !== undefined) {
        let statusText = stage || 'Processing...';
        
        if (typeof total === 'number') {
          // We know the total
          const percentage = Math.round((loaded / total) * 100);
          progressHtml = `
            <div class="progress-bar">
              <div style="width:${percentage}%"></div>
            </div>
            <div class="progress-text">${stage || 'Processing'}: ${loaded} of ${total} (${percentage}%)</div>
          `;
          statusText = `${stage || 'Processing'}: ${percentage}% complete`;
        } else {
          // We don't know the exact total
          progressHtml = `
            <div class="progress-bar indeterminate">
              <div class="progress-track"></div>
            </div>
            <div class="progress-text">${stage || 'Processing'}: ${loaded} items</div>
          `;
          statusText = `${stage || 'Processing'}: ${loaded} items`;
        }
        
        // Update status in footer and header
        this.updateStatusMessage(statusText);
      }
    }
    
    if (progressHtml) {
      const progressContainer = document.createElement('div');
      progressContainer.className = 'progress-container';
      progressContainer.innerHTML = progressHtml;
      
      // Replace existing progress if any, otherwise append
      const existingProgress = this.elements.loading.querySelector('.progress-container');
      if (existingProgress) {
        this.elements.loading.replaceChild(progressContainer, existingProgress);
      } else {
        this.elements.loading.appendChild(progressContainer);
      }
    }
  },
  
  // Update discovery progress
  updateDiscoveryProgress(progress) {
    const progressEl = this.elements.discoveryProgress;
    if (!progressEl) return;
    
    let progressHtml = '';
    if (progress) {
      const percentage = Math.round((progress.progress || 0) * 100);
      
      progressHtml = `
        <div class="progress-bar">
          <div style="width:${percentage}%"></div>
        </div>
        <div class="progress-text">${progress.stage || 'Discovering genes...'}</div>
      `;
      
      if (progress.findings) {
        progressHtml += `<div class="progress-findings">${progress.findings} significant matches found</div>`;
      }
      
      // Update status message
      this.updateStatusMessage(`Gene discovery: ${percentage}% complete`);
    }
    
    if (progressHtml) {
      const progressContainer = document.createElement('div');
      progressContainer.className = 'progress-container';
      progressContainer.innerHTML = progressHtml;
      
      // Replace existing progress if any, otherwise append
      const existingProgress = progressEl.querySelector('.progress-container');
      if (existingProgress) {
        progressEl.replaceChild(progressContainer, existingProgress);
      } else {
        progressEl.appendChild(progressContainer);
      }
    }
  },
  
  // Hide loading indicator
  hideLoading() {
    if (this.elements.loading) {
      this.elements.loading.style.display = 'none';
    }
  },
  
  // Move to the next step in the workflow
  goToStep(step) {
    // Update step indicators in sidebar
    Object.keys(this.elements.stepElements).forEach(key => {
      const element = this.elements.stepElements[key];
      if (!element) return;
      
      if (key === step) {
        element.classList.add('active');
        element.classList.remove('completed');
      } else if (this.getStepIndex(key) < this.getStepIndex(step)) {
        element.classList.remove('active');
        element.classList.add('completed');
      } else {
        element.classList.remove('active', 'completed');
      }
    });
    
    // Show correct step content
    Object.keys(this.elements.stepContents).forEach(key => {
      const content = this.elements.stepContents[key];
      if (!content) return;
      content.classList.toggle('active', key === step);
    });
    
    this.currentStep = step;
    
    // Update status message
    this.updateStatusMessage(this.getStatusForStep(step));
  },
  
  // Get index of step (for comparison)
  getStepIndex(step) {
    const steps = ['upload', 'processing', 'discovery', 'results'];
    return steps.indexOf(step);
  },
  
  // Get status message for current step
  getStatusForStep(step) {
    switch(step) {
      case 'upload': return 'Ready to upload DNA file';
      case 'processing': return 'Processing DNA data';
      case 'discovery': return 'Discovering relevant genes';
      case 'results': return 'Analysis complete';
      default: return 'DNA Explorer';
    }
  },
  
  // Update status message in header and footer
  updateStatusMessage(message) {
    if (this.elements.statusIndicator) {
      this.elements.statusIndicator.textContent = message;
    }
    
    if (this.elements.statusMessage) {
      this.elements.statusMessage.textContent = message;
    }
  },

  // Reset UI to initial state
  resetUI() {
    // Reset core elements
    if (this.elements.dashboardEl) this.elements.dashboardEl.innerHTML = '';
    if (this.elements.insightsEl) this.elements.insightsEl.innerHTML = '';
    if (this.elements.tableContainer) this.elements.tableContainer.innerHTML = '';
    if (this.elements.paginationEl) this.elements.paginationEl.innerHTML = '';
    if (this.elements.detailsContent) this.elements.detailsContent.innerHTML = '';
    if (this.elements.traitsEl) this.elements.traitsEl.innerHTML = '';
    if (this.elements.genesEl) this.elements.genesEl.innerHTML = '';
    
    // Reset sidebar summary
    if (this.elements.sidebarSummary) this.elements.sidebarSummary.innerHTML = '';
    
    // Reset form elements
    if (this.elements.searchInput) this.elements.searchInput.value = '';
    if (this.elements.chromFilter) {
      this.elements.chromFilter.value = '';
      this.elements.chromFilter.innerHTML = '<option value="">All chromosomes</option>';
    }
    
    // Go back to first step
    this.goToStep('upload');
    
    // Ensure details panel is closed
    this.hideDetails();
  },

  // Update UI after analysis
  updateUI(data) {
    const { 
      allResults, 
      clinCounts, 
      traitCounts, 
      ancestryHints, 
      clinSummary, 
      traitSummary, 
      topInsights,
      significantMatches,
      error 
    } = data;
    
    // Create dashboard summary
    if (this.elements.dashboardEl) {
      let matchCount = significantMatches?.count || 0;
      
      this.elements.dashboardEl.innerHTML = `
        <div class="dashboard-card">
          <div class="number">${allResults.length.toLocaleString()}</div>
          <div class="label">Total SNPs</div>
        </div>
        <div class="dashboard-card ${(clinCounts.pathogenic + clinCounts.likely_pathogenic) > 0 ? 'highlight' : ''}">
          <div class="number">${(clinCounts.pathogenic + clinCounts.likely_pathogenic)}</div>
          <div class="label">Potencialmente Patogênico</div>
        </div>
        <div class="dashboard-card">
          <div class="number">${Object.keys(traitCounts).length}</div>
          <div class="label">Traços/Fenótipos</div>
        </div>
        <div class="dashboard-card ${matchCount > 0 ? 'highlight' : ''}">
          <div class="number">${matchCount}</div>
          <div class="label">SNPs Significativos</div>
        </div>
      `;
      
      // Add API analysis button
      this.showApiAnalysisButton();
    }
    
    // Update insights
    if (this.elements.insightsEl) {
      let insightsHtml = '';
      
      // Always show insights, even if empty
      insightsHtml += `
        <div class="insights-container">
          ${topInsights.length ? 
            topInsights.map(i => `<div class="insight-item">${i}</div>`).join('') : 
            '<div class="insight-item info-note">No significant insights were found. This could be due to data format differences or limitations in our reference database.</div>'}
      `;
      
      // Show error message if present
      if (error) {
        insightsHtml += `<div class="insight-item error-message">Error: ${error}</div>`;
      }
      
      // Show SNPs if available
      if (significantMatches && significantMatches.items && significantMatches.items.length > 0) {
        const items = Array.isArray(significantMatches.items) ? significantMatches.items : [];
        const displayCount = Math.min(10, items.length);
        
        insightsHtml += `
          <div class="significant-snps">
            <h3>SNPs (Top ${displayCount})</h3>
            <div class="significant-grid">
              ${items
                .sort((a, b) => (b.magnitude || 0) - (a.magnitude || 0))
                .slice(0, displayCount)
                .map(snp => `
                  <div class="significant-card">
                    <div class="significant-rsid">
                      <span class="snp-link" data-rsid="${snp.rsid}">${snp.rsid}</span>
                    </div>
                    <div class="magnitude-badge">
                      Magnitude: ${snp.magnitude || 'N/A'}
                    </div>
                    <div class="category-tag">${snp.category || snp.chromosome || 'Não categorizado'}</div>
                  </div>
                `).join('')}
            </div>
          </div>
        `;
      }
      
      insightsHtml += '</div>'; // Close insights-container
      this.elements.insightsEl.innerHTML = insightsHtml;
    }

    // Create traits panel
    if (this.elements.traitsEl) {
      let traitHtml = '';
      if (traitSummary.length) {
        traitHtml += `<h3>Saúde & Traços</h3>`;
        traitHtml += `<table>
          <thead>
            <tr>
              <th>rsID</th>
              <th>Gene</th>
              <th>Traços</th>
              <th>Fenótipos</th>
              <th>Magnitude</th>
            </tr>
          </thead>
          <tbody>`;
        
        // Sort by magnitude (if available)
        const sortedTraits = [...traitSummary].sort((a, b) => {
          return (b.magnitude || 0) - (a.magnitude || 0);
        });
        
        for (const t of sortedTraits) {
          const magnitudeClass = t.magnitude >= 7 ? 'high-magnitude' : 
                               t.magnitude >= 4 ? 'medium-magnitude' : 'low-magnitude';
          
          traitHtml += `
            <tr>
              <td><span class="snp-link" data-rsid="${t.rsid}">${t.rsid}</span></td>
              <td>${t.gene}</td>
              <td>${t.traits.map(tr => `<span class="trait-keyword">${tr}</span>`).join('')}</td>
              <td>${t.phenotypes.map(p => p.description).join('; ')}</td>
              <td><span class="magnitude ${magnitudeClass}">${t.magnitude || '-'}</span></td>
            </tr>`;
        }
        
        traitHtml += `</tbody></table>`;
      } else {
        traitHtml = `<div class="info-note">Nenhuma associação de traço/fenótipo encontrada.</div>`;
      }
      
      this.elements.traitsEl.innerHTML = traitHtml;
    }

    // Setup table and filters
    this.setupTable();
    this.setupChromosomeFilter(allResults);
    this.renderTablePage();
    this.setupPagination();

    // Add listeners for SNP links
    document.querySelectorAll('.snp-link').forEach(link => {
      link.addEventListener('click', () => this.fetchDetails(link.dataset.rsid || link.textContent));
    });
  },
  
  // Show API Analysis button
  showApiAnalysisButton() {
    // Create API Analysis button if it doesn't exist
    if (!this.elements.apiAnalysisBtn) {
      const apiBtn = document.createElement('button');
      apiBtn.id = 'apiAnalysisBtn';
      apiBtn.className = 'btn btn-primary api-analysis-btn';
      apiBtn.innerHTML = '<i class="fas fa-cloud"></i> Perform Extended Online Analysis';
      apiBtn.addEventListener('click', () => this.performApiAnalysis());
      
      // Add the button to the dashboard or insights section
      if (this.elements.dashboardEl) {
        const btnContainer = document.createElement('div');
        btnContainer.className = 'api-btn-container';
        btnContainer.appendChild(apiBtn);
        this.elements.dashboardEl.appendChild(btnContainer);
        this.elements.apiAnalysisBtn = apiBtn;
      }
    }
  },
  
  // Handle API analysis button click
  performApiAnalysis() {
    if (!this.elements.apiAnalysisBtn) return;
    
    // Update button state
    this.elements.apiAnalysisBtn.disabled = true;
    this.elements.apiAnalysisBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting to External APIs...';
    
    // Show a progress indicator
    this.showApiProgress();
    
    // Trigger the API analysis in the main application
    // This will be defined in main.js and be available globally
    if (typeof window.performApiAnalysis === 'function') {
      window.performApiAnalysis()
        .then(results => {
          this.hideApiProgress();
          this.updateUIWithApiResults(results);
          
          // Update button state
          this.elements.apiAnalysisBtn.innerHTML = '<i class="fas fa-check-circle"></i> Online Analysis Complete';
          this.elements.apiAnalysisBtn.className = 'btn btn-success api-analysis-btn';
        })
        .catch(error => {
          this.hideApiProgress();
          
          // Show error in button
          this.elements.apiAnalysisBtn.innerHTML = '<i class="fas fa-exclamation-circle"></i> API Analysis Failed';
          this.elements.apiAnalysisBtn.className = 'btn btn-danger api-analysis-btn';
          this.elements.apiAnalysisBtn.disabled = false;
          
          // Show error message
          this.showApiError(error.message || 'Failed to perform online analysis');
        });
    }
  },
  
  // Show API progress indicator
  showApiProgress() {
    // Create or update a progress panel for API analysis
    const progressPanel = document.createElement('div');
    progressPanel.id = 'api-progress-panel';
    progressPanel.className = 'api-progress-panel';
    progressPanel.innerHTML = `
      <div class="progress-container">
        <div class="progress-bar indeterminate">
          <div class="progress-track"></div>
        </div>
        <div class="progress-text">Connecting to external databases...</div>
      </div>
    `;
    
    // Add to insights section
    if (this.elements.insightsEl) {
      const existingPanel = document.getElementById('api-progress-panel');
      if (existingPanel) {
        existingPanel.parentNode.replaceChild(progressPanel, existingPanel);
      } else {
        this.elements.insightsEl.prepend(progressPanel);
      }
    }
  },
  
  // Hide API progress indicator
  hideApiProgress() {
    const progressPanel = document.getElementById('api-progress-panel');
    if (progressPanel) {
      progressPanel.remove();
    }
  },
  
  // Show API error message
  showApiError(message) {
    const errorPanel = document.createElement('div');
    errorPanel.className = 'error-message api-error';
    errorPanel.innerHTML = `
      <i class="fas fa-exclamation-triangle"></i> ${message}
      <button class="retry-btn">Retry</button>
    `;
    
    // Add to insights section
    if (this.elements.insightsEl) {
      const existingError = this.elements.insightsEl.querySelector('.api-error');
      if (existingError) {
        existingError.parentNode.replaceChild(errorPanel, existingError);
      } else {
        this.elements.insightsEl.prepend(errorPanel);
      }
      
      // Add retry button handler
      errorPanel.querySelector('.retry-btn').addEventListener('click', () => {
        errorPanel.remove();
        this.performApiAnalysis();
      });
    }
  },
  
  // Update UI with API analysis results
  updateUIWithApiResults(results) {
    if (!results) return;
    
    const { 
      enrichedTraits, 
      apiFindings, 
      clinicalData, 
      ancestryData 
    } = results;
    
    // Update insights with new information from APIs
    if (this.elements.insightsEl && apiFindings && apiFindings.length > 0) {
      const apiSection = document.createElement('div');
      apiSection.className = 'api-findings-section';
      apiSection.innerHTML = `
        <h3>Extended Analysis Results</h3>
        <div class="api-insights">
          ${apiFindings.map(finding => `
            <div class="insight-item api-finding">
              <div class="finding-title">${finding.title}</div>
              <div class="finding-description">${finding.description}</div>
              ${finding.source ? `<div class="finding-source">Source: ${finding.source}</div>` : ''}
            </div>
          `).join('')}
        </div>
      `;
      
      // Replace existing API section or append new one
      const existingApiSection = this.elements.insightsEl.querySelector('.api-findings-section');
      if (existingApiSection) {
        existingApiSection.parentNode.replaceChild(apiSection, existingApiSection);
      } else {
        this.elements.insightsEl.appendChild(apiSection);
      }
    }
    
    // Update traits with enriched data
    if (this.elements.traitsEl && enrichedTraits && enrichedTraits.length > 0) {
      // Update existing traits with enhanced information
      // This implementation depends on your specific data structure
      this.updateTraitsWithEnrichedData(enrichedTraits);
    }
  },
  
  // Update traits panel with enriched data from APIs
  updateTraitsWithEnrichedData(enrichedTraits) {
    // Find existing trait rows and enhance them with new data
    const traitRows = this.elements.traitsEl.querySelectorAll('tbody tr');
    if (!traitRows.length) return;
    
    // Create a mapping of rsIDs to enriched data
    const enrichedMap = {};
    enrichedTraits.forEach(item => {
      enrichedMap[item.rsid] = item;
    });
    
    // Update each row with enriched data if available
    traitRows.forEach(row => {
      const rsidCell = row.querySelector('td:first-child');
      if (!rsidCell) return;
      
      const rsid = rsidCell.textContent.trim();
      const enrichedData = enrichedMap[rsid];
      
      if (enrichedData) {
        // Add visual indicator for enriched data
        row.classList.add('enriched-data');
        
        // Enhanced phenotypes cell with more detailed information
        const phenotypesCell = row.querySelector('td:nth-child(4)');
        if (phenotypesCell && enrichedData.expandedPhenotypes) {
          phenotypesCell.innerHTML = enrichedData.expandedPhenotypes
            .map(p => `<span class="phenotype-item" title="${p.source || ''}">${p.description}</span>`)
            .join('; ');
        }
        
        // Update magnitude if available
        const magnitudeCell = row.querySelector('td:nth-child(5) .magnitude');
        if (magnitudeCell && enrichedData.updatedMagnitude) {
          // Update magnitude class if changed
          const newMagnitudeClass = enrichedData.updatedMagnitude >= 7 ? 'high-magnitude' : 
                                  enrichedData.updatedMagnitude >= 4 ? 'medium-magnitude' : 'low-magnitude';
          
          magnitudeCell.className = `magnitude ${newMagnitudeClass}`;
          magnitudeCell.textContent = enrichedData.updatedMagnitude;
        }
      }
    });
  },
  
  // Show error message
  showError(errorMessage) {
    this.hideLoading();
    
    const errorHtml = `
      <div class="error-panel">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="var(--danger)" viewBox="0 0 16 16">
          <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
          <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
        </svg>
        <h2>Error Processing DNA File</h2>
        <p>${errorMessage}</p>
        <button class="btn btn-primary" onclick="window.location.reload()">Try Again</button>
      </div>
    `;
    
    // Show error in appropriate place based on current step
    if (this.currentStep === 'upload' && this.elements.stepContents.upload) {
      this.elements.stepContents.upload.innerHTML = errorHtml;
    } else if (this.currentStep === 'processing' && this.elements.loading) {
      this.elements.loading.innerHTML = errorHtml;
    } else if (this.currentStep === 'discovery' && this.elements.discoveryProgress) {
      this.elements.discoveryProgress.innerHTML = errorHtml;
    }
    
    // Update status
    this.updateStatusMessage('Error: ' + errorMessage);
  },

  // Fetch details for a SNP
  fetchDetails(rsid) {
    if (!rsid) return;
    
    this.showDetails();
    this.elements.detailsContent.innerHTML = `
      <div class="loading-details">
        <span class="spinner"></span>
        <div>Loading details for ${rsid}...</div>
      </div>
    `;
    
    // Fetch SNP details (this would be handled by DataManager)
    if (typeof DataManager.fetchSnpDetails === 'function') {
      DataManager.fetchSnpDetails(rsid)
        .then(details => this.renderDetails(details))
        .catch(error => {
          this.elements.detailsContent.innerHTML = `
            <div class="error-panel">
              <h3>Error Loading Details</h3>
              <p>${error.message || 'Could not load details for this SNP'}</p>
            </div>
          `;
        });
    }
  },
  
  // Show details panel
  showDetails() {
    if (this.elements.detailsEl) {
      this.elements.detailsEl.classList.add('visible');
    }
  },
  
  // Hide details panel
  hideDetails() {
    if (this.elements.detailsEl) {
      this.elements.detailsEl.classList.remove('visible');
    }
  },
  
  // Render SNP details
  renderDetails(details) {
    if (!details || !this.elements.detailsContent) return;
    
    // Basic structure for details
    let html = `
      <div class="detail-header">
        <h2>${details.rsid}</h2>
        <div class="genotype">${details.genotype || ''}</div>
      </div>
      <div class="detail-tabs">
        <div class="tab active" data-tab="summary">Summary</div>
        <div class="tab" data-tab="clinical">Clinical</div>
        <div class="tab" data-tab="technical">Technical</div>
      </div>
      <div class="detail-content">
        <div class="tab-pane active" id="summary-pane">
          <div class="detail-section">
            <h3>Overview</h3>
            <p>${details.summary || 'No summary available.'}</p>
          </div>
          ${details.traits && details.traits.length ? `
            <div class="detail-section">
              <h3>Associated Traits</h3>
              <ul class="trait-list">
                ${details.traits.map(trait => `
                  <li class="trait-item">
                    <span class="trait-name">${trait.name}</span>
                    ${trait.description ? `<p class="trait-description">${trait.description}</p>` : ''}
                  </li>
                `).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
        
        <div class="tab-pane" id="clinical-pane">
          ${details.clinical ? `
            <div class="detail-section">
              <h3>Clinical Significance</h3>
              <div class="clinical-significance">
                <span class="significance-level ${details.clinical.significance || 'unknown'}">${details.clinical.significance || 'Unknown'}</span>
                ${details.clinical.condition ? `<p>Condition: ${details.clinical.condition}</p>` : ''}
              </div>
            </div>
          ` : '<p>No clinical data available.</p>'}
        </div>
        
        <div class="tab-pane" id="technical-pane">
          <div class="detail-section">
            <h3>Variant Information</h3>
            <table class="technical-info">
              <tr><td>Chromosome:</td><td>${details.chromosome || '-'}</td></tr>
              <tr><td>Position:</td><td>${details.position || '-'}</td></tr>
              <tr><td>Reference:</td><td>${details.reference || '-'}</td></tr>
              <tr><td>Alternate:</td><td>${details.alternate || '-'}</td></tr>
              <tr><td>Gene:</td><td>${details.gene || '-'}</td></tr>
            </table>
          </div>
        </div>
      </div>
    `;
    
    this.elements.detailsContent.innerHTML = html;
    
    // Add tab switching functionality
    const tabs = this.elements.detailsContent.querySelectorAll('.tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Deactivate all tabs
        tabs.forEach(t => t.classList.remove('active'));
        this.elements.detailsContent.querySelectorAll('.tab-pane').forEach(pane => {
          pane.classList.remove('active');
        });
        
        // Activate clicked tab
        tab.classList.add('active');
        const tabId = `${tab.dataset.tab}-pane`;
        this.elements.detailsContent.querySelector(`#${tabId}`).classList.add('active');
      });
    });
  }
};

export default UIManager;
