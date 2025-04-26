/**
 * FileProcessor
 * 
 * Processa arquivos DNA, extrai dados e executa análises
 */
import DataManager from './dataManager.js';
import ChartManager from './chartManager.js';

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

  // Analisar dados para insights
  async analyzeDnaData(allResults) {
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

    // Vamos analisar apenas uma amostra de SNPs inicialmente
    const snpsToSample = allResults.slice(0, 50);

    for (const snp of snpsToSample) {
      try {
        const info = await DataManager.fetchSnp(snp.rsid);
        
        // Significância clínica
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
            phenotypes: info.phenotypes || []
          });
        }

        // Traços
        const traits = DataManager.extractTraits(info);
        if (traits.length > 0) {
          traitSummary.push({
            rsid: snp.rsid,
            traits,
            gene: info.mapped_genes?.[0]?.gene_symbol || '',
            desc: info.most_severe_consequence || '',
            phenotypes: info.phenotypes || []
          });
          for (const t of traits) traitCounts[t] = (traitCounts[t] || 0) + 1;
        }

        // Dicas de ancestralidade
        if (traits.includes('ancestry') || traits.includes('ethnicity')) ancestryHints++;
        
      } catch (err) {
        // Apenas continuar com o próximo SNP
        console.warn(`Pulando análise para ${snp.rsid}:`, err.message);
      }
    }

    // Top insights
    if (clinCounts.pathogenic > 0) {
      topInsights.push(`<span class="clin-pathogenic">${clinCounts.pathogenic} SNPs patogênicos detectados</span>`);
    }
    if (clinCounts.likely_pathogenic > 0) {
      topInsights.push(`<span class="clin-pathogenic">${clinCounts.likely_pathogenic} SNPs provavelmente patogênicos</span>`);
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
      topInsights
    };
  }
};

export default FileProcessor;
