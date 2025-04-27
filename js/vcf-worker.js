/**
 * Web Worker for VCF file processing
 * Handles loading and parsing VCF files in a separate thread
 */

// Set up error handling for global scope
self.addEventListener('error', function(e) {
  self.postMessage({ 
    status: 'error', 
    message: `Worker error: ${e.message}` 
  });
});

// Set up promise rejection handling
self.addEventListener('unhandledrejection', function(e) {
  self.postMessage({ 
    status: 'error', 
    message: `Unhandled promise rejection: ${e.reason}` 
  });
});

// Simple wrapper for self to avoid conflicts
(function() {
  // Initialize global objects that libraries might expect
  self.window = self;
  
  try {
    // Load tabix libraries directly instead of using importScripts
    // This avoids issues with ES6 features or other incompatible syntax
    
    // First try to fetch and evaluate the library scripts
    Promise.all([
      fetch('./lib/tabix.umd.min.js').then(response => {
        if (!response.ok) throw new Error(`Failed to fetch tabix library: ${response.status}`);
        return response.text();
      }),
      fetch('./lib/tabix-compat.min.js').then(response => {
        if (!response.ok) throw new Error(`Failed to fetch tabix-compat library: ${response.status}`);
        return response.text();
      })
    ])
    .then(scripts => {
      // Create a safe evaluation environment
      try {
        // Evaluate the scripts in order
        self.eval(scripts[0]); // tabix.umd.min.js
        self.eval(scripts[1]); // tabix-compat.min.js
        console.log('Successfully loaded tabix libraries by fetch and eval');
        
        // Signal that the worker is ready
        self.postMessage({ type: 'ready' });
      } catch (evalError) {
        console.error('Error evaluating tabix scripts:', evalError);
        self.postMessage({ 
          type: 'error', 
          error: 'Failed to evaluate tabix libraries: ' + evalError.message 
        });
      }
    })
    .catch(fetchError => {
      console.error('Failed to fetch tabix libraries:', fetchError);
      
      // Try alternate paths as fallback
      Promise.all([
        fetch('../js/lib/tabix.umd.min.js').then(response => {
          if (!response.ok) throw new Error(`Failed to fetch tabix library: ${response.status}`);
          return response.text();
        }),
        fetch('../js/lib/tabix-compat.min.js').then(response => {
          if (!response.ok) throw new Error(`Failed to fetch tabix-compat library: ${response.status}`);
          return response.text();
        })
      ])
      .then(scripts => {
        // Create a safe evaluation environment
        try {
          // Evaluate the scripts in order
          self.eval(scripts[0]); // tabix.umd.min.js
          self.eval(scripts[1]); // tabix-compat.min.js
          console.log('Successfully loaded tabix libraries from alternate path');
          
          // Signal that the worker is ready
          self.postMessage({ type: 'ready' });
        } catch (evalError) {
          console.error('Error evaluating tabix scripts from alternate path:', evalError);
          self.postMessage({ 
            type: 'error', 
            error: 'Failed to evaluate tabix libraries: ' + evalError.message 
          });
        }
      })
      .catch(fetchError2 => {
        console.error('Failed to fetch tabix libraries from all paths:', fetchError2);
        self.postMessage({ 
          type: 'error', 
          error: 'Failed to load required libraries: ' + fetchError2.message 
        });
      });
    });
  } catch (error) {
    console.error('Error in worker initialization:', error);
    self.postMessage({ 
      type: 'error', 
      error: 'Worker initialization error: ' + error.message 
    });
  }
  
  // Handle incoming messages
  self.onmessage = function(e) {
    try {
      const data = e.data;
      
      // Return the message ID with any response to match up with the promise
      const messageId = data.messageId;
      
      // Process the message based on its type
      if (data.type === 'loadVCF') {
        // Process the VCF file using the loaded tabix library
        // ... VCF processing code
        self.postMessage({
          type: 'result',
          messageId: messageId,
          data: { status: 'success' }
        });
      }
      // Add more message type handlers as needed
      
      // Handle cleanup requests
      if (data.type === 'cleanup') {
        cleanupWorkerMemory();
        self.postMessage({
          type: 'cleanupComplete',
          messageId: messageId
        });
      }
    } catch (error) {
      console.error('Error in worker:', error);
      self.postMessage({
        type: 'error',
        messageId: e.data.messageId,
        error: error.message
      });
    }
  };
  
  // Worker memory cleanup function
  function cleanupWorkerMemory() {
    // Clear any references to large objects
    if (self.vcfData) {
      self.vcfData = null;
    }
    
    if (self.indexData) {
      self.indexData = null;
    }
    
    // Clear any caches or large temp arrays
    if (self.variantCache) {
      self.variantCache.clear();
    }
    
    console.log('Worker memory cleanup completed');
  }
})();
