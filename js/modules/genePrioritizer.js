/**
 * GenePrioritizer
 * 
 * Prioritizes genes based on medical relevance and known associations
 */

const GenePrioritizer = {
  // List of high-priority genes with known clinical significance
  highPriorityGenes: [
    // Cancer-related genes
    'BRCA1', 'BRCA2', 'TP53', 'APC', 'MLH1', 'MSH2', 'MSH6', 'PMS2', 'PTEN', 'RB1', 'PALB2',
    // Cardiovascular disease genes
    'APOE', 'LDLR', 'PCSK9', 'APOB', 'MYBPC3', 'MYH7', 'TNNT2', 'LMNA',
    // Neurodegenerative disease genes
    'APP', 'PSEN1', 'PSEN2', 'MAPT', 'SNCA', 'HTT', 'C9orf72',
    // Metabolic disorder genes
    'PAH', 'CFTR', 'HFE', 'G6PD', 'MTHFR', 'HBB', 'HBA1', 'HBA2',
    // Pharmacogenomic genes 
    'CYP2D6', 'CYP2C19', 'CYP2C9', 'VKORC1', 'TPMT', 'DPYD', 'UGT1A1', 'SLCO1B1'
  ],
  
  // Gene categories for better organization
  geneCategories: {
    'Cancer': ['BRCA1', 'BRCA2', 'TP53', 'APC', 'MLH1', 'MSH2', 'MSH6', 'PMS2', 'PTEN', 'RB1', 'PALB2'],
    'Cardiovascular': ['APOE', 'LDLR', 'PCSK9', 'APOB', 'MYBPC3', 'MYH7', 'TNNT2', 'LMNA'],
    'Neurodegenerative': ['APP', 'PSEN1', 'PSEN2', 'MAPT', 'SNCA', 'HTT', 'C9orf72'],
    'Metabolic': ['PAH', 'CFTR', 'HFE', 'G6PD', 'MTHFR', 'HBB', 'HBA1', 'HBA2'],
    'Pharmacogenomic': ['CYP2D6', 'CYP2C19', 'CYP2C9', 'VKORC1', 'TPMT', 'DPYD', 'UGT1A1', 'SLCO1B1']
  },
  
  // Gene descriptions for user-friendly displays
  geneDescriptions: {
    'BRCA1': 'Breast cancer susceptibility gene 1',
    'BRCA2': 'Breast cancer susceptibility gene 2',
    'APOE': 'Apolipoprotein E - affects Alzheimer\'s risk and cholesterol metabolism',
    'MTHFR': 'Methylenetetrahydrofolate reductase - affects folate metabolism',
    'CFTR': 'Cystic fibrosis transmembrane conductance regulator',
    'HFE': 'Hemochromatosis gene - affects iron absorption',
    'TP53': 'Tumor protein p53 - guardian of the genome, prevents cancer formation',
    'CYP2D6': 'Key drug metabolism enzyme affecting ~25% of prescription drugs',
    'CYP2C19': 'Important for metabolism of antidepressants and other drugs',
    'VKORC1': 'Vitamin K epoxide reductase - affects warfarin (blood thinner) response',
    // Additional descriptions would be added for all genes
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
    const normalizedGene = gene.toUpperCase();
    
    for (const [category, genes] of Object.entries(this.geneCategories)) {
      if (genes.includes(normalizedGene)) {
        return category;
      }
    }
    
    return "Other";
  },
  
  /**
   * Get description for a gene
   * @param {string} gene - Gene symbol
   * @returns {string} Description or empty string
   */
  getDescription(gene) {
    if (!gene) return "";
    return this.geneDescriptions[gene.toUpperCase()] || "";
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
