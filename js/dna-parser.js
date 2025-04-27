/**
 * Decompresses a DNA data file using the pako or JSZip library
 * @param {File} file - The compressed DNA data file (.zip or .gz)
 * @param {Function} progressCallback - Callback for reporting progress
 * @returns {Promise<string>} - The decompressed file contents
 */
export async function decompressFile(file, progressCallback = null) {
  return new Promise((resolve, reject) => {
    try {
      const fileReader = new FileReader();
      
      fileReader.onprogress = (event) => {
        if (progressCallback && event.lengthComputable) {
          const progress = (event.loaded / event.total) * 50; // First half of progress
          progressCallback(progress);
        }
      };
      
      fileReader.onload = async (event) => {
        try {
          const compressedData = new Uint8Array(event.target.result);
          console.log(`File size: ${compressedData.length} bytes`);
          
          // Check if we're dealing with a gzip file
          if (file.name.endsWith('.gz') || 
              (compressedData[0] === 0x1F && compressedData[1] === 0x8B)) {
            console.log('Detected gzip format, decompressing...');
            try {
              // Use pako to inflate (decompress) gzip data
              const decompressedData = pako.inflate(compressedData, { to: 'string' });
              console.log(`Decompressed size: ${decompressedData.length} bytes`);
              progressCallback?.(100);
              resolve(decompressedData);
            } catch (gzipError) {
              console.error('Error decompressing gzip data:', gzipError);
              reject(new Error(`Gzip decompression error: ${gzipError.message}`));
            }
          } 
          // Check if we're dealing with a zip file
          else if (file.name.endsWith('.zip')) {
            console.log('Detected zip format, decompressing...');
            try {
              // Use JSZip to handle zip files
              const zip = new JSZip();
              
              // Load the zip file content
              const zipFile = await zip.loadAsync(compressedData);
              
              // Find the first file in the zip archive (assuming it's the DNA data)
              const fileNames = Object.keys(zipFile.files);
              
              if (fileNames.length === 0) {
                reject(new Error('The ZIP file is empty or corrupted.'));
                return;
              }
              
              console.log(`ZIP contains ${fileNames.length} files: ${fileNames.join(', ')}`);
              
              // Try to find CSV, TSV, or TXT files in preferred order
              const dnaFileExtensions = ['.csv', '.txt', '.tsv'];
              let targetFileName = null;
              
              // First, try to find files with DNA data indicators in the name
              const dnaKeywords = ['dna', 'genome', 'genetic', 'genotype', 'raw', 'myheritage'];
              for (const ext of dnaFileExtensions) {
                for (const keyword of dnaKeywords) {
                  const matches = fileNames.filter(name => 
                    name.toLowerCase().includes(keyword) && name.toLowerCase().endsWith(ext));
                  if (matches.length > 0) {
                    targetFileName = matches[0];
                    break;
                  }
                }
                if (targetFileName) break;
              }
              
              // If no keyword match, just look for the first file with the right extension
              if (!targetFileName) {
                for (const ext of dnaFileExtensions) {
                  const matches = fileNames.filter(name => name.toLowerCase().endsWith(ext));
                  if (matches.length > 0) {
                    targetFileName = matches[0];
                    break;
                  }
                }
              }
              
              // If still no match, just use the first file
              if (!targetFileName) {
                targetFileName = fileNames[0];
              }
              
              console.log(`Selected file from archive: ${targetFileName}`);
              
              const fileData = zipFile.files[targetFileName];
              
              if (fileData.dir) {
                reject(new Error('Found a directory instead of a file in the ZIP archive.'));
                return;
              }
              
              // Extract the content as text
              const decompressedData = await fileData.async('string');
              console.log(`Decompressed size: ${decompressedData.length} bytes`);
              progressCallback?.(100);
              resolve(decompressedData);
            } catch (zipError) {
              console.error('Error processing ZIP file:', zipError);
              reject(new Error(`ZIP decompression error: ${zipError.message}`));
            }
          } 
          // If it's not compressed, assume it's plain text
          else {
            console.log('File does not appear to be compressed, treating as text');
            const textDecoder = new TextDecoder();
            const plainText = textDecoder.decode(compressedData);
            console.log(`Text size: ${plainText.length} bytes`);
            progressCallback?.(100);
            resolve(plainText);
          }
        } catch (error) {
          reject(new Error(`Decompression error: ${error.message}`));
        }
      };
      
      fileReader.onerror = () => {
        reject(new Error('Failed to read the file'));
      };
      
      fileReader.readAsArrayBuffer(file);
    } catch (error) {
      reject(new Error(`File reading error: ${error.message}`));
    }
  });
}

/**
 * Parses a decompressed genotype file into structured data
 * @param {string} data - The decompressed file contents
 * @param {Function} progressCallback - Callback for reporting progress
 * @returns {Promise<Array>} - Array of parsed genotype records
 */
export async function parseGenotypeFile(data, progressCallback = null) {
  return new Promise((resolve, reject) => {
    try {
      // Split the file into lines
      const lines = data.split(/\r?\n/);
      const totalLines = lines.length;
      console.log(`Total lines in file: ${totalLines}`);
      
      // Sample the first few lines to better understand the format
      const sampleLines = lines.slice(0, Math.min(20, totalLines));
      console.log("Sample lines:", sampleLines);
      
      const records = [];
      let lineErrors = 0;
      let headerLine = null;
      let headerFields = [];
      let rsidCol = -1, chromosomeCol = -1, positionCol = -1, genotypeCol = -1;
      
      // Process in chunks for better UI responsiveness
      const chunkSize = 1000;
      let currentLine = 0;
      
      // Try different delimiters commonly used in DNA files
      const possibleDelimiters = ['\t', ',', ';', ' '];
      let mostLikelyDelimiter = '\t'; // Default to tab
      let maxConsistentColumns = 0;
      
      // Determine the most consistent delimiter by analyzing column counts
      for (const delimiter of possibleDelimiters) {
        const columnCounts = {};
        
        for (let i = 0; i < Math.min(50, totalLines); i++) {
          const line = lines[i].trim();
          if (!line || line.startsWith('#')) continue;
          
          const columnCount = line.split(delimiter).length;
          columnCounts[columnCount] = (columnCounts[columnCount] || 0) + 1;
        }
        
        // Find the most common column count for this delimiter
        let maxCount = 0;
        let mostCommonColumnCount = 0;
        
        for (const [columnCount, count] of Object.entries(columnCounts)) {
          if (count > maxCount) {
            maxCount = count;
            mostCommonColumnCount = parseInt(columnCount);
          }
        }
        
        // If this delimiter gives us more consistent columns and at least 3 columns
        // (which is minimum needed for rsID, position, genotype)
        if (maxCount > maxConsistentColumns && mostCommonColumnCount >= 3) {
          maxConsistentColumns = maxCount;
          mostLikelyDelimiter = delimiter;
        }
      }
      
      console.log(`Detected delimiter: "${mostLikelyDelimiter === '\t' ? 'tab' : mostLikelyDelimiter}" with ${maxConsistentColumns} consistent lines`);
      
      // Find header line and detect column positions
      for (let i = 0; i < Math.min(50, totalLines); i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('#')) continue;
        
        const fields = line.split(mostLikelyDelimiter);
        
        // Skip lines with inconsistent number of columns
        if (fields.length < 3) continue;
        
        // Try to identify column headers - check for common MyHeritage column names
        // Headers might be: RSID, Chromosome, Position, Genotype
        // Or: rsid, chromosome, position, result
        // Or: SNP, CHR, POS, RESULT, etc.
        const lowerFields = fields.map(f => f.toLowerCase().trim());
        
        // Check for typical header patterns
        let foundRsid = false;
        let foundChromosome = false;
        let foundPosition = false;
        let foundGenotype = false;
        
        for (let j = 0; j < lowerFields.length; j++) {
          const field = lowerFields[j];
          if (field === 'rsid' || field === 'snp' || field === 'rs#' || field === 'rs_id' || field === 'id') {
            rsidCol = j;
            foundRsid = true;
          } else if (field === 'chromosome' || field === 'chrom' || field === 'chr') {
            chromosomeCol = j;
            foundChromosome = true;
          } else if (field === 'position' || field === 'pos' || field === 'bp' || field === 'location') {
            positionCol = j;
            foundPosition = true;
          } else if (field === 'genotype' || field === 'result' || field === 'allele' || field === 'alleles' || field === 'call' || field === 'variant') {
            genotypeCol = j;
            foundGenotype = true;
          }
        }
        
        // If we found enough columns to identify this as a header row
        if ((foundRsid && foundGenotype) || (foundRsid && foundChromosome && foundPosition)) {
          headerLine = i;
          headerFields = fields;
          // Skip the header in data processing
          currentLine = headerLine + 1;
          break;
        }
      }
      
      // If we couldn't identify a header, let's try heuristics based on the data itself
      if (headerLine === null) {
        console.log("No explicit header detected, trying to infer column positions from data");
        
        // Sample a few data lines to check for patterns that match rsIDs, chromosomes, etc.
        let rsidPattern = /^rs\d+$/;  // e.g., rs123456
        let chromPattern = /^(chr)?(1?[0-9]|2[0-2]|X|Y|MT?)$/i;  // e.g., 1, chr1, X, chrX
        let posPattern = /^\d+$/;  // e.g., 123456
        let genoPattern = /^[ACGT-]{1,2}$/i;  // e.g., AA, AG, --, A
        
        let colMatches = new Array(Math.min(10, fields.length)).fill(0).map(() => ({
          rsid: 0,
          chrom: 0,
          pos: 0,
          geno: 0
        }));
        
        // Check sample lines to see which columns match our patterns
        for (let i = 0; i < Math.min(30, totalLines); i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const fields = line.split(mostLikelyDelimiter);
          if (fields.length < 3) continue;
          
          for (let j = 0; j < Math.min(fields.length, colMatches.length); j++) {
            const field = fields[j].trim();
            if (rsidPattern.test(field)) colMatches[j].rsid++;
            if (chromPattern.test(field)) colMatches[j].chrom++;
            if (posPattern.test(field)) colMatches[j].pos++;
            if (genoPattern.test(field)) colMatches[j].geno++;
          }
        }
        
        // Find the most likely column for each type of data
        let bestRsid = 0, bestChrom = 0, bestPos = 0, bestGeno = 0;
        
        for (let j = 0; j < colMatches.length; j++) {
          if (colMatches[j].rsid > colMatches[bestRsid].rsid) bestRsid = j;
          if (colMatches[j].chrom > colMatches[bestChrom].chrom) bestChrom = j;
          if (colMatches[j].pos > colMatches[bestPos].pos) bestPos = j;
          if (colMatches[j].geno > colMatches[bestGeno].geno) bestGeno = j;
        }
        
        // Only assign if we found a decent match
        if (colMatches[bestRsid].rsid > 5) rsidCol = bestRsid;
        if (colMatches[bestChrom].chrom > 5) chromosomeCol = bestChrom;
        if (colMatches[bestPos].pos > 5) positionCol = bestPos;
        if (colMatches[bestGeno].geno > 5) genotypeCol = bestGeno;
        
        // If we still couldn't detect the columns, default to standard positions
        if (rsidCol === -1) rsidCol = 0;
        if (chromosomeCol === -1) chromosomeCol = 1;
        if (positionCol === -1) positionCol = 2;
        if (genotypeCol === -1) genotypeCol = 3;
        
        // Start from first line since we have no header
        currentLine = 0;
      }
      
      console.log(`Detected columns - RSID: ${rsidCol}, Chromosome: ${chromosomeCol}, Position: ${positionCol}, Genotype: ${genotypeCol}`);
      
      function processChunk() {
        const endLine = Math.min(currentLine + chunkSize, totalLines);
        let validRecordsInChunk = 0;
        
        for (let i = currentLine; i < endLine; i++) {
          const line = lines[i] ? lines[i].trim() : '';
          
          // Skip empty lines, comments and potential headers if we're restarting from 0
          if (!line || line.startsWith('#') || (i === 0 && (line.toLowerCase().includes('rsid') || line.toLowerCase().includes('chromosome')))) {
            continue;
          }
          
          try {
            // Split by the detected delimiter
            const fields = line.split(mostLikelyDelimiter);
            
            // Skip lines that are too short - but be flexible about which columns we require
            if (fields.length < 2) {
              lineErrors++;
              continue;
            }
            
            // Try to extract essential fields - being very flexible about what we accept
            const recordData = {};
            
            // Extract fields based on detected column positions
            if (rsidCol >= 0 && rsidCol < fields.length) {
              recordData.rsID = fields[rsidCol].trim();
            }
            
            if (chromosomeCol >= 0 && chromosomeCol < fields.length) {
              recordData.chrom = fields[chromosomeCol].trim();
              // Clean up chromosome format (remove 'chr' prefix if present)
              if (recordData.chrom) {
                recordData.chrom = recordData.chrom.replace(/^chr/i, '');
              }
            }
            
            if (positionCol >= 0 && positionCol < fields.length) {
              const posStr = fields[positionCol].trim();
              const position = parseInt(posStr, 10);
              if (!isNaN(position)) {
                recordData.pos = position;
              }
            }
            
            if (genotypeCol >= 0 && genotypeCol < fields.length) {
              recordData.genotype = fields[genotypeCol].trim();
            }
            
            // For MyHeritage files, sometimes the genotype might be in different columns
            if (!recordData.genotype && fields.length > genotypeCol + 1) {
              // Try next column as genotype
              recordData.genotype = fields[genotypeCol + 1].trim();
            }
            
            // Validate that we have enough data
            // Require at least a genotype and one of: rsID, chromosome+position
            if ((recordData.rsID || (recordData.chrom && recordData.pos)) && recordData.genotype) {
              // Valid record found
              records.push(recordData);
              validRecordsInChunk++;
            } else {
              lineErrors++;
            }
          } catch (error) {
            console.error(`Error parsing line ${i}: ${lines[i]}`, error);
            lineErrors++;
          }
        }
        
        // Update progress
        if (progressCallback) {
          const progress = (endLine / totalLines) * 100;
          progressCallback(progress, endLine, totalLines);
        }
        
        currentLine = endLine;
        
        if (currentLine < totalLines) {
          // Process next chunk
          setTimeout(processChunk, 0);
        } else {
          // All chunks processed
          if (records.length === 0) {
            console.error("No valid records found. File format may not be supported.");
            console.log("Headers detected:", headerFields);
            console.log("Lines with errors:", lineErrors);
            reject(new Error('No valid genotype records found in the file'));
            return;
          }
          
          if (lineErrors > 0) {
            console.warn(`Skipped ${lineErrors} malformed lines during parsing`);
          }
          
          console.log(`Successfully parsed ${records.length} genotype records`);
          resolve(records);
        }
      }
      
      // Start processing
      processChunk();
    } catch (error) {
      console.error('Parsing error:', error);
      reject(new Error(`Parsing error: ${error.message}`));
    }
  });
}
