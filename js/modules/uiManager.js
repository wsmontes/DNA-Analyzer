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
      fileInput: document.getElementById('fileInput')
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

  // Display gene discovery results
  displayGeneResults(results) {
    if (!results || !this.elements.genesEl) return;
    
    const { geneGroups, stats } = results;
    
    if (!geneGroups || Object.keys(geneGroups).length === 0) {
      this.elements.genesEl.innerHTML = `
        <div class="info-panel">
          <h3>Gene Discovery Results</h3>
          <p>No significant genes were found in your DNA data.</p>
        </div>
      `;
      return;
    }
    
    // Create discovery stats section
    let html = `
      <div class="discovery-stats">
        <div class="stat-item">
          <div class="stat-value">${stats.totalFound}</div>
          <div class="stat-label">Relevant SNPs</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${stats.geneCount}</div>
          <div class="stat-label">Genes</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${stats.locallyIdentified}</div>
          <div class="stat-label">Clinical Markers</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${stats.fromSNPedia || 0}</div>
          <div class="stat-label">From SNPedia</div>
        </div>
      </div>
    `;
    
    // Generate HTML for gene groups
    html += `<div class="gene-groups">`;
    
    for (const [gene, snps] of Object.entries(geneGroups)) {
      if (!snps || !snps.length) continue;
      
      html += `
        <div class="gene-card">
          <div class="gene-header">
            <h4>${gene}</h4>
            <span class="gene-count">${snps.length} SNPs</span>
          </div>
          <div class="gene-snps">
            <ul>
              ${snps.map(snp => `
                <li>
                  <span class="snp-link" data-rsid="${snp.rsid}">${snp.rsid}</span> 
                  ${snp.condition ? `<span class="condition-tag">${snp.condition}</span>` : ''}
                  ${snp.significance ? `<span class="significance-tag ${snp.significance}">${snp.significance}</span>` : ''}
                  ${snp.magnitude ? `<span class="magnitude-tag">${snp.magnitude}</span>` : ''}
                </li>
              `).join('')}
            </ul>
          </div>
        </div>
      `;
    }
    
    html += `</div>`;
    
    // Add some explanation
    html += `
      <div class="info-panel">
        <p><strong>Note:</strong> The genes shown above have potential medical or phenotypic significance based on variants found in your DNA.</p>
        <p>Click on any SNP to see detailed information. The significance tags indicate the potential impact level of each variant.</p>
      </div>
    `;
    
    // Display the content
    this.elements.genesEl.innerHTML = html;
    
    // Add click handlers for SNP links
    this.elements.genesEl.querySelectorAll('.snp-link').forEach(link => {
      link.addEventListener('click', () => this.fetchDetails(link.dataset.rsid));
    });
  },

  // Setup table for SNP data
  setupTable() {
    this.tableEl = document.createElement('table');
    this.tableEl.innerHTML = `
      <thead>
        <tr>
          <th>rsID</th>
          <th>Chromosome</th>
          <th>Position</th>
          <th>Genotype</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    
    if (this.elements.tableContainer) {
      this.elements.tableContainer.innerHTML = '';
      this.elements.tableContainer.append(this.tableEl);
    }
  },

  // Setup chromosome filter
  setupChromosomeFilter(results) {
    if (!this.elements.chromFilter) return;
    
    const chroms = [...new Set(results.map(r => r.chromosome))].sort((a, b) => {
      const na = parseInt(a); const nb = parseInt(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      if (!isNaN(na)) return -1; if (!isNaN(nb)) return 1;
      return a.localeCompare(b);
    });
    
    this.elements.chromFilter.innerHTML = '<option value="">All chromosomes</option>';
    chroms.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = `Chromosome ${c}`;
      this.elements.chromFilter.append(opt);
    });
  },

  // Render table page with filtered results
  renderTablePage() {
    if (!this.tableEl) return;
    
    const start = (DataManager.currentPage - 1) * DataManager.rowsPerPage;
    const end = start + DataManager.rowsPerPage;
    const pageData = DataManager.filteredResults.slice(start, end);

    const tbody = this.tableEl.querySelector('tbody');
    if (!tbody) return;
    
    tbody.innerHTML = pageData.map(r => `
      <tr data-rsid="${r.rsid}" tabindex="0" style="cursor:pointer;">
        <td><span class="snp-link" data-rsid="${r.rsid}">${r.rsid}</span></td>
        <td>${r.chromosome}</td>
        <td>${r.position}</td>
        <td>${r.Genotype}</td>
      </tr>`).join('');
    
    // Add listeners for row clicks and keyboard access
    tbody.querySelectorAll('tr[data-rsid]').forEach(row => {
      row.addEventListener('click', (e) => {
        // Don't trigger if clicked directly on link
        if (!e.target.classList.contains('snp-link')) {
          this.fetchDetails(row.dataset.rsid);
        }
      });
      
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
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

  // Setup pagination controls
  setupPagination() {
    if (!this.elements.paginationEl) return;
    
    this.elements.paginationEl.innerHTML = '';
    const totalPages = Math.ceil(DataManager.filteredResults.length / DataManager.rowsPerPage);

    if (totalPages <= 1) return;

    const prevButton = document.createElement('button');
    prevButton.textContent = 'Previous';
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
    pageInfo.textContent = ` Page ${DataManager.currentPage} of ${totalPages} `;
    pageInfo.style.margin = '0 10px';
    this.elements.paginationEl.appendChild(pageInfo);

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
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

  // Handle filter changes
  handleFilterChange() {
    if (!this.elements.searchInput || !this.elements.chromFilter) return;
    
    const searchQuery = this.elements.searchInput.value;
    const chromosomeFilter = this.elements.chromFilter.value;
    
    DataManager.filterResults(searchQuery, chromosomeFilter);
    this.renderTablePage();
    this.setupPagination();
  },

  // Download report as JSON
  downloadReport() {
    if (DataManager.allResults.length === 0) {
      alert("No data loaded to download.");
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

  // Fetch and display details for a SNP
  async fetchDetails(rsid) {
    if (!rsid || !this.elements.detailsEl || !this.elements.detailsContent) return;
    
    // Show details panel
    this.elements.detailsEl.classList.add('open');
    this.elements.detailsContent.innerHTML = `
      <div class="details-loading">
        <span class="spinner"></span>
        <p>Loading details for ${rsid}...</p>
      </div>
    `;
    
    let ensemblInfo = {};
    let popFreq = {};
    let snpediaSummary = 'Could not fetch SNPedia summary.';
    let errorMessages = [];

    try {
      // Fetch SNP data
      ensemblInfo = await DataManager.fetchSnp(rsid);
    } catch (err) {
      errorMessages.push(`Failed to fetch Ensembl variation data: ${err.message}`);
    }

    // Fetch population frequencies
    if (ensemblInfo.name) {
      try {
        const pfData = await DataManager.fetchPopulationFrequencies(rsid);
        if (pfData && pfData.length > 0) {
          popFreq = pfData.reduce((acc, p) => {
            acc[p.population] = p.frequency !== undefined ? p.frequency.toFixed(4) : 'N/A';
            return acc;
          }, {});
        } else {
          popFreq = { 'Info': 'No population data available.' };
        }
      } catch (err) {
        errorMessages.push(`Failed to fetch population frequencies: ${err.message}`);
        popFreq = { 'Error': 'Could not load data.' };
      }
    } else {
      popFreq = { 'Info': 'Skipped due to error in variation lookup.' };
    }

    // Fetch SNPedia information
    try {
      snpediaSummary = await DataManager.fetchSnpediaSummary(rsid);
    } catch (err) {
      errorMessages.push(`Failed to fetch SNPedia summary: ${err.message}`);
    }

    // Render details
    const clinicalSignificance = (ensemblInfo.clinical_significance || []).join(', ') || 'none';
    const popFreqHtml = Object.entries(popFreq).length > 0 
      ? Object.entries(popFreq).map(([pop, freq]) => `<li>${pop}: ${freq}</li>`).join('') 
      : '<li>No population data available</li>';
    const phenotypesHtml = (ensemblInfo.phenotypes || []).length > 0
      ? (ensemblInfo.phenotypes || []).map(p => `<li>${p.description}</li>`).join('')
      : '<li>No phenotype data available</li>';

    // Show which proxy is being used (if any)
    let proxyInfo = '<span class="proxy-info">Proxy status: Not initialized</span>';
    if (window.proxyManager && window.proxyManager.isInitialized && window.proxyManager.currentProxy) {
      proxyInfo = window.proxyManager.currentProxy.url
        ? `<span class="proxy-info">Using proxy: ${window.proxyManager.currentProxy.name}</span>`
        : '<span class="proxy-info">Using: Direct API access</span>';
    }
    
    // Add clinical significance style
    let clinicalClass = '';
    let clinText = clinicalSignificance;
    if (clinicalSignificance.includes('pathogenic')) {
      clinicalClass = 'clin-pathogenic';
    } else if (clinicalSignificance.includes('benign')) {
      clinicalClass = 'clin-benign';
    } else if (clinicalSignificance.includes('uncertain')) {
      clinicalClass = 'clin-uncertain';
    }

    this.elements.detailsContent.innerHTML = `
      <div class="details-header-info">
        <h2>${rsid}</h2>
        <div class="details-meta">${proxyInfo}</div>
      </div>
      
      ${errorMessages.length > 0 ? 
        `<div class="error-message">
           <strong>⚠️ Note:</strong> ${errorMessages.join('<br>')}
         </div>` : ''}
      
      <div class="external-links">
        <a href="https://www.snpedia.com/index.php/${rsid}" target="_blank">SNPedia</a>
        <a href="https://www.ncbi.nlm.nih.gov/snp/${rsid}" target="_blank">dbSNP</a>
        <a href="https://grch37.ensembl.org/Homo_sapiens/Variation/Summary?v=${rsid}" target="_blank">Ensembl</a>
      </div>
      
      <div class="details-grid">
        <div class="details-item">
          <label>Most Severe Consequence:</label>
          <span>${ensemblInfo.most_severe_consequence || 'N/A'}</span>
        </div>
        <div class="details-item">
          <label>Ancestral Allele:</label>
          <span>${ensemblInfo.ancestral_allele || 'N/A'}</span>
        </div>
        <div class="details-item">
          <label>Clinical Significance:</label>
          <span class="${clinicalClass}">${clinText || 'N/A'}</span>
        </div>
        <div class="details-item">
          <label>Mapped Gene:</label>
          <span>${ensemblInfo.mapped_genes?.[0]?.gene_symbol || 'N/A'}</span>
        </div>
        <div class="details-item">
          <label>Minor Allele:</label>
          <span>${ensemblInfo.minor_allele || 'N/A'}</span>
        </div>
        <div class="details-item">
          <label>MAF:</label>
          <span>${ensemblInfo.MAF ? ensemblInfo.MAF.toFixed(4) : 'N/A'}</span>
        </div>
        <div class="details-item">
          <label>Assembly:</label>
          <span>${ensemblInfo.assembly_name || 'N/A'}</span>
        </div>
      </div>

      <div class="details-section">
        <h3>Population Frequencies</h3>
        <ul class="freq-list">${popFreqHtml}</ul>
      </div>
      
      <div class="details-section">
        <h3>Phenotypes</h3>
        <ul class="phenotype-list">${phenotypesHtml}</ul>
      </div>
      
      <div class="details-section">
        <h3>SNPedia Information</h3>
        <div class="snpedia-info">${snpediaSummary.replace(/\n/g, '<br>')}</div>
        <div class="attribution">
          Data from SNPedia under <a href="https://creativecommons.org/licenses/by-nc-sa/3.0/us/" target="_blank">CC BY-NC-SA 3.0 US</a>
        </div>
      </div>
      
      <details>
        <summary>Complete Variation JSON</summary>
        <pre>${JSON.stringify(ensemblInfo, null, 2)}</pre>
      </details>
    `;
  },
  
  // Hide details panel
  hideDetails() {
    if (this.elements.detailsEl) {
      this.elements.detailsEl.classList.remove('open');
    }
  }
};

export default UIManager;
