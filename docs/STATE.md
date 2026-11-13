# Estado real — 13/11/2026

## Auditoria inicial

Pasta de trabalho inicialmente vazia. Repositório público clonado de `MarioSerafimCoder/post-machine`; continha somente README e o commit inicial. Nenhuma funcionalidade anterior foi substituída. Trabalho exclusivamente em `main`.

## Implementado

- Fundação React + TypeScript + Vite + Tailwind, dependências fixadas e lockfile.
- Interface editorial original: visão geral, Radar, Studio e Auditoria; links diretos, histórico do navegador, página desconhecida e recuperação.
- **Somente desktop. Desktop first sempre**, conforme instrução do proprietário. Viewport mínimo 1024 px; abaixo disso somente orientação para desktop. Testes em 1280×800 e 1440×1000.
- Seletor de seções do Radar e estados vazios que identificam funcionalidades futuras; nenhuma notícia, métrica, análise ou projeto inventado.
- Roteiro em diálogo nativo com Escape, contenção de foco e retorno ao botão; link para pular ao conteúdo; títulos de página e foco na navegação.
- Documentos permanentes, instruções de Fase 1, CI e workflow manual de deploy condicionado à configuração de produção.
- Configuração Workers Static Assets e cabeçalhos de segurança; URLs workers.dev/preview desabilitadas.

## Verificações locais

| Verificação | Resultado |
| --- | --- |
| ESLint | Aprovado, sem avisos |
| Vitest | 9 testes aprovados |
| Playwright Chromium | 8 testes aprovados em desktop/laptop, incluindo aviso em viewport não suportado |
| TypeScript + Vite | Build aprovado; artefatos em dist (não versionados) |
| Wrangler dry-run | Empacotamento aprovado, sem bindings |
| npm audit | 0 vulnerabilidades após override de minimatch |
| Revisão visual | Visão geral inspecionada no Chrome; composição editorial, navegação e legibilidade conferidas |

Correções realizadas: TypeScript 7 incompatível com typescript-eslint → fixado 6.0.3; minimatch vulnerável transitivo → override 11.0.8 e lint revalidado; diálogo não devolvia foco após Escape → restauração explícita e teste aprovado; foco inicial indevido em StrictMode → foco somente em troca de página. Removida adaptação mobile após instrução do proprietário. Corrigida opção de consulta de teste incompatível com tipos da Testing Library.

## Pendências reais

**Fase 0 não está integralmente encerrada: falta deploy de teste protegido.** `wrangler whoami` confirmou ausência de autenticação Cloudflare neste ambiente. Nenhum deploy, configuração DNS ou política Access foi executado. Dry-run não prova publicação.

Necessário do proprietário: autenticar Cloudflare, conferir plano Free, configurar identidade permitida no Access e credenciais/variáveis do ambiente de produção conforme SETUP.md. Configurar rota somente após proteção. Não foi solicitado token em texto nem ativado serviço pago.

Coletor, RSS, Google Trends, favoritos, importação, Fabric, templates editáveis, IndexedDB, uploads, auditoria de artes e exportação não estão implementados. A arte ilustrativa da tela inicial não é um template funcional.

## Próxima etapa

Fase 1 preparada em ROADMAP.md: contratos, fontes reais, coleta robusta, busca/filtros/favoritos e atualização da produção no mesmo workflow. Não depender de commits GITHUB_TOKEN para acionar deploy. Antes de declarar Fase 1 concluída, validar snapshot real em produção protegida.
