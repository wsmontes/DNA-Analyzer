/**
 * DataManager
 * 
 * Core module for managing and processing DNA data
 */
import ProxyManager from './proxyManager.js';
import SNPediaManager from './snpediaManager.js';
import GenePrioritizer from './genePrioritizer.js';
import GeneDiscovery from './geneDiscovery.js';
import Logger from './logger.js';

// DataManager object
const DataManager = {
  snpCache: new Map(),
  allResults: [],
  filteredResults: [],
  currentPage: 1,
  rowsPerPage: 20,
  
  // Initialize DataManager
  init() {
    // Initialize SNPedia Manager
    SNPediaManager.init();
    Logger.info('[DataManager] Initialized');
  },
  
  // Get cached SNP data if available
  getCachedSnp(rsid) {
    const cached = this.snpCache.get(rsid);
    if (cached) {
      Logger.debug(`[DataManager] Cache hit for SNP ${rsid}`);
    }
    return cached;
  },

  // Cache SNP data
  cacheSnp(rsid, data) {
    Logger.debug(`[DataManager] Caching SNP ${rsid}`);
    this.snpCache.set(rsid, data);
  },

  // Fetch SNP details from Ensembl API
  async fetchSnp(rsid) {
    // Check cache first
    const cached = this.getCachedSnp(rsid);
    if (cached) {
      return cached;
    }

    const url = `https://rest.ensembl.org/variation/human/${rsid}?content-type=application/json`;
    try {
      Logger.info(`[DataManager] Fetching SNP ${rsid} from Ensembl`);
      const res = await ProxyManager.fetch(url, {
        headers: { 'Accept': 'application/json' }
      });

      const data = await res.json();
      this.cacheSnp(rsid, data);
      return data;
    } catch (err) {
      Logger.error(`[DataManager] Error fetching SNP ${rsid}:`, err);
      throw err;
    }
  },

  // Extract traits from SNP data
  extractTraits(snpData) {
    if (!snpData || !snpData.phenotypes) return [];
    
    const traits = new Set();
    for (const pheno of snpData.phenotypes) {
      if (pheno.trait) {
        traits.add(pheno.trait.toLowerCase());
      }
    }
    return Array.from(traits);
  },

  // Fetch population frequencies 
  async fetchPopulationFrequencies(rsid) {
    const url = `https://rest.ensembl.org/variation/human/${rsid}?pops=1;content-type=application/json`;
    try {
      Logger.info(`[DataManager] Fetching population frequencies for ${rsid}`);
      const res = await ProxyManager.fetch(url, {
        headers: { 'Accept': 'application/json' }
      });
      const data = await res.json();
      return data.populations || [];
    } catch (err) {
      Logger.error(`[DataManager] Error fetching population frequencies for ${rsid}:`, err);
      throw err;
    }
  },
  
  /**
   * Perform local analysis on DNA data without requiring external API calls
   * @param {Array} dnaData - Array of processed SNPs from the user's file
   * @returns {Object} Results of local analysis
   */
  async performLocalAnalysis(dnaData) {
    Logger.info(`[DataManager] Starting local analysis on ${dnaData.length} SNPs`);
    
    try {
      // Initialize gene discovery module with the user data
      GeneDiscovery.init(dnaData);
      
      // Find clinically significant SNPs from local database
      const localSignificantResults = GeneDiscovery.findLocalSignificantSNPs();
      
      // Create analysis results object
      const results = {
        allResults: dnaData,
        significantSnps: localSignificantResults.matches,
        statistics: {
          total: dnaData.length,
          significant: Object.keys(localSignificantResults.matches).length,
          matchRate: localSignificantResults.stats.matchRate.toFixed(2)
        },
        geneGroups: {}
      };
      
      // Group SNPs by gene for better organization
      for (const [rsid, info] of Object.entries(localSignificantResults.matches)) {
        const gene = info.gene || "Unknown";
        if (!results.geneGroups[gene]) {
          results.geneGroups[gene] = [];
        }
        results.geneGroups[gene].push({ rsid, ...info });
      }
      
      // Save the results
      this.allResults = dnaData;
      this.filteredResults = Object.entries(localSignificantResults.matches).map(([rsid, data]) => {
        return { rsid, ...data };
      });
      
      Logger.info(`[DataManager] Local analysis complete. Found ${results.statistics.significant} significant SNPs`);
      return results;
      
    } catch (error) {
      Logger.error(`[DataManager] Error in local analysis:`, error);
      throw error;
    }
  },
  
  /**
   * Perform extended analysis using external APIs
   * @param {Array} dnaData - Array of processed SNPs
   * @returns {Object} Enhanced results with API data
   */
  async performApiAnalysis(dnaData) {
    Logger.info(`[DataManager] Starting API analysis phase`);
    
    try {
      // Use GeneDiscovery to fetch more detailed information
      const discoveryResults = await GeneDiscovery.discoverRelevantGenes(progress => {
        Logger.info(`[DataManager] Gene discovery: ${progress.stage} - ${progress.progress}%`);
        return progress;
      });
      
      const enhancedResults = {
        matchingSNPs: discoveryResults.matchingSNPs,
        geneGroups: discoveryResults.geneGroups,
        statistics: discoveryResults.stats
      };
      
      // Update filtered results with enhanced data
      this.filteredResults = Object.entries(discoveryResults.matchingSNPs).map(([rsid, data]) => {
        return { rsid, ...data };
      });
      
      Logger.info(`[DataManager] API analysis complete. Found ${enhancedResults.statistics.totalFound} significant SNPs`);
      return enhancedResults;
      
    } catch (error) {
      Logger.error(`[DataManager] Error in API analysis:`, error);
      throw error;
    }
  }
};

export default DataManager;
