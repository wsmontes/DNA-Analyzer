/**
 * DataManager
 * 
 * Gerencia os dados de SNPs, busca informações e mantém cache.
 */
import ProxyManager from './proxyManager.js';

const DataManager = {
  snpCache: new Map(),
  allResults: [],
  filteredResults: [],
  currentPage: 1,
  rowsPerPage: 20,
  
  // Obter dados de SNP em cache, se disponível
  getCachedSnp(rsid) {
    return this.snpCache.get(rsid);
  },

  // Definir SNP em cache
  cacheSnp(rsid, data) {
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
      // Usar o ProxyManager.fetch atualizado
      const res = await ProxyManager.fetch(url, {
        headers: { 'Accept': 'application/json' }
      });

      const data = await res.json();
      this.cacheSnp(rsid, data);
      return data;
    } catch (err) {
      console.error(`Erro ao buscar ${rsid}:`, err);
      throw err;
    }
  },

  // Buscar frequências populacionais para um SNP
  async fetchPopulationFrequencies(rsid) {
    const url = `https://rest.ensembl.org/variation/human/${rsid}?pops=1;content-type=application/json`;
    try {
      const res = await ProxyManager.fetch(url, {
        headers: { 'Accept': 'application/json' }
      });
      const data = await res.json();
      return data.populations || [];
    } catch (err) {
      console.error(`Erro ao buscar frequências populacionais para ${rsid}:`, err);
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
    
    this.currentPage = 1;
    return this.filteredResults;
  },

  // Buscar informações do SNPedia via API do Wikipedia
  async fetchSnpediaSummary(rsid) {
    try {
      // A API do Wikipedia já suporta CORS, então não é necessário proxy
      const res = await fetch(`https://en.wikipedia.org/w/api.php?` +
        new URLSearchParams({
          action: 'query', prop: 'extracts', format: 'json',
          titles: rsid, origin: '*', exintro: '', explaintext: ''
        }));
      if (!res.ok) throw new Error(`Wikipedia API error (${res.status})`);
      const wpData = await res.json();
      const pages = wpData.query?.pages || {};
      const page = Object.values(pages)[0];
      if (page && !page.missing && page.extract) {
        return page.extract;
      } else {
        return 'Nenhum artigo do SNPedia encontrado ou resumo disponível.';
      }
    } catch (err) {
      console.error(`Erro ao buscar resumo do SNPedia para ${rsid}:`, err);
      return 'Falha ao buscar informações do SNPedia.';
    }
  }
};

export default DataManager;
