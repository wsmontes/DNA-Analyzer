/**
 * FileProcessor
 * 
 * Enhanced to handle different DNA file formats and provide better error handling
 */
import DataManager from './dataManager.js';
import ChartManager from './chartManager.js';
import SNPediaManager from './snpediaManager.js';
import Logger from './logger.js';

const FileProcessor = {
  // Process DNA file with improved format detection
  async processDnaFile(file) {
    try {
      Logger.info(`Processing file: ${file.name} (${file.size} bytes, type: ${file.type})`);
      
      // Determine file type based on extension
      const fileExtension = file.name.split('.').pop().toLowerCase();
      
      if (fileExtension === 'zip') {
        return this.processZipFile(file);
      } else if (fileExtension === 'csv' || fileExtension === 'txt') {
        return this.processCSVFile(file);
      } else if (fileExtension === 'vcf') {
        return this.processVCFFile(file);
      } else {
        throw new Error(`Unsupported file format: ${fileExtension}. Please upload .zip, .csv, .txt or .vcf files.`);
      }
    } catch (error) {
      Logger.error("Error processing DNA file:", error);
      throw error;
    }
  },

  // Process ZIP file (MyHeritage, etc.)
  async processZipFile(file) {
    try {
      const data = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(data);
      
      // Look for any CSV, TXT or other data files
      const csvName = Object.keys(zip.files).find(n => 
        n.endsWith('.csv') || n.endsWith('.txt') || n.includes('dna') || n.includes('genome')
      );
      
      if (!csvName) throw new Error("No data file found in the ZIP. Please ensure the ZIP contains a CSV or TXT file with DNA data.");
      
      Logger.info(`Found data file in ZIP: ${csvName}`);
      const csvText = await zip.files[csvName].async('text');
      
      // Process the CSV text
      return this.processRawCSV(csvText);
    } catch (error) {
      Logger.error("Error processing ZIP file:", error);
      throw new Error(`Failed to process ZIP file: ${error.message}`);
    }
  },
  
  // Process CSV or TXT file directly
  async processCSVFile(file) {
    try {
      const text = await file.text();
      return this.processRawCSV(text);
    } catch (error) {
      Logger.error("Error processing CSV/TXT file:", error);
      throw new Error(`Failed to process CSV/TXT file: ${error.message}`);
    }
  },
  
  // Process VCF file (more complex format used by some providers)
  async processVCFFile(file) {
    try {
      const text = await file.text();
      const lines = text.split('\n');
      
      // Filter out header lines and comments
      const dataLines = lines.filter(line => !line.startsWith('#') && line.trim().length > 0);
      
      // Map VCF data to our standard format
      const results = dataLines.map(line => {
        const fields = line.split('\t');
        // VCF format: CHROM POS ID REF ALT QUAL FILTER INFO FORMAT SAMPLE
        if (fields.length < 5) return null;
        
        return {
          rsid: fields[2].startsWith('rs') ? fields[2] : `rs${fields[2]}`,
          chromosome: fields[0],
          position: fields[1],
          Genotype: fields[3] + fields[4] // REF + ALT as a simple approximation
        };
      }).filter(Boolean);
      
      Logger.info(`Processed ${results.length} SNPs from VCF file`);
      
      if (results.length === 0) {
        throw new Error("No valid SNP data found in the VCF file.");
      }
      
      DataManager.allResults = results;
      DataManager.filteredResults = [...results];
      
      return results;
    } catch (error) {
      Logger.error("Error processing VCF file:", error);
      throw new Error(`Failed to process VCF file: ${error.message}`);
    }
  },
  
  // Process raw CSV text with more flexible format detection
  processRawCSV(csvText) {
    try {
      // Remove comment lines starting with # for better parsing
      const cleanedCsvText = csvText.split('\n')
        .filter(line => !line.startsWith('#') && line.trim().length > 0)
        .join('\n');
      
      // Parse CSV with PapaParse
      const parseResult = Papa.parse(cleanedCsvText, { 
        header: true, 
        skipEmptyLines: true,
        error: (error) => {
          Logger.error("CSV parsing error:", error);
        }
      });
      
      if (parseResult.errors && parseResult.errors.length > 0) {
        Logger.warn(`CSV parsing had ${parseResult.errors.length} errors:`, 
          parseResult.errors.slice(0, 3));
      }
      
      // Get all headers and normalize them to lowercase for case-insensitive matching
      const headers = parseResult.meta.fields.map(h => h.toLowerCase());
      Logger.debug("Detected headers:", headers);
      
      // Match headers with flexible options
      const rsidHeader = this.findMatchingHeader(parseResult.meta.fields, 
        ['rsid', 'rs#', 'rs_id', 'snp', 'snp_id', 'marker', 'snp name', 'id']);
        
      const chromHeader = this.findMatchingHeader(parseResult.meta.fields, 
        ['chromosome', 'chrom', 'chr', 'chromosome name', 'chromosome number']);
        
      const posHeader = this.findMatchingHeader(parseResult.meta.fields, 
        ['position', 'pos', 'bp', 'position (bp)', 'bp position']);
        
      const genoHeader = this.findMatchingHeader(parseResult.meta.fields, 
        ['genotype', 'result', 'allele', 'alleles', 'call', 'geno', 'snp result']);

      if (!rsidHeader || !chromHeader || !posHeader || !genoHeader) {
        throw new Error(`Could not find required columns. Detected headers: ${parseResult.meta.fields.join(', ')}. 
          Required: rsid/marker, chromosome, position, genotype/result.`);
      }
      
      Logger.info(`Matched headers: rsid=${rsidHeader}, chrom=${chromHeader}, pos=${posHeader}, geno=${genoHeader}`);

      // Extract data with matched headers
      const results = parseResult.data
        .filter(r => r[rsidHeader] && r[chromHeader] && r[posHeader] && r[genoHeader])
        .map(r => ({
          rsid: r[rsidHeader],
          chromosome: r[chromHeader],
          position: r[posHeader],
          Genotype: r[genoHeader]
        }));

      if (results.length === 0) {
        throw new Error("No valid SNP data found after filtering. Please check the file content.");
      }
      
      Logger.info(`Processed ${results.length} SNPs from CSV data`);
      
      // Set results in DataManager
      DataManager.allResults = results;
      DataManager.filteredResults = [...results];

      return results;
    } catch (error) {
      Logger.error("Error processing CSV data:", error);
      throw error;
    }
  },
  
  // Find matching header from a list of options (case-insensitive)
  findMatchingHeader(headers, options) {
    // Create a map of lowercase header to actual header for case-insensitive lookup
    const headerMap = {};
    headers.forEach(h => headerMap[h.toLowerCase()] = h);
    
    // Try each option
    for (const option of options) {
      if (headerMap[option.toLowerCase()]) {
        return headerMap[option.toLowerCase()];
      }
    }
    
    // Try partial matches if exact match fails
    for (const option of options) {
      const partialMatches = headers.filter(h => 
        h.toLowerCase().includes(option.toLowerCase()) || 
        option.toLowerCase().includes(h.toLowerCase())
      );
      if (partialMatches.length > 0) {
        return partialMatches[0];
      }
    }
    
    return null;
  },

  // Analyze DNA data for insights with improved error handling
  async analyzeDnaData(allResults, progressCallback) {
    // Initialize counters and storage
    const clinSummary = [];
    const traitSummary = [];
    const clinCounts = { 
      pathogenic: 0, 
      likely_pathogenic: 0, 
      benign: 0, 
      uncertain: 0, 
      other: 0 
    };
    const traitCounts = {};
    let ancestryHints = 0;
    const topInsights = [];

    try {
      // STEP 1: Get SNP list from SNPedia first to guide our analysis
      if (progressCallback) {
        progressCallback({
          stage: "Getting SNPedia data catalog...",
          loaded: 0,
          total: 1
        });
      }

      // Fetch high-magnitude SNPs from SNPedia - these are the ones worth analyzing
      const significantSnps = await SNPediaManager.getHighMagnitudeSNPs({
        progressCallback: (progress) => {
          if (progressCallback) {
            progressCallback({
              stage: "Downloading SNP reference data",
              loaded: progress.found || 0, 
              total: "SNPedia database"
            });
          }
        }
      });
      
      Logger.info(`Retrieved ${significantSnps.length} significant SNPs from SNPedia`);
      
      if (progressCallback) {
        progressCallback({
          stage: `Found ${significantSnps.length} significant SNPs in database`,
          loaded: 1,
          total: 2
        });
      }
      
      // STEP 2: Now check if user has any of these significant SNPs
      if (progressCallback) {
        progressCallback({
          stage: "Checking your DNA for matches...",
          loaded: 0,
          total: significantSnps.length
        });
      }
      
      // Create a map of the user's SNPs for efficient lookup
      // Normalize rsIDs to ensure consistent matching
      const userSnpMap = new Map();
      for (const snp of allResults) {
        // Normalize to lowercase and ensure 'rs' prefix is present
        let rsid = snp.rsid.toLowerCase();
        if (!rsid.startsWith('rs') && /^\d+$/.test(rsid)) {
          rsid = 'rs' + rsid;
        }
        userSnpMap.set(rsid, { ...snp, rsid });
        
        // Also add the non-prefixed version for flexible matching
        if (rsid.startsWith('rs')) {
          const numericRs = rsid.substring(2);
          if (!userSnpMap.has(numericRs)) {
            userSnpMap.set(numericRs, { ...snp, rsid });
          }
        }
      }
      
      Logger.info(`Created map of ${userSnpMap.size} user SNPs for matching`);
      
      const matchingSignificantSnps = [];
      let checkedCount = 0;
      
      // Log a sample of SNPs to help with debugging
      Logger.debug("First 5 user SNPs:", [...userSnpMap.entries()].slice(0, 5));
      Logger.debug("First 5 significant SNPs to match:", significantSnps.slice(0, 5));
      
      // Find matching significant SNPs in user's data
      for (const snp of significantSnps) {
        let normalizedRsid = snp.rsid.toLowerCase();
        let numericRsid = normalizedRsid.startsWith('rs') ? normalizedRsid.substring(2) : normalizedRsid;
        
        // Try both formats for matching
        if (userSnpMap.has(normalizedRsid) || userSnpMap.has(numericRsid)) {
          const userSnp = userSnpMap.get(normalizedRsid) || userSnpMap.get(numericRsid);
          matchingSignificantSnps.push({
            ...snp,
            userGenotype: userSnp.Genotype,
            chromosome: userSnp.chromosome,
            position: userSnp.position
          });
          
          // Log successful matches (first few only)
          if (matchingSignificantSnps.length <= 5) {
            Logger.info(`Matched SNP ${snp.rsid} with user SNP ${userSnp.rsid}, genotype: ${userSnp.Genotype}`);
          }
        }
        
        // Update progress periodically
        checkedCount++;
        if (checkedCount % 100 === 0 && progressCallback) {
          progressCallback({
            stage: "Matching SNPs",
            loaded: checkedCount,
            total: significantSnps.length,
            matched: matchingSignificantSnps.length
          });
        }
      }
      
      Logger.info(`Found ${matchingSignificantSnps.length} matching SNPs out of ${significantSnps.length} significant SNPs`);

      if (progressCallback) {
        progressCallback({
          stage: `Found ${matchingSignificantSnps.length} relevant SNPs in your DNA`,
          loaded: significantSnps.length,
          total: significantSnps.length
        });
      }
      
      // STEP 3: Get detailed information for the matched SNPs (from Ensembl)
      let topSnps = matchingSignificantSnps
        .sort((a, b) => (b.magnitude || 0) - (a.magnitude || 0))
        .slice(0, Math.min(25, matchingSignificantSnps.length)); // Get top 25 by magnitude
      
      // If no matches, use the first few SNPs from user data as fallback
      if (topSnps.length === 0) {
        Logger.warn("No matching significant SNPs found. Using fallback with first 10 user SNPs");
        topSnps = allResults.slice(0, 10).map(snp => ({
          rsid: snp.rsid,
          chromosome: snp.chromosome,
          position: snp.position,
          userGenotype: snp.Genotype,
          magnitude: 0
        }));
        
        // Add a fallback insight
        topInsights.push(`<span class="info-note">No significant SNPs were found in your DNA that match our high-impact database. This could be normal or indicate data format differences.</span>`);
      }
      
      if (progressCallback) {
        progressCallback({
          stage: "Getting detailed information for significant SNPs",
          loaded: 0,
          total: topSnps.length
        });
      }
      
      // Process detailed information for top SNPs
      for (let i = 0; i < topSnps.length; i++) {
        const snp = topSnps[i];
        
        try {
          const info = await DataManager.fetchSnp(snp.rsid);
          
          // Process clinical significance
          let clin = (info.clinical_significance || []).map(x => x.toLowerCase());
          if (clin.includes('pathogenic')) clinCounts.pathogenic++;
          else if (clin.includes('likely pathogenic')) clinCounts.likely_pathogenic++;
          else if (clin.includes('benign')) clinCounts.benign++;
          else if (clin.includes('uncertain significance')) clinCounts.uncertain++;
          else clinCounts.other++;

          if (clin.length > 0) {
            clinSummary.push({
              rsid: snp.rsid,
              clin,
              gene: info.mapped_genes?.[0]?.gene_symbol || '',
              desc: info.most_severe_consequence || '',
              phenotypes: info.phenotypes || [],
              magnitude: snp.magnitude
            });
          }

          // Traits
          const traits = DataManager.extractTraits(info);
          if (traits.length > 0) {
            traitSummary.push({
              rsid: snp.rsid,
              traits,
              gene: info.mapped_genes?.[0]?.gene_symbol || '',
              desc: info.most_severe_consequence || '',
              phenotypes: info.phenotypes || [],
              magnitude: snp.magnitude
            });
            for (const t of traits) traitCounts[t] = (traitCounts[t] || 0) + 1;
          }

          // Ancestry hints
          if (traits.includes('ancestry') || traits.includes('ethnicity')) ancestryHints++;
          
          // Update progress
          if (progressCallback) {
            progressCallback({
              stage: "Analyzing SNPs",
              loaded: i + 1,
              total: topSnps.length
            });
          }
        } catch (err) {
          console.warn(`Skipping analysis for ${snp.rsid}:`, err.message);
        }
      }

      // Generate insights based on the findings
      if (clinCounts.pathogenic > 0) {
        topInsights.push(`<span class="clin-pathogenic">${clinCounts.pathogenic} SNPs patogênicos detectados</span>`);
      }
      if (clinCounts.likely_pathogenic > 0) {
        topInsights.push(`<span class="clin-pathogenic">${clinCounts.likely_pathogenic} SNPs provavelmente patogênicos</span>`);
      }
      
      if (matchingSignificantSnps.length > 0) {
        topInsights.push(`<span class="insight-highlight">Encontrados ${matchingSignificantSnps.length} SNPs com significância potencial em seu DNA</span>`);
      }
      
      if (Object.keys(traitCounts).length > 0) {
        const topTraits = Object.entries(traitCounts).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`${k} (${v})`);
        topInsights.push(`Traços detectados: <span class="trait-keyword">${topTraits.join('</span>, <span class="trait-keyword">')}</span>`);
      }
      if (ancestryHints > 0) {
        topInsights.push(`${ancestryHints} SNPs relacionados à ancestralidade/etnia encontrados`);
      }

      // Always include a summary insight with counts
      topInsights.push(`<span class="insight-highlight">Found ${allResults.length} SNPs in your DNA file. Analyzed in detail: ${topSnps.length} SNPs.</span>`);

      return {
        allResults,
        clinSummary,
        traitSummary,
        clinCounts,
        traitCounts,
        ancestryHints,
        topInsights,
        significantMatches: {
          count: matchingSignificantSnps.length,
          items: matchingSignificantSnps.length > 0 ? matchingSignificantSnps : topSnps // Always return something
        }
      };
    } catch (error) {
      Logger.error("Error in comprehensive analysis:", error);
      topInsights.push(`<span class="error-message">Analysis error: ${error.message}</span>`);
      
      // Add helpful fallback insights even when we encounter an error
      topInsights.push(`<span class="insight-highlight">Found ${allResults.length} SNPs in your DNA file.</span>`);
      topInsights.push(`<span class="info-note">Try reloading the page or using a different DNA file if you continue to see errors.</span>`);
      
      return {
        allResults,
        clinSummary,
        traitSummary,
        clinCounts,
        traitCounts,
        ancestryHints,
        topInsights,
        error: error.message
      };
    }
  }
};

export default FileProcessor;
