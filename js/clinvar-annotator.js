import { createWorker, sendWorkerMessage, terminateWorker, cleanupMemory, releaseDataset } from './worker-utils.js';

/**
 * Loads ClinVar reference data from local assets
 * @param {Function} progressCallback - Callback for reporting progress
 * @returns {Promise<Object>} - Object containing loaded ClinVar data
 */
export async function loadClinVarData() {
  try {
    console.log("Loading ClinVar data...");
    const variantData = await loadClinVarVCF();
    
    // Add null/undefined check before using Object.keys
    if (!variantData) {
      console.error("No variant data returned from loadClinVarVCF");
      throw new Error('Required ClinVar data is not available. Unable to proceed with annotation.');
    }
    
    console.log(`ClinVar data source: ${Object.keys(variantData).includes('tabixIndexed') ? 'indexed' : 'simplified'}`);
    return variantData;
  } catch (error) {
    console.error("Error loading ClinVar data:", error);
    // Instead of returning mock data, throw an error to fail explicitly
    throw new Error(`Failed to load ClinVar data: ${error.message}`);
  }
}

/**
 * Load ClinVar VCF file
 */
async function loadClinVarVCF() {
  let worker;
  try {
    // Store worker reference globally for potential cleanup later
    worker = await createWorker('js/vcf-worker.js', { timeout: 30000 });
    window.clinvarWorker = worker;
    
    console.log("Successfully loaded ClinVar VCF with worker");
    
    // Start loading the VCF file - using the correct paths to our compressed files
    const result = await sendWorkerMessage(worker, { 
      type: 'loadVCF',
      fileUrl: 'clinvar/clinvar.vcf.gz',
      indexUrl: 'clinvar/clinvar.vcf.gz.tbi',
      chunkSize: 2 * 1024 * 1024 // 2MB chunks
    });
    
    if (!result || result.type === 'error') {
      throw new Error(result?.error || 'Unknown error loading ClinVar data');
    }
    
    // Setup local query function that uses worker
    const clinvarQuery = async (chr, pos) => {
      // Check cache first
      const cacheKey = `${chr}:${pos}`;
      if (dataCache.has(cacheKey)) {
        return dataCache.get(cacheKey);
      }
      
      // Query worker for specific position
      const queryResult = await sendWorkerMessage(worker, {
        type: 'query',
        params: { chr, pos }
      });
      
      // Cache result
      if (queryResult && queryResult.results) {
        dataCache.set(cacheKey, queryResult.results);
        
        // Limit cache size
        if (dataCache.size > 10000) {
          // Remove oldest entries
          const keysToDelete = Array.from(dataCache.keys()).slice(0, 1000);
          keysToDelete.forEach(key => dataCache.delete(key));
        }
      }
      
      return queryResult?.results || [];
    };
    
    // Return query function to be used for annotation
    return clinvarQuery;
  } catch (error) {
    console.error('Error loading ClinVar VCF:', error);
    if (worker && typeof worker.terminate === 'function') {
      worker.terminate();
    }
    throw new Error('Failed to load ClinVar VCF: ' + error.message);
  }
}

/**
 * Simplified ClinVar VCF loader without worker
 */
async function loadClinVarVCFSimplified() {
  try {
    // Try to load compressed variant_summary.txt.gz file
    console.log("Loading variant_summary.txt.gz from clinvar directory");
    const response = await fetch('clinvar/variant_summary.txt.gz');
    
    if (!response.ok) {
      console.error(`File not found: clinvar/variant_summary.txt.gz (${response.status})`);
      throw new Error('ClinVar data not found');
    }
    
    // Process the compressed variant_summary file using streaming approach
    try {
      // Get total size for progress tracking
      const totalSize = response.headers.get('Content-Length');
      const blob = await response.blob();
      
      console.log(`Starting decompression of variant_summary.txt.gz (${(blob.size/1024/1024).toFixed(2)} MB)`);
      
      // Use chunked decompression to avoid memory issues
      const decompressedText = await streamDecompressGzip(blob);
      
      if (!decompressedText) {
        throw new Error('Decompression returned empty result');
      }
      
      return parseVariantSummaryData(decompressedText);
    } catch (error) {
      console.warn(`Failed to decompress variant_summary.txt.gz: ${error.message}`);
      
      // Try direct VCF file if variant summary failed
      console.log("Falling back to clinvar.vcf");
      return loadSimplifiedVCF();
    }
  } catch (error) {
    console.warn(`ClinVar data should be downloaded from NCBI and placed in the clinvar/ directory`);
    displayClinVarFilesInfoMessage();
    // Instead of returning mock data, throw an error to fail explicitly
    throw new Error('Required ClinVar data files are not available. Please download them from NCBI.');
  }
}

// Improved streamed decompression for large gzip files
async function streamDecompressGzip(blob) {
  return new Promise((resolve, reject) => {
    try {
      // Use smaller chunk size to avoid memory issues
      const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
      const fileReader = new FileReader();
      let offset = 0;
      let result = '';
      
      // Create pako inflater
      const inflator = new pako.Inflate({
        to: 'string',
        chunkSize: CHUNK_SIZE
      });
      
      fileReader.onload = function(e) {
        try {
          const buffer = new Uint8Array(e.target.result);
          
          // Process in smaller chunks
          let chunkOffset = 0;
          while (chunkOffset < buffer.length) {
            const end = Math.min(buffer.length, chunkOffset + CHUNK_SIZE);
            const chunk = buffer.subarray(chunkOffset, end);
            const isLast = (offset + end >= blob.size);
            
            try {
              inflator.push(chunk, isLast);
              chunkOffset = end;
            } catch (err) {
              reject(new Error(`Decompression chunk error: ${err.message}`));
              return;
            }
          }
          
          // Get partial results and append to string
          if (inflator.result) {
            result += inflator.result;
          }
          
          // Continue reading if more data exists
          offset += buffer.length;
          if (offset < blob.size) {
            readNextChunk();
          } else {
            // All data processed
            if (inflator.err) {
              reject(new Error(inflator.msg));
            } else {
              resolve(result);
            }
          }
        } catch (err) {
          reject(new Error(`Failed to process decompressed chunk: ${err.message}`));
        }
      };
      
      fileReader.onerror = () => reject(new Error('Error reading file'));
      
      // Function to read the next chunk
      function readNextChunk() {
        const slice = blob.slice(offset, offset + CHUNK_SIZE);
        fileReader.readAsArrayBuffer(slice);
      }
      
      // Start reading the first chunk
      readNextChunk();
      
    } catch (error) {
      reject(new Error(`Decompression setup error: ${error.message}`));
    }
  });
}

// Fallback function to load directly from VCF file
async function loadSimplifiedVCF() {
  try {
    console.log("Attempting to load clinvar.vcf directly");
    const response = await fetch('clinvar/clinvar.vcf');
    
    if (!response.ok) {
      console.error(`File not found: clinvar/clinvar.vcf (${response.status})`);
      
      // Try compressed VCF
      const gzResponse = await fetch('clinvar/clinvar.vcf.gz');
      if (!gzResponse.ok) {
        console.error(`File not found: clinvar/clinvar.vcf.gz (${gzResponse.status})`);
        throw new Error('ClinVar VCF not found');
      }
      
      const blob = await gzResponse.blob();
      const vcfContent = await streamDecompressGzip(blob);
      return parseVCFData(vcfContent);
    }
    
    const vcfContent = await response.text();
    return parseVCFData(vcfContent);
  } catch (error) {
    console.error(`Error loading VCF: ${error.message}`);
    throw error;
  }
}

/**
 * Show help message for downloading ClinVar data
 */
function displayClinVarFilesInfoMessage() {
  console.info(`
=================================================================
ClinVar Data Not Found
=================================================================
To use ClinVar annotation, please download the data files from NCBI:

1. Create a 'clinvar' directory in the project root if it doesn't exist
2. Download the required files from NCBI:
   - variant_summary.txt.gz: ftp://ftp.ncbi.nlm.nih.gov/pub/clinvar/tab_delimited/variant_summary.txt.gz
   - clinvar.vcf.gz: ftp://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh37/clinvar.vcf.gz
   - clinvar.vcf.gz.tbi: ftp://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh37/clinvar.vcf.gz.tbi

For more information, see: https://www.ncbi.nlm.nih.gov/clinvar/docs/ftp_primer/
=================================================================
`);
}

/**
 * Parse variant summary text format
 * @param {string} text - The variant summary text
 * @param {Function} progressCallback - Callback for reporting progress
 * @returns {Object} - Object with variants indexed by rsID
 */
function parseVariantSummaryText(text, progressCallback) {
  const lines = text.split('\n');
  const variants = {};
  
  // Find the header line
  const headerLine = lines.find(line => line.startsWith('#'));
  if (!headerLine) {
    console.error("Could not find header in variant summary file");
    throw new Error("Could not find header in variant summary file");
  }
  
  const headers = headerLine.substring(1).split('\t');
  const rsIdIndex = headers.indexOf('RS# (dbSNP)');
  const alleleIdIndex = headers.indexOf('AlleleID');
  const typeIndex = headers.indexOf('Type');
  const nameIndex = headers.indexOf('Name');
  const geneIdIndex = headers.indexOf('GeneID');
  const geneSymbolIndex = headers.indexOf('GeneSymbol');
  const clinSigIndex = headers.indexOf('ClinicalSignificance');
  const phenotypeListIndex = headers.indexOf('PhenotypeList');
  const chromosomeIndex = headers.indexOf('Chromosome');
  const positionIndex = headers.indexOf('Start');
  const refIndex = headers.indexOf('ReferenceAllele');
  const altIndex = headers.indexOf('AlternateAllele');
  
  console.log(`Found column indices: rsID=${rsIdIndex}, clinSig=${clinSigIndex}, chromosome=${chromosomeIndex}`);
  
  if (rsIdIndex === -1 || alleleIdIndex === -1 || geneSymbolIndex === -1) {
    console.error("Required columns missing in variant summary file");
    throw new Error("Required columns missing in variant summary file");
  }
  
  let processedVariants = 0;
  let validVariants = 0;
  const totalLines = lines.length;
  
  // Process data in chunks to avoid blocking (every 1000 lines)
  const chunkSize = 1000;
  
  // Process the data in chunks
  for (let i = 1; i < lines.length; i += chunkSize) {
    const endIdx = Math.min(i + chunkSize, lines.length);
    
    for (let j = i; j < endIdx; j++) {
      const line = lines[j].trim();
      if (!line) continue;
      
      processedVariants++;
      
      // Parse tab-separated values
      const fields = line.split('\t');
      if (fields.length < Math.max(rsIdIndex, geneSymbolIndex, clinSigIndex) + 1) continue;
      
      const rsId = fields[rsIdIndex];
      
      // Only process entries with valid rsIDs
      if (rsId && rsId !== '-1' && rsId !== 'na') {
        variants[rsId] = {
          alleleId: fields[alleleIdIndex] || null,
          type: fields[typeIndex] || null,
          name: fields[nameIndex] || null,
          geneId: fields[geneIdIndex] || null,
          geneSymbol: fields[geneSymbolIndex] || null,
          clinicalSignificance: fields[clinSigIndex] || 'unknown',
          condition: fields[phenotypeListIndex] || null,
          chromosome: fields[chromosomeIndex] || null,
          position: parseInt(fields[positionIndex], 10) || 0,
          referenceAllele: fields[refIndex] || null,
          alternateAllele: fields[altIndex] || null
        };
        validVariants++;
      }
    }
    
    // Update progress occasionally
    if (progressCallback && i % (chunkSize * 10) === 0) {
      const progress = Math.min(90, 50 + (i / totalLines) * 40);
      progressCallback(progress, `Parsed ${validVariants.toLocaleString()} variants...`);
    }
  }
  
  console.log(`Successfully processed ${processedVariants} variants from summary file`);
  console.log(`Found ${validVariants} valid variants with rsIDs`);
  
  return variants;
}

/**
 * Annotates variants with ClinVar data
 * @param {Array} genotypeRecords - The parsed genotype records
 * @param {Object} clinVarData - The loaded ClinVar reference data
 * @param {Function} progressCallback - Callback for reporting progress
 * @returns {Promise<Array>} - Array of annotated variants
 */
export async function annotateVariants(genotypeRecords, clinVarData, progressCallback = null) {
  try {
    const total = genotypeRecords.length;
    let annotated = [];
    let processed = 0;
    let matched = 0;
    
    console.log(`Starting annotation of ${total} genotype records`);
    
    // Log clinvar data structure
    if (clinVarData.clinvarVcf) {
      console.log(`ClinVar data source: ${clinVarData.clinvarVcf.simplified ? 'simplified' : 'full'}`);
      const variantCount = clinVarData.clinvarVcf.variants ? Object.keys(clinVarData.clinvarVcf.variants).length : 0;
      console.log(`ClinVar variants available: ${variantCount}`);
    }
    
    // Process in batches for better UI responsiveness
    const batchSize = 100;
    
    // Function to process a batch of variants
    const processBatch = async (startIdx) => {
      const endIdx = Math.min(startIdx + batchSize, total);
      const batch = [];
      
      for (let i = startIdx; i < endIdx; i++) {
        const record = genotypeRecords[i];
        const rsID = record.rsID;
        
        let annotation = {
          ...record,
          gene: null,
          clinicalSignificance: 'unknown',
          condition: null,
          associatedGenes: null
        };
        
        // If using the simplified approach
        if (clinVarData.clinvarVcf.simplified) {
          if (rsID && clinVarData.clinvarVcf.variants[rsID]) {
            const variant = clinVarData.clinvarVcf.variants[rsID];
            annotation.gene = variant.geneSymbol;
            annotation.clinicalSignificance = variant.clinicalSignificance;
            annotation.condition = variant.condition;
            matched++;
            
            if (matched % 100 === 0) {
              console.log(`Found ${matched} matches in ClinVar data so far`);
            }
          }
        } 
        // If using the worker-based approach (not implemented for now)
        else {
          // In a real implementation, we would query the worker here
          // For now, just use basic annotation
        }
        
        // Look for gene-condition relationships if we have a gene
        if (annotation.gene) {
          const geneConditions = clinVarData.geneConditions[annotation.gene];
          if (geneConditions) {
            annotation.associatedGenes = geneConditions.map(gc => gc.geneID).join(',');
          }
        }
        
        batch.push(annotation);
      }
      
      processed += batch.length;
      
      if (progressCallback) {
        const progress = (processed / total) * 100;
        progressCallback(progress, `Processed ${processed}/${total} (${matched} matches)`, total);
      }
      
      return batch;
    };
    
    // Process all variants in batches
    for (let i = 0; i < total; i += batchSize) {
      annotated = annotated.concat(await processBatch(i));
    }
    
    console.log(`Annotation complete: ${matched} variants matched out of ${total} total`);
    
    // Clean up memory after annotations are complete
    setTimeout(() => {
      releaseClinVarData();
    }, 1000); // Delay cleanup to ensure UI updates complete
    
    return annotated;
  } catch (error) {
    console.error('Error during annotation:', error);
    // Still clean up even on error
    releaseClinVarData();
    throw error;
  }
}

// Add or modify the cleanup function to use the imported utilities
export function cleanup() {
  console.log("Cleaning up ClinVar annotator resources");
  
  // Release any stored data
  if (window.clinvarData) {
    releaseDataset(window.clinvarData);
    window.clinvarData = null;
  }
  
  if (window.clinvarCache) {
    releaseDataset(window.clinvarCache);
    window.clinvarCache = null;
  }
  
  // Clean up any running workers
  if (window.clinvarWorker) {
    terminateWorker(window.clinvarWorker);
    window.clinvarWorker = null;
  }
  
  // Run general memory cleanup
  cleanupMemory();
}

// Add cleanup on window unload to ensure proper resource release
window.addEventListener('beforeunload', () => {
  cleanup();
});
