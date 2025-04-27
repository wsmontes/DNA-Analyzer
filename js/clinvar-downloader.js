/**
 * Utility for downloading ClinVar reference data
 */

// Define the files we need to download
const CLINVAR_FILES = [
  {
    name: 'variant_summary.txt.gz',
    url: 'https://ftp.ncbi.nlm.nih.gov/pub/clinvar/tab_delimited/variant_summary.txt.gz',
    size: '~350 MB',
    required: true
  },
  {
    name: 'clinvar.vcf.gz',
    url: 'https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh37/clinvar.vcf.gz',
    size: '~120 MB',
    required: true
  },
  {
    name: 'clinvar.vcf.gz.tbi',
    url: 'https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh37/clinvar.vcf.gz.tbi',
    size: '~600 KB',
    required: true
  },
  {
    name: 'gene_condition_source_id.txt',
    url: 'https://ftp.ncbi.nlm.nih.gov/pub/clinvar/gene_condition_source_id',
    size: '~2 MB',
    required: false
  }
];

/**
 * Check if ClinVar data is available locally
 * @returns {Promise<boolean>}
 */
export async function checkClinVarData() {
  try {
    // Try to fetch a critical file
    const response = await fetch('clinvar/variant_summary.txt.gz', { method: 'HEAD' });
    return response.ok;
  } catch (error) {
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
      <h3>ClinVar Data Download Instructions</h3>
      <p>To enable full functionality, please download the following files and place them in a "clinvar" directory in your project:</p>
      
      <ol>
        ${CLINVAR_FILES.map(file => `
          <li>
            <strong>${file.name}</strong> (${file.size}) ${file.required ? '<span class="required">Required</span>' : 'Optional'}
            <br>
            <a href="${file.url}" target="_blank" class="download-link">Download directly</a> or use the command:
            <pre>curl -o clinvar/${file.name} ${file.url}</pre>
          </li>
        `).join('')}
      </ol>
      
      <div class="note">
        <p><strong>Note:</strong> These files are large and may take time to download. The application will work with limited functionality until they are available.</p>
      </div>
      
      <div class="command-block">
        <p>Quick setup with all files (Unix/Mac):</p>
        <pre>mkdir -p clinvar
cd clinvar
curl -O https://ftp.ncbi.nlm.nih.gov/pub/clinvar/tab_delimited/variant_summary.txt.gz
curl -O https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh37/clinvar.vcf.gz
curl -O https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh37/clinvar.vcf.gz.tbi
curl -O https://ftp.ncbi.nlm.nih.gov/pub/clinvar/gene_condition_source_id</pre>
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
  }
  
  // Display the modal
  modal.style.display = 'block';
}
