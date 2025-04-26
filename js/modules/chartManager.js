/**
 * ChartManager
 * 
 * Gerencia a criação e atualização de gráficos
 */

const ChartManager = {
  charts: {},

  /**
   * Inicializa os gráficos
   */
  init() {
    // Os gráficos serão inicializados sob demanda quando os dados estiverem disponíveis
    console.log("ChartManager inicializado");
  },

  /**
   * Cria o gráfico de distribuição de genótipos
   * @param {HTMLCanvasElement} canvasElement - O elemento canvas onde desenhar o gráfico
   * @param {Array} data - Os dados de DNA
   */
  createGenotypeChart(canvasElement, data) {
    if (!canvasElement || !data || !data.length) return;
    
    // Calcular estatísticas de genótipo
    const total = data.length;
    const homo = data.filter(r => {
      if (!r.Genotype) return false;
      if (r.Genotype.length === 3) return r.Genotype[0] === r.Genotype[2]; // Formato "A/A"
      if (r.Genotype.length === 2) return r.Genotype[0] === r.Genotype[1]; // Formato "AA"
      return false;
    }).length;
    const hetero = total - homo;

    // Criar gráfico usando Chart.js
    const ctx = canvasElement.getContext('2d');
    
    // Excluir gráfico antigo se existir
    if (this.charts.genoChart) {
      this.charts.genoChart.destroy();
    }
    
    this.charts.genoChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Homozigoto (aprox)', 'Heterozigoto (aprox)'],
        datasets: [{ 
          data: [homo, hetero], 
          backgroundColor: ['#4361ee', '#4cc9f0'],
          borderColor: 'white',
          borderWidth: 2
        }]
      },
      options: { 
        responsive: true, 
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.raw;
                const percentage = ((value / total) * 100).toFixed(1);
                return `${value} SNPs (${percentage}%)`;
              }
            }
          }
        }
      }
    });
    
    return this.charts.genoChart;
  },

  /**
   * Cria gráfico de distribuição por cromossomo
   * @param {HTMLCanvasElement} canvasElement - O elemento canvas onde desenhar o gráfico
   * @param {Array} data - Os dados de DNA
   */
  createChromosomeDistributionChart(canvasElement, data) {
    if (!canvasElement || !data || !data.length) return;
    
    // Agregar dados por cromossomo
    const chromCounts = data.reduce((acc, item) => {
      acc[item.chromosome] = (acc[item.chromosome] || 0) + 1;
      return acc;
    }, {});
    
    // Ordenar cromossomos numericamente (com tratamento especial para X, Y, MT)
    const sortedChroms = Object.keys(chromCounts).sort((a, b) => {
      const numA = parseInt(a);
      const numB = parseInt(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      if (!isNaN(numA)) return -1;
      if (!isNaN(numB)) return 1;
      return a.localeCompare(b);
    });
    
    const ctx = canvasElement.getContext('2d');
    
    // Excluir gráfico antigo se existir
    if (this.charts.chromosomeChart) {
      this.charts.chromosomeChart.destroy();
    }
    
    this.charts.chromosomeChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sortedChroms.map(c => `Cromossomo ${c}`),
        datasets: [{
          label: 'SNPs por Cromossomo',
          data: sortedChroms.map(c => chromCounts[c]),
          backgroundColor: '#4361ee',
          borderColor: '#3f37c9',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Distribuição de SNPs por Cromossomo'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Número de SNPs'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Cromossomo'
            }
          }
        }
      }
    });
    
    return this.charts.chromosomeChart;
  },
  
  /**
   * Cria gráfico para exibir estatísticas clínicas
   * @param {HTMLCanvasElement} canvasElement - O elemento canvas onde desenhar o gráfico
   * @param {Object} clinCounts - Contagem de significância clínica
   */
  createClinicalSignificanceChart(canvasElement, clinCounts) {
    if (!canvasElement || !clinCounts) return;
    
    const ctx = canvasElement.getContext('2d');
    
    // Excluir gráfico antigo se existir
    if (this.charts.clinChart) {
      this.charts.clinChart.destroy();
    }
    
    // Preparar dados
    const labels = [
      'Patogênico', 
      'Provavelmente Patogênico', 
      'Benigno', 
      'Significado Incerto',
      'Outros'
    ];
    
    const data = [
      clinCounts.pathogenic || 0,
      clinCounts.likely_pathogenic || 0,
      clinCounts.benign || 0,
      clinCounts.uncertain || 0,
      clinCounts.other || 0
    ];
    
    const colors = [
      '#e63946', // Vermelho para patogênico
      '#f94144', // Vermelho mais claro para provavelmente patogênico
      '#0cce6b', // Verde para benigno
      '#fca311', // Laranja para incerto
      '#6c757d'  // Cinza para outros
    ];
    
    this.charts.clinChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderColor: 'white',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              padding: 20
            }
          },
          title: {
            display: true,
            text: 'Significância Clínica'
          }
        }
      }
    });
    
    return this.charts.clinChart;
  }
};

export default ChartManager;
