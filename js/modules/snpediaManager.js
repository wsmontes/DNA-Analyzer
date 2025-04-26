/**
 * SNPediaManager
 * 
 * Module for handling interactions with the SNPedia API
 * Following guidelines from https://www.snpedia.com/index.php/Bulk
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
   * Search for multiple SNPs in SNPedia category
   * @param {number} limit - Maximum number of SNPs to fetch
   * @returns {Promise} Promise resolving to array of SNP names
   */
  getAllSNPs(limit = 500) {
    return new Promise((resolve, reject) => {
      this.queueRequest({
        action: 'query',
        list: 'categorymembers',
        cmtitle: 'Category:Is_a_snp',
        cmlimit: limit
      }, (error, data) => {
        if (error) return reject(error);
        
        if (data.query && data.query.categorymembers) {
          const snps = data.query.categorymembers.map(item => item.title);
          resolve(snps);
        } else {
          reject(new Error('Invalid response from SNPedia API'));
        }
      });
    });
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
