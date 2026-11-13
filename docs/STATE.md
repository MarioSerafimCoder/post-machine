# Estado real — 13/11/2026

## Fase 1 — Radar

- Coleta inicial real em 13/11/2026 às 15:47 (Brasília): **161 notícias únicas, nove fontes sem falha, 20 itens associados ao Google Trends e 128 com resumo**. O snapshot v1 está em `public/radar.json`. Fontes e classificação configuráveis em `radar/sources.json`.
- Radar desktop com cards, busca, filtros por nicho, fonte, idioma, publicação e Trends, favoritos no IndexedDB, paginação e diagnóstico por fonte. Falhas de coleta preservam o histórico e a última data de sucesso.
- Lint, build, dry-run do Wrangler, 13 testes Vitest e 10 Playwright aprovados localmente. Playwright verificou navegação, console, layout desktop, links, busca e persistência após recarregar.
- Primeira edição publicada pelo Wrangler no Workers Static Assets, versão `8857c7f2-8bb2-429a-b36a-b3e7e396fa27`. A atualização automatizada no mesmo workflow está configurada para 06:17, 12:17 e 18:17 (Brasília).
- **Pendente:** cadastrar os dois segredos Cloudflare e a variável do ambiente `production` conforme SETUP.md, executar o workflow e comparar o timestamp do artefato com o JSON em sessão Access autorizada. Ainda não há comprovação do deploy agendado nem do timestamp obtido em sessão autorizada.

## Auditoria inicial

Pasta de trabalho inicialmente vazia. Repositório público clonado de `MarioSerafimCoder/post-machine`; continha somente README e o commit inicial. Nenhuma funcionalidade anterior foi substituída. Trabalho exclusivamente em `main`.

## Implementado

- Fundação React + TypeScript + Vite + Tailwind, dependências fixadas e lockfile.
- Interface editorial original: visão geral, Radar, Studio e Auditoria; links diretos, histórico do navegador, página desconhecida e recuperação.
- **Somente desktop. Desktop first sempre**, conforme instrução do proprietário. Viewport mínimo 1024 px; abaixo disso somente orientação para desktop. Testes em 1280×800 e 1440×1000.
- Seletor de seções do Radar e estados vazios que identificam funcionalidades futuras; nenhuma notícia, métrica, análise ou projeto inventado.
- Roteiro em diálogo nativo com Escape, contenção de foco e retorno ao botão; link para pular ao conteúdo; títulos de página e foco na navegação.
- Documentos permanentes, instruções de Fase 1, CI e workflow manual de deploy condicionado à configuração de produção.
- Deploy de teste em [posts.marioserafim.com.br](https://posts.marioserafim.com.br), via Workers Static Assets, versão `2e08f86c-766b-48e3-ac52-811515402d30`. Workers Free e Zero Trust Free confirmados no painel; nenhum upgrade, binding ou serviço pago foi ativado para o projeto.
- Access para o hostname inteiro, com regra Allow restrita ao proprietário. URLs workers.dev e de preview desabilitadas.

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

O CI Linux inicialmente falhou no `npm ci` por entradas transitivas `@emnapi` ausentes do lockfile. Lockfile regenerado para Linux sem alterar dependências diretas; [CI remoto aprovado](https://github.com/MarioSerafimCoder/post-machine/actions/runs/43484465001).

Build servido pelo Wrangler local: HTTP 200 com CSP, rota direta, navegação por teclado, sem overflow horizontal nem erros de console em 1024, 1280 e 1440 px. Em produção, HTML, JS e CSS retornaram HTTP 302 para o Access sem sessão; o hostname alternativo workers.dev respondeu 404. O DNS público da Cloudflare já resolve o domínio; o resolvedor local ainda não resolvia na primeira tentativa de acesso no Chrome.

## Registro da Fase 0

**Fase 0: deploy protegido publicado; falta validar a sessão autorizada no navegador.** A autenticação do painel/Wrangler foi concluída pelo proprietário; o Access do site usa uma sessão distinta. Abrir o domínio no desktop após o DNS resolver, autenticar com a identidade permitida e verificar abertura, navegação, refresh e carregamento de assets.

O primeiro deploy foi pelo Wrangler autenticado localmente. Para publicação pelo GitHub Actions, provisionar `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` e `CLOUDFLARE_ACCESS_READY` no environment `production`, conforme SETUP.md. Isso é necessário para automatizar o deploy do Radar na Fase 1.

Importação, Fabric, templates editáveis, uploads, auditoria de artes e exportação permanecem fora do escopo atual.

## Próxima etapa

Validar o deploy agendado e o snapshot em sessão autorizada antes de encerrar a Fase 1. A Fase 2 ainda não foi iniciada.
