/**
 * SNPediaManager
 * 
 * Module for handling interactions with the SNPedia API
 * Following guidelines from https://www.snpedia.com/index.php/Bulk
 * With continuation support from MediaWiki API
 */

const SNPediaManager = {
  baseUrl: 'https://bots.snpedia.com/api.php',
  requestQueue: [],
  isProcessing: false,
  requestDelay: 1000, // Delay between requests to avoid overwhelming the server (1 second)
  cache: new Map(),
  
  /**
   * Initialize the SNPedia manager
   */
  init() {
    console.log('SNPedia Manager initialized');
    // Start the request queue processor
    this.processQueue();
  },

  /**
   * Add a request to the queue with rate limiting
   * @param {Object} params - API parameters
   * @param {Function} callback - Function to call with results
   */
  queueRequest(params, callback) {
    const cacheKey = JSON.stringify(params);
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cachedData = this.cache.get(cacheKey);
      if (cachedData.expires > Date.now()) {
        console.log('Using cached SNPedia data');
        setTimeout(() => callback(null, cachedData.data), 0);
        return;
      } else {
        this.cache.delete(cacheKey);
      }
    }
    
    // Add to queue
    this.requestQueue.push({ params, callback, cacheKey });
    
    // Start processing if not already
    if (!this.isProcessing) {
      this.processQueue();
    }
  },

  /**
   * Process the request queue with rate limiting
   */
  processQueue() {
    if (this.requestQueue.length === 0) {
      this.isProcessing = false;
      return;
    }
    
    this.isProcessing = true;
    const { params, callback, cacheKey } = this.requestQueue.shift();
    
    // Build URL with parameters
    const url = new URL(this.baseUrl);
    url.search = new URLSearchParams({
      ...params,
      format: 'json',
      origin: '*'
    }).toString();
    
    console.log(`Making SNPedia API request: ${url}`);
    
    fetch(url)
      .then(response => {
        if (!response.ok) throw new Error(`SNPedia API error: ${response.status}`);
        return response.json();
      })
      .then(data => {
        // Cache the result (24 hour expiry)
        this.cache.set(cacheKey, {
          data,
          expires: Date.now() + (24 * 60 * 60 * 1000)
        });
        
        callback(null, data);
      })
      .catch(error => {
        console.error('SNPedia API error:', error);
        callback(error, null);
      })
      .finally(() => {
        // Schedule the next request with delay
        setTimeout(() => this.processQueue(), this.requestDelay);
      });
  },

  /**
   * Get SNP information from SNPedia
   * @param {string} rsid - The SNP rsID
   * @returns {Promise} Promise resolving to SNP data
   */
  getSNP(rsid) {
    return new Promise((resolve, reject) => {
      this.queueRequest({
        action: 'parse',
        page: rsid,
        prop: 'text|categories|templates'
      }, (error, data) => {
        if (error) return reject(error);
        resolve(this.parseSnpResult(data, rsid));
      });
    });
  },

  /**
   * Get batch of SNP information from SNPedia using generator
   * @param {Array} rsids - Array of SNP rsIDs
   * @returns {Promise} Promise resolving to an object with SNP data by rsid
   */
  getMultipleSNPs(rsids) {
    if (!rsids || !rsids.length) {
      return Promise.resolve({});
    }
    
    // Split into batches of 50 (MediaWiki API limitation)
    const batchSize = 50;
    const batches = [];
    
    for (let i = 0; i < rsids.length; i += batchSize) {
      batches.push(rsids.slice(i, i + batchSize));
    }
    
    console.log(`Processing ${rsids.length} SNPs in ${batches.length} batches`);
    
    // Process all batches sequentially to avoid overwhelming the API
    return batches.reduce((promiseChain, batch) => {
      return promiseChain.then(allResults => {
        return this.getSNPBatch(batch).then(batchResults => {
          return { ...allResults, ...batchResults };
        });
      });
    }, Promise.resolve({}));
  },
  
  /**
   * Get a batch of SNPs using generator
   * @param {Array} rsids - Batch of rsIDs (max 50)
   * @returns {Promise} Promise resolving to object with SNP data
   */
  getSNPBatch(rsids) {
    return new Promise((resolve, reject) => {
      this.queueRequest({
        action: 'query',
        titles: rsids.join('|'),
        prop: 'revisions|categories|templates',
        rvprop: 'content',
        rvslots: 'main',
        formatversion: '2'
      }, (error, data) => {
        if (error) return reject(error);
        
        // Process batch results
        const results = {};
        if (data.query && data.query.pages) {
          data.query.pages.forEach(page => {
            const rsid = page.title;
            
            // Skip missing pages
            if (page.missing) {
              results[rsid] = { 
                rsid, 
                summary: "No information available in SNPedia",
                references: []
              };
              return;
            }
            
            // Extract categories
            const categories = (page.categories || [])
              .map(cat => cat.title || '')
              .filter(cat => !cat.includes('Is_a_snp') && !cat.includes('SNP'));
            
            // Extract content
            let content = '';
            if (page.revisions && page.revisions.length) {
              const revision = page.revisions[0];
              if (revision.slots && revision.slots.main) {
                content = revision.slots.main.content || '';
              }
            }
            
            // Extract magnitude if present
            let magnitude = null;
            const magnitudeMatch = content.match(/\|\s*magnitude\s*=\s*([+-\.\d]+)/);
            if (magnitudeMatch && magnitudeMatch[1]) {
              magnitude = parseFloat(magnitudeMatch[1]);
            }
            
            results[rsid] = {
              rsid,
              summary: this.extractSummary(content),
              magnitude,
              categories,
              content // Include full content for detailed parsing if needed
            };
          });
        }
        
        resolve(results);
      });
    });
  },

  /**
   * Search for all SNPs in SNPedia category with proper continuation
   * @param {Object} options - Options like limit, progressCallback
   * @returns {Promise} Promise resolving to array of SNP names
   */
  getAllSNPs(options = {}) {
    const { 
      limit = Infinity, // Default to get all SNPs
      progressCallback = null // Optional callback for progress updates
    } = options;
    
    return new Promise((resolve, reject) => {
      let allSNPs = [];
      let params = {
        action: 'query',
        list: 'categorymembers',
        cmtitle: 'Category:Is_a_snp',
        cmlimit: 500, // Maximum allowed in one request
        formatversion: '2'
      };
      
      // Helper function to process results with continuation
      const processResults = (error, data) => {
        if (error) return reject(error);
        
        // Extract SNPs from this batch
        if (data.query && data.query.categorymembers) {
          const snps = data.query.categorymembers.map(item => item.title);
          allSNPs = [...allSNPs, ...snps];
          
          // Report progress if callback provided
          if (progressCallback) {
            progressCallback({
              loaded: allSNPs.length,
              total: allSNPs.length + (data.continue ? '...' : ''),
              done: !data.continue
            });
          }
          
          // Check if we need to continue or have reached the limit
          if (data.continue && allSNPs.length < limit) {
            // Use continuation parameters for next request
            const nextParams = { ...params, ...data.continue };
            this.queueRequest(nextParams, processResults);
          } else {
            // We're done - either no more results or reached limit
            resolve(limit < Infinity ? allSNPs.slice(0, limit) : allSNPs);
          }
        } else {
          reject(new Error('Invalid response from SNPedia API'));
        }
      };
      
      // Start the first request
      this.queueRequest(params, processResults);
    });
  },
  
  /**
   * Extract a clean summary from wiki text content
   * @param {string} content - Wiki text content
   * @returns {string} Clean summary text
   */
  extractSummary(content) {
    if (!content) return "No content available";
    
    // Remove wiki markup for a cleaner text
    let summary = content
      .split('\n').slice(0, 10).join('\n') // Take first 10 lines
      .replace(/\{\{.*?\}\}/g, '') // Remove templates
      .replace(/\[\[(.*?)\]\]/g, '$1') // Extract link text
      .replace(/\'\'\'(.*?)\'\'\'/g, '$1') // Remove bold
      .replace(/\'\'(.*?)\'\'/g, '$1') // Remove italics
      .replace(/\=\=(.*?)\=\=/g, '') // Remove headings
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // Limit length and add ellipsis if too long
    if (summary.length > 300) {
      summary = summary.substring(0, 300) + '...';
    }
    
    return summary || "No readable summary available";
  },
  
  /**
   * Parse SNPedia result and extract relevant information
   * @param {Object} data - Raw data from SNPedia API
   * @param {string} rsid - The SNP rsID
   * @returns {Object} Parsed SNP data
   */
  parseSnpResult(data, rsid) {
    if (!data.parse) {
      return { 
        rsid, 
        summary: "No information available",
        references: []
      };
    }
    
    // Extract templates to find magnitude and other metadata
    const templates = data.parse.templates || [];
    let magnitude = null;
    let repute = null;
    
    for (const template of templates) {
      const title = template.title || '';
      if (title.includes('Magnitude')) {
        magnitude = title.split('|')[1];
      } else if (title.includes('Repute')) {
        repute = title.split('|')[1];
      }
    }
    
    // Extract categories to identify traits and characteristics
    const categories = (data.parse.categories || [])
      .map(cat => cat['*'] || cat.title || '')
      .filter(cat => !cat.includes('Is_a_snp') && !cat.includes('SNP'));
    
    // Extract text content
    let summary = '';
    if (data.parse.text && data.parse.text['*']) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = data.parse.text['*'];
      
      // Remove scripts and other unwanted elements
      const scripts = tempDiv.querySelectorAll('script, style');
      scripts.forEach(el => el.remove());
      
      // Extract main content
      const content = tempDiv.querySelector('#mw-content-text');
      if (content) {
        summary = content.textContent.trim();
        // Limit length and clean up
        summary = summary.substring(0, 1000).replace(/\s+/g, ' ');
        if (summary.length >= 1000) summary += '...';
      }
    }
    
    return {
      rsid,
      summary,
      magnitude,
      repute,
      categories
    };
  }
};

export default SNPediaManager;
