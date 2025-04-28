/**
 * Web Worker for VCF file processing
 * Handles loading and parsing VCF files in a separate thread
 * 
 * Dependencies:
 * - tabix-es5.umd.min.js: ES5 compatible version of tabix for indexed VCF files
 * - tabix-compat.min.js: Compatibility layer for tabix
 * - vcf-utils.js: Utility functions for VCF processing
 * 
 * Responsibilities:
 * - Loading and parsing VCF files with tabix indexing
 * - Providing query capabilities for genomic positions
 * - Handling memory cleanup
 */

// Set up error handling for global scope
self.addEventListener('error', function(e) {
  self.postMessage({ 
    status: 'error', 
    message: `Worker error: ${e.message}` 
  });
});

// Set up promise rejection handling
self.addEventListener('unhandledrejection', function(e) {
  self.postMessage({ 
    status: 'error', 
    message: `Unhandled promise rejection: ${e.reason}` 
  });
});

// Simple wrapper for self to avoid conflicts
(function() {
  // Initialize global objects that libraries might expect
  self.window = self;
  
  // Track success/failure state
  let tabixLoadSuccess = false;
  
  try {
    console.log('Initializing VCF worker...');
    
    // Define possible paths to find the tabix libraries, starting with most likely locations
    const possiblePaths = [
      './lib/tabix-es5.umd.min.js', // Try this path first as it's likely working
      './js/lib/tabix-es5.umd.min.js',
      '../lib/tabix-es5.umd.min.js',
      '../js/lib/tabix-es5.umd.min.js'
    ];
    
    const possibleCompatPaths = [
      './lib/tabix-compat.min.js',
      './js/lib/tabix-compat.min.js',
      '../lib/tabix-compat.min.js',
      '../js/lib/tabix-compat.min.js'
    ];
    
    const possibleUtilsPaths = [
      './vcf-utils.js',
      './js/vcf-utils.js',
      '../vcf-utils.js',
      '../js/vcf-utils.js'
    ];
    
    // Try to load tabix libraries from the most likely path first
    loadDependencies(0);
    
    // Function to load tabix libraries and VCF utilities with fallback paths
    function loadDependencies(pathIndex) {
      if (pathIndex >= possiblePaths.length) {
        // All paths failed, fall back to simple implementation
        console.error('Failed to load dependencies from all possible paths');
        fallbackToSimpleImplementation();
        return;
      }
      
      try {
        // First load the VCF utilities
        tryLoadScript(possibleUtilsPaths[pathIndex], () => {
          // Then try to load tabix libraries
          Promise.all([
            fetch(possiblePaths[pathIndex]).then(response => {
              if (!response.ok) throw new Error(`Failed to fetch tabix ES5 library from ${possiblePaths[pathIndex]}: ${response.status}`);
              return response.text();
            }),
            fetch(possibleCompatPaths[pathIndex]).then(response => {
              if (!response.ok) throw new Error(`Failed to fetch tabix-compat library from ${possibleCompatPaths[pathIndex]}: ${response.status}`);
              return response.text();
            })
          ])
          .then(scripts => {
            try {
              // Evaluate the scripts in order
              self.eval(scripts[0]); // tabix-es5.umd.min.js
              self.eval(scripts[1]); // tabix-compat.min.js
              console.log(`Successfully loaded ES5-compatible tabix libraries from ${possiblePaths[pathIndex]}`);
              
              tabixLoadSuccess = true;
              // Signal that the worker is ready
              self.postMessage({ type: 'ready' });
            } catch (evalError) {
              console.error(`Error evaluating tabix scripts from ${possiblePaths[pathIndex]}:`, evalError);
              // Try next path
              loadDependencies(pathIndex + 1);
            }
          })
          .catch(error => {
            console.warn(`Failed to fetch tabix libraries from ${possiblePaths[pathIndex]}:`, error);
            // Try next path
            loadDependencies(pathIndex + 1);
          });
        }, (error) => {
          console.warn(`Failed to load VCF utilities from ${possibleUtilsPaths[pathIndex]}:`, error);
          // Try next path
          loadDependencies(pathIndex + 1);
        });
      } catch (error) {
        console.error('Error loading dependencies:', error);
        loadDependencies(pathIndex + 1);
      }
    }
    
    // Helper function to try loading a script
    function tryLoadScript(path, onSuccess, onError) {
      try {
        importScripts(path);
        console.log(`Successfully loaded ${path}`);
        onSuccess();
      } catch (error) {
        onError(error);
      }
    }
    
  } catch (error) {
    console.error('Error in worker initialization:', error);
    fallbackToSimpleImplementation();
  }
  
  // Store tabix reference and VCF data
  let tabixFile = null;
  
  /**
   * Fall back to a simple implementation without tabix
   */
  function fallbackToSimpleImplementation() {
    console.log('Falling back to simple VCF implementation without tabix');
    
    // Setup a simple in-memory implementation
    self.simpleVcfImplementation = {
      loaded: false,
      data: {},
      
      // Simple methods to mimic tabix functionality
      loadVcf: function(url) {
        return fetch(url)
          .then(response => response.text())
          .then(text => {
            // Parse VCF text
            const lines = text.split('\n');
            const variants = {};
            
            lines.forEach(line => {
              if (line.startsWith('#')) return; // Skip headers
              
              const fields = line.split('\t');
              if (fields.length < 8) return; // Skip malformed lines
              
              const chr = fields[0];
              const pos = parseInt(fields[1], 10);
              const id = fields[2];
              const ref = fields[3];
              const alt = fields[4];
              const info = fields[7];
              
              // Extract info fields
              const infoFields = {};
              info.split(';').forEach(field => {
                const [key, value] = field.split('=');
                infoFields[key] = value;
              });
              
              // Store by position for quick lookup
              if (!this.data[chr]) this.data[chr] = {};
              if (!this.data[chr][pos]) this.data[chr][pos] = [];
              
              this.data[chr][pos].push({
                id,
                ref,
                alt,
                info: infoFields
              });
            });
            
            this.loaded = true;
            return true;
          });
      },
      
      query: function(chr, pos) {
        if (!this.loaded) return [];
        if (!this.data[chr] || !this.data[chr][pos]) return [];
        return this.data[chr][pos];
      }
    };
    
    // Signal that we're ready with the fallback implementation
    tabixLoadSuccess = true;
    self.postMessage({ 
      type: 'ready', 
      implementation: 'simple'
    });
  }
  
  /**
   * Handle the loadUncompressedVCF message
   * @param {Object} data - Message data
   * @param {string} messageId - Message ID for response
   */
  async function handleLoadUncompressedVCF(data, messageId) {
    try {
      console.log(`Loading uncompressed VCF file: ${data.fileUrl}`);
      
      // Check if file is accessible
      const fileResponse = await fetch(data.fileUrl, { method: 'HEAD' });
      
      if (!fileResponse.ok) {
        throw new Error(`VCF file not accessible: ${fileResponse.status} - ${fileResponse.statusText}`);
      }
      
      console.log(`Uncompressed VCF file size: ${fileResponse.headers.get('content-length') || 'unknown'} bytes`);
      
      // Load the entire file into memory
      const response = await fetch(data.fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch VCF file: ${response.status}`);
      }
      
      const vcfText = await response.text();
      console.log(`Loaded ${vcfText.length} characters of VCF data`);
      
      // Parse the VCF and build an index in memory
      const lines = vcfText.split('\n');
      const variants = {};
      let headerLines = [];
      let variantCount = 0;
      
      // Process the file line by line
      lines.forEach(line => {
        if (line.startsWith('#')) {
          // Store header lines for reference
          headerLines.push(line);
          return;
        }
        
        if (!line.trim()) return; // Skip empty lines
        
        const fields = line.split('\t');
        if (fields.length < 8) return; // Skip incomplete lines
        
        const chr = fields[0];
        const pos = parseInt(fields[1], 10);
        
        // Store by chromosome and position for efficient lookup
        if (!variants[chr]) {
          variants[chr] = {};
        }
        
        if (!variants[chr][pos]) {
          variants[chr][pos] = [];
        }
        
        variants[chr][pos].push(line);
        variantCount++;
      });
      
      // Store the parsed data globally for queries
      self.simpleVcfImplementation = {
        loaded: true,
        variants: variants,
        headers: headerLines,
        variantCount: variantCount,
        
        // Query function for uncompressed VCF
        query: function(chr, startPos, endPos) {
          if (!this.loaded || !this.variants[chr]) return [];
          
          const results = [];
          
          // Check all positions in the range
          for (let pos = startPos; pos <= endPos; pos++) {
            if (this.variants[chr][pos]) {
              results.push(...this.variants[chr][pos]);
            }
          }
          
          return results;
        }
      };
      
      console.log(`Successfully loaded and indexed ${variantCount} variants from uncompressed VCF`);
      
      self.postMessage({
        type: 'result',
        messageId: messageId,
        status: 'loaded',
        variantCount: variantCount,
        message: 'Uncompressed VCF file loaded successfully'
      });
      
    } catch (error) {
      console.error("Failed to load uncompressed VCF file:", error);
      self.postMessage({
        type: 'error',
        messageId: messageId,
        error: error.message || 'Failed to load uncompressed VCF file'
      });
    }
  }
  
  // Handle incoming messages
  self.onmessage = function(e) {
    try {
      const data = e.data;
      
      // Return the message ID with any response to match up with the promise
      const messageId = data.messageId;
      
      // Process the message based on its type
      if (data.type === 'loadVCF') {
        // Handle compressed VCF loading (existing code)
        handleLoadVCF(data, messageId);
      } else if (data.type === 'loadUncompressedVCF') {
        // Handle uncompressed VCF loading (new code)
        handleLoadUncompressedVCF(data, messageId);
      } else if (data.type === 'query') {
        // Use the appropriate query mechanism
        handleQuery(data, messageId);
      } else if (data.type === 'cleanup') {
        // Clean up resources before termination
        cleanupWorkerMemory();
        self.postMessage({
          type: 'cleanup',
          messageId: messageId,
          status: 'completed'
        });
      } else if (data.type === 'getImplementation') {
        // Implementation type check
        self.postMessage({
          type: 'result',
          messageId: messageId,
          implementation: self.simpleVcfImplementation ? 'simple' : 'tabix'
        });
      } else {
        self.postMessage({
          type: 'error',
          messageId: messageId,
          error: `Unknown message type: ${data.type}`
        });
      }
    } catch (error) {
      console.error('Error handling message in worker:', error);
      self.postMessage({
        type: 'error',
        messageId: data?.messageId,
        error: `Worker error: ${error.message}`
      });
    }
  };

  // Update the query handler to work with both compressed and uncompressed files
  function handleQuery(data, messageId) {
    if (self.simpleVcfImplementation && self.simpleVcfImplementation.loaded) {
      // Use simple implementation for uncompressed VCF
      try {
        const { chr, pos } = data.params;
        
        if (!chr || pos === undefined) {
          throw new Error('Missing required parameters: chr and pos');
        }
        
        // Format chromosome string for consistent lookup
        let formattedChr = String(chr);
        let altFormattedChr = formattedChr.startsWith('chr') ? 
                              formattedChr.substring(3) : `chr${formattedChr}`;
        
        // Search a window around the position
        const searchWindow = 25;
        const startPos = Math.max(1, pos - searchWindow);
        const endPos = pos + searchWindow;
        
        console.log(`Querying uncompressed VCF: ${formattedChr}:${startPos}-${endPos}`);
        
        // Try both chromosome formats
        const mainResults = self.simpleVcfImplementation.query(formattedChr, startPos, endPos);
        const altResults = self.simpleVcfImplementation.query(altFormattedChr, startPos, endPos);
        
        // Combine results
        const lines = [...mainResults, ...altResults];
        
        if (lines.length === 0) {
          console.log(`No results found in uncompressed VCF for ${formattedChr} or ${altFormattedChr} at positions ${startPos}-${endPos}`);
        } else {
          console.log(`Found ${lines.length} lines in uncompressed VCF`);
        }
        
        // Get sample IDs from header if available
        const headerSamples = [];
        if (self.simpleVcfImplementation.headers) {
          const headerLine = self.simpleVcfImplementation.headers.find(l => l.startsWith('#CHROM'));
          if (headerLine) {
            const parts = headerLine.split('\t');
            if (parts.length > 9) {
              headerSamples.push(...parts.slice(9));
            }
          }
        }
        
        // Parse the results properly using VcfUtils
        const parsedResults = lines.map(line => {
          if (!line) return null;
          
          // Use our new VcfUtils to parse properly
          if (self.VcfUtils) {
            return self.VcfUtils.parseVcfLine(line, headerSamples);
          } else {
            // Fallback to basic parsing if VcfUtils isn't available
            const fields = line.split('\t');
            if (fields.length < 8) return null;
            
            const lineChr = fields[0];
            const linePos = parseInt(fields[1], 10);
            const id = fields[2];
            const ref = fields[3];
            const alt = fields[4];
            const qual = fields[5];
            const filter = fields[6];
            const info = fields[7];
            
            // Extract info fields
            const infoFields = {};
            info.split(';').forEach(field => {
              if (field.includes('=')) {
                const [key, value] = field.split('=', 2);
                infoFields[key] = value;
              } else {
                // Flag fields without values
                infoFields[field] = true;
              }
            });
            
            return {
              chr: lineChr,
              pos: linePos,
              id: id === '.' ? null : id,
              ref,
              alt: alt === '.' ? null : alt,
              qual: qual === '.' ? null : parseFloat(qual),
              filter: filter === '.' ? null : filter.split(';'),
              info: infoFields,
              raw: line
            };
          }
        }).filter(result => result !== null);
        
        self.postMessage({
          type: 'result',
          messageId: messageId,
          results: parsedResults
        });
      } catch (error) {
        console.error("Error querying uncompressed VCF:", error);
        self.postMessage({
          type: 'error',
          messageId: messageId,
          error: `Failed to query uncompressed VCF: ${error.message}`
        });
      }
    } else if (tabixFile) {
      // Use tabix for compressed files - existing code
      const chr = data.params.chr;
      const pos = data.params.pos;
      
      // Convert chr to string if needed (some formats expect "chr1" instead of just "1")
      const chrStr = chr.toString();
      // Support both formats - with or without 'chr' prefix
      const formattedChr = chrStr.startsWith('chr') ? chrStr : chrStr;
      const altFormattedChr = chrStr.startsWith('chr') ? chrStr.substring(3) : `chr${chrStr}`;
      
      // Query a wider range around the position to improve match chances
      // ClinVar and genotype data often have slight position differences
      const startPos = Math.max(1, pos - 10); // Search 10bp upstream
      const endPos = pos + 10; // Search 10bp downstream
      
      console.log(`Querying tabix: ${formattedChr}:${startPos}-${endPos}`);
      
      // Try with both chromosome formats - crucial for finding matches
      const getLines = async (chromosome) => {
        try {
          return await tabixFile.getLines(chromosome, startPos, endPos);
        } catch (error) {
          console.warn(`Error querying tabix for ${chromosome}:${startPos}-${endPos}:`, error);
          return [];
        }
      };
      
      // Try both chromosome formats and combine results
      Promise.all([
        getLines(formattedChr),
        getLines(altFormattedChr)
      ])
      .then(resultsArray => {
        const lines = [...(resultsArray[0] || []), ...(resultsArray[1] || [])];
        
        if (lines.length === 0) {
          console.log(`No results found for either ${formattedChr} or ${altFormattedChr} at positions ${startPos}-${endPos}`);
        } else {
          console.log(`Found ${lines.length} lines from tabix query`);
        }
        
        // Parse the VCF lines into result objects
        const parsedResults = lines.map(line => {
          // Use VcfUtils if available
          if (self.VcfUtils) {
            return self.VcfUtils.parseVcfLine(line);
          } else {
            // Fallback to basic parsing
            // Skip comment lines
            if (line.startsWith('#')) return null;
            
            const fields = line.split('\t');
            if (fields.length < 8) return null;
            
            const lineChr = fields[0];
            const linePos = parseInt(fields[1], 10);
            const id = fields[2];
            const ref = fields[3];
            const alt = fields[4];
            const qual = fields[5];
            const filter = fields[6];
            const info = fields[7];
            
            // Basic info field parsing
            const infoFields = {};
            info.split(';').forEach(field => {
              if (field.includes('=')) {
                const [key, value] = field.split('=', 2);
                infoFields[key] = value;
              } else {
                // Flag fields
                infoFields[field] = true;
              }
            });
            
            return {
              chr: lineChr,
              pos: linePos,
              id: id === '.' ? null : id,
              ref,
              alt: alt === '.' ? null : alt,
              qual: qual === '.' ? null : parseFloat(qual),
              filter: filter === '.' ? null : filter.split(';'),
              info: infoFields,
              raw: line
            };
          }
        }).filter(result => result !== null);
        
        self.postMessage({
          type: 'result',
          messageId: messageId,
          results: parsedResults
        });
      })
      .catch(error => {
        console.error(`Error querying tabix for ${formattedChr}:${pos}:`, error);
        self.postMessage({
          type: 'error',
          messageId: messageId,
          error: `Error querying tabix: ${error.message}`
        });
      });
    } else {
      self.postMessage({
        type: 'error',
        messageId: messageId,
        error: 'No VCF data loaded. Call loadVCF or loadUncompressedVCF first.'
      });
    }
  }
  
  // Worker memory cleanup function
  function cleanupWorkerMemory() {
    // Clear any references to large objects
    if (self.vcfData) {
      self.vcfData = null;
    }
    
    if (self.indexData) {
      self.indexData = null;
    }
    
    if (tabixFile) {
      tabixFile = null;
    }
    
    if (self.simpleVcfImplementation && self.simpleVcfImplementation.data) {
      self.simpleVcfImplementation.data = null;
    }
    
    // Clear any caches or large temp arrays
    if (self.variantCache) {
      self.variantCache.clear();
    }
    
    // Also clean up uncompressed VCF data if present
    if (self.simpleVcfImplementation) {
      self.simpleVcfImplementation.variants = null;
      self.simpleVcfImplementation.headers = null;
      self.simpleVcfImplementation = null;
    }
    
    console.log('Worker memory cleanup completed');
  }
})();
