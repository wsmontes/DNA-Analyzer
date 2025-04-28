/**
 * ClinVar Annotator Module
 * 
 * Loads and processes ClinVar reference data for annotating genetic variants.
 * Handles querying of ClinVar data and matching with user-provided variants.
 * 
 * Dependencies:
 * - worker-utils.js: For worker management and memory cleanup
 * - pako: For gzip decompression (only needed for compressed files)
 * 
 * Exports:
 * - loadClinVarData: Load ClinVar reference data
 * - annotateVariants: Annotate variants with ClinVar data
 * - cleanup: Release resources and clear caches
 */

import { createWorker, sendWorkerMessage, terminateWorker, cleanupMemory, releaseDataset } from './worker-utils.js';

// Cache for ClinVar query results
const dataCache = new Map();

// Define all possible ClinVar file formats and their priorities
// Lower priority number means higher preference
const CLINVAR_FILE_FORMATS = [
  { 
    type: 'vcf-uncompressed', 
    files: ['clinvar/clinvar.vcf'],
    priority: 0  // Highest priority - uncompressed VCF
  },
  { 
    type: 'tab-delimited-uncompressed', 
    files: ['clinvar/variant_summary.txt'],
    priority: 1  // Second highest priority - uncompressed tab-delimited
  },
  { 
    type: 'vcf', 
    files: ['clinvar/clinvar.vcf.gz', 'clinvar/clinvar.vcf.gz.tbi'],
    priority: 2  // Third priority - compressed VCF
  },
  { 
    type: 'tab-delimited', 
    files: ['clinvar/variant_summary.txt.gz'],
    priority: 3  // Lowest priority - compressed tab-delimited
  }
];

/**
 * Loads ClinVar reference data from local assets
 * @returns {Promise<Object>} - Object containing loaded ClinVar data
 */
export async function loadClinVarData() {
  try {
    console.log("Loading ClinVar data...");
    
    // Verify which files actually exist in the clinvar directory
    await verifyClivarDirectory();
    
    // Check all possible file formats
    const formatAvailability = await checkClinVarFileFormats();
    console.log("ClinVar file availability:", formatAvailability);
    
    if (formatAvailability.length === 0) {
      throw new Error('No ClinVar data files found. Please download the required files.');
    }
    
    // Try loading data in order of priority
    let variantData = null;
    
    for (const format of formatAvailability) {
      console.log(`Attempting to load ClinVar data using ${format.type} format...`);
      try {
        if (format.type === 'vcf') {
          variantData = await loadClinVarVCF();
          if (variantData) break;
        } else if (format.type === 'vcf-uncompressed') {
          variantData = await loadClinVarVCFUncompressed();
          if (variantData) break;
        } else if (format.type === 'tab-delimited') {
          variantData = await loadClinVarTabDelimited();
          if (variantData) break;
        } else if (format.type === 'tab-delimited-uncompressed') {
          variantData = await loadClinVarTabDelimitedUncompressed();
          if (variantData) break;
        }
      } catch (formatError) {
        console.warn(`Failed to load ${format.type} format:`, formatError);
      }
    }
    
    if (!variantData) {
      throw new Error('Failed to parse ClinVar data. Unable to proceed with annotation.');
    }
    
    // Ensure the data structure is consistent regardless of the source
    const normalizedData = normalizeCliVarData(variantData);
    
    console.log(`ClinVar data source: ${normalizedData.source}`);
    return normalizedData;
  } catch (error) {
    console.error("Error loading ClinVar data:", error);
    // Dispatch event to notify application about missing ClinVar data
    document.dispatchEvent(new CustomEvent('clinvar-missing', { detail: { error: error.message } }));
    throw new Error(`Failed to load ClinVar data: ${error.message}`);
  }
}

/**
 * Verify that the clinvar directory exists and list its contents
 * @returns {Promise<Array>} - List of files in the clinvar directory
 */
async function verifyClivarDirectory() {
  try {
    // Use fetch to check directory existence
    const response = await fetch('clinvar/');
    
    if (!response.ok) {
      console.warn("Clinvar directory is not accessible or doesn't exist");
      return [];
    }
    
    console.log("Clinvar directory exists, checking for files:");
    
    // Log the presence of each expected file type, including uncompressed versions
    const fileChecks = [
      'clinvar.vcf', // Uncompressed VCF
      'clinvar.vcf.gz',
      'clinvar.vcf.gz.tbi',
      'variant_summary.txt', // Uncompressed tab-delimited
      'variant_summary.txt.gz'
    ];
    
    const fileStatuses = await Promise.all(
      fileChecks.map(async filename => {
        try {
          const fileResponse = await fetch(`clinvar/${filename}`, { method: 'HEAD' });
          const exists = fileResponse.ok;
          const size = exists ? fileResponse.headers.get('content-length') : 'N/A';
          console.log(`- ${filename}: ${exists ? 'Found' : 'Not found'} (${size} bytes)`);
          return { filename, exists, size };
        } catch (e) {
          console.log(`- ${filename}: Error checking (${e.message})`);
          return { filename, exists: false, error: e.message };
        }
      })
    );
    
    return fileStatuses.filter(f => f.exists).map(f => f.filename);
  } catch (error) {
    console.warn("Error verifying clinvar directory:", error);
    return [];
  }
}

/**
 * Check which ClinVar file formats are available
 * @returns {Promise<Array>} - Array of available formats sorted by priority
 */
async function checkClinVarFileFormats() {
  const results = [];
  
  for (const format of CLINVAR_FILE_FORMATS) {
    try {
      const filePromises = format.files.map(file => 
        fetch(file, { method: 'HEAD' })
          .then(r => ({ file, exists: r.ok, size: r.headers.get('content-length') }))
          .catch(err => ({ file, exists: false, error: err.message }))
      );
      
      const fileResults = await Promise.all(filePromises);
      const allFilesExist = fileResults.every(result => result.exists);
      
      // Log detailed information about each file
      fileResults.forEach(result => {
        console.log(`${result.file}: ${result.exists ? `Found (${result.size} bytes)` : `Not found${result.error ? ': ' + result.error : ''}`}`);
      });
      
      if (allFilesExist) {
        results.push({
          type: format.type,
          priority: format.priority,
          files: format.files,
          fileDetails: fileResults
        });
      }
    } catch (error) {
      console.warn(`Error checking format ${format.type}:`, error);
    }
  }
  
  // Sort by priority
  return results.sort((a, b) => a.priority - b.priority);
}

/**
 * Load uncompressed tab-delimited ClinVar file
 * @returns {Promise<Object>} - Parsed ClinVar data
 */
async function loadClinVarTabDelimitedUncompressed() {
  try {
    console.log("Attempting to load uncompressed tab-delimited ClinVar data");
    const response = await fetch('clinvar/variant_summary.txt');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch variant_summary.txt: ${response.status}`);
    }
    
    const contentLength = response.headers.get('content-length');
    console.log(`Downloaded variant_summary.txt (${contentLength} bytes)`);
    
    // Get the file as text directly
    const text = await response.text();
    console.log(`Got text of ${text.length} characters`);
    
    // Parse the tab-delimited data
    return parseTabDelimitedData(text);
  } catch (error) {
    console.error("Error loading uncompressed tab-delimited file:", error);
    throw error;
  }
}

/**
 * Load compressed tab-delimited ClinVar file
 * @returns {Promise<Object>} - Parsed ClinVar data
 */
async function loadClinVarTabDelimited() {
  try {
    console.log("Attempting to load compressed tab-delimited ClinVar data");
    const response = await fetch('clinvar/variant_summary.txt.gz');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch variant_summary.txt.gz: ${response.status}`);
    }
    
    const contentLength = response.headers.get('content-length');
    console.log(`Downloaded variant_summary.txt.gz (${contentLength} bytes)`);
    
    // Get the file as an ArrayBuffer
    const buffer = await response.arrayBuffer();
    console.log(`Got ArrayBuffer of ${buffer.byteLength} bytes`);
    
    // Use the pako library to decompress the gzip file
    const pako = window.pako;
    if (!pako) {
      throw new Error("Pako library not found. Required for decompression.");
    }
    
    console.log("Decompressing gzipped data...");
    const decompressed = pako.inflate(new Uint8Array(buffer));
    
    // Convert to text
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(decompressed);
    console.log(`Decompressed to ${text.length} characters`);
    
    return parseTabDelimitedData(text);
  } catch (error) {
    console.error("Error loading tab-delimited file:", error);
    throw error;
  }
}

/**
 * Parse tab-delimited ClinVar data
 * @param {string} text - Tab-delimited text content
 * @returns {Object} - Parsed ClinVar data structure
 */
function parseTabDelimitedData(text) {
  try {
    console.log("Parsing tab-delimited ClinVar data...");
    
    const lines = text.split('\n');
    if (lines.length < 2) {
      throw new Error("Tab-delimited file has insufficient data");
    }
    
    // Parse header to find column indices
    const header = lines[0].split('\t');
    const colIndices = {
      alleleId: header.indexOf('AlleleID'),
      clinSig: header.indexOf('ClinicalSignificance'),
      geneId: header.indexOf('GeneID'),
      geneSymbol: header.indexOf('GeneSymbol'),
      rsId: header.indexOf('RS# (dbSNP)'),
      phenotype: header.indexOf('PhenotypeList'),
      chromosome: header.indexOf('Chromosome'),
      start: header.indexOf('Start'),
      stop: header.indexOf('Stop'),
      refAllele: header.indexOf('ReferenceAllele'),
      altAllele: header.indexOf('AlternateAllele')
    };
    
    // Check if required columns are present
    for (const [key, index] of Object.entries(colIndices)) {
      if (index === -1) {
        console.warn(`Required column ${key} not found in tab-delimited file`);
      }
    }
    
    const variants = {};
    const geneConditions = {};
    let variantCount = 0;
    
    // Start from line 1 to skip header
    for (let i = 1; i < lines.length && variantCount < 10000; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const fields = line.split('\t');
      
      // Skip if we don't have enough fields
      if (fields.length < Math.max(...Object.values(colIndices)) + 1) {
        continue;
      }
      
      // Extract data from relevant columns
      const alleleId = colIndices.alleleId !== -1 ? fields[colIndices.alleleId] : '';
      const rsId = colIndices.rsId !== -1 ? fields[colIndices.rsId] : '';
      const geneSymbol = colIndices.geneSymbol !== -1 ? fields[colIndices.geneSymbol] : '';
      const clinSig = colIndices.clinSig !== -1 ? fields[colIndices.clinSig] : '';
      const phenotype = colIndices.phenotype !== -1 ? fields[colIndices.phenotype] : '';
      
      // Skip if no allele ID or rsID
      if (!alleleId && !rsId) continue;
      
      const variantId = alleleId || rsId;
      
      // Create variant data
      variants[variantId] = {
        chr: colIndices.chromosome !== -1 ? fields[colIndices.chromosome] : '',
        pos: colIndices.start !== -1 ? parseInt(fields[colIndices.start], 10) || 0 : 0,
        ref: colIndices.refAllele !== -1 ? fields[colIndices.refAllele] : '',
        alt: colIndices.altAllele !== -1 ? fields[colIndices.altAllele] : '',
        gene: geneSymbol,
        geneSymbol: geneSymbol,
        clinicalSignificance: parseClinicalSignificance(clinSig),
        condition: phenotype
      };
      
      // Add to gene conditions if we have gene info
      if (geneSymbol && phenotype) {
        if (!geneConditions[geneSymbol]) {
          geneConditions[geneSymbol] = [];
        }
        
        geneConditions[geneSymbol].push({
          geneID: geneSymbol,
          condition: phenotype
        });
      }
      
      variantCount++;
    }
    
    console.log(`Parsed ${variantCount} variants from tab-delimited data`);
    
    return {
      clinvarVcf: {
        simplified: true,
        variants: variants
      },
      geneConditions: geneConditions,
      type: 'tab-delimited'
    };
  } catch (error) {
    console.error("Error parsing tab-delimited data:", error);
    throw error;
  }
}

/**
 * Load uncompressed ClinVar VCF file
 */
async function loadClinVarVCFUncompressed() {
  let worker;
  try {
    // Store worker reference globally for potential cleanup later
    worker = await createWorker('js/vcf-worker.js', { timeout: 30000 });
    window.clinvarWorker = worker;
    
    console.log("Successfully loaded ClinVar VCF worker for uncompressed VCF");
    
    // Check worker response for implementation type
    let implementationType = 'unknown';
    try {
      const initMessage = await sendWorkerMessage(worker, { type: 'getImplementation' });
      implementationType = initMessage?.implementation || 'unknown';
      console.log(`Using ${implementationType} implementation for ClinVar data`);
    } catch (error) {
      console.warn("Could not determine implementation type:", error);
    }
    
    // Verify file exists
    const fileUrl = 'clinvar/clinvar.vcf';
    
    try {
      // Check if file actually exists
      const fileResponse = await fetch(fileUrl, { method: 'HEAD' });
      
      if (!fileResponse.ok) {
        throw new Error(`Required file not available: ${fileUrl}`);
      }
      
      const fileSize = fileResponse.headers.get('content-length');
      console.log(`ClinVar uncompressed VCF file: ${fileSize} bytes`);
    } catch (fileError) {
      console.error("Error checking ClinVar file availability:", fileError);
      throw new Error(`ClinVar file not accessible: ${fileError.message}`);
    }
    
    console.log(`Loading ClinVar data from ${fileUrl}`);
    
    // For uncompressed VCF, we'll use a simple implementation since tabix isn't needed
    const result = await sendWorkerMessage(worker, { 
      type: 'loadUncompressedVCF',
      fileUrl: fileUrl
    });
    
    if (!result || result.type === 'error') {
      console.warn("Worker failed to load ClinVar VCF:", result?.error || "Unknown error");
      throw new Error(result?.error || "Failed to load VCF file");
    }
    
    console.log("Uncompressed VCF file loaded successfully. Testing a sample query...");
    
    // Test query to verify data loading
    const testQuery = await sendWorkerMessage(worker, {
      type: 'query',
      params: { chr: '1', pos: 10000 }
    });
    
    console.log("Sample query results:", testQuery);
    
    // Setup local query function that uses worker (similar to compressed version)
    const clinvarQuery = async (variant) => {
      if (!variant) return null;
      
      let chr, pos;
      
      // Handle different input formats
      if (typeof variant === 'object') {
        chr = variant.chrom || variant.chr;
        pos = variant.pos;
      } else if (typeof variant === 'string' && variant.includes(':')) {
        [chr, pos] = variant.split(':');
        pos = parseInt(pos, 10);
      } else {
        // For rsID only, we can't do much with the worker
        return null;
      }
      
      if (!chr || !pos) return null;
      
      // Try multiple positions around the target to improve match chances
      const positionsToTry = [pos];
      
      // Add +/- 1bp positions to improve matching
      if (pos > 1) positionsToTry.push(pos - 1);
      positionsToTry.push(pos + 1);
      
      // Check cache first for all positions
      for (const tryPos of positionsToTry) {
        const cacheKey = `${chr}:${tryPos}`;
        if (dataCache.has(cacheKey)) {
          return dataCache.get(cacheKey);
        }
      }
      
      // Try each position with the worker
      for (const tryPos of positionsToTry) {
        try {
          // Query worker for specific position
          const queryResult = await sendWorkerMessage(worker, {
            type: 'query',
            params: { chr, pos: tryPos }
          });
          
          if (queryResult && queryResult.results && Array.isArray(queryResult.results) && queryResult.results.length > 0) {
            // Process the results and convert to our expected format
            const processedResults = processWorkerResults(queryResult.results);
            
            // Cache the results if valid
            if (processedResults) {
              const cacheKey = `${chr}:${tryPos}`;
              dataCache.set(cacheKey, processedResults);
              return processedResults;
            }
          }
        } catch (error) {
          console.warn(`Error querying position ${chr}:${tryPos}:`, error);
        }
      }
      
      return null;
    };
    
    // Return query function to be used for annotation
    return {
      query: clinvarQuery,
      type: 'worker',
      source: 'vcf-uncompressed',
      // Create a structure consistent with what the application expects
      variants: {},
      geneConditions: {}
    };
    
  } catch (error) {
    console.error('Error loading uncompressed ClinVar VCF with worker:', error);
    if (worker && typeof worker.terminate === 'function') {
      worker.terminate();
    }
    throw error;
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
    
    console.log("Successfully loaded ClinVar VCF worker");
    
    // Check worker response for implementation type
    let implementationType = 'unknown';
    try {
      const initMessage = await sendWorkerMessage(worker, { type: 'getImplementation' });
      implementationType = initMessage?.implementation || 'unknown';
      console.log(`Using ${implementationType} implementation for ClinVar data`);
    } catch (error) {
      console.warn("Could not determine implementation type:", error);
    }
    
    // Verify files exist
    const fileUrl = 'clinvar/clinvar.vcf.gz';
    const indexUrl = 'clinvar/clinvar.vcf.gz.tbi';
    
    try {
      // Check if files actually exist
      const [fileExists, indexExists] = await Promise.all([
        fetch(fileUrl, { method: 'HEAD' }).then(r => ({ ok: r.ok, size: r.headers.get('content-length') })).catch(() => ({ ok: false })),
        fetch(indexUrl, { method: 'HEAD' }).then(r => ({ ok: r.ok, size: r.headers.get('content-length') })).catch(() => ({ ok: false }))
      ]);
      
      if (!fileExists.ok || !indexExists.ok) {
        throw new Error(`Required files not available: ${!fileExists.ok ? fileUrl : ''} ${!indexExists.ok ? indexUrl : ''}`);
      }
      
      console.log(`ClinVar VCF file: ${fileExists.size} bytes`);
      console.log(`ClinVar index file: ${indexExists.size} bytes`);
    } catch (fileError) {
      console.error("Error checking ClinVar file availability:", fileError);
      throw new Error(`ClinVar files not accessible: ${fileError.message}`);
    }
    
    console.log(`Loading ClinVar data from ${fileUrl} with index ${indexUrl}`);
    
    // Initialize the tabix file with larger buffer size
    const result = await sendWorkerMessage(worker, { 
      type: 'loadVCF',
      fileUrl: fileUrl,
      indexUrl: indexUrl,
      chunkSize: 5 * 1024 * 1024 // 5MB chunks for better performance
    });
    
    if (!result || result.type === 'error') {
      console.warn("Worker failed to load ClinVar VCF:", result?.error || "Unknown error");
      throw new Error(result?.error || "Failed to load VCF file");
    }
    
    console.log("VCF file loaded successfully. Testing a sample query...");
    
    // Test query to verify data loading
    const testQuery = await sendWorkerMessage(worker, {
      type: 'query',
      params: { chr: '1', pos: 10000 }
    });
    
    console.log("Sample query results:", testQuery);
    
    // Setup local query function that uses worker
    const clinvarQuery = async (variant) => {
      if (!variant) return null;
      
      let chr, pos;
      
      // Handle different input formats
      if (typeof variant === 'object') {
        chr = variant.chrom || variant.chr;
        pos = variant.pos;
      } else if (typeof variant === 'string' && variant.includes(':')) {
        [chr, pos] = variant.split(':');
        pos = parseInt(pos, 10);
      } else {
        // For rsID only, we can't do much with the worker
        return null;
      }
      
      if (!chr || !pos) return null;
      
      // Try multiple positions around the target to improve match chances
      const positionsToTry = [pos];
      
      // Add +/- 1bp positions to improve matching
      if (pos > 1) positionsToTry.push(pos - 1);
      positionsToTry.push(pos + 1);
      
      // Check cache first for all positions
      for (const tryPos of positionsToTry) {
        const cacheKey = `${chr}:${tryPos}`;
        if (dataCache.has(cacheKey)) {
          return dataCache.get(cacheKey);
        }
      }
      
      // Try each position with the worker
      for (const tryPos of positionsToTry) {
        try {
          // Query worker for specific position
          const queryResult = await sendWorkerMessage(worker, {
            type: 'query',
            params: { chr, pos: tryPos }
          });
          
          if (queryResult && queryResult.results && Array.isArray(queryResult.results) && queryResult.results.length > 0) {
            // Process the results and convert to our expected format
            const processedResults = processWorkerResults(queryResult.results);
            
            // Cache the results if valid
            if (processedResults) {
              const cacheKey = `${chr}:${tryPos}`;
              dataCache.set(cacheKey, processedResults);
              return processedResults;
            }
          }
        } catch (error) {
          console.warn(`Error querying position ${chr}:${tryPos}:`, error);
        }
      }
      
      return null;
    };
    
    // Return query function to be used for annotation
    return {
      query: clinvarQuery,
      type: 'worker',
      source: 'vcf',
      // Create a structure consistent with what the application expects
      variants: {},
      geneConditions: {}
    };
    
  } catch (error) {
    console.error('Error loading ClinVar VCF with worker:', error);
    if (worker && typeof worker.terminate === 'function') {
      worker.terminate();
    }
    throw error;
  }
}

/**
 * Normalize the ClinVar data structure to ensure consistent format
 * @param {Object} data - The raw ClinVar data
 * @returns {Object} - Normalized ClinVar data
 */
function normalizeCliVarData(data) {
  // Create a standardized structure
  const normalized = {
    source: 'unknown',
    type: data.type || 'unknown',
    variants: {},
    geneConditions: {},
    
    // Use a query function that works with our structure
    query: async function(variant) {
      // Handle different types of query inputs
      if (typeof variant === 'string') {
        // If just an rsID is provided
        const rsID = variant;
        
        // First try direct lookup in variants map if available
        if (data.variants && data.variants[rsID]) {
          return data.variants[rsID];
        } else if (normalized.variants[rsID]) {
          return normalized.variants[rsID];
        }
        
        // If we have the original query function
        if (data.query && typeof data.query === 'function') {
          // Try the original query function
          return await data.query(rsID);
        }
      } else if (typeof variant === 'object') {
        // We have a full variant object with chromosome and position
        const { rsID, chrom, pos } = variant;
        
        // Try rsID lookup first if available
        if (rsID) {
          if (data.variants && data.variants[rsID]) {
            return data.variants[rsID];
          } else if (normalized.variants[rsID]) {
            return normalized.variants[rsID];
          }
        }
        
        // If we have position info and the query function, use that
        if (chrom && pos && data.query && typeof data.query === 'function') {
          const result = await data.query(variant);
          
          // If we got a result and it has an rsID, cache it for future lookups
          if (result && result.id && rsID) {
            normalized.variants[rsID] = result;
          }
          
          return result;
        }
      }
      
      return null;
    }
  };
  
  // Determine the source based on available properties
  if (data.type === 'worker') {
    normalized.source = 'indexed';
  } else if (data.clinvarVcf && data.clinvarVcf.simplified) {
    normalized.source = 'simplified';
    normalized.variants = data.clinvarVcf.variants || {};
  } else if (data.variants) {
    normalized.source = 'simplified';
    normalized.variants = data.variants;
  }
  
  // Copy gene conditions if available
  if (data.geneConditions) {
    normalized.geneConditions = data.geneConditions;
  }
  
  // Log the first 5 variants from the normalized data
  console.log("--- Normalized ClinVar Data Sample ---");
  let sampleCount = 0;
  const variantKeys = Object.keys(normalized.variants);
  console.log(`Total variants available: ${variantKeys.length}`);
  
  if (variantKeys.length > 0) {
    console.log("First 5 variants from normalized data:");
    for (let i = 0; i < Math.min(5, variantKeys.length); i++) {
      const key = variantKeys[i];
      console.log(`Variant ${i+1}: ${key}`, normalized.variants[key]);
      sampleCount++;
    }
  } else {
    console.log("No variants available in normalized data structure.");
    
    // If we have no variants but the original data has some, try to copy them directly
    if (data.variants && Object.keys(data.variants).length > 0) {
      normalized.variants = {...data.variants};
      console.log("Recovered variants from original data structure.");
    } else if (data.clinvarVcf && data.clinvarVcf.variants && 
              Object.keys(data.clinvarVcf.variants).length > 0) {
      normalized.variants = {...data.clinvarVcf.variants};
      console.log("Recovered variants from clinvarVcf structure.");
    } else {
      // No variants available, throw an error
      throw new Error("No variants found in ClinVar data. Data may be corrupted or incomplete.");
    }
  }
  
  console.log(`Logged ${sampleCount} sample variants`);
  console.log("--- End of Normalized ClinVar Data Sample ---");
  
  return normalized;
}

/**
 * Create ClinVar directory if it doesn't exist
 */
async function createClinVarDirectory() {
  try {
    // This is a best-effort attempt since browser JS can't create directories
    // In a real implementation, we'd need to use server-side code or the File System Access API
    const response = await fetch('clinvar/.dummy', { method: 'HEAD' });
    if (!response.ok) {
      console.log("ClinVar directory might not exist");
    }
  } catch (error) {
    console.warn("Error checking clinvar directory:", error);
  }
}

/**
 * Process worker query results into a standard format
 * @param {Array} results - Raw results from worker query
 * @returns {Object|null} - Processed variant data or null if no valid results
 */
function processWorkerResults(results) {
  if (!results || results.length === 0) {
    return null;
  }
  
  // Log the raw results for debugging
  console.log("--- Worker Query Results Sample ---");
  console.log(`Received ${results.length} results from worker query`);
  
  if (results.length > 0) {
    console.log("First 5 raw results from worker query:");
    results.slice(0, 5).forEach((result, idx) => {
      console.log(`Result ${idx+1}:`, {
        chr: result.chr,
        pos: result.pos,
        id: result.id,
        ref: result.ref,
        alt: result.alt,
        info: result.info
      });
    });
  }
  
  // For simplicity, just use the first matching result
  const firstResult = results[0];
  
  // Extract clinical significance and condition from info fields if available
  let clinicalSignificance = 'unknown';
  let condition = null;
  let gene = null;
  
  if (firstResult.info) {
    // Parse CLNSIG (clinical significance)
    if (firstResult.info.CLNSIG) {
      clinicalSignificance = parseClinicalSignificance(firstResult.info.CLNSIG);
    }
    
    // Parse CLNDISDB and CLNDN (disease database and name)
    if (firstResult.info.CLNDN) {
      condition = firstResult.info.CLNDN.replace(/_/g, ' ');
    }
    
    // Parse gene info if available
    if (firstResult.info.GENEINFO) {
      const geneInfo = firstResult.info.GENEINFO.split(':');
      if (geneInfo.length > 0) {
        gene = geneInfo[0];
      }
    }
  }
  
  const processedResult = {
    id: firstResult.id,
    ref: firstResult.ref,
    alt: firstResult.alt,
    gene: gene,
    geneSymbol: gene,
    clinicalSignificance: clinicalSignificance,
    condition: condition
  };
  
  console.log("Processed result:", processedResult);
  console.log("--- End of Worker Query Results Sample ---");
  
  return processedResult;
}

/**
 * Parse clinical significance value
 * @param {string} value - Raw clinical significance value
 * @returns {string} - Normalized clinical significance
 */
function parseClinicalSignificance(value) {
  if (!value) return 'unknown';
  
  const val = String(value).toLowerCase();
  
  if (val.includes('pathogenic') && !val.includes('likely')) {
    return 'pathogenic';
  } else if (val.includes('likely_pathogenic') || val.includes('likely pathogenic')) {
    return 'likely pathogenic';
  } else if (val.includes('uncertain') || val.includes('vus')) {
    return 'uncertain significance';
  } else if (val.includes('likely_benign') || val.includes('likely benign')) {
    return 'likely benign';
  } else if (val.includes('benign')) {
    return 'benign';
  } else {
    return 'unknown';
  }
}

/**
 * Attempt to download ClinVar files if they don't exist
 * @returns {Promise<boolean>} - Whether download attempt was initiated
 */
async function ensureClinVarFilesExist() {
  try {
    console.log("Checking for ClinVar data files...");
    
    // Check for files existence
    const requiredFiles = [
      'clinvar/clinvar.vcf.gz',
      'clinvar/clinvar.vcf.gz.tbi'
    ];
    
    let allFilesExist = true;
    const missingFiles = [];
    
    for (const filePath of requiredFiles) {
      try {
        const response = await fetch(filePath, { method: 'HEAD' });
        if (!response.ok) {
          allFilesExist = false;
          missingFiles.push(filePath);
        }
      } catch (error) {
        console.warn(`Error checking ${filePath}:`, error);
        allFilesExist = false;
        missingFiles.push(filePath);
      }
    }
    
    if (!allFilesExist) {
      console.warn(`Missing required ClinVar files: ${missingFiles.join(', ')}`);
      
      // Create clinvar directory if it doesn't exist
      try {
        await createClinVarDirectory();
      } catch (dirError) {
        console.warn("Could not create clinvar directory:", dirError);
      }
      
      // Display download instructions
      document.dispatchEvent(new CustomEvent('clinvar-missing', { 
        detail: { 
          error: `Missing required ClinVar files: ${missingFiles.join(', ')}`,
          missingFiles
        }
      }));
      
      throw new Error('Required ClinVar files not found');
    }
    
    console.log("All required ClinVar files found");
    return true;
  } catch (error) {
    console.error("Error ensuring ClinVar files exist:", error);
    return false;
  }
}

/**
 * Annotates variants with ClinVar data
 * @param {Array} genotypeRecords - The parsed genotype records
 * @param {Object} clinVarData - The loaded ClinVar reference data
 * @param {Function} progressCallback - Callback for reporting progress
 * @returns {Promise<Array>} - Array of annotated variants
 */
export async function annotateVariants(genotypeRecords, clinVarData, progressCallback = null) {
  if (!genotypeRecords || !Array.isArray(genotypeRecords)) {
    throw new Error('Invalid genotype records provided for annotation');
  }
  
  if (!clinVarData || typeof clinVarData !== 'object') {
    throw new Error('Invalid ClinVar data provided for annotation');
  }
  
  try {
    const total = genotypeRecords.length;
    let annotated = [];
    let processed = 0;
    let matched = 0;
    
    console.log(`Starting annotation of ${total} genotype records`);
    
    // Log clinvar data structure
    console.log(`ClinVar data source: ${clinVarData.source || 'unknown'}`);
    
    // Process in batches for better UI responsiveness
    const batchSize = 100;
    
    // Function to process a batch of variants
    const processBatch = async (startIdx) => {
      const endIdx = Math.min(startIdx + batchSize, total);
      const batch = [];
      
      for (let i = startIdx; i < endIdx; i++) {
        const record = genotypeRecords[i];
        
        let annotation = {
          ...record,
          gene: null,
          clinicalSignificance: 'unknown',
          condition: null,
          associatedGenes: null
        };
        
        // Try to find annotation using the full variant record
        if (clinVarData.query && typeof clinVarData.query === 'function') {
          try {
            // More detailed logging to trace the process
            if (i % 1000 === 0) {
              console.log(`Querying ClinVar for ${record.rsID} at ${record.chrom}:${record.pos}`);
            }
            
            const queryResult = await clinVarData.query(record);
            
            if (queryResult) {
              annotation.gene = queryResult.geneSymbol || queryResult.gene;
              annotation.clinicalSignificance = queryResult.clinicalSignificance;
              annotation.condition = queryResult.condition;
              matched++;
              
              if (matched % 100 === 0) {
                console.log(`Found ${matched} matches in ClinVar data so far`);
              }
            }
          } catch (queryError) {
            console.warn(`Error querying ClinVar for ${record.rsID}:`, queryError);
          }
        }
        
        // Look for gene-condition relationships if we have a gene
        if (annotation.gene && clinVarData.geneConditions) {
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

/**
 * Release ClinVar data resources
 */
function releaseClinVarData() {
  // Clear cache to free memory
  dataCache.clear();
  
  // Clean up any stored data
  if (window.clinvarData) {
    try {
      releaseDataset(window.clinvarData);
    } catch (e) {
      console.warn('Error releasing ClinVar dataset:', e);
    }
    window.clinvarData = null;
  }
}

/**
 * Cleanup function to release resources
 */
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
  
  // Clear data cache
  dataCache.clear();
  
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
