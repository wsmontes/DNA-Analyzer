/**
 * FileProcessor
 * 
 * Processa arquivos DNA, extrai dados e executa análises
 */
import DataManager from './dataManager.js';
import ChartManager from './chartManager.js';
import SNPediaManager from './snpediaManager.js';

const FileProcessor = {
  // Processar arquivo DNA (ZIP do MyHeritage)
  async processDnaFile(file) {
    try {
      const data = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(data);
      const csvName = Object.keys(zip.files).find(n => n.endsWith('.csv'));
      
      if (!csvName) throw new Error("Nenhum arquivo CSV encontrado no ZIP.");
      
      const csvText = await zip.files[csvName].async('text');
      const cleanedCsvText = csvText.split('\n').filter(line => !line.startsWith('#')).join('\n');
      const parseResult = Papa.parse(cleanedCsvText, { header: true, skipEmptyLines: true });

      // Encontrar cabeçalhos
      const headers = parseResult.meta.fields.map(h => h.toLowerCase());
      const rsidHeader = parseResult.meta.fields[headers.indexOf('rsid')] || parseResult.meta.fields[headers.indexOf('rs#')];
      const chromHeader = parseResult.meta.fields[headers.indexOf('chromosome')];
      const posHeader = parseResult.meta.fields[headers.indexOf('position')];
      const genoHeader = parseResult.meta.fields[headers.indexOf('genotype')] || parseResult.meta.fields[headers.indexOf('result')];

      if (!rsidHeader || !chromHeader || !posHeader || !genoHeader) {
          throw new Error(`Não foi possível encontrar as colunas necessárias. Cabeçalhos detectados: ${parseResult.meta.fields.join(', ')}. Necessários (case-insensitive): rsid/rs#, chromosome, position, genotype/result.`);
      }

      DataManager.allResults = parseResult.data
          .filter(r => r[rsidHeader] && r[chromHeader] && r[posHeader] && r[genoHeader])
          .map(r => ({
              rsid: r[rsidHeader],
              chromosome: r[chromHeader],
              position: r[posHeader],
              Genotype: r[genoHeader]
          }));

      DataManager.filteredResults = [...DataManager.allResults];

      if (DataManager.allResults.length === 0) {
          throw new Error("Nenhuma linha de dados SNP válida encontrada após a filtragem. Verifique o conteúdo do CSV e os cabeçalhos.");
      }

      return DataManager.allResults;
    } catch (error) {
      console.error("Erro ao processar arquivo DNA:", error);
      throw error;
    }
  },

  // Analisar dados para insights - versão aprimorada para análise completa
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
      const userSnpMap = new Map(allResults.map(snp => [snp.rsid, snp]));
      const matchingSignificantSnps = [];
      let checkedCount = 0;
      
      // Find matching significant SNPs in user's data
      for (const snp of significantSnps) {
        if (userSnpMap.has(snp.rsid)) {
          matchingSignificantSnps.push({
            ...snp,
            userGenotype: userSnpMap.get(snp.rsid).Genotype,
            chromosome: userSnpMap.get(snp.rsid).chromosome,
            position: userSnpMap.get(snp.rsid).position
          });
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

      if (progressCallback) {
        progressCallback({
          stage: `Found ${matchingSignificantSnps.length} relevant SNPs in your DNA`,
          loaded: significantSnps.length,
          total: significantSnps.length
        });
      }
      
      // STEP 3: Get detailed information for the matched SNPs (from Ensembl)
      const topSnps = matchingSignificantSnps
        .sort((a, b) => (b.magnitude || 0) - (a.magnitude || 0))
        .slice(0, 25); // Get top 25 by magnitude
    
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
          items: matchingSignificantSnps
        }
      };
    } catch (error) {
      console.error("Error in comprehensive analysis:", error);
      topInsights.push(`<span class="error-message">Erro durante análise completa: ${error.message}</span>`);
      
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
