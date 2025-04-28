/**
 * VCF Exporter
 * 
 * This module provides functionality to export data to VCF format
 * according to the VCF v4.3 specification.
 */

const vcfUtils = require('./vcf-utils');

/**
 * Creates a VCF header with proper metadata
 * @param {Object} options - Options for creating the header
 * @param {string} options.version - VCF version (default: 4.3)
 * @param {string} options.source - Source of the VCF file
 * @param {Array<Object>} options.contigs - Contig definitions
 * @param {Object} options.infoFields - INFO field definitions
 * @param {Object} options.formatFields - FORMAT field definitions
 * @param {Array<string>} options.samples - Sample IDs
 * @returns {string} - The VCF header
 */
function createVcfHeader(options) {
  const {
    version = '4.3', 
    source = 'DNA-Analyzer', 
    contigs = [],
    infoFields = {},
    formatFields = {},
    samples = []
  } = options;
  
  const lines = [];
  
  // Fileformat is required and must be first
  lines.push(`##fileformat=VCFv${version}`);
  
  // Add fileDate
  const today = new Date();
  const fileDate = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  lines.push(`##fileDate=${fileDate}`);
  
  // Add source
  lines.push(`##source=${source}`);
  
  // Add contig definitions
  for (const contig of contigs) {
    if (!vcfUtils.isValidContigName(contig.id)) {
      console.warn(`Invalid contig name: ${contig.id}`);
      continue;
    }
    
    let contigLine = `##contig=<ID=${contig.id}`;
    
    if (contig.length) {
      contigLine += `,length=${contig.length}`;
    }
    
    if (contig.assembly) {
      contigLine += `,assembly=${contig.assembly}`;
    }
    
    if (contig.md5) {
      contigLine += `,md5=${contig.md5}`;
    }
    
    if (contig.species) {
      // Escape quotes in species name
      const escapedSpecies = contig.species.replace(/"/g, '\\"');
      contigLine += `,species="${escapedSpecies}"`;
    }
    
    contigLine += '>';
    lines.push(contigLine);
  }
  
  // Add INFO field definitions
  for (const [id, field] of Object.entries(infoFields)) {
    if (!vcfUtils.isValidInfoFormatKey(id) && id !== "1000G") {
      console.warn(`Invalid INFO field ID: ${id}`);
      continue;
    }
    
    let infoLine = `##INFO=<ID=${id},Number=${field.number},Type=${field.type},Description="${field.description.replace(/"/g, '\\"')}"`;
    
    // Add optional fields
    if (field.source) {
      infoLine += `,Source="${field.source.replace(/"/g, '\\"')}"`;
    }
    
    if (field.version) {
      infoLine += `,Version="${field.version.replace(/"/g, '\\"')}"`;
    }
    
    infoLine += '>';
    lines.push(infoLine);
  }
  
  // Add FORMAT field definitions
  for (const [id, field] of Object.entries(formatFields)) {
    if (!vcfUtils.isValidInfoFormatKey(id)) {
      console.warn(`Invalid FORMAT field ID: ${id}`);
      continue;
    }
    
    const formatLine = `##FORMAT=<ID=${id},Number=${field.number},Type=${field.type},Description="${field.description.replace(/"/g, '\\"')}">`;
    lines.push(formatLine);
  }
  
  // Add header line
  let headerLine = '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO';
  
  if (samples.length > 0) {
    headerLine += '\tFORMAT';
    headerLine += samples.map(sample => `\t${sample}`).join('');
  }
  
  lines.push(headerLine);
  
  return lines.join('\n');
}

/**
 * Serializes a VCF record object to a VCF line
 * @param {Object} record - The VCF record to serialize
 * @returns {string} - The serialized VCF line
 */
function serializeVcfRecord(record) {
  // Validate the record
  const validation = vcfUtils.validateVcfRecord(record);
  if (!validation.isValid) {
    console.warn(`Attempting to serialize invalid VCF record: ${validation.errors.join(', ')}`);
  }
  
  const fields = [
    record.chr,
    record.pos,
    record.id || '.',
    record.ref,
    record.alt || '.',
    record.qual !== null && record.qual !== undefined ? record.qual : '.',
    Array.isArray(record.filter) ? record.filter.join(';') : (record.filter || '.'),
    vcfUtils.serializeInfoField(record.info)
  ];
  
  // Add FORMAT and sample fields if present
  if (record.samples) {
    // Get all FORMAT keys from all samples
    const formatKeys = new Set();
    for (const sample of Object.values(record.samples)) {
      Object.keys(sample).forEach(key => formatKeys.add(key));
    }
    
    // GT must be first if present
    const sortedFormatKeys = Array.from(formatKeys);
    if (sortedFormatKeys.includes('GT')) {
      sortedFormatKeys.splice(sortedFormatKeys.indexOf('GT'), 1);
      sortedFormatKeys.unshift('GT');
    }
    
    fields.push(sortedFormatKeys.join(':'));
    
    // Add sample data
    for (const [, sample] of Object.entries(record.samples)) {
      const sampleValues = sortedFormatKeys.map(key => {
        if (!(key in sample)) return '.';
        
        const value = sample[key];
        if (value === null) return '.';
        if (Array.isArray(value)) {
          return value.map(v => v === null ? '.' : v).join(',');
        }
        return value;
      });
      
      fields.push(sampleValues.join(':'));
    }
  }
  
  return fields.join('\t');
}

module.exports = {
  createVcfHeader,
  serializeVcfRecord
};
