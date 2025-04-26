/**
 * ProxyManager
 * 
 * Gerencia proxies para contornar limitações de CORS, testando vários
 * e escolhendo o primeiro que funciona.
 */
const ProxyManager = {
  proxies: [
    { url: '',                                    name: 'Direct' },
    { url: 'https://api.allorigins.win/raw?url=', name: 'AllOrigins' },
    { url: 'https://api.allorigins.cf/raw?url=',  name: 'AllOrigins.cf' },
    { url: 'https://corsproxy.io/?',              name: 'CORSProxy.io' },
    // Outros proxies disponíveis que podem ser úteis
    { url: 'https://jsonp.afeld.me/?url=',        name: 'jsonp.afeld' },
    { url: 'https://yacdn.org/proxy/',            name: 'YACDN' },
    { url: 'https://cors-anywhere.herokuapp.com/', name: 'CORS-Anywhere' },
    { url: 'https://corsproxy.netlify.app/?url=', name: 'NetlifyCORS' },
  ],
  currentProxy: null, // Armazena o primeiro proxy que funcionar
  isInitialized: false,
  isInitializing: false,
  cache: new Map(),

  // Log com distinção visual
  log(message, type = 'info') {
    const styles = {
      info: 'color: #2196F3; font-weight: bold;',
      success: 'color: #4CAF50; font-weight: bold;',
      error: 'color: #F44336; font-weight: bold;',
      warning: 'color: #FF9800; font-weight: bold;'
    };
    console.log(`%c[ProxyManager] ${message}`, styles[type] || styles.info);
  },

  // Inicializa: Testa proxies e encontra o primeiro que funciona
  async initialize() {
    if (this.isInitialized || this.isInitializing) {
      return this.isInitialized;
    }
    this.isInitializing = true;
    this.log('Inicializando: Testando proxies...');

    const testUrl = 'https://rest.ensembl.org/info/ping?content-type=application/json';

    for (let i = 0; i < this.proxies.length; i++) {
      const proxy = this.proxies[i];
      const fullUrl = proxy.url ? `${proxy.url}${encodeURIComponent(testUrl)}` : testUrl;
      this.log(`Testando proxy: ${proxy.name}...`);
      try {
        const response = await fetch(fullUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(5000) // 5 segundos de timeout
        });

        if (response.ok) {
          this.log(`Sucesso! Usando proxy: ${proxy.name}`, 'success');
          this.currentProxy = proxy;
          this.isInitialized = true;
          this.isInitializing = false;
          return true; // Encontrou um proxy funcionando
        } else {
          this.log(`${proxy.name} respondeu mas com status: ${response.status}`, 'warning');
        }
      } catch (error) {
        this.log(`${proxy.name} falhou: ${error.message}`, 'error');
      }
    }

    this.log('Inicialização falhou: Nenhum proxy funcionando encontrado.', 'error');
    this.isInitializing = false;
    return false; // Nenhum proxy funcionando encontrado
  },

  // Verificar cache
  isCached(url) {
    return this.cache.has(url);
  },
  getFromCache(url) {
    return this.cache.get(url);
  },
  saveToCache(url, data, ttl = 3600000) {
    this.cache.set(url, {
      data,
      expires: Date.now() + ttl
    });

    // Limpa itens expirados ocasionalmente
    if (Math.random() < 0.1) { // 10% de chance de acionar a limpeza
      this.cleanCache();
    }
  },
  cleanCache() {
    const now = Date.now();
    for (const [url, cached] of this.cache.entries()) {
      if (cached.expires < now) {
        this.cache.delete(url);
      }
    }
  },

  // Fetch usando o proxy pré-determinado que funciona, com uma nova tentativa em caso de falha
  async fetch(url, options = {}, _retried = false) {
    // Garantir inicialização
    if (!this.isInitialized) {
      if (!this.isInitializing) await this.initialize();
      else {
        await new Promise(r => {
          const iv = setInterval(() => { 
            if (!this.isInitializing) { clearInterval(iv); r(); } 
          }, 100);
        });
      }
      if (!this.currentProxy) throw new Error("Nenhum proxy disponível funcionando.");
    }

    // Verificar cache
    if (this.isCached(url)) {
      const cached = this.getFromCache(url);
      if (cached && cached.expires > Date.now()) {
        this.log(`Dados recuperados do cache para: ${url.slice(0,50)}...`, 'success');
        return new Response(new Blob([JSON.stringify(cached.data)], {type: 'application/json'}));
      }
    }

    const proxy = this.currentProxy;
    const fullUrl = proxy.url ? `${proxy.url}${encodeURIComponent(url)}` : url;

    try {
      this.log(`Buscando via ${proxy.name}: ${url.slice(0,50)}...`);
      const response = await fetch(fullUrl, {
        ...options,
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = await response.clone().json();
      this.saveToCache(url, data);
      this.log(`Sucesso com ${proxy.name}`, 'success');
      return response;
    } catch (err) {
      this.log(`${proxy.name} falhou: ${err.message}`, 'error');
      // Na primeira falha, esqueça este proxy, reinicialize e tente novamente uma vez
      if (!_retried) {
        this.isInitialized = false;
        this.currentProxy = null;
        this.log('Tentando buscar novamente com novo proxy...', 'warning');
        await this.initialize();
        return this.fetch(url, options, true);
      }
      throw err;
    }
  }
};

export default ProxyManager;
