# DNA Explorer

Uma aplicação web para análise de dados de DNA.

## Visão Geral

O DNA Explorer é uma ferramenta que permite a usuários analisar seus dados de DNA carregando arquivos no formato ZIP do MyHeritage. A aplicação processa esses arquivos e apresenta informações relevantes sobre SNPs (polimorfismos de nucleotídeo único), incluindo possíveis implicações na saúde, traços e ancestralidade.

## Características

- Carregamento e processamento de arquivos DNA ZIP
- Visualização de tabela de SNPs com filtragem e paginação
- Insights sobre SNPs importantes relacionados à saúde
- Detalhes sobre traços genéticos e significância clínica
- Gráficos de distribuição de genótipos e cromossomos
- Detalhes por SNP com informações do Ensembl e SNPedia

## Estrutura do Projeto

```
DNA-Analyzer/
├── css/
│   └── styles.css           # Estilos da aplicação
├── js/
│   ├── main.js              # Ponto de entrada da aplicação
│   └── modules/
│       ├── chartManager.js  # Gerenciamento de gráficos
│       ├── dataManager.js   # Gerenciamento de dados
│       ├── fileProcessor.js # Processamento de arquivos
│       ├── proxyManager.js  # Gerenciamento de proxies CORS
│       └── uiManager.js     # Gerenciamento de interface
├── index.html               # Página principal da aplicação
└── README.md                # Documentação
```

## Tecnologias Utilizadas

- JavaScript (ES6+)
- HTML5 / CSS3
- Bibliotecas:
  - JSZip (processamento de arquivos ZIP)
  - PapaParse (processamento de CSV)
  - Chart.js (visualização de dados)

## Como Usar

1. Abra a aplicação no navegador
2. Clique no botão "Select DNA File" ou arraste um arquivo ZIP do MyHeritage para a área indicada
3. Aguarde o processamento do arquivo
4. Explore os dados e insights fornecidos nas várias abas da aplicação

## Desenvolvimento

Este projeto segue uma arquitetura modular para facilitar manutenção e extensibilidade. Cada componente funcional está isolado em seu próprio arquivo:

- **ProxyManager**: Gerencia conexões com APIs externas, contornando limitações de CORS
- **DataManager**: Gerencia os dados de SNPs, busca e cache de informações
- **UIManager**: Lida com a interface do usuário e renderização
- **FileProcessor**: Processa arquivos DNA e extrai dados
- **ChartManager**: Gerencia a criação e atualização de gráficos

## Melhorias Futuras

- Adicionar mais visualizações e gráficos
- Incluir análises de saúde mais detalhadas
- Implementar exportação de relatórios em PDF
- Adicionar suporte para arquivos de outros serviços de DNA (23andMe, AncestryDNA)
- Melhorar o desempenho para arquivos muito grandes
