/**
 * Safely formats a number with locale-specific thousands separators
 * @param {number|null|undefined} value - The number to format
 * @param {string} defaultValue - The default value if the input is invalid
 * @returns {string} - Formatted number or default value
 */
function safeFormatNumber(value, defaultValue = '-') {
  if (value === null || value === undefined || isNaN(value)) {
    return defaultValue;
  }
  return value.toLocaleString();
}

/**
 * Format the clinical significance value for display
 * @param {string} significance - The raw clinical significance value
 * @returns {string} - Formatted significance
 */
function formatClinicalSignificance(significance) {
  if (!significance) return 'Unknown';
  
  // Handle multiple values separated by semicolons
  if (significance.includes(';')) {
    return significance.split(';').map(s => formatClinicalSignificance(s.trim())).join(', ');
  }
  
  // Format common values
  const mapping = {
    'pathogenic': 'Pathogenic',
    'likely pathogenic': 'Likely Pathogenic',
    'uncertain significance': 'Uncertain Significance',
    'likely benign': 'Likely Benign',
    'benign': 'Benign',
    'conflicting interpretations of pathogenicity': 'Conflicting',
    'not provided': 'Not Provided',
    'unknown': 'Unknown'
  };
  
  const lowercased = significance.toLowerCase();
  return mapping[lowercased] || significance;
}

/**
 * Update a progress bar
 * @param {string} id - The ID of the progress bar (without "progress" suffix)
 * @param {number} progress - The progress percentage (0-100)
 * @param {string} message - The status message
 */
function updateProgressBar(id, progress, message) {
  const progressBar = document.getElementById(`${id}-progress`);
  const status = document.getElementById(`${id}-status`);
  
  if (progressBar) {
    progressBar.style.width = `${progress}%`;
  }
  
  if (status && message) {
    status.textContent = message;
  }
}

/**
 * Hide the error section
 */
export function hideError() {
  const errorSection = document.getElementById('error-section');
  if (errorSection) {
    errorSection.classList.add('hidden');
  }
}

/**
 * Show an error message to the user
 * @param {string} message - The error message to display
 */
export function showError(message) {
  const errorSection = document.getElementById('error-section');
  const errorMessage = document.getElementById('error-message');
  
  if (errorSection && errorMessage) {
    errorMessage.textContent = message;
    errorSection.classList.remove('hidden');
  }
}

/**
 * Render results table with filtered data
 * @param {Array} variants - The annotated variants
 * @param {Object} filters - The filters to apply
 * @param {number} currentPage - The current page number
 * @param {number} pageSize - The number of items per page
 */
export function renderResultsTable(variants, filters, currentPage, pageSize) {
  const tableBody = document.getElementById('results-body');
  const paginationControls = document.getElementById('pagination-controls');
  const pageIndicator = document.getElementById('page-indicator');
  const prevButton = document.getElementById('prev-page');
  const nextButton = document.getElementById('next-page');
  
  if (!tableBody) return;
  
  // Apply filters
  const filteredVariants = filterVariants(variants, filters);
  
  // Apply sorting if applicable
  const sortedVariants = sortVariants(filteredVariants, filters.sortField, filters.sortDirection);
  
  // Calculate pagination
  const totalItems = sortedVariants.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const pageItems = sortedVariants.slice(startIndex, endIndex);
  
  // Clear the table
  tableBody.innerHTML = '';
  
  // If no variants match the filters
  if (pageItems.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 8;
    cell.textContent = 'No variants match the current filters';
    cell.className = 'no-results';
    row.appendChild(cell);
    tableBody.appendChild(row);
  } else {
    // Add the variants to the table
    for (const variant of pageItems) {
      const row = document.createElement('tr');
      
      // Add clinical significance class for styling
      if (variant.clinicalSignificance) {
        row.classList.add(`significance-${variant.clinicalSignificance.toLowerCase().replace(/[\s_]+/g, '-')}`);
      }
      
      // Create cells with safe formatting
      appendCell(row, variant.rsID || '-');
      appendCell(row, variant.chrom || '-');
      appendCell(row, safeFormatNumber(variant.pos));
      appendCell(row, variant.genotype || '-');
      appendCell(row, variant.gene || '-');
      appendCell(row, formatClinicalSignificance(variant.clinicalSignificance));
      appendCell(row, variant.condition || variant.associatedConditions || '-');
      
      // Links cell
      const linksCell = document.createElement('td');
      
      if (variant.rsID && variant.rsID.startsWith('rs')) {
        const dbSnpLink = document.createElement('a');
        dbSnpLink.href = `https://www.ncbi.nlm.nih.gov/snp/${variant.rsID}`;
        dbSnpLink.target = '_blank';
        dbSnpLink.textContent = 'dbSNP';
        dbSnpLink.className = 'external-link';
        linksCell.appendChild(dbSnpLink);
        
        // Add ClinVar link if available
        if (variant.clinicalSignificance) {
          const clinVarLink = document.createElement('a');
          clinVarLink.href = `https://www.ncbi.nlm.nih.gov/clinvar?term=${variant.rsID}`;
          clinVarLink.target = '_blank';
          clinVarLink.textContent = 'ClinVar';
          clinVarLink.className = 'external-link';
          linksCell.appendChild(document.createTextNode(' | '));
          linksCell.appendChild(clinVarLink);
        }
      } else {
        linksCell.textContent = '-';
      }
      
      row.appendChild(linksCell);
      tableBody.appendChild(row);
    }
  }
  
  // Update pagination controls
  if (paginationControls) {
    paginationControls.classList.toggle('hidden', totalPages <= 1);
  }
  
  if (pageIndicator) {
    pageIndicator.textContent = `Page ${currentPage} of ${totalPages || 1}`;
  }
  
  if (prevButton) {
    prevButton.disabled = currentPage <= 1;
  }
  
  if (nextButton) {
    nextButton.disabled = currentPage >= totalPages;
  }
}

/**
 * Append a cell with content to a row
 * @param {HTMLElement} row - The row element
 * @param {string} content - The cell content
 */
function appendCell(row, content) {
  const cell = document.createElement('td');
  cell.textContent = content;
  row.appendChild(cell);
}

/**
 * Filter variants based on the provided filters
 * @param {Array} variants - The variants to filter
 * @param {Object} filters - The filter settings
 * @returns {Array} - The filtered variants
 */
function filterVariants(variants, filters) {
  if (!variants || !Array.isArray(variants)) return [];
  
  return variants.filter(v => {
    // Filter by clinical significance
    if (filters.significance !== 'all') {
      const sig = v.clinicalSignificance?.toLowerCase() || '';
      
      if (filters.significance === 'pathogenic' && !sig.includes('pathogenic')) {
        return false;
      } else if (filters.significance === 'likely_pathogenic' && !sig.includes('likely pathogenic')) {
        return false;
      } else if (filters.significance === 'uncertain_significance' && !sig.includes('uncertain')) {
        return false;
      } else if (filters.significance === 'likely_benign' && !sig.includes('likely benign')) {
        return false;
      } else if (filters.significance === 'benign' && !sig.includes('benign')) {
        return false;
      }
    }
    
    // Filter by chromosome
    if (filters.chromosome !== 'all' && v.chrom !== filters.chromosome) {
      return false;
    }
    
    // Filter by search term
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      const rsID = v.rsID?.toLowerCase() || '';
      const gene = v.gene?.toLowerCase() || '';
      const condition = v.condition?.toLowerCase() || '';
      
      if (!rsID.includes(term) && !gene.includes(term) && !condition.includes(term)) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * Sort variants based on the provided field and direction
 * @param {Array} variants - The variants to sort
 * @param {string} field - The field to sort by
 * @param {string} direction - The sort direction ('asc' or 'desc')
 * @returns {Array} - The sorted variants
 */
function sortVariants(variants, field, direction) {
  if (!variants || !Array.isArray(variants)) return [];
  if (!field) return [...variants];
  
  return [...variants].sort((a, b) => {
    let valA, valB;
    
    // Get the values to compare based on the field
    switch (field) {
      case 'rsid':
        valA = a.rsID || '';
        valB = b.rsID || '';
        break;
      case 'chrom':
        // Sort chromosomes numerically, with X, Y, MT at the end
        valA = a.chrom || '';
        valB = b.chrom || '';
        if (!isNaN(valA) && !isNaN(valB)) {
          valA = parseInt(valA, 10);
          valB = parseInt(valB, 10);
        } else {
          if (!isNaN(valA)) return -1;
          if (!isNaN(valB)) return 1;
          // Handle X, Y, MT
          if (valA === 'X') valA = 100;
          if (valA === 'Y') valA = 101;
          if (valA === 'MT') valA = 102;
          if (valB === 'X') valB = 100;
          if (valB === 'Y') valB = 101;
          if (valB === 'MT') valB = 102;
        }
        break;
      case 'pos':
        valA = a.pos || 0;
        valB = b.pos || 0;
        break;
      case 'genotype':
        valA = a.genotype || '';
        valB = b.genotype || '';
        break;
      case 'gene':
        valA = a.gene || '';
        valB = b.gene || '';
        break;
      case 'significance':
        valA = a.clinicalSignificance || '';
        valB = b.clinicalSignificance || '';
        break;
      case 'condition':
        valA = a.condition || a.associatedConditions || '';
        valB = b.condition || b.associatedConditions || '';
        break;
      default:
        return 0;
    }
    
    // Compare the values
    let result;
    if (typeof valA === 'string' && typeof valB === 'string') {
      result = valA.localeCompare(valB);
    } else {
      result = valA < valB ? -1 : valA > valB ? 1 : 0;
    }
    
    // Apply direction
    return direction === 'asc' ? result : -result;
  });
}

// Export all functions at the end of the file
export {
  updateProgressBar,
  formatClinicalSignificance,
  safeFormatNumber,
  filterVariants,
  sortVariants
};
