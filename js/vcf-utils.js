/**
 * VCF Utilities
 * 
 * Provides utility functions for working with VCF (Variant Call Format) files.
 * Implements data validation and parsing according to the VCF v4.3 specification.
 * 
 * Dependencies:
 * - None (standalone utility module)
 */

/**
 * Constants used throughout the VCF utilities
 */
const VCF_CONSTANTS = {
  // Regular expressions for validation according to spec
  REGEX: {
    INFO_FORMAT_KEY: /^([A-Za-z][0-9A-Za-z.]*|1000G)$/, // Section 1.6.1 - INFO keys
    FORMAT_KEY: /^[A-Za-z][0-9A-Za-z.]*$/,              // Section 1.6.2 - FORMAT keys
    CONTIG_NAME: /^[0-9A-Za-z!#$%&+./:;?@^_|~-][0-9A-Za-z!#$%&*+./:;=?@^_|~-]*$/,  // Section 1.4.7
    ALT_FIELD: /^([ACGTNacgtn]+|\*|\.)$/,               // Section 1.6.1 - ALT field
  },
  // Special character encoding mappings (Section 1.2)
  PERCENT_ENCODING: {
    ':': '%3A',  // colon
    ';': '%3B',  // semicolon
    '=': '%3D',  // equal sign
    '%': '%25',  // percent sign
    ',': '%2C',  // comma
    '\r': '%0D', // CR
    '\n': '%0A', // LF
    '\t': '%09'  // TAB
  },
  // Missing value representation
  MISSING_VALUE: '.',
  // Reserved symbolic alleles
  SYMBOLIC_ALLELES: ['DEL', 'INS', 'DUP', 'INV', 'CNV', 'BND']
};

/**
 * Validates if a string is a valid INFO or FORMAT field key
 * @param {string} key - The key to validate
 * @returns {boolean} - Whether the key is valid
 */
function isValidInfoFormatKey(key) {
  return VCF_CONSTANTS.REGEX.INFO_FORMAT_KEY.test(key);
}

/**
 * Validates if a string is a valid contig name according to the spec (Section 1.4.7)
 * @param {string} name - The contig name to validate
 * @returns {boolean} - Whether the name is valid
 */
function isValidContigName(name) {
  // Check for disallowed characters: '\ , "'' () {} <>'
  if (/[\\,"'(){}<>]/.test(name)) {
    return false;
  }
  
  // Check that it doesn't start with '*' or '='
  if (/^[*=]/.test(name)) {
    return false;
  }
  
  // Check against the regex pattern from the spec
  return VCF_CONSTANTS.REGEX.CONTIG_NAME.test(name);
}

/**
 * Encodes special characters in VCF fields according to Section 1.2
 * @param {string} value - The string to encode
 * @returns {string} - The encoded string
 */
function encodeSpecialChars(value) {
  if (!value) return value;
  
  let result = value;
  
  // Encode % first to avoid double-encoding
  if (result.includes('%')) {
    result = result.replace(/%/g, VCF_CONSTANTS.PERCENT_ENCODING['%']);
  }
  
  // Encode other special characters
  for (const [char, encoded] of Object.entries(VCF_CONSTANTS.PERCENT_ENCODING)) {
    if (char !== '%' && result.includes(char)) {
      result = result.replace(new RegExp(char, 'g'), encoded);
    }
  }
  
  return result;
}

/**
 * Decodes percent-encoded special characters in VCF fields
 * @param {string} value - The string to decode
 * @returns {string} - The decoded string
 */
function decodeSpecialChars(value) {
  if (!value) return value;
  
  let result = value;
  
  // Create a reverse mapping for decoding
  const decodeMap = {};
  for (const [char, encoded] of Object.entries(VCF_CONSTANTS.PERCENT_ENCODING)) {
    decodeMap[encoded] = char;
  }
  
  // Replace all encoded sequences
  for (const [encoded, char] of Object.entries(decodeMap)) {
    result = result.replace(new RegExp(encoded, 'g'), char);
  }
  
  return result;
}

/**
 * Parses INFO field string into a structured object
 * @param {string} infoStr - The INFO field string from VCF
 * @returns {Object} - Structured info object
 */
function parseInfoField(infoStr) {
  // Handle missing value case
  if (!infoStr || infoStr === '.') return {};
  
  const result = {};
  const fields = infoStr.split(';');
  
  for (const field of fields) {
    if (field.includes('=')) {
      // Key-value field
      const [key, value] = field.split('=', 2);
      
      if (isValidInfoFormatKey(key)) {
        // Handle comma-separated values (arrays)
        if (value.includes(',')) {
          result[key] = value.split(',').map(v => decodeSpecialChars(v));
        } else {
          result[key] = decodeSpecialChars(value);
        }
      } else {
        console.warn(`Invalid INFO field key: ${key}`);
      }
    } else {
      // Flag field (no value)
      if (isValidInfoFormatKey(field)) {
        result[field] = true;
      } else {
        console.warn(`Invalid INFO flag field: ${field}`);
      }
    }
  }
  
  return result;
}

/**
 * Serializes an info object back to VCF format
 * @param {Object} infoObj - The info object to serialize
 * @returns {string} - The serialized INFO field
 */
function serializeInfoField(infoObj) {
  if (!infoObj || Object.keys(infoObj).length === 0) {
    return '.';
  }
  
  const parts = [];
  
  for (const [key, value] of Object.entries(infoObj)) {
    if (value === true) {
      // Flag field
      parts.push(key);
    } else if (Array.isArray(value)) {
      // Array field
      const encodedValues = value.map(v => encodeSpecialChars(String(v)));
      parts.push(`${key}=${encodedValues.join(',')}`);
    } else {
      // Single value field
      parts.push(`${key}=${encodeSpecialChars(String(value))}`);
    }
  }
  
  return parts.join(';');
}

/**
 * Parses a VCF line into a structured object
 * @param {string} line - The VCF data line
 * @param {Array} headerSamples - Sample IDs from the header
 * @returns {Object|null} - Parsed VCF record or null if invalid
 */
function parseVcfLine(line, headerSamples = []) {
  if (!line || line.startsWith('#')) return null;
  
  const fields = line.split('\t');
  if (fields.length < 8) return null; // Minimum 8 columns required
  
  const [chrom, posStr, id, ref, alt, qual, filter, info, ...rest] = fields;
  
  // Parse position as integer
  const pos = parseInt(posStr, 10);
  
  // Create the basic record
  const record = {
    chrom: chrom,
    pos: pos,
    id: id === '.' ? null : id,
    ref: ref,
    alt: alt === '.' ? null : alt,
    qual: qual === '.' ? null : parseFloat(qual),
    filter: filter === '.' ? null : filter.split(';'),
    info: parseInfoField(info)
  };
  
  // Handle format and samples if present
  if (rest.length > 0 && headerSamples.length > 0) {
    const format = rest[0];
    const formatFields = format.split(':');
    
    record.samples = {};
    
    // Process each sample
    for (let i = 1; i < rest.length && i-1 < headerSamples.length; i++) {
      const sampleName = headerSamples[i-1];
      const sampleValues = rest[i].split(':');
      record.samples[sampleName] = {};
      
      // Map format fields to values
      for (let j = 0; j < formatFields.length; j++) {
        if (j < sampleValues.length) {
          const key = formatFields[j];
          const value = sampleValues[j];
          
          // Handle special cases
          if (key === 'GT') {
            record.samples[sampleName][key] = value; // Keep GT as is
          } else if (value === '.') {
            record.samples[sampleName][key] = null; // Missing value
          } else if (value.includes(',')) {
            // Array values
            record.samples[sampleName][key] = value.split(',').map(v => 
              v === '.' ? null : v);
          } else {
            record.samples[sampleName][key] = value;
          }
        }
      }
    }
  }
  
  return record;
}

/**
 * Serializes a VCF record object back to a VCF line
 * @param {Object} record - The VCF record object
 * @returns {string} - The serialized VCF line
 */
function serializeVcfLine(record) {
  if (!record) return null;
  
  // Build the required fields
  const fields = [
    record.chrom,
    record.pos.toString(),
    record.id || '.',
    record.ref,
    record.alt || '.',
    record.qual !== null && record.qual !== undefined ? record.qual.toString() : '.',
    record.filter ? record.filter.join(';') : '.',
    serializeInfoField(record.info)
  ];
  
  // Add FORMAT and sample fields if present
  if (record.samples) {
    const sampleNames = Object.keys(record.samples);
    
    if (sampleNames.length > 0) {
      // Get all format keys
      const formatKeys = new Set();
      for (const sample of Object.values(record.samples)) {
        Object.keys(sample).forEach(key => formatKeys.add(key));
      }
      
      // Ensure GT is first if present
      const formatKeysArray = Array.from(formatKeys);
      if (formatKeysArray.includes('GT')) {
        formatKeysArray.splice(formatKeysArray.indexOf('GT'), 1);
        formatKeysArray.unshift('GT');
      }
      
      // Add FORMAT column
      fields.push(formatKeysArray.join(':'));
      
      // Add each sample
      for (const sampleName of sampleNames) {
        const sampleValues = formatKeysArray.map(key => {
          const value = record.samples[sampleName][key];
          
          if (value === null || value === undefined) {
            return '.';
          } else if (Array.isArray(value)) {
            return value.map(v => v === null ? '.' : v).join(',');
          } else {
            return value;
          }
        });
        
        fields.push(sampleValues.join(':'));
      }
    }
  }
  
  return fields.join('\t');
}

/**
 * Validates a VCF record according to the specification
 * @param {Object} record - The record to validate
 * @returns {Object} - Validation result with isValid flag and error messages
 */
function validateVcfRecord(record) {
  const errors = [];
  
  // Check required fields
  if (!record.chrom) errors.push('Missing CHROM field');
  if (!record.pos) errors.push('Missing POS field');
  if (!record.ref) errors.push('Missing REF field');
  
  // Validate CHROM
  if (record.chrom && !isValidContigName(record.chrom)) {
    errors.push(`Invalid contig name: ${record.chrom}`);
  }
  
  // Validate POS (must be positive integer)
  if (record.pos !== undefined && (isNaN(record.pos) || record.pos < 1)) {
    errors.push(`Invalid POS value: ${record.pos}, must be a positive integer`);
  }
  
  // Validate REF (must be A, C, G, T, N bases)
  if (record.ref && !/^[ACGTNacgtn]+$/.test(record.ref)) {
    errors.push(`Invalid REF value: ${record.ref}, must contain only A, C, G, T, N bases`);
  }
  
  // Validate ALT
  if (record.alt && record.alt !== '.') {
    const alts = record.alt.split(',');
    for (const alt of alts) {
      // Per spec section 1.6.1: must be one of: bases, * (missing), . (no variant), or symbolic <ID>
      if (!/^([ACGTNacgtn]+|\*|\.|<[^>]+>)$/.test(alt)) {
        errors.push(`Invalid ALT value: ${alt}`);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

/**
 * Extracts header information from VCF header lines
 * @param {Array<string>} headerLines - VCF header lines
 * @returns {Object} - Parsed header information
 */
function parseVcfHeader(headerLines) {
  const header = {
    fileFormat: null,
    contigs: [],
    infos: {},
    formats: {},
    filters: {},
    alts: {},
    samples: []
  };
  
  for (const line of headerLines) {
    if (line.startsWith('##fileformat=')) {
      header.fileFormat = line.substring(12).trim();
    } else if (line.startsWith('##INFO=')) {
      const info = parseHeaderStructure(line.substring(7));
      if (info && info.ID) {
        header.infos[info.ID] = info;
      }
    } else if (line.startsWith('##FORMAT=')) {
      const format = parseHeaderStructure(line.substring(9));
      if (format && format.ID) {
        header.formats[format.ID] = format;
      }
    } else if (line.startsWith('##FILTER=')) {
      const filter = parseHeaderStructure(line.substring(9));
      if (filter && filter.ID) {
        header.filters[filter.ID] = filter;
      }
    } else if (line.startsWith('##contig=')) {
      const contig = parseHeaderStructure(line.substring(9));
      if (contig && contig.ID) {
        header.contigs.push(contig);
      }
    } else if (line.startsWith('##ALT=')) {
      const alt = parseHeaderStructure(line.substring(6));
      if (alt && alt.ID) {
        header.alts[alt.ID] = alt;
      }
    } else if (line.startsWith('#CHROM')) {
      // Parse the sample names from the header line
      const parts = line.split('\t');
      if (parts.length > 9) { // If there are samples
        header.samples = parts.slice(9);
      }
    }
  }
  
  return header;
}

/**
 * Parse a structured header line like ##INFO=<ID=AC,Number=A,Type=Integer,Description="Allele count">
 * @param {string} structuredLine - The structured header line content
 * @returns {Object|null} - Parsed structure or null if invalid
 */
function parseHeaderStructure(structuredLine) {
  // Check if it's a structured line (enclosed in <>)
  if (!structuredLine.startsWith('<') || !structuredLine.endsWith('>')) {
    return null;
  }
  
  // Remove the enclosing <>
  const content = structuredLine.substring(1, structuredLine.length - 1);
  
  // Parse the key-value pairs
  const result = {};
  let currentKey = '';
  let currentValue = '';
  let inQuotes = false;
  let escapeNext = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    
    if (escapeNext) {
      currentValue += char;
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    
    if (char === '=' && !inQuotes && currentValue === '') {
      currentKey = currentValue.trim();
      currentValue = '';
      continue;
    }
    
    if (char === ',' && !inQuotes) {
      result[currentKey] = currentValue;
      currentKey = '';
      currentValue = '';
      continue;
    }
    
    currentValue += char;
  }
  
  // Add the last key-value pair
  if (currentKey && currentValue) {
    result[currentKey] = currentValue;
  }
  
  return result;
}

// Expose the functions for use in other modules
self.VcfUtils = {
  constants: VCF_CONSTANTS,
  isValidInfoFormatKey,
  isValidContigName,
  encodeSpecialChars,
  decodeSpecialChars,
  parseInfoField,
  serializeInfoField,
  parseVcfLine,
  serializeVcfLine,
  validateVcfRecord,
  parseVcfHeader,
  parseHeaderStructure
};
