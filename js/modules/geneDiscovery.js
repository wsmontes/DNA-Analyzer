/**
 * GeneDiscovery
 * 
 * Efficiently discovers relevant genes from raw DNA data before making expensive API calls
 */

import SNPediaManager from './snpediaManager.js';

const GeneDiscovery = {
  // Local database of clinically significant SNPs for quick lookup
  // This serves as our "pre-filter" before hitting external APIs
  significantSnps: {
    // Cancer-related SNPs
    "rs1042522": { gene: "TP53", significance: "high", condition: "Cancer risk" },
    "rs1801133": { gene: "MTHFR", significance: "medium", condition: "Cardiovascular" },
    "rs429358": { gene: "APOE", significance: "high", condition: "Alzheimer's" },
    "rs7412": { gene: "APOE", significance: "high", condition: "Alzheimer's" },
    "rs6025": { gene: "F5", significance: "high", condition: "Thrombosis" },
    "rs1800562": { gene: "HFE", significance: "high", condition: "Hemochromatosis" },
    "rs1799945": { gene: "HFE", significance: "medium", condition: "Hemochromatosis" },
    "rs1801282": { gene: "PPARG", significance: "medium", condition: "Diabetes" },
    "rs1544410": { gene: "VDR", significance: "medium", condition: "Osteoporosis" },
    "rs2476601": { gene: "PTPN22", significance: "medium", condition: "Autoimmune" },
    // Add more pre-filtered SNPs as needed
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
  },
  
  /**
   * Quickly pre-filter the user's SNPs against our local database
   * @returns {Object} Pre-filtered significant SNPs found in user data
   */
  findLocalSignificantSNPs() {
    const matches = {};
    let significantCount = 0;
    let totalChecked = 0;
    
    // Create a Map for faster lookups
    const userSnpsMap = new Map(this.userSnps.map(snp => [snp.rsid, snp]));
    
    // Check against our local database first (very fast)
    for (const [rsid, info] of Object.entries(this.significantSnps)) {
      totalChecked++;
      if (userSnpsMap.has(rsid)) {
        const userSnp = userSnpsMap.get(rsid);
        matches[rsid] = {
          ...info,
          genotype: userSnp.Genotype,
          chromosome: userSnp.chromosome,
          position: userSnp.position
        };
        significantCount++;
      }
    }
    
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
        stage: "Local database scan complete", 
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
      
      if (progressCallback) {
        progressCallback({ 
          stage: "Cross-referencing with your DNA", 
          progress: 70 
        });
      }
      
      // Cross-reference with user's SNPs
      const userSnpsMap = new Map(this.userSnps.map(snp => [snp.rsid, snp]));
      const matchingHighMagnitudeSNPs = [];
      
      for (const snp of highMagnitudeSNPs) {
        if (userSnpsMap.has(snp.rsid)) {
          const userSnp = userSnpsMap.get(snp.rsid);
          matchingHighMagnitudeSNPs.push({
            ...snp,
            genotype: userSnp.Genotype,
            chromosome: userSnp.chromosome,
            position: userSnp.position
          });
        }
      }
      
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
      console.error("Error discovering relevant genes:", error);
      
      // Even if the SNPedia part fails, return local results
      return {
        matchingSNPs: localResults.matches,
        geneGroups: {},
        error: error.message,
        stats: {
          totalFound: initialPriority.length,
          locallyIdentified: localResults.stats.significantCount,
          fromSNPedia: 0,
          geneCount: 0
        }
      };
    }
  }
};

export default GeneDiscovery;
