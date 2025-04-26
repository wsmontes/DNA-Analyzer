/**
 * GeneDiscovery module
 * Responsible for identifying significant SNPs and gene associations
 */
import Logger from './logger.js';
import significantSNPs from '../data/significantSNPs.js';

const GeneDiscovery = {
  userSnps: [],
  significantSnps: significantSNPs || {},
  discoveredSnps: new Map(),
  
  /**
   * Initialize module with user DNA data
   * @param {Array} snps - User DNA SNPs from uploaded file 
   */
  init(snps) {
    this.userSnps = snps || [];
    this.discoveredSnps = new Map();
    Logger.info(`[GeneDiscovery] Initialized with ${this.userSnps.length} SNPs`);
  },
  
  /**
   * Normalize rsid to standard format
   * @param {string} rsid - SNP identifier 
   */
  normalizeRsid(rsid) {
    if (!rsid) return '';
    rsid = rsid.toString().toLowerCase().trim();
    if (/^\d+$/.test(rsid)) {
      return 'rs' + rsid;
    }
    return rsid;
  },
  
  /**
   * Find significant SNPs in the user's DNA data using local database
   * @returns {Object} Matching SNPs and statistics
   */
  findLocalSignificantSNPs() {
    const matches = {};
    let significantCount = 0;
    let totalChecked = 0;
    
    // Create a Map for faster lookups with normalized rsIDs
    const userSnpsMap = new Map();
    this.userSnps.forEach(snp => {
      const normalizedRsid = this.normalizeRsid(snp.rsid);
      userSnpsMap.set(normalizedRsid, snp);
      
      // Also add the version without rs prefix for flexible matching
      if (normalizedRsid.startsWith('rs')) {
        const numericId = normalizedRsid.substring(2);
        userSnpsMap.set(numericId, snp);
      }
    });
    
    Logger.debug(`Created user SNPs map with ${userSnpsMap.size} entries`);
    Logger.debug(`First few user SNPs: ${JSON.stringify([...userSnpsMap.keys()].slice(0, 5))}`);
    
    // Check against our local database first (very fast)
    for (const [rsid, info] of Object.entries(this.significantSnps)) {
      totalChecked++;
      
      const normalizedRsid = this.normalizeRsid(rsid);
      const numericId = normalizedRsid.startsWith('rs') ? normalizedRsid.substring(2) : normalizedRsid;
      
      // Try both formats for matching
      if (userSnpsMap.has(normalizedRsid) || userSnpsMap.has(numericId)) {
        const userSnp = userSnpsMap.get(normalizedRsid) || userSnpsMap.get(numericId);
        matches[rsid] = {
          ...info,
          genotype: userSnp.Genotype,
          chromosome: userSnp.chromosome,
          position: userSnp.position
        };
        significantCount++;
        Logger.debug(`Match found: ${rsid} (${info.gene}) - ${info.condition}`);
      }
    }
    
    Logger.info(`Local database scan: Found ${significantCount} matches out of ${totalChecked} checked`);
    
    return {
      matches,
      stats: {
        significantCount,
        totalChecked,
        matchRate: totalChecked > 0 ? (significantCount / totalChecked) * 100 : 0
      }
    };
  },
  
  /**
   * Discover relevant genes based on user DNA data
   * @param {Function} progressCallback - Callback for progress updates
   * @returns {Object} Discovered genes and related data
   */
  async discoverRelevantGenes(progressCallback) {
    // Implementation for API-based discovery
    // ...existing code...
  }
};

export default GeneDiscovery;
