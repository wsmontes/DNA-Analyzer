/**
 * Genome Browser Module
 * 
 * Provides visualization of genomic variants on an interactive canvas.
 * 
 * Dependencies:
 * - None (standalone module)
 * 
 * Exports:
 * - initGenomeBrowser: Initialize the genome browser with variants
 * - updateGenomeBrowser: Update the browser with filtered variants
 */

// Chromosome sizes in base pairs (GRCh37/hg19)
const chromosomeSizes = {
  '1': 249250621,
  '2': 243199373,
  '3': 198022430,
  '4': 191154276,
  '5': 180915260,
  '6': 171115067,
  '7': 159138663,
  '8': 146364022,
  '9': 141213431,
  '10': 135534747,
  '11': 135006516,
  '12': 133851895,
  '13': 115169878,
  '14': 107349540,
  '15': 102531392,
  '16': 90354753,
  '17': 81195210,
  '18': 78077248,
  '19': 59128983,
  '20': 63025520,
  '21': 48129895,
  '22': 51304566,
  'X': 155270560,
  'Y': 59373566,
  'MT': 16569
};

// Browser state to track visualization settings
const browserState = {
  canvas: null,
  ctx: null,
  width: 1000,
  height: 200,
  variants: [],
  filteredVariants: [],
  selectedChromosome: 'all',
  viewStart: 0,
  viewEnd: 250000000,
  maxZoom: 100, // Minimum size of view range
  colors: {
    background: '#ffffff',
    chromosome: '#f0f0f0',
    border: '#dddddd',
    text: '#333333',
    pathogenic: '#d9534f',
    likelyPathogenic: '#f0ad4e',
    uncertain: '#5bc0de',
    likelyBenign: '#5cb85c',
    benign: '#3c763d',
    unknown: '#aaaaaa'
  }
};

/**
 * Initialize the genome browser
 * @param {Array} variants - The annotated variants
 */
export function initGenomeBrowser(variants) {
  browserState.canvas = document.getElementById('genome-browser');
  
  if (!browserState.canvas) {
    console.error('Genome browser canvas not found');
    return;
  }
  
  // Get the 2D rendering context
  browserState.ctx = browserState.canvas.getContext('2d');
  
  // Set canvas dimensions
  browserState.width = browserState.canvas.width;
  browserState.height = browserState.canvas.height;
  
  // Store variants
  browserState.variants = variants;
  
  // Setup event listeners
  setupBrowserEventListeners();
  
  // Initial rendering - don't call resetView directly here to avoid potential recursion
  initializeView();
}

/**
 * Update the genome browser with filtered variants
 * @param {Array} variants - All variants
 * @param {Object} filters - Filter settings to apply
 */
export function updateGenomeBrowser(variants, filters) {
  if (!browserState.canvas || !variants) return;
  
  // Apply filters similar to the table filters
  browserState.variants = variants;
  
  // Update chromosome selection if it doesn't match the filter
  if (filters.chromosome !== 'all' && 
      browserState.selectedChromosome !== filters.chromosome) {
    browserState.selectedChromosome = filters.chromosome;
  }
  
  // Debug logging to identify potential issues
  console.log(`Updating genome browser with ${variants.length} variants`);
  console.log(`Selected chromosome: ${browserState.selectedChromosome}`);
  
  // Count variants with significant data for debugging
  const annotatedCount = variants.filter(v => v.clinicalSignificance && v.clinicalSignificance !== 'unknown').length;
  console.log(`Variants with clinical significance: ${annotatedCount}`);
  
  // Update filtered variants
  browserState.filteredVariants = filterVariantsByChromosome(variants, browserState.selectedChromosome);
  console.log(`Filtered to ${browserState.filteredVariants.length} variants for selected chromosome`);
  
  // Reset view to accommodate the new data
  initializeView();
  
  // Render with updated data
  renderBrowser();
}

/**
 * Initialize the view without potential recursive calls
 */
function initializeView() {
  // Initialize view state
  browserState.viewStart = 0;
  browserState.viewEnd = 0;
  browserState.selectedChromosome = 'all';
  
  // Find the min and max positions for all variants or the selected chromosome
  let minPos = Number.MAX_SAFE_INTEGER;
  let maxPos = 0;
  
  for (const variant of browserState.variants) {
    if (browserState.selectedChromosome === 'all' || variant.chrom === browserState.selectedChromosome) {
      if (variant.pos < minPos) minPos = variant.pos;
      if (variant.pos > maxPos) maxPos = variant.pos;
    }
  }
  
  // Set the view range with some padding
  const padding = Math.round((maxPos - minPos) * 0.05); // 5% padding
  browserState.viewStart = Math.max(0, minPos - padding);
  browserState.viewEnd = maxPos + padding;
  
  // Render the browser with the new view
  renderBrowser();
}

/**
 * Set up event listeners for browser interaction
 */
function setupBrowserEventListeners() {
  const zoomIn = document.getElementById('zoom-in');
  const zoomOut = document.getElementById('zoom-out');
  const zoomReset = document.getElementById('zoom-reset');
  const canvas = browserState.canvas;
  
  if (zoomIn) {
    zoomIn.addEventListener('click', () => zoom(0.5));
  }
  
  if (zoomOut) {
    zoomOut.addEventListener('click', () => zoom(2));
  }
  
  if (zoomReset) {
    zoomReset.addEventListener('click', resetView);
  }
  
  if (canvas) {
    let isDragging = false;
    let lastX = 0;
    
    canvas.addEventListener('mousedown', (event) => {
      isDragging = true;
      lastX = event.offsetX;
      canvas.style.cursor = 'grabbing';
    });
    
    canvas.addEventListener('mousemove', (event) => {
      if (!isDragging) return;
      
      const deltaX = event.offsetX - lastX;
      pan(-deltaX);
      lastX = event.offsetX;
    });
    
    canvas.addEventListener('mouseup', () => {
      isDragging = false;
      canvas.style.cursor = 'grab';
    });
    
    canvas.addEventListener('mouseleave', () => {
      isDragging = false;
      canvas.style.cursor = 'grab';
    });
    
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      
      // Zoom in or out based on scroll direction
      const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9;
      zoom(zoomFactor);
    });
    
    // Set initial cursor
    canvas.style.cursor = 'grab';
  }
  
  // Add chromosome select handler
  const chromosomeSelect = document.getElementById('chromosome-select');
  if (chromosomeSelect) {
    chromosomeSelect.addEventListener('change', (event) => {
      browserState.selectedChromosome = event.target.value;
      browserState.filteredVariants = filterVariantsByChromosome(
        browserState.variants, 
        browserState.selectedChromosome
      );
      initializeView();
    });
  }
}

/**
 * Zoom the browser view
 * @param {number} factor - The zoom factor (>1: zoom out, <1: zoom in)
 */
function zoom(factor) {
  const viewRange = browserState.viewEnd - browserState.viewStart;
  const midPoint = (browserState.viewStart + browserState.viewEnd) / 2;
  const newViewRange = Math.max(browserState.maxZoom, viewRange * factor);
  
  browserState.viewStart = Math.max(0, midPoint - newViewRange / 2);
  browserState.viewEnd = Math.min(getMaxPosition(), midPoint + newViewRange / 2);
  
  renderBrowser();
}

/**
 * Pan the browser view
 * @param {number} deltaX - The amount to pan (in pixels)
 */
function pan(deltaX) {
  const viewRange = browserState.viewEnd - browserState.viewStart;
  const maxPos = getMaxPosition();
  const pixelsPerBp = browserState.width / viewRange;
  const bpDelta = deltaX / pixelsPerBp;
  
  browserState.viewStart = Math.max(0, Math.min(maxPos - viewRange, browserState.viewStart + bpDelta));
  browserState.viewEnd = Math.min(maxPos, browserState.viewStart + viewRange);
  
  renderBrowser();
}

/**
 * Reset the genome browser view
 */
function resetView() {
  // Don't directly call functions that might call back into this one
  // Use the non-recursive initialization function instead
  initializeView();
}

/**
 * Filter variants by chromosome
 * @param {Array} variants - All variants
 * @param {string} chromosome - Selected chromosome
 * @returns {Array} - Filtered variants
 */
function filterVariantsByChromosome(variants, chromosome) {
  if (chromosome === 'all') {
    return variants;
  }
  
  return variants.filter(v => v.chrom === chromosome);
}

/**
 * Get the maximum position based on selected chromosome
 * @returns {number} - Maximum position
 */
function getMaxPosition() {
  if (browserState.selectedChromosome === 'all') {
    return Math.max(...Object.values(chromosomeSizes));
  }
  
  return chromosomeSizes[browserState.selectedChromosome] || 250000000;
}

/**
 * Render the genome browser
 */
function renderBrowser() {
  const { ctx, width, height, filteredVariants, viewStart, viewEnd, colors } = browserState;
  
  if (!ctx) return;
  
  // Clear canvas
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, width, height);
  
  // Draw chromosome background
  ctx.fillStyle = colors.chromosome;
  ctx.fillRect(0, height / 4, width, height / 2);
  
  // Draw border
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(0, height / 4, width, height / 2);
  
  // Draw variants
  const viewRange = viewEnd - viewStart;
  const pixelsPerBp = width / viewRange;
  
  filteredVariants.forEach(variant => {
    if (variant.pos >= viewStart && variant.pos <= viewEnd) {
      const x = ((variant.pos - viewStart) * pixelsPerBp);
      const y = height / 2;
      
      // Determine color based on clinical significance
      let color = colors.unknown;
      if (variant.clinicalSignificance) {
        const sig = variant.clinicalSignificance.toLowerCase();
        if (sig.includes('pathogenic') && !sig.includes('likely')) {
          color = colors.pathogenic;
        } else if (sig.includes('likely pathogenic')) {
          color = colors.likelyPathogenic;
        } else if (sig.includes('uncertain')) {
          color = colors.uncertain;
        } else if (sig.includes('likely benign')) {
          color = colors.likelyBenign;
        } else if (sig.includes('benign')) {
          color = colors.benign;
        }
      }
      
      // Draw variant marker
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  
  // Draw current view details
  ctx.fillStyle = colors.text;
  ctx.font = '12px Arial';
  ctx.textAlign = 'left';
  
  const chrText = browserState.selectedChromosome === 'all' ? 'All Chromosomes' : `Chromosome ${browserState.selectedChromosome}`;
  const rangeText = `View: ${Math.floor(viewStart).toLocaleString()} - ${Math.floor(viewEnd).toLocaleString()} bp`;
  const countText = `Variants: ${filteredVariants.length} total, ${filteredVariants.filter(v => v.pos >= viewStart && v.pos <= viewEnd).length} visible`;
  
  ctx.fillText(chrText, 10, 20);
  ctx.fillText(rangeText, 10, 40);
  ctx.fillText(countText, 10, 60);
}
