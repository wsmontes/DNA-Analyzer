/**
 * API Diagnostics
 * 
 * Provides utilities for diagnosing API connection issues
 */
import Logger from './logger.js';

const APIDiagnostics = {
  endpoints: {
    snpedia: 'https://bots.snpedia.com/api.php?action=query&meta=siteinfo&siprop=general&format=json',
    ensembl: 'https://rest.ensembl.org/info/ping?content-type=application/json',
    dbSnp: 'https://api.ncbi.nlm.nih.gov/variation/v0/refsnp/1'
  },

  statusIndicators: {
    snpedia: null,
    ensembl: null,
    geneDb: null
  },
  
  lastStatus: {
    snpedia: { status: 'unknown', timestamp: null },
    ensembl: { status: 'unknown', timestamp: null },
    geneDb: { status: 'unknown', timestamp: null }
  },
  
  /**
   * Initialize the API diagnostics module
   * @param {Object} statusElements - DOM elements for status indicators
   */
  init(statusElements) {
    this.statusIndicators = statusElements || {};
    Logger.info('[APIDiagnostics] Initialized');
    
    // Enable debug mode checkbox
    const debugCheckbox = document.getElementById('debug-mode');
    const apiDebugPanel = document.getElementById('api-debug-panel');
    
    if (debugCheckbox && apiDebugPanel) {
      debugCheckbox.addEventListener('change', (e) => {
        apiDebugPanel.style.display = e.target.checked ? 'block' : 'none';
        if (e.target.checked) {
          this.populateDebugLogs();
        }
      });
    }
  },
  
  /**
   * Check connectivity to all APIs
   * @returns {Promise<Object>} Status for each API
   */
  async checkAllConnections() {
    const results = {};
    
    try {
      results.snpedia = await this.checkConnection('snpedia');
    } catch (e) {
      results.snpedia = { ok: false, error: e.message };
    }
    
    try {
      results.ensembl = await this.checkConnection('ensembl');
    } catch (e) {
      results.ensembl = { ok: false, error: e.message };
    }
    
    try {
      results.geneDb = await this.checkConnection('dbSnp'); 
    } catch (e) {
      results.geneDb = { ok: false, error: e.message };
    }
    
    this.updateStatusIndicators(results);
    return results;
  },
  
  /**
   * Check connectivity to a specific API
   * @param {string} api - API name (must be a key in this.endpoints)
   * @returns {Promise<Object>} Connection info
   */
  async checkConnection(api) {
    if (!this.endpoints[api]) {
      throw new Error(`Unknown API: ${api}`);
    }
    
    const startTime = performance.now();
    const response = await fetch(this.endpoints[api], { 
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      mode: 'cors',
      cache: 'no-cache',
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
      credentials: 'omit'
    });
    const endTime = performance.now();
    
    const result = {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      latency: Math.round(endTime - startTime)
    };
    
    // Update last known status
    this.lastStatus[api] = { 
      status: response.ok ? 'online' : 'error',
      timestamp: new Date()
    };
    
    return result;
  },
  
  /**
   * Update status indicators in the UI
   * @param {Object} results - Results from checkAllConnections
   */
  updateStatusIndicators(results) {
    for (const [api, indicator] of Object.entries(this.statusIndicators)) {
      if (!indicator) continue;
      
      const result = results[api];
      if (!result) {
        indicator.className = 'status-indicator unknown';
        indicator.textContent = 'Unknown';
      } else if (result.ok) {
        indicator.className = 'status-indicator online';
        indicator.textContent = `Connected (${result.latency}ms)`;
      } else {
        indicator.className = 'status-indicator offline';
        indicator.textContent = `Failed (${result.status || 'Error'})`;
      }
    }
  },
  
  /**
   * Add a log entry to the API debug panel
   * @param {string} message - Log message
   * @param {string} type - Log type (success, warning, error)
   */
  logToDebugPanel(message, type = 'info') {
    const apiLog = document.getElementById('api-log');
    if (!apiLog) return;
    
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    
    const timestamp = document.createElement('span');
    timestamp.className = 'timestamp';
    timestamp.textContent = new Date().toLocaleTimeString();
    
    const icon = document.createElement('span');
    icon.className = type;
    icon.textContent = type === 'success' ? '✓' : type === 'warning' ? '⚠' : type === 'error' ? '✗' : 'ℹ';
    
    const content = document.createElement('span');
    content.textContent = message;
    
    logEntry.appendChild(timestamp);
    logEntry.appendChild(icon);
    logEntry.appendChild(content);
    
    apiLog.appendChild(logEntry);
    
    // Keep log size manageable
    if (apiLog.childNodes.length > 100) {
      apiLog.removeChild(apiLog.firstChild);
    }
    
    // Scroll to bottom
    apiLog.scrollTop = apiLog.scrollHeight;
  },
  
  /**
   * Populate debug logs with API status information
   */
  populateDebugLogs() {
    const apiLog = document.getElementById('api-log');
    if (!apiLog) return;
    
    apiLog.innerHTML = '';
    
    // Add status entries
    for (const [api, status] of Object.entries(this.lastStatus)) {
      const type = status.status === 'online' ? 'success' : 
                  status.status === 'error' ? 'error' : 'warning';
                  
      const message = `${api.charAt(0).toUpperCase() + api.slice(1)}: ${status.status}`;
      this.logToDebugPanel(message, type);
    }
    
    // Add API logs from the logger
    const apiLogs = Logger.getApiLogs();
    if (apiLogs && apiLogs.length > 0) {
      apiLogs.slice(-10).forEach(log => {
        const type = log.status === 'success' ? 'success' :
                    log.status === 'error' ? 'error' : 'info';
        this.logToDebugPanel(`API: ${log.api} - ${log.message || 'Request completed'}`, type);
      });
    }
  }
};

export default APIDiagnostics;
