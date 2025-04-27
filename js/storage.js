/**
 * Module for handling local storage of ClinVar data using IndexedDB
 */

// Database constants
const DB_NAME = 'dna-analysis-db';
const DB_VERSION = 1;
const CLINVAR_STORE = 'clinvar-data';

// Initialize the database
export async function setupIndexedDB() {
  return new Promise((resolve, reject) => {
    // Open the database
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    // Handle database upgrade (first time or version change)
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create the object store for ClinVar data if it doesn't exist
      if (!db.objectStoreNames.contains(CLINVAR_STORE)) {
        db.createObjectStore(CLINVAR_STORE, { keyPath: 'id' });
        console.log('ClinVar object store created');
      }
    };
    
    // Success handler
    request.onsuccess = (event) => {
      console.log('IndexedDB setup successful');
      resolve();
    };
    
    // Error handler
    request.onerror = (event) => {
      console.error('IndexedDB setup error:', event.target.error);
      reject(new Error('Failed to setup IndexedDB'));
    };
  });
}

/**
 * Store ClinVar data in IndexedDB
 * @param {Object} clinVarData - The ClinVar data to cache
 * @returns {Promise<void>}
 */
export async function cacheClinVarData(clinVarData) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction([CLINVAR_STORE], 'readwrite');
      const store = transaction.objectStore(CLINVAR_STORE);
      
      // Store the data with a timestamp and unique ID
      const dataToStore = {
        id: 'clinvar-latest',
        data: clinVarData,
        timestamp: Date.now()
      };
      
      // Put the data in the store (will update if ID already exists)
      const putRequest = store.put(dataToStore);
      
      putRequest.onsuccess = () => {
        console.log('ClinVar data cached successfully');
        resolve();
      };
      
      putRequest.onerror = (event) => {
        console.error('Error caching ClinVar data:', event.target.error);
        reject(new Error('Failed to cache ClinVar data'));
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    };
    
    request.onerror = (event) => {
      console.error('Error opening database:', event.target.error);
      reject(new Error('Failed to open database'));
    };
  });
}

/**
 * Retrieve cached ClinVar data from IndexedDB
 * @returns {Promise<Object|null>} - The cached ClinVar data or null if not found
 */
export async function getCachedClinVarData() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction([CLINVAR_STORE], 'readonly');
      const store = transaction.objectStore(CLINVAR_STORE);
      
      // Get the latest ClinVar data
      const getRequest = store.get('clinvar-latest');
      
      getRequest.onsuccess = () => {
        const result = getRequest.result;
        
        if (result) {
          // Check if the data is still valid (less than 7 days old)
          const ageInDays = (Date.now() - result.timestamp) / (1000 * 60 * 60 * 24);
          if (ageInDays < 7) {
            console.log('Using cached ClinVar data');
            resolve(result.data);
          } else {
            console.log('Cached ClinVar data expired');
            resolve(null);
          }
        } else {
          console.log('No cached ClinVar data found');
          resolve(null);
        }
      };
      
      getRequest.onerror = (event) => {
        console.error('Error retrieving ClinVar data:', event.target.error);
        reject(new Error('Failed to retrieve cached ClinVar data'));
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    };
    
    request.onerror = (event) => {
      console.error('Error opening database:', event.target.error);
      reject(new Error('Failed to open database'));
    };
  });
}

/**
 * Clear all cached ClinVar data
 * @returns {Promise<void>}
 */
export async function clearCachedClinVarData() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction([CLINVAR_STORE], 'readwrite');
      const store = transaction.objectStore(CLINVAR_STORE);
      
      // Clear all data from the store
      const clearRequest = store.clear();
      
      clearRequest.onsuccess = () => {
        console.log('ClinVar cache cleared successfully');
        resolve();
      };
      
      clearRequest.onerror = (event) => {
        console.error('Error clearing ClinVar cache:', event.target.error);
        reject(new Error('Failed to clear ClinVar cache'));
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    };
    
    request.onerror = (event) => {
      console.error('Error opening database:', event.target.error);
      reject(new Error('Failed to open database'));
    };
  });
}

/**
 * Get the size of the cached ClinVar data
 * @returns {Promise<number>} - Size in bytes
 */
export async function getCacheSize() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction([CLINVAR_STORE], 'readonly');
      const store = transaction.objectStore(CLINVAR_STORE);
      
      // Get the latest ClinVar data
      const getRequest = store.get('clinvar-latest');
      
      getRequest.onsuccess = () => {
        const result = getRequest.result;
        
        if (result) {
          // Estimate the size of the data
          const jsonString = JSON.stringify(result.data);
          const size = new Blob([jsonString]).size;
          resolve(size);
        } else {
          resolve(0);
        }
      };
      
      getRequest.onerror = (event) => {
        console.error('Error retrieving cache size:', event.target.error);
        reject(new Error('Failed to get cache size'));
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    };
    
    request.onerror = (event) => {
      console.error('Error opening database:', event.target.error);
      reject(new Error('Failed to open database'));
    };
  });
}
