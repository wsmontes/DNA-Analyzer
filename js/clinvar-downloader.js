/**
 * ClinVar Data Downloader Module
 * 
 * Provides utilities for downloading and managing ClinVar reference data files.
 * Handles checking for data availability and showing download instructions.
 * 
 * Dependencies:
 * - None (standalone utility module)
 * 
 * Exports:
 * - checkClinVarData: Check if ClinVar data files are available locally
 * - generateDownloadInstructions: Generate HTML content with download instructions
 * - showDownloadModal: Display a modal with download instructions
 * - downloadClinVarFiles: Trigger download of ClinVar files (where supported)
 */

// Define the files we need to download
const CLINVAR_FILES = [
  {
    name: 'variant_summary.txt.gz',
    url: 'https://ftp.ncbi.nlm.nih.gov/pub/clinvar/tab_delimited/variant_summary.txt.gz',
    size: '~350 MB',
    required: true,
    description: 'Contains detailed information about genetic variants and their clinical significance'
  },
  {
    name: 'clinvar.vcf.gz',
    url: 'https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh37/clinvar.vcf.gz',
    size: '~120 MB',
    required: true,
    description: 'VCF format file containing genetic variants with associated clinical data'
  },
  {
    name: 'clinvar.vcf.gz.tbi',
    url: 'https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh37/clinvar.vcf.gz.tbi',
    size: '~600 KB',
    required: true,
    description: 'Tabix index for the VCF file, enables efficient querying'
  },
  {
    name: 'gene_condition_source_id',
    url: 'https://ftp.ncbi.nlm.nih.gov/pub/clinvar/gene_condition_source_id',
    size: '~2 MB',
    required: false,
    description: 'Maps genes to associated conditions and their sources'
  },
  {
    name: 'README.txt',
    url: 'https://ftp.ncbi.nlm.nih.gov/pub/clinvar/README.txt',
    size: '~50 KB',
    required: false,
    description: 'Documentation about ClinVar data files and formats'
  }
];

/**
 * Check if ClinVar data is available locally
 * @returns {Promise<boolean>}
 */
export async function checkClinVarData() {
  try {
    // Check for required files using HEAD requests
    const requiredFiles = CLINVAR_FILES.filter(file => file.required);
    const filePromises = requiredFiles.map(file => 
      fetch(`clinvar/${file.name}`, { method: 'HEAD' })
        .then(response => response.ok)
        .catch(() => false)
    );
    
    const results = await Promise.all(filePromises);
    
    // Return true if all required files are available
    return results.every(result => result === true);
  } catch (error) {
    console.warn("Error checking for ClinVar data:", error);
    return false;
  }
}

/**
 * Generate download instructions
 * @returns {string} HTML content with download instructions
 */
export function generateDownloadInstructions() {
  return `
    <div class="download-instructions">
      <h3>ClinVar Data Required</h3>
      <p class="error-message">Missing required ClinVar data files. The DNA Analyzer needs these files for variant annotation.</p>
      
      <h4>What This Means</h4>
      <p>Without these files, the application cannot:</p>
      <ul>
        <li>Identify clinically significant variants</li>
        <li>Provide information about disease associations</li>
        <li>Generate accurate clinical summaries</li>
      </ul>
      
      <h4>Download Instructions</h4>
      <p>Please download the following files and place them in a "<strong>clinvar</strong>" directory in your project folder:</p>
      
      <ol>
        ${CLINVAR_FILES.map(file => `
          <li>
            <strong>${file.name}</strong> (${file.size}) ${file.required ? '<span class="required">Required</span>' : 'Optional'}
            <p class="file-description">${file.description}</p>
            <div class="download-options">
              <a href="${file.url}" target="_blank" class="download-link">Download directly</a>
              <div class="command">
                <code>curl -o clinvar/${file.name} ${file.url}</code>
                <button class="copy-btn" data-command="curl -o clinvar/${file.name} ${file.url}">Copy</button>
              </div>
            </div>
          </li>
        `).join('')}
      </ol>
      
      <div class="note">
        <p><strong>Important:</strong> Based on the ClinVar README file, these files need specific handling:</p>
        <ul>
          <li>The VCF files (<code>clinvar.vcf.gz</code> and <code>clinvar.vcf.gz.tbi</code>) must be from the correct genome build (GRCh37 or GRCh38)</li>
          <li>The tab-delimited file (<code>variant_summary.txt.gz</code>) contains all variant annotations</li>
          <li>Files are updated monthly, so ensure you're using the latest versions</li>
        </ul>
      </div>
      
      <div class="note">
        <p><strong>Note:</strong> These files are large and may take time to download. The application will work with limited functionality until they are available.</p>
        <p><strong>File location:</strong> Place these files in a folder named "clinvar" at:</p>
        <code class="file-path">${window.location.origin}/clinvar/</code>
      </div>
      
      <div class="command-block">
        <h4>Quick Setup with All Files (Unix/Mac)</h4>
        <div class="command-wrapper">
          <pre>mkdir -p clinvar
cd clinvar
curl -O https://ftp.ncbi.nlm.nih.gov/pub/clinvar/tab_delimited/variant_summary.txt.gz
curl -O https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh37/clinvar.vcf.gz
curl -O https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh37/clinvar.vcf.gz.tbi
curl -O https://ftp.ncbi.nlm.nih.gov/pub/clinvar/gene_condition_source_id</pre>
          <button class="copy-btn" data-command="mkdir -p clinvar
cd clinvar
curl -O https://ftp.ncbi.nlm.nih.gov/pub/clinvar/tab_delimited/variant_summary.txt.gz
curl -O https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh37/clinvar.vcf.gz
curl -O https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh37/clinvar.vcf.gz.tbi
curl -O https://ftp.ncbi.nlm.nih.gov/pub/clinvar/gene_condition_source_id">Copy all</button>
        </div>
      </div>

      <div class="continue-options">
        <button id="continue-without-clinvar" class="secondary-btn">Continue with Limited Functionality</button>
        <button id="retry-after-download" class="primary-btn">I've Downloaded the Files - Retry</button>
      </div>
    </div>
  `;
}

/**
 * Show the ClinVar download modal
 */
export function showDownloadModal() {
  // Only run in browser context
  if (typeof document === 'undefined') return;
  
  // Create modal if it doesn't exist
  let modal = document.getElementById('clinvar-download-modal');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'clinvar-download-modal';
    modal.className = 'modal';
    
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close">&times;</span>
        <div class="modal-body">
          ${generateDownloadInstructions()}
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listener to close button
    const closeBtn = modal.querySelector('.close');
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
    
    // Close when clicking outside the modal
    window.addEventListener('click', (event) => {
      if (event.target === modal) {
        modal.style.display = 'none';
      }
    });
    
    // Add event listeners for copy buttons
    modal.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const command = btn.getAttribute('data-command');
        navigator.clipboard.writeText(command)
          .then(() => {
            const originalText = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => {
              btn.textContent = originalText;
            }, 2000);
          })
          .catch(err => {
            console.error('Failed to copy:', err);
          });
      });
    });
    
    // Add event listeners for action buttons
    const continueBtn = modal.querySelector('#continue-without-clinvar');
    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        // Dispatch event to continue without ClinVar
        document.dispatchEvent(new CustomEvent('clinvar-continue-without-data'));
      });
    }
    
    const retryBtn = modal.querySelector('#retry-after-download');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        // Dispatch event to retry loading ClinVar data
        document.dispatchEvent(new CustomEvent('clinvar-retry-load'));
      });
    }
  } else {
    // Update modal content if it already exists
    modal.querySelector('.modal-body').innerHTML = generateDownloadInstructions();
  }
  
  // Display the modal
  modal.style.display = 'block';
}

/**
 * Try to download ClinVar files directly
 * Note: This may not work in all browsers due to CORS and download size limitations
 * @returns {Promise<boolean>} Whether the download was initiated
 */
export async function downloadClinVarFiles() {
  try {
    // Create clinvar directory if needed
    await createDirectory('clinvar');
    
    // Start downloads in sequence to avoid overwhelming the browser
    for (const file of CLINVAR_FILES) {
      if (file.required) {
        try {
          console.log(`Attempting to download ${file.name}...`);
          await downloadFile(file.url, `clinvar/${file.name}`);
          console.log(`Successfully downloaded ${file.name}`);
        } catch (error) {
          console.error(`Failed to download ${file.name}:`, error);
          throw error;
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error("Failed to download ClinVar files:", error);
    return false;
  }
}

/**
 * Create a directory (if supported by browser)
 * @param {string} dirName - Directory name to create
 * @returns {Promise<boolean>} Whether the directory was created
 */
async function createDirectory(dirName) {
  // This is a placeholder - browsers don't generally allow creating directories
  // In a real implementation, this would need to use the File System Access API
  console.log(`Creating directory ${dirName} (simulated)`);
  return true;
}

/**
 * Download a file (if supported by browser)
 * @param {string} url - URL to download from
 * @param {string} filename - Where to save the file
 * @returns {Promise<boolean>} Whether the download was successful
 */
async function downloadFile(url, filename) {
  // In a real implementation with File System Access API support,
  // this would download the file directly to the specified location.
  // For now, we'll just trigger a normal browser download
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.split('/').pop();
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  // We can't actually verify if the download succeeded
  // Just return true to indicate we initiated it
  return true;
}
