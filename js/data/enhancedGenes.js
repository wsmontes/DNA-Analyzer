/**
 * Enhanced Genes
 * 
 * Extends KnownGenes with additional information from NCBI gene_info,
 * providing richer data about genes found in DNA analysis.
 */

import KnownGenes from './knownGenes.js';
import GeneInfoMatcher from './geneInfoMatcher.js';

class EnhancedGenes {
  constructor() {
    this.knownGenes = KnownGenes;
    this.geneInfoMatcher = GeneInfoMatcher;
    this.enrichedGenes = new Map();
  }
  
  /**
   * Load gene info data and enrich known genes
   * @param {string} geneInfoPath - Path to the gene_info file
   * @returns {Promise<boolean>} - True if enrichment was successful
   */
  async loadAndEnrich(geneInfoPath) {
    try {
      const loaded = await this.geneInfoMatcher.loadFromFile(geneInfoPath);
      if (!loaded) {
        throw new Error("Failed to load gene info data");
      }
      
      // Get all high priority genes
      const allGenes = this.knownGenes.getAllHighPriorityGenes();
      
      // Enrich each gene with info
      let enrichedCount = 0;
      for (const symbol of allGenes) {
        const geneInfo = this.geneInfoMatcher.matchGene(symbol);
        if (geneInfo) {
          // Combine data from NCBI with our own annotations
          const enriched = {
            ...geneInfo,
            category: this.knownGenes.getGeneCategory(symbol),
            knownDescription: this.knownGenes.getGeneDescription(symbol)
          };
          this.enrichedGenes.set(symbol, enriched);
          enrichedCount++;
        }
      }
      
      console.log(`Enriched ${enrichedCount} out of ${allGenes.length} known genes`);
      return true;
    } catch (error) {
      console.error("Error enriching genes:", error);
      return false;
    }
  }
  
  /**
   * Get enriched information for a gene
   * @param {string} geneSymbol - The gene symbol to look up
   * @returns {Object|null} - Enriched gene info or null if not found
   */
  getEnrichedGene(geneSymbol) {
    if (this.enrichedGenes.has(geneSymbol)) {
      return this.enrichedGenes.get(geneSymbol);
    }
    
    // Try to enrich on-demand if not previously processed
    const geneInfo = this.geneInfoMatcher.matchGene(geneSymbol);
    if (geneInfo) {
      const enriched = {
        ...geneInfo,
        category: this.knownGenes.getGeneCategory(geneSymbol),
        knownDescription: this.knownGenes.getGeneDescription(geneSymbol)
      };
      this.enrichedGenes.set(geneSymbol, enriched);
      return enriched;
    }
    
    return null;
  }
  
  /**
   * Get array of all enriched genes
   * @returns {Array} - Array of all enriched gene objects
   */
  getAllEnrichedGenes() {
    return Array.from(this.enrichedGenes.values());
  }
  
  /**
   * Search for genes by name, symbol, or description
   * @param {string} query - Search query
   * @returns {Array} - Matching gene objects
   */
  searchGenes(query) {
    if (!query || query.trim() === '') {
      return [];
    }
    
    query = query.toLowerCase();
    const results = [];
    
    for (const gene of this.enrichedGenes.values()) {
      // Search in symbol, name, description
      if (gene.symbol.toLowerCase().includes(query) ||
          gene.fullName?.toLowerCase().includes(query) ||
          gene.description?.toLowerCase().includes(query) ||
          gene.knownDescription?.toLowerCase().includes(query)) {
        results.push(gene);
      }
    }
    
    return results;
  }
  
  /**
   * Get genes by chromosome
   * @param {string} chromosome - Chromosome number or identifier
   * @returns {Array} - Array of genes on that chromosome
   */
  getGenesByChromosome(chromosome) {
    if (!chromosome) return [];
    
    return Array.from(this.enrichedGenes.values())
      .filter(gene => gene.chromosome === chromosome);
  }
}

export default new EnhancedGenes();
