/**
 * GenePrioritizer
 * 
 * Prioritizes genes based on medical relevance and known associations
 */

import KnownGenes from '../data/knownGenes.js';

const GenePrioritizer = {
  // Get high priority genes from the imported database
  get highPriorityGenes() {
    return KnownGenes.getAllHighPriorityGenes();
  },
  
  // Gene categories from the database
  get geneCategories() {
    return KnownGenes.highPriorityGenes;
  },
  
  // Gene descriptions from the database
  get geneDescriptions() {
    return KnownGenes.geneDescriptions;
  },
  
  /**
   * Get a score representing the priority level of a gene
   * @param {string} gene - Gene symbol
   * @returns {number} Priority score (higher = more important)
   */
  getPriorityScore(gene) {
    if (!gene) return 0;
    const normalizedGene = gene.toUpperCase();
    
    // Highest priority for clinically significant genes
    if (this.highPriorityGenes.includes(normalizedGene)) {
      return 10;
    }
    
    // Medium priority for genes with partial matches (may be related genes)
    for (const highPriorityGene of this.highPriorityGenes) {
      if (normalizedGene.includes(highPriorityGene) || highPriorityGene.includes(normalizedGene)) {
        return 5;
      }
    }
    
    return 1; // Base priority for all other genes
  },
  
  /**
   * Get category for a gene
   * @param {string} gene - Gene symbol
   * @returns {string} Category name or "Other"
   */
  getCategory(gene) {
    if (!gene) return "Other";
    return KnownGenes.getGeneCategory(gene);
  },
  
  /**
   * Get description for a gene
   * @param {string} gene - Gene symbol
   * @returns {string} Description or empty string
   */
  getDescription(gene) {
    if (!gene) return "";
    return KnownGenes.getGeneDescription(gene);
  },
  
  /**
   * Sort SNPs by gene priority
   * @param {Array} snps - Array of SNP objects with gene property
   * @returns {Array} Sorted array of SNPs
   */
  sortByPriority(snps) {
    return [...snps].sort((a, b) => {
      const aScore = this.getPriorityScore(a.gene);
      const bScore = this.getPriorityScore(b.gene);
      return bScore - aScore; // Descending order (high priority first)
    });
  },
  
  /**
   * Group SNPs by gene category
   * @param {Array} snps - Array of SNP objects with gene property
   * @returns {Object} SNPs grouped by category
   */
  groupByCategory(snps) {
    return snps.reduce((acc, snp) => {
      const category = this.getCategory(snp.gene);
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(snp);
      return acc;
    }, {});
  }
};

export default GenePrioritizer;
