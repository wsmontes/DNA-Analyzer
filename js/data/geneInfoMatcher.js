/**
 * Gene Info Matcher
 * 
 * Matches genes with NCBI gene info database and provides additional information
 * about genes found in DNA analysis.
 */

class GeneInfoMatcher {
  constructor() {
    this.geneInfoMap = new Map(); // Map gene symbols to their info
    this.synonymMap = new Map();  // Map gene synonyms to canonical symbols
    this.loaded = false;
  }
  
  /**
   * Load gene info data from the provided file content
   * @param {string} fileContent - Raw content of the gene_info file
   * @returns {Promise<boolean>} - True if loading was successful
   */
  async loadFromContent(fileContent) {
    try {
      const lines = fileContent.split('\n');
      
      // Skip header (first line)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const fields = line.split('\t');
        if (fields.length < 9) continue;
        
        // Field indices based on the gene_info format
        const taxId = fields[0];
        const geneId = fields[1];
        const symbol = fields[2];
        const synonymsStr = fields[4];
        const chromosome = fields[6];
        const location = fields[7];
        const description = fields[8];
        const type = fields[9];
        const fullName = fields[11];
        const otherDesignations = fields[13];
        
        // Only store human genes (taxId 9606)
        if (taxId === '9606') {
          const synonyms = synonymsStr ? synonymsStr.split('|').filter(s => s !== '-') : [];
          
          const geneInfo = {
            geneId,
            symbol,
            description,
            type,
            synonyms,
            chromosome,
            location,
            fullName,
            otherDesignations: otherDesignations ? otherDesignations.split('|') : []
          };
          
          this.geneInfoMap.set(symbol, geneInfo);
          
          // Index synonyms for faster lookup
          synonyms.forEach(syn => {
            this.synonymMap.set(syn, symbol);
          });
        }
      }
      
      this.loaded = true;
      console.log(`Loaded ${this.geneInfoMap.size} genes from gene_info file`);
      return true;
    } catch (error) {
      console.error("Error loading gene info:", error);
      return false;
    }
  }
  
  /**
   * Load gene info from a file
   * @param {string} filePath - Path to the gene_info file
   * @returns {Promise<boolean>} - True if loading was successful
   */
  async loadFromFile(filePath) {
    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const content = await response.text();
      return await this.loadFromContent(content);
    } catch (error) {
      console.error("Error loading gene info from file:", error);
      return false;
    }
  }
  
  /**
   * Match a gene symbol with gene info
   * @param {string} geneSymbol - The gene symbol to look up
   * @returns {Object|null} - Gene info object or null if not found
   */
  matchGene(geneSymbol) {
    if (!this.loaded) {
      console.warn("Gene info data not loaded yet");
      return null;
    }
    
    if (!geneSymbol) return null;
    
    // Direct match
    if (this.geneInfoMap.has(geneSymbol)) {
      return this.geneInfoMap.get(geneSymbol);
    }
    
    // Check synonym map
    if (this.synonymMap.has(geneSymbol)) {
      const canonicalSymbol = this.synonymMap.get(geneSymbol);
      return this.geneInfoMap.get(canonicalSymbol);
    }
    
    return null;
  }
  
  /**
   * Match multiple gene symbols with gene info
   * @param {Array<string>} geneSymbols - Array of gene symbols to look up
   * @returns {Object} - Map of gene symbols to their info objects
   */
  matchGenes(geneSymbols) {
    if (!this.loaded) {
      console.warn("Gene info data not loaded yet");
      return {};
    }
    
    const results = {};
    
    for (const symbol of geneSymbols) {
      const match = this.matchGene(symbol);
      if (match) {
        results[symbol] = match;
      }
    }
    
    return results;
  }
  
  /**
   * Get the total number of genes loaded
   * @returns {number} - Number of genes in the database
   */
  get totalGenes() {
    return this.geneInfoMap.size;
  }
  
  /**
   * Check if the gene info data is loaded
   * @returns {boolean} - True if data is loaded
   */
  isLoaded() {
    return this.loaded;
  }
}

export default new GeneInfoMatcher();
