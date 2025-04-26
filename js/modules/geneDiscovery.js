/**
 * GeneDiscovery
 * 
 * Efficiently discovers relevant genes from raw DNA data before making expensive API calls
 */

import SNPediaManager from './snpediaManager.js';
import Logger from './logger.js';
import KnownGenes from '../data/knownGenes.js';

const GeneDiscovery = {
  // Local database of clinically significant SNPs now imported from KnownGenes
  get significantSnps() {
    return KnownGenes.snpGeneAssociations;
  },
  
  // Discovered SNPs will be cached here
  discoveredSnps: new Map(),
  
  /**
   * Initialize the module with user data
   * @param {Array} userSnps - Array of user's SNPs
   */
  init(userSnps) {
    this.userSnps = userSnps;
    this.discoveredSnps.clear();
    Logger.info(`GeneDiscovery initialized with ${userSnps.length} SNPs`);
  },
  
  /**
   * Normalize rsID to ensure consistent format for matching
   * @param {string} rsid - The rsID to normalize
   * @returns {string} Normalized rsID
   */
  normalizeRsid(rsid) {
    if (!rsid) return '';
    
    // Convert to lowercase
    let normalized = String(rsid).toLowerCase().trim();
    
    // Ensure rs prefix if it's just a number
    if (/^\d+$/.test(normalized)) {
      normalized = 'rs' + normalized;
    }
    
    return normalized;
  },
  
  /**
   * Quickly pre-filter the user's SNPs against our local database
   * @returns {Object} Pre-filtered significant SNPs found in user data
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
   * Discover genes from an initial bulk query to SNPedia
   * @param {Function} progressCallback - Callback for reporting progress
   * @returns {Promise<Object>} Discovered genes and SNPs
   */
  async discoverRelevantGenes(progressCallback) {
    if (progressCallback) {
      progressCallback({ stage: "Local database scan", progress: 0 });
    }
    
    // First check our local database (instantaneous)
    const localResults = this.findLocalSignificantSNPs();
    
    if (progressCallback) {
      progressCallback({ 
        stage: `Local database scan complete - Found ${localResults.stats.significantCount} SNPs`, 
        progress: 20,
        findings: localResults.stats.significantCount
      });
    }
    
    // If we have an initial set of matches, prioritize those
    const initialPriority = Object.keys(localResults.matches);
    
    // Prepare for bulk queries to SNPedia
    if (progressCallback) {
      progressCallback({ 
        stage: "Preparing SNPedia bulk queries", 
        progress: 40
      });
    }
    
    try {
      Logger.info("About to fetch high magnitude SNPs from SNPedia");
      
      // First get a list of all SNPs in SNPedia with magnitude > 3
      // This is much more efficient than querying each SNP individually
      const highMagnitudeSNPs = await SNPediaManager.getHighMagnitudeSNPs({
        progressCallback: (progress) => {
          if (progressCallback) {
            progressCallback({
              stage: "Fetching high-magnitude SNPs",
              progress: 40 + (progress.progress || 0) * 0.3,
              findings: progress.found || 0
            });
          }
        }
      });
      
      Logger.info(`Retrieved ${highMagnitudeSNPs.length} high magnitude SNPs from SNPedia`);
      
      if (highMagnitudeSNPs.length === 0) {
        Logger.warn("No high magnitude SNPs returned from SNPedia - API might be failing");
      } else {
        Logger.debug(`Sample high magnitude SNPs: ${JSON.stringify(highMagnitudeSNPs.slice(0, 3))}`);
      }
      
      if (progressCallback) {
        progressCallback({ 
          stage: `Cross-referencing ${highMagnitudeSNPs.length} SNPs with your DNA`, 
          progress: 70 
        });
      }
      
      // Cross-reference with user's SNPs with normalized IDs
      const userSnpsMap = new Map();
      this.userSnps.forEach(snp => {
        const normalizedRsid = this.normalizeRsid(snp.rsid);
        userSnpsMap.set(normalizedRsid, snp);
        
        // Also add without rs prefix for flexible matching
        if (normalizedRsid.startsWith('rs')) {
          userSnpsMap.set(normalizedRsid.substring(2), snp);
        }
      });
      
      const matchingHighMagnitudeSNPs = [];
      
      for (const snp of highMagnitudeSNPs) {
        const normalizedRsid = this.normalizeRsid(snp.rsid);
        const numericId = normalizedRsid.startsWith('rs') ? normalizedRsid.substring(2) : normalizedRsid;
        
        if (userSnpsMap.has(normalizedRsid) || userSnpsMap.has(numericId)) {
          const userSnp = userSnpsMap.get(normalizedRsid) || userSnpsMap.get(numericId);
          matchingHighMagnitudeSNPs.push({
            ...snp,
            genotype: userSnp.Genotype,
            chromosome: userSnp.chromosome,
            position: userSnp.position
          });
          
          if (matchingHighMagnitudeSNPs.length <= 5) {
            Logger.debug(`SNPedia match: ${snp.rsid} with magnitude ${snp.magnitude || 'unknown'}`);
          }
        }
      }
      
      Logger.info(`Found ${matchingHighMagnitudeSNPs.length} SNPedia matches in user's DNA`);
      
      if (progressCallback) {
        progressCallback({ 
          stage: "Organizing findings", 
          progress: 90,
          findings: matchingHighMagnitudeSNPs.length + localResults.stats.significantCount 
        });
      }
      
      // Combine results from local database and SNPedia query
      const allMatches = [...initialPriority];
      for (const snp of matchingHighMagnitudeSNPs) {
        if (!allMatches.includes(snp.rsid)) {
          allMatches.push(snp.rsid);
          localResults.matches[snp.rsid] = snp;
        }
      }
      
      // Group by gene for better organization
      const geneGroups = {};
      for (const [rsid, info] of Object.entries(localResults.matches)) {
        const gene = info.gene || "Unknown";
        if (!geneGroups[gene]) {
          geneGroups[gene] = [];
        }
        geneGroups[gene].push({ rsid, ...info });
      }
      
      if (progressCallback) {
        progressCallback({ 
          stage: "Discovery complete", 
          progress: 100,
          findings: allMatches.length
        });
      }
      
      return {
        matchingSNPs: localResults.matches,
        geneGroups,
        stats: {
          totalFound: allMatches.length,
          locallyIdentified: localResults.stats.significantCount,
          fromSNPedia: matchingHighMagnitudeSNPs.length,
          geneCount: Object.keys(geneGroups).length
        }
      };
      
    } catch (error) {
      Logger.error("Error discovering relevant genes:", error);
      
      // Fallback to direct Ensembl query if SNPedia fails
      const fallbackResults = await this.attemptFallbackDiscovery(progressCallback, localResults);
      
      return {
        matchingSNPs: {...localResults.matches, ...fallbackResults.matches},
        geneGroups: fallbackResults.geneGroups || {},
        error: `SNPedia API error: ${error.message}. Used fallback discovery method.`,
        stats: {
          totalFound: Object.keys(localResults.matches).length + Object.keys(fallbackResults.matches || {}).length,
          locallyIdentified: localResults.stats.significantCount,
          fromSNPedia: 0,
          fromFallback: Object.keys(fallbackResults.matches || {}).length,
          geneCount: Object.keys(fallbackResults.geneGroups || {}).length
        }
      };
    }
  },
  
  /**
   * Fallback discovery method when SNPedia fails
   * Uses high-priority SNPs and direct Ensembl queries
   */
  async attemptFallbackDiscovery(progressCallback, localResults) {
    Logger.info("Attempting fallback gene discovery method");
    
    if (progressCallback) {
      progressCallback({
        stage: "API failure detected - Using fallback method",
        progress: 60
      });
    }
    
    const fallbackSnps = {
      // Known important SNPs when SNPedia fails
      "rs429358": { gene: "APOE", significance: "high", condition: "Alzheimer's risk" },
      "rs7412": { gene: "APOE", significance: "high", condition: "Alzheimer's risk" },
      "rs1800562": { gene: "HFE", significance: "high", condition: "Hemochromatosis" },
      "rs1801133": { gene: "MTHFR", significance: "medium", condition: "Cardiovascular" },
      "rs1800795": { gene: "IL6", significance: "medium", condition: "Inflammation" },
      "rs53576": { gene: "OXTR", significance: "medium", condition: "Empathy traits" },
      "rs6152": { gene: "AR", significance: "medium", condition: "Androgenic traits" },
      "rs1815739": { gene: "ACTN3", significance: "medium", condition: "Muscle performance" },
      "rs4680": { gene: "COMT", significance: "medium", condition: "Cognitive function" },
      "rs1800497": { gene: "ANKK1", significance: "medium", condition: "Reward mechanism" }
    };
    
    // Create a Map of user's SNPs with normalization
    const userSnpsMap = new Map();
    this.userSnps.forEach(snp => {
      const normalizedRsid = this.normalizeRsid(snp.rsid);
      userSnpsMap.set(normalizedRsid, snp);
      if (normalizedRsid.startsWith('rs')) {
        userSnpsMap.set(normalizedRsid.substring(2), snp);
      }
    });
    
    // Find matches against our fallback list
    const matches = {};
    for (const [rsid, info] of Object.entries(fallbackSnps)) {
      const normalizedRsid = this.normalizeRsid(rsid);
      const numericId = normalizedRsid.startsWith('rs') ? normalizedRsid.substring(2) : normalizedRsid;
      
      if (userSnpsMap.has(normalizedRsid) || userSnpsMap.has(numericId)) {
        const userSnp = userSnpsMap.get(normalizedRsid) || userSnpsMap.get(numericId);
        matches[rsid] = {
          ...info,
          genotype: userSnp.Genotype,
          chromosome: userSnp.chromosome,
          position: userSnp.position
        };
      }
    }
    
    Logger.info(`Fallback discovery found ${Object.keys(matches).length} matches`);
    
    // If we still have no matches, sample some SNPs from the user's data
    if (Object.keys(matches).length === 0) {
      // Sample a few SNPs from user data to at least show something
      const sampledSnps = this.userSnps
        .slice(0, Math.min(20, this.userSnps.length))
        .filter(snp => snp.rsid && snp.rsid.toLowerCase().startsWith('rs'));
      
      for (const snp of sampledSnps) {
        matches[snp.rsid] = {
          gene: "Unknown",
          significance: "unknown",
          condition: "Data sample only",
          genotype: snp.Genotype,
          chromosome: snp.chromosome,
          position: snp.position
        };
      }
      
      Logger.info(`Added ${sampledSnps.length} sampled SNPs as fallback`);
    }
    
    // Group by gene
    const geneGroups = {};
    for (const [rsid, info] of Object.entries(matches)) {
      const gene = info.gene || "Unknown";
      if (!geneGroups[gene]) {
        geneGroups[gene] = [];
      }
      geneGroups[gene].push({ rsid, ...info });
    }
    
    if (progressCallback) {
      progressCallback({
        stage: "Fallback discovery complete",
        progress: 100,
        findings: Object.keys(matches).length 
      });
    }
    
    return { 
      matches, 
      geneGroups,
      fallback: true 
    };
  }
};

export default GeneDiscovery;
