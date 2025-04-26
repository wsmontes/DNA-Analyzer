/**
 * Logger Module
 * 
 * Provides centralized logging functionality with different severity levels
 * and the ability to log API responses
 */

const Logger = {
  // Log levels
  LEVELS: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  },
  
  // Current log level (can be changed at runtime)
  currentLevel: 0, // Default to DEBUG level
  
  // Store for API response logs
  apiResponses: [],
  
  // Maximum number of API responses to keep in memory
  maxStoredResponses: 100,
  
  /**
   * Set the current logging level
   * @param {Number} level - The log level to set
   */
  setLevel(level) {
    this.currentLevel = level;
    this.info(`Log level set to: ${Object.keys(this.LEVELS).find(key => this.LEVELS[key] === level)}`);
  },
  
  /**
   * Log a debug message
   * @param {String} message - The message to log
   * @param {Object} data - Optional data to log
   */
  debug(message, data = null) {
    if (this.currentLevel <= this.LEVELS.DEBUG) {
      console.debug(`%c[DEBUG] ${message}`, 'color: #6c757d', data || '');
    }
  },
  
  /**
   * Log an info message
   * @param {String} message - The message to log
   * @param {Object} data - Optional data to log
   */
  info(message, data = null) {
    if (this.currentLevel <= this.LEVELS.INFO) {
      console.info(`%c[INFO] ${message}`, 'color: #2196F3; font-weight: bold;', data || '');
    }
  },
  
  /**
   * Log a warning message
   * @param {String} message - The message to log
   * @param {Object} data - Optional data to log
   */
  warn(message, data = null) {
    if (this.currentLevel <= this.LEVELS.WARN) {
      console.warn(`%c[WARN] ${message}`, 'color: #FF9800; font-weight: bold;', data || '');
    }
  },
  
  /**
   * Log an error message
   * @param {String} message - The message to log
   * @param {Object} error - The error object or data
   */
  error(message, error = null) {
    if (this.currentLevel <= this.LEVELS.ERROR) {
      console.error(`%c[ERROR] ${message}`, 'color: #F44336; font-weight: bold;', error || '');
    }
  },
  
  /**
   * Log an API response with MediaWiki-specific handling
   * @param {String} endpoint - The API endpoint
   * @param {Object} response - The response data
   * @param {String} status - The response status (success, error, cache)
   */
  logApiResponse(endpoint, response, status = 'success') {
    // Create log entry
    const timestamp = new Date().toISOString();
    
    // Handle MediaWiki API specific responses
    let processedResponse = response;
    if (response && typeof response === 'object') {
      // Check for MediaWiki API errors
      if (response.error) {
        status = 'error';
        processedResponse = {
          error: {
            code: response.error.code,
            info: response.error.info
          },
          originalResponse: this._safeClone(response)
        };
      }
      
      // Check for warnings
      if (response.warnings) {
        processedResponse = {
          ...this._safeClone(response),
          _hasWarnings: true
        };
        
        // Log warnings separately
        this.warn(`API ${endpoint} returned warnings:`, response.warnings);
      }
      
      // Extract MediaWiki query/parse results into a more manageable format
      if (response.query) {
        processedResponse = {
          ...this._safeClone(response),
          _queryData: {
            found: response.query.pages ? response.query.pages.length : 0,
            hasContinue: !!response.continue
          }
        };
      }
    }
    
    const logEntry = {
      timestamp,
      endpoint,
      status,
      response: this._safeClone(processedResponse),
    };
    
    // Add to stored responses with limit
    this.apiResponses.unshift(logEntry);
    if (this.apiResponses.length > this.maxStoredResponses) {
      this.apiResponses.pop();
    }
    
    // Log to console if debug level
    if (this.currentLevel <= this.LEVELS.DEBUG) {
      let colorStyle = status === 'success' ? 'color: #4CAF50' : 
                       status === 'cache' ? 'color: #2196F3' : 'color: #F44336';
                       
      if (response && response.warnings) {
        colorStyle = 'color: #FF9800'; // Warnings in orange
      }
      
      console.groupCollapsed(`%c[API] ${endpoint} (${status})`, `${colorStyle}; font-weight: bold;`);
      console.log('Timestamp:', timestamp);
      
      if (response && response.requestParams) {
        console.log('Request Parameters:', response.requestParams);
      }
      
      console.log('Response:', response);
      console.groupEnd();
    }
    
    return logEntry;
  },
  
  /**
   * Get all stored API response logs filtered by type
   * @param {String} type - Optional filter by status type (success, error, cache)
   * @returns {Array} The stored API response logs
   */
  getApiLogs(type = null) {
    if (!type) {
      return this.apiResponses;
    }
    
    return this.apiResponses.filter(log => log.status === type);
  },
  
  /**
   * Clear all stored API response logs
   */
  clearApiLogs() {
    this.apiResponses = [];
    this.info('API logs cleared');
  },
  
  /**
   * Create a safe clone of data for logging (handles circular references)
   * @param {Object} data - The data to clone
   * @returns {Object} A safe clone of the data
   * @private
   */
  _safeClone(data) {
    try {
      if (!data) return data;
      
      // Use a WeakSet to keep track of objects we've seen
      const seen = new WeakSet();
      
      return JSON.parse(JSON.stringify(data, (key, value) => {
        // Handle circular references
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular Reference]';
          }
          seen.add(value);
        }
        
        // Truncate large strings
        if (typeof value === 'string' && value.length > 1000) {
          return value.substring(0, 1000) + '... [truncated]';
        }
        
        return value;
      }));
    } catch (err) {
      return {
        error: 'Unable to serialize response',
        reason: err.message
      };
    }
  }
};

// Expose globally for console access
window.Logger = Logger;

export default Logger;
