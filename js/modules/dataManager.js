/**
 * DataManager
 * 
 * Updated to prioritize genes and implement bulk querying with API logging
 */
import ProxyManager from './proxyManager.js';
import SNPediaManager from './snpediaManager.js';
import GenePrioritizer from './genePrioritizer.js';
import GeneDiscovery from './geneDiscovery.js';
import Logger from './logger.js';

// Update the DataManager object
const DataManager = {
  snpCache: new Map(),
  allResults: [],
  filteredResults: [],
  currentPage: 1,
  rowsPerPage: 20,
  
  // Inicializar
  init() {
    // Initialize SNPedia Manager
    SNPediaManager.init();
    Logger.info('[DataManager] Initialized');
  },
  
  // Obter dados de SNP em cache, se disponível
  getCachedSnp(rsid) {
    const cached = this.snpCache.get(rsid);
    if (cached) {
      Logger.debug(`[DataManager] Cache hit for SNP ${rsid}`);
    }
    return cached;
  },

  // Definir SNP em cache
  cacheSnp(rsid, data) {
    Logger.debug(`[DataManager] Caching SNP ${rsid}`);
    this.snpCache.set(rsid, data);
  },

  // Buscar detalhes de SNP apenas quando necessário
  async fetchSnp(rsid) {
    // Verificar primeiro o cache
    const cached = this.getCachedSnp(rsid);
    if (cached) {
      return cached;
    }

    const url = `https://rest.ensembl.org/variation/human/${rsid}?content-type=application/json`;
    try {
      Logger.info(`[DataManager] Fetching SNP ${rsid} from Ensembl`);
      // Usar o ProxyManager.fetch atualizado
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

  // Buscar frequências populacionais para um SNP
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

  // Extrair palavras-chave de traços/saúde
  extractTraits(info) {
    const keywords = ['height','eye color','hair','lactose','alcohol','caffeine','diabetes','cancer','asthma','skin','obesity','blood','cholesterol','alzheimer','parkinson','celiac','crohn','sickle','thalassemia','hemochromatosis','ancestry','ethnicity','risk','disease','trait','response','drug','immunity','autoimmune'];
    let found = [];
    if (info?.phenotypes) {
      for (const ph of info.phenotypes) {
        for (const k of keywords) {
          if (ph.description && ph.description.toLowerCase().includes(k)) found.push(k);
        }
      }
    }
    return [...new Set(found)];
  },

  // Filtrar resultados com base na pesquisa e no filtro de cromossomo
  filterResults(searchQuery, chromosomeFilter) {
    const q = searchQuery.toLowerCase();
    const cf = chromosomeFilter;
    
    this.filteredResults = this.allResults.filter(r => {
      const rsidMatch = !q || r.rsid.toLowerCase().includes(q);
      const chromMatch = !cf || r.chromosome === cf;
      return rsidMatch && chromMatch;
    });
    
    Logger.debug(`[DataManager] Filtered results: ${this.filteredResults.length} / ${this.allResults.length} SNPs`);
    this.currentPage = 1;
    return this.filteredResults;
  },

  // Buscar informações do SNPedia via API do SNPedia (não Wikipedia)
  async fetchSnpediaSummary(rsid) {
    try {
      Logger.info(`[DataManager] Fetching SNPedia summary for ${rsid}`);
      // Use SNPediaManager instead of Wikipedia API
      const snpData = await SNPediaManager.getSNP(rsid);
      
      if (snpData && snpData.summary) {
        let result = snpData.summary;
        
        // Add magnitude information if available
        if (snpData.magnitude) {
          result = `[Magnitude: ${snpData.magnitude}] ${result}`;
        }
        
        // Add categories as keywords
        if (snpData.categories && snpData.categories.length > 0) {
          result += `\n\nCategories: ${snpData.categories.join(', ')}`;
        }
        
        return result;
      } else {
        return 'Nenhum artigo do SNPedia encontrado ou resumo disponível.';
      }
    } catch (err) {
      Logger.error(`[DataManager] Error fetching SNPedia summary for ${rsid}:`, err);
      return 'Falha ao buscar informações do SNPedia.';
    }
  },

  /**
   * Fetch SNPedia data for multiple SNPs in batch with progress reporting
   * @param {Array} rsids - Array of SNP rsIDs
   * @param {Function} progressCallback - Callback for progress updates
   * @returns {Promise<Object>} - Promise resolving to object of SNP data keyed by rsid
   */
  async fetchSnpediaBatch(rsids, progressCallback) {
    if (!rsids || !rsids.length) {
      return {};
    }
    
    try {
      return await SNPediaManager.getMultipleSNPs(rsids, {
        progressCallback
      });
    } catch (err) {
      Logger.error("Error in batch SNPedia fetch:", err);
      return {};
    }
  },
  
  /**
   * Get a list of all SNPs in SNPedia with continuation support
   * @param {Number} limit - Maximum number of SNPs to fetch (defaults to all)
   * @param {Function} progressCallback - Callback for progress updates
   * @returns {Promise<Array>} - Promise resolving to array of SNP names
   */
  async getAllSnpediaSNPs(limit = Infinity, progressCallback) {
    try {
      return await SNPediaManager.getAllSNPs({
        limit,
        progressCallback
      });
    } catch (err) {
      Logger.error("Error fetching all SNPedia SNPs:", err);
      return [];
    }
  },

  /**
   * Get SNPedia data for user's SNPs that exist in SNPedia
   * @param {Function} progressCallback - Progress reporting callback
   * @returns {Promise<Object>} - Object mapping rsid to SNPedia data
   */
  async getRelevantSnpediaSNPs(progressCallback) {
    try {
      // First get all SNPs from SNPedia (using continuation)
      const allSnpediaSNPs = await this.getAllSnpediaSNPs(Infinity, progressCallback);
      
      // Find overlap with user's SNPs
      const userSnpSet = new Set(this.allResults.map(snp => snp.rsid));
      const relevantSNPs = allSnpediaSNPs.filter(snp => userSnpSet.has(snp));
      
      if (progressCallback) {
        progressCallback({
          loaded: 0,
          total: relevantSNPs.length,
          stage: 'Fetching details for matching SNPs'
        });
      }
      
      // Fetch detailed data for the relevant SNPs
      return await this.fetchSnpediaBatch(relevantSNPs, progressCallback);
      
    } catch (err) {
      Logger.error("Error getting relevant SNPedia data:", err);
      return {};
    }
  },

  /**
   * Get SNPs associated with high-priority genes
   * @param {Function} progressCallback - Progress reporting callback
   * @returns {Promise<Array>} Array of prioritized SNPs
   */
  async getPrioritizedGeneSNPs(progressCallback) {
    try {
      if (progressCallback) {
        progressCallback({
          stage: 'Starting gene prioritization',
          loaded: 0,
          total: GenePrioritizer.highPriorityGenes.length
        });
      }
      
      // Get SNPs for high-priority genes using SNPedia bulk API
      const prioritizedSNPs = await SNPediaManager.getSnpsMatchingCriteria({
        genes: GenePrioritizer.highPriorityGenes,
        limit: 500,  // Limit to 500 most relevant SNPs
        progressCallback
      });
      
      // Find overlap with user's SNPs
      const userSnpMap = new Map(this.allResults.map(snp => [snp.rsid, snp]));
      
      // Match user's SNPs with the prioritized SNPs
      const matchedSNPs = prioritizedSNPs.filter(snp => userSnpMap.has(snp.rsid))
        .map(snp => ({
          ...snp,
          userGenotype: userSnpMap.get(snp.rsid).Genotype,
          category: GenePrioritizer.getCategory(snp.gene),
          description: GenePrioritizer.getDescription(snp.gene)
        }));
      
      // Group by gene category
      const categorizedSNPs = GenePrioritizer.groupByCategory(matchedSNPs);
      
      if (progressCallback) {
        progressCallback({
          stage: 'Gene prioritization complete',
          loaded: matchedSNPs.length,
          total: matchedSNPs.length,
          done: true
        });
      }
      
      return {
        prioritizedSNPs: matchedSNPs,
        categorizedSNPs,
        stats: {
          total: matchedSNPs.length,
          categories: Object.keys(categorizedSNPs).reduce((acc, category) => {
            acc[category] = categorizedSNPs[category].length;
            return acc;
          }, {})
        }
      };
      
    } catch (err) {
      Logger.error("Error prioritizing gene SNPs:", err);
      return {
        prioritizedSNPs: [],
        categorizedSNPs: {},
        stats: { total: 0, categories: {} },
        error: err.message
      };
    }
  },

  /**
   * Discover relevant genes from user DNA data
   * @param {Function} progressCallback - Progress reporting callback
   * @returns {Promise<Object>} Gene discovery results
   */
  async discoverRelevantGenes(progressCallback) {
    // Initialize the gene discovery module with user data
    GeneDiscovery.init(this.allResults);
    
    try {
      // Run the discovery process
      const discoveryResults = await GeneDiscovery.discoverRelevantGenes(progressCallback);
      
      // Cache the results
      this.geneDiscoveryResults = discoveryResults;
      
      return discoveryResults;
    } catch (error) {
      Logger.error("Error discovering relevant genes:", error);
      throw error;
    }
  },
  
  /**
   * Get detailed information for discovered genes
   * @param {Array} rsids - Array of rsIDs to fetch detailed data for
   * @param {Function} progressCallback - Progress reporting callback
   * @returns {Promise<Object>} Detailed gene data
   */
  async fetchDetailedGeneData(rsids, progressCallback) {
    if (!rsids || rsids.length === 0) {
      return {};
    }
    
    try {
      const batchSize = 10; // Smaller batches for better progress reporting
      const totalSnps = rsids.length;
      let processedSnps = 0;
      let detailedData = {};
      
      // Process in batches
      for (let i = 0; i < rsids.length; i += batchSize) {
        const batch = rsids.slice(i, i + batchSize);
        
        if (progressCallback) {
          progressCallback({
            stage: `Fetching details for SNPs ${processedSnps + 1}-${processedSnps + batch.length}`,
            progress: (processedSnps / totalSnps) * 100
          });
        }
        
        // Process batch
        const batchResults = await Promise.all(batch.map(async (rsid) => {
          try {
            const info = await this.fetchSnp(rsid);
            return { rsid, info };
          } catch (error) {
            Logger.warn(`Error fetching details for ${rsid}:`, error);
            return { rsid, error: error.message };
          }
        }));
        
        // Add to results
        for (const result of batchResults) {
          if (result.info) {
            detailedData[result.rsid] = result.info;
          }
        }
        
        processedSnps += batch.length;
      }
      
      if (progressCallback) {
        progressCallback({
          stage: "Detail fetching complete",
          progress: 100
        });
      }
      
      return detailedData;
    } catch (error) {
      Logger.error("Error fetching detailed gene data:", error);
      throw error;
    }
  }
};

export default DataManager;
