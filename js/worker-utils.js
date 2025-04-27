// Helper functions for web worker management
export function createWorker(scriptPath, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(scriptPath);
      const timeout = setTimeout(() => {
        console.error('Worker initialization timed out - attempting cleanup');
        worker.terminate();
        reject(new Error('Worker initialization timed out'));
      }, options.timeout || 30000);

      worker.onmessage = (e) => {
        if (e.data.type === 'ready') {
          clearTimeout(timeout);
          resolve(worker);
        } else if (e.data.type === 'error') {
          clearTimeout(timeout);
          console.error('Worker initialization error:', e.data.error);
          worker.terminate();
          reject(new Error(e.data.error));
        }
      };

      worker.onerror = (error) => {
        clearTimeout(timeout);
        console.error('Worker script error:', error);
        worker.terminate();
        reject(error);
      };
    } catch (error) {
      console.error('Failed to create worker:', error);
      reject(error);
    }
  });
}

// Enhanced worker message function that uses transferable objects when possible
export function sendWorkerMessage(worker, message) {
  return new Promise((resolve, reject) => {
    const messageId = Math.random().toString(36).substring(2, 15);
    
    const handler = (e) => {
      const response = e.data;
      if (response.messageId === messageId) {
        worker.removeEventListener('message', handler);
        
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      }
    };
    
    worker.addEventListener('message', handler);
    
    try {
      // Check for transferable objects to optimize performance
      const transferables = [];
      
      // Look for ArrayBuffers to transfer
      if (message.buffer && message.buffer instanceof ArrayBuffer) {
        transferables.push(message.buffer);
      }
      
      // Look for arrays with buffers
      if (message.data) {
        if (message.data instanceof Uint8Array || 
            message.data instanceof Int8Array ||
            message.data instanceof Uint16Array ||
            message.data instanceof Int16Array ||
            message.data instanceof Uint32Array ||
            message.data instanceof Int32Array ||
            message.data instanceof Float32Array ||
            message.data instanceof Float64Array) {
          transferables.push(message.data.buffer);
        }
      }
      
      // Send with transferables if we found any
      if (transferables.length > 0) {
        worker.postMessage({
          ...message,
          messageId
        }, transferables);
      } else {
        worker.postMessage({
          ...message,
          messageId
        });
      }
    } catch (error) {
      worker.removeEventListener('message', handler);
      reject(error);
    }
  });
}

// Export the memory management utility
export function cleanupMemory() {
  // Force garbage collection if possible (though not directly controllable in JS)
  if (window.gc) {
    window.gc();
  }
  
  // Clear any temporary caches used by the application
  if (window.caches && window.caches.delete) {
    caches.delete('temp-dna-data').catch(e => console.log('No temp cache to clear'));
  }
  
  // Free up memory from any large arrays stored in window
  if (window.largeDatasets) {
    for (const key in window.largeDatasets) {
      window.largeDatasets[key] = null;
    }
    window.largeDatasets = {};
  }
  
  console.log('Memory cleanup routine executed');
}

// Enhanced worker termination with proper cleanup
export function terminateWorker(worker) {
  if (worker && typeof worker.terminate === 'function') {
    try {
      // Send cleanup message before termination
      worker.postMessage({ type: 'cleanup' });
      // Allow some time for cleanup before termination
      setTimeout(() => {
        worker.terminate();
        console.log('Worker terminated and resources released');
      }, 100);
    } catch (error) {
      console.error('Error terminating worker:', error);
      worker.terminate();
    }
  }
}

// Enhanced memory management for large datasets
export function releaseDataset(datasetRef) {
  if (!datasetRef) return;
  
  if (Array.isArray(datasetRef)) {
    // Clear array contents but keep the reference
    datasetRef.length = 0;
  } else if (datasetRef instanceof Map || datasetRef instanceof Set) {
    datasetRef.clear();
  } else if (typeof datasetRef === 'object') {
    // For objects, remove all properties
    for (const key in datasetRef) {
      if (Object.prototype.hasOwnProperty.call(datasetRef, key)) {
        datasetRef[key] = null;
      }
    }
  }
  
  // Run general cleanup
  cleanupMemory();
}

// Helper to load worker with local library paths
export function getLocalLibraryPath(libraryName) {
  // Convert CDN URL to local path
  if (libraryName.includes('tabix')) {
    if (libraryName.includes('compat')) {
      return './js/lib/tabix-compat.min.js';
    }
    return './js/lib/tabix.umd.min.js';
  }
  // Add more library mappings as needed
  return null;
}
