/**
 * SNPediaManager
 * 
 * Module for handling interactions with the SNPedia API
 * Following guidelines from https://www.mediawiki.org/wiki/API
 */
import Logger from './logger.js';

const SNPediaManager = {
  baseUrl: 'https://bots.snpedia.com/api.php',
  requestQueue: [],
  isProcessing: false,
  requestDelay: 1000,  
  cache: new Map(),
  
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
  },
  
  /**
   * Get all SNPs matching specific criteria with continuation support
   * @param {Object} options - Query options including criteria and callbacks
   * @returns {Promise} Promise resolving to array of matching SNPs
   */
  getSnpsMatchingCriteria(options = {}) {
    const { 
      genes = [], // Array of gene symbols to match
      categories = [], // Array of categories to match
      limit = 100, // Default limit the number of results
      progressCallback = null // Optional callback for progress updates
    } = options;
    
    return new Promise((resolve, reject) => {
      // Prepare SNPedia API query parameters using generators as recommended
      let params = {
        action: 'query',
        generator: 'categorymembers',
        gcmtitle: 'Category:Is_a_snp',
        gcmlimit: 500, // Maximum per request
        prop: 'revisions|templates',
        rvprop: 'content',
        rvslots: 'main',
        formatversion: '2'
      };
      
      let allResults = [];
      let matchedCount = 0;
      
      // Helper function to process results using continuation
      const processResults = (error, data) => {
        if (error) return reject(error);
        
        // Process this batch of results
        if (data.query && data.query.pages) {
          const results = this.processSnpBatch(data.query.pages, { genes, categories });
          
          // Add matching SNPs to our collection
          if (results.length > 0) {
            allResults = [...allResults, ...results];
            matchedCount = allResults.length;
            
            // Report progress if callback provided
            if (progressCallback) {
              progressCallback({
                loaded: matchedCount,
                matched: matchedCount,
                total: data.continue ? 'continuing...' : matchedCount,
                done: !data.continue || matchedCount >= limit
              });
            }
          }
          
          // Check if we should continue or have reached the limit
          if (data.continue && matchedCount < limit) {
            // Use continuation parameters for next request
            const nextParams = { ...params, ...data.continue };
            this.queueRequest(nextParams, processResults);
          } else {
            // We're done - either no more results or reached limit
            resolve(matchedCount < limit ? allResults : allResults.slice(0, limit));
          }
        } else {
          resolve(allResults); // No results found
        }
      };
      
      // Start the first request
      this.queueRequest(params, processResults);
    });
  },
  
  /**
   * Get all SNPs with high magnitude (clinically significant)
   * @param {Object} options - Options including progressCallback
   * @returns {Promise<Array>} Array of high magnitude SNPs
   */
  async getHighMagnitudeSNPs(options = {}) {
    const { progressCallback = null, minMagnitude = 3 } = options;
    
    Logger.info(`[SNPediaManager] Searching for SNPs with magnitude >= ${minMagnitude}`);
    
    try {
      // Try to use cache first
      const cacheKey = `high_magnitude_${minMagnitude}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached) {
        Logger.info(`[SNPediaManager] Using cached high magnitude SNPs (${cached.length} items)`);
        if (progressCallback) {
          progressCallback({
            stage: 'Retrieved from cache',
            progress: 100,
            found: cached.length
          });
        }
        return cached;
      }
      
      // Set up query to find SNPs with magnitude template
      const results = await this.getSnpsMatchingCriteria({
        categories: [`Magnitude ${minMagnitude}`],
        limit: 500,
        progressCallback: (progress) => {
          if (progressCallback) {
            progressCallback({
              stage: 'Searching SNPedia',
              progress: progress.done ? 100 : (progress.loaded / progress.total) * 100,
              found: progress.matched
            });
          }
        }
      });
      
      Logger.info(`[SNPediaManager] Found ${results.length} high magnitude SNPs`);
      
      // Cache results
      this.cache.set(cacheKey, results);
      
      return results;
    } catch (error) {
      Logger.error('[SNPediaManager] Error getting high magnitude SNPs:', error);
      
      // Return empty array in case of error rather than throwing
      return [];
    }
  },
  
  /**
   * Initialize the SNPediaManager
   */
  init() {
    Logger.info('[SNPediaManager] Initialized');
  },
  
  /**
   * Process a batch of SNPs and filter by criteria
   * @param {Array} pages - Array of page objects from SNPedia API
   * @param {Object} criteria - Criteria to filter by
   * @returns {Array} Filtered and processed SNPs
   */
  processSnpBatch(pages, criteria = {}) {
    const { genes = [], categories = [] } = criteria;
    const results = [];
    
    try {
      for (const page of pages) {
        const title = page.title || '';
        
        // Skip non-SNP pages
        if (!title.match(/^rs\d+$/i)) {
          continue;
        }
        
        // Extract content from revision
        let content = '';
        if (page.revisions && page.revisions.length > 0) {
          const revision = page.revisions[0];
          content = revision.slots?.main?.content || revision.content || '';
        }
        
        // Extract magnitude if present
        let magnitude = null;
        const magnitudeMatch = content.match(/\{\{Magnitude\|(\d+(\.\d+)?)\}\}/i);
        if (magnitudeMatch) {
          magnitude = parseFloat(magnitudeMatch[1]);
        }
        
        // Extract genes mentioned in the content
        const geneMatches = content.match(/\[\[(.*?)\]\]/g) || [];
        const mentionedGenes = geneMatches.map(match => {
          const innerMatch = match.match(/\[\[(.*?)\]\]/);
          return innerMatch ? innerMatch[1] : '';
        }).filter(Boolean);
        
        // Check if this SNP matches our criteria
        let matchesGenes = genes.length === 0;
        let matchesCategories = categories.length === 0;
        
        if (genes.length > 0) {
          matchesGenes = mentionedGenes.some(gene => 
            genes.some(targetGene => gene.toLowerCase().includes(targetGene.toLowerCase()))
          );
        }
        
        if (categories.length > 0 && page.categories) {
          const pageCategories = page.categories.map(cat => cat.title || cat['*'] || '');
          matchesCategories = categories.some(category => 
            pageCategories.some(pageCat => 
              pageCat.toLowerCase().includes(category.toLowerCase())
            )
          );
        }
        
        // If matches criteria, add to results
        if (matchesGenes || matchesCategories) {
          results.push({
            rsid: title,
            magnitude,
            summary: this.extractSummary(content),
            genes: mentionedGenes
          });
        }
      }
      
      return results;
    } catch (error) {
      Logger.error('[SNPediaManager] Error processing SNP batch:', error);
      return [];
    }
  },
  
  /**
   * Queue a request to the SNPedia API
   * @param {Object} params - API parameters
   * @param {Function} callback - Callback function for results
   */
  queueRequest(params, callback) {
    this.requestQueue.push({ params, callback });
    
    if (!this.isProcessing) {
      this.processQueue();
    }
  },
  
  /**
   * Process the request queue with rate limiting
   */
  async processQueue() {
    if (this.requestQueue.length === 0) {
      this.isProcessing = false;
      return;
    }
    
    this.isProcessing = true;
    const { params, callback } = this.requestQueue.shift();
    
    try {
      // Add common parameters
      const fullParams = {
        ...params,
        format: 'json',
        origin: '*'
      };
      
      // Build URL with parameters
      const queryString = Object.entries(fullParams)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');
      
      const url = `${this.baseUrl}?${queryString}`;
      
      // Use proxy-aware fetch
      const response = await ProxyManager.fetch(url);
      const data = await response.json();
      
      // Call callback with results
      callback(null, data);
      
    } catch (error) {
      Logger.error('[SNPediaManager] API request failed:', error);
      callback(error, null);
    }
    
    // Process next request after delay
    setTimeout(() => this.processQueue(), this.requestDelay);
  }
};

export default SNPediaManager;
