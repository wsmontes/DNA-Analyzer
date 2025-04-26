/**
 * Known Genes Database
 * 
 * Comprehensive database of clinically significant genes and their associations
 */

const KnownGenes = {
  // High-priority genes categorized by disease/function
  highPriorityGenes: {
    // Cancer-related genes
    cancer: [
      'BRCA1', 'BRCA2', 'TP53', 'APC', 'MLH1', 'MSH2', 'MSH6', 'PMS2', 'PTEN', 'RB1', 'PALB2',
      'ATM', 'BARD1', 'BRIP1', 'CDH1', 'CHEK2', 'CDKN2A', 'EPCAM', 'NBN', 'RAD51C', 'RAD51D',
      'STK11', 'MET', 'EGFR', 'KRAS', 'BRAF', 'CTNNB1', 'PIK3CA', 'AKT1', 'ERBB2', 'JAK2',
      'FGFR1', 'FGFR2', 'FGFR3', 'KIT', 'PDGFRA', 'FLT3', 'NTRK1', 'NTRK2', 'NTRK3', 'RET',
      'ALK', 'NRAS', 'IDH1', 'IDH2', 'GNAS', 'TERT', 'VHL', 'SMAD4', 'NOTCH1', 'NOTCH2'
    ],
    
    // Cardiovascular disease genes
    cardiovascular: [
      'APOE', 'LDLR', 'PCSK9', 'APOB', 'MYBPC3', 'MYH7', 'TNNT2', 'LMNA', 'SCN5A', 'KCNQ1', 
      'KCNH2', 'RYR2', 'PKP2', 'DSP', 'DSG2', 'DSC2', 'TMEM43', 'ACTC1', 'MYH6', 'TPM1',
      'PRKAG2', 'GLA', 'TTR', 'FLNC', 'BAG3', 'TGFBR1', 'TGFBR2', 'SMAD3', 'ACTA2', 'MYH11',
      'COL3A1', 'FBN1', 'BMPR2', 'TNNI3', 'PLN', 'LAMP2', 'NKX2-5', 'TBX5', 'TBX20', 'TTN', 
      'KCNE1', 'KCNE2', 'JUP', 'LDB3', 'MYOZ2', 'TCAP', 'CASQ2', 'HCN4', 'MYL2', 'MYL3'
    ],
    
    // Neurodegenerative disease genes
    neurodegenerative: [
      'APP', 'PSEN1', 'PSEN2', 'MAPT', 'SNCA', 'HTT', 'C9orf72', 'SOD1', 'TARDBP', 'FUS',
      'GRN', 'TREM2', 'PRNP', 'UBQLN2', 'OPTN', 'TBK1', 'VCP', 'CHCHD10', 'ALS2', 'SETX',
      'ANG', 'PFN1', 'VAPB', 'SQSTM1', 'DCTN1', 'SPG11', 'ATXN1', 'ATXN2', 'ATXN3', 'ATXN7',
      'HTT', 'ATN1', 'TBP', 'CACNA1A', 'PARK2', 'LRRK2', 'PINK1', 'PARK7', 'VPS35', 'GBA',
      'CLN3', 'NOTCH3', 'GFAP', 'PLP1', 'MECP2', 'SMN1', 'APTX', 'SACS', 'POLG', 'OPA1'
    ],
    
    // Metabolic disorder genes
    metabolic: [
      'PAH', 'CFTR', 'HFE', 'G6PD', 'MTHFR', 'HBB', 'HBA1', 'HBA2', 'GALT', 'GALT', 'GCK',
      'GYS1', 'GYS2', 'PYGL', 'PHKA1', 'PHKA2', 'PHKB', 'PHKG2', 'GAA', 'AGL', 'LDHA', 'LDHB',
      'PDHA1', 'PCCA', 'PCCB', 'MCCC1', 'MCCC2', 'MUT', 'MMAA', 'MMAB', 'MMACHC', 'HMBS',
      'UROS', 'PPOX', 'FECH', 'ALAD', 'CPOX', 'UROD', 'IDUA', 'IDS', 'SGSH', 'NAGLU',
      'HGSNAT', 'GLA', 'GALC', 'HEXA', 'HEXB', 'GM2A', 'ASAH1', 'SMPD1', 'NPC1', 'NPC2'
    ],
    
    // Immune system genes
    immune: [
      'HLA-A', 'HLA-B', 'HLA-C', 'HLA-DRB1', 'HLA-DQA1', 'HLA-DQB1', 'HLA-DPA1', 'HLA-DPB1',
      'IL2RA', 'IL7R', 'IL12RB1', 'IL10', 'IL6', 'IFNG', 'TNF', 'CTLA4', 'PTPN22', 'STAT1',
      'STAT3', 'JAK1', 'JAK3', 'TYK2', 'AIRE', 'FOXP3', 'CD40LG', 'BTK', 'CYBB', 'CYBA',
      'NCF1', 'NCF2', 'NCF4', 'RAG1', 'RAG2', 'DCLRE1C', 'LIG4', 'NHEJ1', 'XLF', 'ADA',
      'PNP', 'CD3D', 'CD3E', 'CD3G', 'CD8A', 'IL2RG', 'JAK3', 'IL7R', 'CORO1A', 'DOCK8'
    ],
    
    // Pharmacogenomic genes 
    pharmacogenomic: [
      'CYP2D6', 'CYP2C19', 'CYP2C9', 'VKORC1', 'TPMT', 'DPYD', 'UGT1A1', 'SLCO1B1', 'CYP3A4',
      'CYP3A5', 'CYP1A2', 'CYP2B6', 'NAT2', 'COMT', 'OPRM1', 'ABCB1', 'ABCC2', 'ABCG2', 'F5',
      'IFNL3', 'HLA-B*15:02', 'HLA-B*57:01', 'HLA-B*58:01', 'HLA-A*31:01', 'HLA-DQA1', 'RYR1',
      'CACNA1S', 'G6PD', 'NUDT15', 'CYP4F2', 'CFTR', 'ITPA', 'ANKK1', 'DRD2', 'HTR2A',
      'HTR2C', 'ADRB1', 'ADRB2', 'SLCO2B1', 'GSTP1', 'GSTM1', 'GSTT1', 'MTHFR', 'CPS1', 'CBR3'
    ],
    
    // Developmental genes
    developmental: [
      'NIPBL', 'SMC1A', 'SMC3', 'RAD21', 'HDAC8', 'FGFR1', 'FGFR2', 'FGFR3', 'TWIST1', 'MSX2',
      'PAX3', 'PAX6', 'SOX2', 'SOX9', 'SHH', 'GLI3', 'PTCH1', 'CHD7', 'MECP2', 'CREBBP',
      'EP300', 'NSD1', 'EZH2', 'KMT2D', 'KDM6A', 'SETD2', 'ARID1A', 'ARID1B', 'SMARCA4', 'SMARCB1',
      'TSC1', 'TSC2', 'PTEN', 'NF1', 'FMR1', 'DMPK', 'DYRK1A', 'TBX1', 'TBX3', 'TBX5'
    ],
    
    // Sensory system genes
    sensory: [
      'ABCA4', 'RPE65', 'RPGR', 'USH2A', 'MYO7A', 'CDH23', 'PCDH15', 'GJB2', 'GJB6', 'SLC26A4',
      'MYO15A', 'OTOF', 'TMC1', 'TECTA', 'KCNQ4', 'RHO', 'PRPH2', 'RP1', 'RP2', 'PRPF31',
      'BEST1', 'GUCY2D', 'CRX', 'RS1', 'OPN1LW', 'OPN1MW', 'OPN1SW', 'GRM6', 'GNAT1', 'GNAT2',
      'PDE6A', 'PDE6B', 'PDE6C', 'CNGB1', 'CNGB3', 'MYO6', 'PTPRQ', 'WHRN', 'SANS', 'PDZD7'
    ]
  },
  
  // Get a flattened list of all high priority genes
  getAllHighPriorityGenes() {
    return Object.values(this.highPriorityGenes)
      .flat()
      .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
  },
  
  // SNP-to-Gene known associations
  snpGeneAssociations: {
    // Key SNPs associated with important genes
    "rs1042522": { gene: "TP53", significance: "high", condition: "Cancer risk" },
    "rs1801133": { gene: "MTHFR", significance: "medium", condition: "Cardiovascular" },
    "rs429358": { gene: "APOE", significance: "high", condition: "Alzheimer's" },
    "rs7412": { gene: "APOE", significance: "high", condition: "Alzheimer's" },
    "rs6025": { gene: "F5", significance: "high", condition: "Thrombosis" },
    "rs1800562": { gene: "HFE", significance: "high", condition: "Hemochromatosis" },
    "rs1799945": { gene: "HFE", significance: "medium", condition: "Hemochromatosis" },
    "rs1801282": { gene: "PPARG", significance: "medium", condition: "Diabetes" },
    "rs1544410": { gene: "VDR", significance: "medium", condition: "Osteoporosis" },
    "rs2476601": { gene: "PTPN22", significance: "medium", condition: "Autoimmune" },
    "rs4988235": { gene: "MCM6", significance: "medium", condition: "Lactose intolerance" },
    "rs53576": { gene: "OXTR", significance: "low", condition: "Empathy" },
    "rs1815739": { gene: "ACTN3", significance: "low", condition: "Muscle performance" },
    "rs662799": { gene: "APOA5", significance: "medium", condition: "Triglyceride levels" },
    "rs9939609": { gene: "FTO", significance: "medium", condition: "Obesity risk" },
    "rs1799983": { gene: "NOS3", significance: "medium", condition: "Cardiovascular" },
    "rs4680": { gene: "COMT", significance: "medium", condition: "Cognitive function" },
    "rs1800497": { gene: "ANKK1", significance: "medium", condition: "Addiction risk" },
    "rs1229984": { gene: "ADH1B", significance: "high", condition: "Alcohol metabolism" },
    "rs16969968": { gene: "CHRNA5", significance: "medium", condition: "Nicotine dependence" },
    "rs17822931": { gene: "ABCC11", significance: "low", condition: "Earwax type" },
    "rs12913832": { gene: "HERC2", significance: "low", condition: "Eye color" },
    "rs1800896": { gene: "IL10", significance: "medium", condition: "Immune function" },
    "rs1800629": { gene: "TNF", significance: "medium", condition: "Inflammatory response" },
    "rs2066844": { gene: "NOD2", significance: "medium", condition: "Crohn's disease" },
    "rs601338": { gene: "FUT2", significance: "medium", condition: "Norovirus resistance" },
    "rs1051931": { gene: "ALPL", significance: "medium", condition: "Vitamin B6 levels" },
    "rs2070424": { gene: "SOD1", significance: "medium", condition: "ALS" },
    "rs4343": { gene: "ACE", significance: "medium", condition: "Blood pressure" },
    "rs1799752": { gene: "ACE", significance: "medium", condition: "ACE insertion/deletion" },
    "rs1799983": { gene: "NOS3", significance: "medium", condition: "Nitric oxide production" },
    "rs1800795": { gene: "IL6", significance: "medium", condition: "Inflammatory response" },
    "rs1800796": { gene: "IL6", significance: "medium", condition: "IL-6 production" },
    "rs1800871": { gene: "IL10", significance: "medium", condition: "IL-10 production" },
    "rs1800872": { gene: "IL10", significance: "medium", condition: "IL-10 production" },
    "rs1801131": { gene: "MTHFR", significance: "medium", condition: "Folate metabolism" },
    "rs1801133": { gene: "MTHFR", significance: "high", condition: "Homocysteine levels" },
    "rs1805007": { gene: "MC1R", significance: "low", condition: "Red hair" },
    "rs1805008": { gene: "MC1R", significance: "low", condition: "Red hair" },
    "rs1808593": { gene: "APOE", significance: "high", condition: "Alzheimer's risk" },
    "rs1042713": { gene: "ADRB2", significance: "medium", condition: "Bronchodilator response" },
    "rs1042714": { gene: "ADRB2", significance: "medium", condition: "Obesity risk" },
    "rs1045642": { gene: "ABCB1", significance: "medium", condition: "Drug metabolism" },
    "rs1051740": { gene: "EPHX1", significance: "medium", condition: "Xenobiotic metabolism" },
    "rs1057910": { gene: "CYP2C9", significance: "high", condition: "Warfarin metabolism" },
    "rs1058930": { gene: "CYP2C8", significance: "medium", condition: "Drug metabolism" },
    "rs1064039": { gene: "HNF1A", significance: "medium", condition: "Type 2 diabetes" }
  },
  
  // Gene descriptions for user-friendly displays
  geneDescriptions: {
    'BRCA1': 'Breast cancer susceptibility gene 1 - mutations increase risk of breast and ovarian cancer',
    'BRCA2': 'Breast cancer susceptibility gene 2 - mutations increase risk of breast, ovarian, and other cancers',
    'APOE': 'Apolipoprotein E - affects Alzheimer\'s risk and cholesterol metabolism',
    'MTHFR': 'Methylenetetrahydrofolate reductase - affects folate metabolism and homocysteine levels',
    'CFTR': 'Cystic fibrosis transmembrane conductance regulator - mutations cause cystic fibrosis',
    'HFE': 'Hemochromatosis gene - affects iron absorption and storage',
    'TP53': 'Tumor protein p53 - guardian of the genome, prevents cancer formation',
    'CYP2D6': 'Key drug metabolism enzyme affecting ~25% of prescription drugs',
    'CYP2C19': 'Important for metabolism of antidepressants and other drugs',
    'VKORC1': 'Vitamin K epoxide reductase - affects warfarin (blood thinner) response',
    'F5': 'Factor V - mutations can increase blood clot risk (Factor V Leiden)',
    'COMT': 'Catechol-O-methyltransferase - affects dopamine metabolism and cognition',
    'ACE': 'Angiotensin converting enzyme - affects blood pressure regulation',
    'APP': 'Amyloid precursor protein - mutations linked to early-onset Alzheimer\'s',
    'MAPT': 'Microtubule-associated protein tau - mutations linked to frontotemporal dementia',
    'FOXP2': 'Forkhead box protein P2 - involved in speech and language development',
    'MC1R': 'Melanocortin 1 receptor - determines hair and skin color',
    'HERC2': 'HECT and RLD domain containing E3 ubiquitin protein ligase 2 - affects eye color',
    'OCA2': 'Oculocutaneous albinism II - affects eye, hair, and skin color',
    'FTO': 'Fat mass and obesity-associated protein - affects obesity risk',
    'ACTN3': 'Alpha-actinin-3 - affects muscle performance and athletic ability',
    'PAH': 'Phenylalanine hydroxylase - mutations cause phenylketonuria (PKU)',
    'G6PD': 'Glucose-6-phosphate dehydrogenase - deficiency causes hemolytic anemia',
    'HBB': 'Hemoglobin beta - mutations cause sickle cell anemia and other blood disorders',
    'HTT': 'Huntingtin - expanded CAG repeats cause Huntington\'s disease',
    'DMD': 'Dystrophin - mutations cause Duchenne and Becker muscular dystrophies',
    'NF1': 'Neurofibromin 1 - mutations cause neurofibromatosis type 1',
    'PSEN1': 'Presenilin 1 - mutations cause early-onset Alzheimer\'s disease'
  },
  
  // Get description for a gene
  getGeneDescription(gene) {
    if (!gene) return "No gene information available";
    return this.geneDescriptions[gene] || "Gene with potential health significance";
  },
  
  // Get category for a gene
  getGeneCategory(gene) {
    if (!gene) return "Other";
    
    // Check each category for the gene
    for (const [category, genes] of Object.entries(this.highPriorityGenes)) {
      if (genes.includes(gene)) {
        return category.charAt(0).toUpperCase() + category.slice(1); // Capitalize first letter
      }
    }
    
    return "Other";
  }
};

export default KnownGenes;
