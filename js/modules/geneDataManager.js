/**
 * Gene Data Manager
 * 
 * Manages gene data loading and integration between different sources
 */

import EnhancedGenes from '../data/enhancedGenes.js';

class GeneDataManager {
  constructor() {
    this.enhancedGenes = EnhancedGenes;
    this.isInitialized = false;
  }
  
  /**
   * Initialize the gene data manager and load required data
   * @returns {Promise<boolean>} - True if initialization was successful
   */
  async initialize() {
    try {
      // Path to the gene_info file
      const geneInfoPath = 'data/Homo_sapiens.gene_info';
      
      // Load and enrich genes
      const result = await this.enhancedGenes.loadAndEnrich(geneInfoPath);
      
      if (result) {
        this.isInitialized = true;
        console.log("Gene data manager initialized successfully");
      }
      
      return result;
    } catch (error) {
      console.error("Failed to initialize gene data manager:", error);
      return false;
    }
  }
  
  /**
   * Get detailed information for a gene
   * @param {string} geneSymbol - Gene symbol to look up
   * @returns {Object|null} - Enhanced gene information or null if not found
   */
  getGeneInfo(geneSymbol) {
    if (!this.isInitialized) {
      console.warn("Gene data manager not initialized");
    }
    
    return this.enhancedGenes.getEnrichedGene(geneSymbol);
  }
  
  /**
   * Search for genes by query string
   * @param {string} query - Search query
   * @returns {Array} - Array of matching gene objects
   */
  searchGenes(query) {
    if (!this.isInitialized) {
      console.warn("Gene data manager not initialized");
      return [];
    }
    
    return this.enhancedGenes.searchGenes(query);
  }
}

export default new GeneDataManager();
