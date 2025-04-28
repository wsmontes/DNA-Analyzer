/**
 * Main Application Module
 * 
 * Entry point for the DNA Analyzer application.
 * Coordinates all application functionality and handles user interaction.
 * 
 * Dependencies:
 * - dna-parser.js: For file decompression and parsing
 * - clinvar-annotator.js: For variant annotation
 * - ui-renderer.js: For UI updates and rendering
 * - genome-browser.js: For genomic visualization
 * - ai-interpreter.js: For clinical interpretation
 * - storage.js: For data caching
 * - worker-utils.js: For worker management
 * 
 * Exports:
 * - None (main application controller)
 */

import { decompressFile } from './dna-parser.js';
import { parseGenotypeFile } from './dna-parser.js';
import { loadClinVarData, annotateVariants, cleanup as cleanupClinvar } from './clinvar-annotator.js';
import { renderResultsTable, updateProgressBar, showError, hideError } from './ui-renderer.js';
import { initGenomeBrowser, updateGenomeBrowser } from './genome-browser.js';
import { generateClinicalSummary } from './ai-interpreter.js';
import { setupIndexedDB, getCachedClinVarData, cacheClinVarData } from './storage.js';

// Import cleanup utilities
import { cleanupMemory } from './worker-utils.js';

// DOM Elements
const uploadBtn = document.getElementById('upload-btn');
const dnaFileInput = document.getElementById('dna-file');
const progressContainer = document.getElementById('progress-container');
const summarySection = document.getElementById('summary-section');
const resultsSection = document.getElementById('results-section');
const browserSection = document.getElementById('browser-section');
const errorDismiss = document.getElementById('error-dismiss');
const summaryToggle = document.getElementById('summary-toggle');

// Application state
let appState = {
  genotypeRecords: [],
  annotatedVariants: [],
  clinVarData: null,
  currentPage: 1,
  pageSize: 20,
  filters: {
    significance: 'all',
    chromosome: 'all',
    search: '',
    sortField: 'rsID',
    sortDirection: 'asc'
  }
};

/**
 * Initialize the application
 */
async function initApp() {
  try {
    // Setup IndexedDB
    await setupIndexedDB();
    
    // Set up event listeners
    setupEventListeners();
    
    // Check for Web Workers support
    if (!window.Worker) {
      showError("Your browser doesn't support Web Workers. Some features may be limited.", false);
    }
    
    // Listen for ClinVar data missing events
    document.addEventListener('clinvar-missing', handleMissingClinVar);
    
    console.log('DNA Analysis Tool initialized successfully');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    showError(`Initialization error: ${error.message}`, false);
  }
}

/**
 * Handle missing ClinVar data
 */
function handleMissingClinVar(event) {
  // Create a warning notification
  const warningDiv = document.createElement('div');
  warningDiv.className = 'clinvar-warning';
  warningDiv.innerHTML = `
    <div class="warning-content">
      <h3>ClinVar Data Issue</h3>
      <p>${event.detail.error || 'Unable to process ClinVar data'}</p>
      <p>To enable full functionality, please download ClinVar data files.</p>
      <a href="https://www.ncbi.nlm.nih.gov/clinvar/docs/ftp_primer/" target="_blank">
        Learn how to download ClinVar data
      </a>
      <button class="download-clinvar">Download ClinVar Files</button>
      <button class="close-warning">Dismiss</button>
    </div>
  `;
  
  document.body.appendChild(warningDiv);
  
  // Add event listener to close button
  warningDiv.querySelector('.close-warning').addEventListener('click', () => {
    warningDiv.remove();
  });
  
  // Add event listener for download button
  warningDiv.querySelector('.download-clinvar').addEventListener('click', () => {
    import('./clinvar-downloader.js').then(module => {
      module.showDownloadModal();
    });
  });
}

// Set up event listeners
function setupEventListeners() {
  uploadBtn.addEventListener('click', handleFileUpload);
  dnaFileInput.addEventListener('change', () => {
    uploadBtn.disabled = !dnaFileInput.files.length;
  });
  errorDismiss.addEventListener('click', hideError);
  summaryToggle.addEventListener('click', toggleSummary);
  
  // Set up filter event listeners
  document.getElementById('significance-filter').addEventListener('change', applyFilters);
  document.getElementById('chromosome-filter').addEventListener('change', applyFilters);
  document.getElementById('search-input').addEventListener('input', applyFilters);
  
  // Set up sorting event listeners
  document.querySelectorAll('#results-table th[data-sort]').forEach(th => {
    th.addEventListener('click', handleSort);
  });
  
  // Set up pagination
  document.getElementById('prev-page').addEventListener('click', goToPrevPage);
  document.getElementById('next-page').addEventListener('click', goToNextPage);
  document.getElementById('page-size').addEventListener('change', changePageSize);
}

// Handle file upload button click
async function handleFileUpload() {
  const file = dnaFileInput.files[0];
  if (!file) {
    showError('Please select a DNA data file (.zip or .gz)');
    return;
  }
  
  try {
    // Reset UI
    progressContainer.classList.remove('hidden');
    summarySection.classList.add('hidden');
    resultsSection.classList.add('hidden');
    browserSection.classList.add('hidden');
    uploadBtn.disabled = true;
    
    // Process the file
    await processFile(file);
    
    uploadBtn.disabled = false;
  } catch (error) {
    console.error('Error processing file:', error);
    showError(`Error processing file: ${error.message}`);
    uploadBtn.disabled = false;
  }
}

/**
 * Reset the view to prepare for new file processing
 */
function resetView() {
  // Hide results sections
  document.getElementById('browser-section').classList.add('hidden');
  document.getElementById('results-section').classList.add('hidden');
  document.getElementById('summary-section').classList.add('hidden');
  
  // Hide error section
  hideError();
  
  // Clear previous results
  document.getElementById('results-body').innerHTML = '';
  document.getElementById('ai-summary').innerHTML = '';
  
  // Reset progress bars
  updateProgressBar('decompress', 0, '');
  updateProgressBar('parse', 0, '');
  updateProgressBar('clinvar', 0, '');
  updateProgressBar('annotate', 0, '');
  
  // Show progress container
  document.getElementById('progress-container').classList.remove('hidden');
}

/**
 * Process the uploaded DNA file
 */
async function processFile(file) {
  try {
    resetView();
    
    // Show the progress container
    document.getElementById('progress-container').classList.remove('hidden');
    
    // Step 1: Decompress the file
    updateProgressBar('decompress', 0, 'Starting decompression...');
    let decompressedContent = await decompressFile(file, (progress) => {
      updateProgressBar('decompress', progress, `Decompressing: ${progress.toFixed(1)}%`);
    });
    updateProgressBar('decompress', 100, 'Decompression complete');
    
    // Step 2: Parse the DNA data
    updateProgressBar('parse', 0, 'Starting parser...');
    const genotypeRecords = await parseGenotypeFile(decompressedContent, (progress, message) => {
      updateProgressBar('parse', progress, message);
    });
    updateProgressBar('parse', 100, `Parsed ${genotypeRecords.length.toLocaleString()} genotype records`);
    
    // Store in app state
    appState.genotypeRecords = genotypeRecords;
    
    // Clear decompressed content to free memory
    const decompressedSize = decompressedContent.length;
    decompressedContent = null; // Allow garbage collection
    
    // Step 3: Load ClinVar data
    updateProgressBar('clinvar', 0, 'Loading ClinVar data...');
    let clinVarData;
    try {
      clinVarData = await loadClinVarData();
      appState.clinVarData = clinVarData;
      
      // If we got data with no variants, throw error
      if (clinVarData && (!clinVarData.variants || Object.keys(clinVarData.variants).length === 0) && 
          (!clinVarData.query || typeof clinVarData.query !== 'function')) {
        throw new Error('ClinVar data was loaded but contains no variant information');
      }
    } catch (error) {
      console.error("Error loading ClinVar data:", error);
      showError(`Failed to load ClinVar data: ${error.message}. Please ensure all required ClinVar files are in the clinvar/ directory.`);
      throw error; // Re-throw to stop processing
    }
    
    // Step 4: Annotate the variants with ClinVar data
    updateProgressBar('annotate', 0, 'Starting annotation...');
    const annotatedVariants = await annotateVariants(genotypeRecords, clinVarData, (progress, message) => {
      updateProgressBar('annotate', progress, message);
    });
    
    // Store in app state and free memory
    appState.annotatedVariants = annotatedVariants;
    appState.genotypeRecords = null; // No longer needed, free memory
    
    // Count variants by clinical significance
    const significanceCounts = countByClinicalSignificance(annotatedVariants);
    updateProgressBar('annotate', 100, 
      `Annotated ${annotatedVariants.length.toLocaleString()} variants. ` + 
      `Found: ${significanceCounts.pathogenic} pathogenic, ` + 
      `${significanceCounts.likely_pathogenic} likely pathogenic`);
    
    // Initialize and display the genome browser
    initGenomeBrowser(annotatedVariants);
    document.getElementById('browser-section').classList.remove('hidden');
    
    // Render the results table
    renderResultsTable(annotatedVariants, appState.filters, appState.currentPage, appState.pageSize);
    document.getElementById('results-section').classList.remove('hidden');
    
    // Generate and display AI summary
    generateSummary(annotatedVariants);
    
    // After processing is complete, run cleanup
    setTimeout(() => {
      cleanupAfterProcessing();
    }, 2000);
    
    return { variants: annotatedVariants, counts: significanceCounts };
  } catch (error) {
    console.error("Error processing file:", error);
    // Clean up even on error
    cleanupAfterProcessing();
    showError(`Error processing file: ${error.message}`);
    throw error;
  }
}

function cleanupAfterProcessing() {
  // Release file data
  if (window.fileData) {
    window.fileData = null;
  }
  
  // Release any large parsed objects
  if (window.parsedGenotype) {
    window.parsedGenotype = null;
  }
  
  // Clean up in the ClinVar module
  cleanupClinvar();
  
  // General memory cleanup
  cleanupMemory();
  
  console.log("Memory cleanup completed after file processing");
}

// Add window event listeners for when tab is hidden/visible to manage memory
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Tab is hidden, perform aggressive cleanup
    cleanupAfterProcessing();
  }
});

// Filter results based on selected criteria
function applyFilters() {
  appState.filters.significance = document.getElementById('significance-filter').value;
  appState.filters.chromosome = document.getElementById('chromosome-filter').value;
  appState.filters.search = document.getElementById('search-input').value.toLowerCase();
  
  // Reset to first page when filters change
  appState.currentPage = 1;
  
  // Update UI with filtered results
  renderResultsTable(appState.annotatedVariants, appState.filters, appState.currentPage, appState.pageSize);
  updateGenomeBrowser(appState.annotatedVariants, appState.filters);
}

// Populate filter dropdowns based on data
function populateFilters(variants) {
  // Populate chromosome filter
  const chromosomes = [...new Set(variants.map(v => v.chrom))].sort((a, b) => {
    // Sort chromosomes numerically, with X, Y, MT at the end
    if (!isNaN(a) && !isNaN(b)) return parseInt(a) - parseInt(b);
    if (!isNaN(a)) return -1;
    if (!isNaN(b)) return 1;
    return a.localeCompare(b);
  });
  
  const chromosomeFilter = document.getElementById('chromosome-filter');
  chromosomeFilter.innerHTML = '<option value="all">All</option>';
  chromosomes.forEach(chrom => {
    const option = document.createElement('option');
    option.value = chrom;
    option.textContent = `Chromosome ${chrom}`;
    chromosomeFilter.appendChild(option);
  });
  
  // Also update the browser chromosome select
  const chromosomeSelect = document.getElementById('chromosome-select');
  chromosomeSelect.innerHTML = '<option value="all">All Chromosomes</option>';
  chromosomes.forEach(chrom => {
    const option = document.createElement('option');
    option.value = chrom;
    option.textContent = `Chromosome ${chrom}`;
    chromosomeSelect.appendChild(option);
  });
}

// Handle clicking on table headers for sorting
function handleSort(event) {
  const sortField = event.target.getAttribute('data-sort');
  if (!sortField) return;
  
  // Toggle sort direction if already sorting by this field
  if (appState.sortField === sortField) {
    appState.sortDirection = appState.sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    appState.sortField = sortField;
    appState.sortDirection = 'asc';
  }
  
  // Apply sort and re-render
  renderResultsTable(appState.annotatedVariants, appState.filters, appState.currentPage, appState.pageSize);
}

// Pagination handlers
function goToPrevPage() {
  if (appState.currentPage > 1) {
    appState.currentPage--;
    renderResultsTable(appState.annotatedVariants, appState.filters, appState.currentPage, appState.pageSize);
  }
}

function goToNextPage() {
  const filteredVariants = filterVariants(appState.annotatedVariants, appState.filters);
  const totalPages = Math.ceil(filteredVariants.length / appState.pageSize);
  
  if (appState.currentPage < totalPages) {
    appState.currentPage++;
    renderResultsTable(appState.annotatedVariants, appState.filters, appState.currentPage, appState.pageSize);
  }
}

function changePageSize() {
  appState.pageSize = parseInt(document.getElementById('page-size').value);
  appState.currentPage = 1; // Reset to first page
  renderResultsTable(appState.annotatedVariants, appState.filters, appState.currentPage, appState.pageSize);
}

// Filter variants based on current filter settings
function filterVariants(variants, filters) {
  return variants.filter(variant => {
    // Filter by significance
    if (filters.significance !== 'all' && variant.clinicalSignificance !== filters.significance) {
      return false;
    }
    
    // Filter by chromosome
    if (filters.chromosome !== 'all' && variant.chrom !== filters.chromosome) {
      return false;
    }
    
    // Filter by search text
    if (filters.search) {
      const searchString = filters.search.toLowerCase();
      const searchFields = [
        variant.rsID,
        variant.gene,
        variant.condition,
        variant.clinicalSignificance
      ].map(field => (field || '').toLowerCase());
      
      if (!searchFields.some(field => field.includes(searchString))) {
        return false;
      }
    }
    
    return true;
  });
}

// Toggle clinical summary section
function toggleSummary() {
  const summaryContent = document.getElementById('summary-content');
  const isVisible = !summaryContent.classList.contains('hidden');
  
  if (isVisible) {
    summaryContent.classList.add('hidden');
    summaryToggle.textContent = 'Show Summary';
  } else {
    summaryContent.classList.remove('hidden');
    summaryToggle.textContent = 'Hide Summary';
  }
}

/**
 * Count variants by clinical significance
 * @param {Array} variants - The variants to count
 * @returns {Object} - Counts by significance category
 */
function countByClinicalSignificance(variants) {
  const counts = {
    pathogenic: 0,
    likely_pathogenic: 0,
    uncertain_significance: 0,
    likely_benign: 0,
    benign: 0,
    unknown: 0
  };
  
  variants.forEach(variant => {
    const sig = variant.clinicalSignificance?.toLowerCase() || '';
    
    if (sig.includes('pathogenic') && !sig.includes('likely') && !sig.includes('not')) {
      counts.pathogenic++;
    } else if (sig.includes('likely pathogenic')) {
      counts.likely_pathogenic++;
    } else if (sig.includes('uncertain significance') || sig.includes('vus')) {
      counts.uncertain_significance++;
    } else if (sig.includes('likely benign')) {
      counts.likely_benign++;
    } else if (sig.includes('benign') && !sig.includes('likely')) {
      counts.benign++;
    } else {
      counts.unknown++;
    }
  });
  
  return counts;
}

/**
 * Generate AI summary from variants
 * @param {Array} variants - The variants to summarize
 */
async function generateSummary(variants) {
  try {
    document.getElementById('ai-loading').classList.remove('hidden');
    document.getElementById('ai-summary').classList.add('hidden');
    summarySection.classList.remove('hidden');
    
    const summary = await generateClinicalSummary(variants);
    
    document.getElementById('ai-loading').classList.add('hidden');
    const summaryElement = document.getElementById('ai-summary');
    summaryElement.textContent = summary;
    summaryElement.classList.remove('hidden');
  } catch (error) {
    console.error('Error generating summary:', error);
    document.getElementById('ai-loading').classList.add('hidden');
    document.getElementById('ai-summary').textContent = 
      'Unable to generate summary. Please try again later.';
    document.getElementById('ai-summary').classList.remove('hidden');
  }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', initApp);
