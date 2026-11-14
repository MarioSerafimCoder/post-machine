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

Validar o deploy agendado e o snapshot em sessão autorizada para encerrar a Fase 1. A implementação local da Fase 2 está registrada abaixo.

## Preparacao local em F:\postmachine - 14/11/2026

Instalacao ainda bloqueada nesta sessao do Work. Arquivos de codigo preservados.

- Node 24.18.0, npm 11.16.0 e Git 2.56.1.windows.1 disponiveis.
- Git inicializado em main, sem commits. Adicionar origin falhou: `.git/config: Permission denied`; fetch falhou ao abrir `.git/FETCH_HEAD`. Historico e upstream ainda nao restaurados. A politica da sessao protege .git contra escrita.
- DNS/HTTPS para github.com e registry.npmjs.org: ENOTFOUND. TCP para 1.1.1.1:443 e 127.0.0.1:5173: EACCES. Servidor TCP temporario conseguiu escutar em loopback, mas o cliente no mesmo processo recebeu EACCES. Servidor de diagnostico encerrado.
- npm sem proxy/https-proxy configurado, registry oficial e strict-ssl=true. Sem variaveis de ambiente proxy. Consulta de firewall via CIM indisponivel; nenhuma regra de firewall alterada.
- Politica efetiva: rede restrita e elevacao sandbox desabilitada. UI: Geral mostra Acesso total ativo; Configuracao > Work > Acesso a rede local mostra Usar padrao. Nenhuma permissao alterada.
- npm ci --fetch-retries=0 --fetch-timeout=8000 --no-audit --no-fund falhou com ENOTFOUND ao baixar zod-validation-error. Dependencias nao instaladas completamente.
- Pendente: liberar as permissoes efetivas de rede e escrita Git pelo aplicativo, restaurar origin/main e historico preservando arquivos, concluir npm ci, lint, testes, build e verificar servidor/app. Resultados aprovados descritos acima pertencem ao ambiente anterior, nao a esta instalacao.

- Reteste apos o usuario ativar Acesso a rede local em Configuracao > Work (conferido na tela): DNS e HTTPS para GitHub/npm continuam ENOTFOUND no terminal desta sessao. HTTP contra servidor temporario no proprio loopback continua EACCES. Git continua sem origin, pois a escrita em .git/config retorna Permission denied.

## Instalação local e porta de testes - 14/11/2026

- O PowerShell do Windows restaurou o histórico e o upstream em main (origin/main, 6cbd921) e instalou as dependências do lockfile. Lint, 13 testes unitários e build foram reconferidos no workspace.
- Os 10 testes Playwright da primeira execução abriram o BRasa na porta 4173. Os relatórios mostram a interface do BRasa. O Post Machine agora executa o servidor de testes na porta 44173 e rejeita a reutilização de outro servidor.
- Vite iniciou na porta de desenvolvimento 5173. O terminal gerenciado recebeu EACCES ao tentar HTTP em loopback. Validação pós-correção dos testes de navegador e carregamento da aplicação no PowerShell do Windows ainda pendentes.

- Validação concluída pelo PowerShell do Windows: o resultado mais recente do Playwright indica aprovação sem testes com falha, e o navegador exibiu o Post Machine em http://127.0.0.1:5173/ (aviso de viewport abaixo de 1024 px no painel estreito). O terminal gerenciado continua recebendo EACCES no mesmo endereço.

## Fase 2 — Pautas e campanhas

- Cada notícia abre uma pauta com a referência original e seus metadados. O briefing ajusta objetivo, público, tom, abordagem, formato, quantidade de peças e orientações. Público e tom podem ser salvos como padrão.
- Geração e edição local do prompt, com cópia e links para ChatGPT, Claude e Gemini. A consulta à fonte integral, a verificação factual e a distinção entre fatos, opiniões e interpretações são instruções do prompt.
- Importação por texto ou arquivo JSON/Markdown com Zod. O exemplo de sintaxe Markdown está disponível no próprio importador. URLs aceitam apenas HTTP/HTTPS sem credenciais. Textos importados são renderizados como dados.
- Revisão editorial permite editar campanha e peças, reordenar, adicionar, duplicar e excluir. Pautas, prompts, campanhas e preferências usam o banco IndexedDB versionado post-machine-campaigns. Backup JSON restaura por adição e preserva campanhas existentes quando há colisões de ID.
- O contrato v1 em src/features/campaigns/contract.ts disponibiliza metadados de projeto, campanha, referência original, datas e peças ordenadas para a futura integração com o Studio.
- Validação neste workspace: ESLint sem avisos, 17 testes Vitest e build aprovados. Playwright local depende de acesso HTTP ao servidor Vite em 127.0.0.1:44173, bloqueado no terminal gerenciado. A suíte completa também roda no GitHub Actions.

- CI da Fase 2 aprovado: 17 testes Vitest, 14 testes Playwright nos perfis desktop com verificações em 1024, 1280 e 1440 px, ESLint, build e Wrangler dry-run. Execução: https://github.com/MarioSerafimCoder/post-machine/actions/runs/43597537707.
- A coleta agendada do Radar concluiu e gerou artefatos na execução 43540726966. A publicação parou na trava CLOUDFLARE_ACCESS_READY; a execução não chegou à verificação dos dois segredos. O deploy direto da Fase 2 abriu a sessão de upload, mas foi bloqueado com HTTP 401 no envio dos arquivos. O domínio continua vinculado ao Worker existente com Cloudflare Access. A produção ainda precisa receber a Fase 2 e ser conferida em sessão autorizada.

## Publicação da Fase 2 — 14/11/2026

- As alterações de pautas e campanhas já estavam na main remota (872dad8). A cópia em F:\postmachine foi sincronizada após conferir que os arquivos eram idênticos.
- ESLint, 17 testes Vitest, 14 testes Playwright e build aprovados. A comparação do prompt copiado agora aceita a quebra de linha nativa do Windows sem ignorar diferenças de conteúdo.
- A Fase 2 foi publicada via Wrangler no domínio de produção, versão `caee93ea-86b8-4192-aa9f-dd4df8fd0058`. A página inicial, o snapshot e os arquivos estáticos verificados continuaram redirecionando visitantes anônimos ao Cloudflare Access. A verificação do fluxo de campanhas em sessão autorizada e o deploy agendado continuam pendentes.

## Entrega 3.0 — 14/11/2026

- Campanhas independentes com título próprio e origem opcional. Entrada no Radar e Studio; importador editorial existente preservado. Marca pública Direto, infraestrutura e bancos preservados.
- IndexedDB v2 migra documentos v1 em transação; backups antigos são aceitos sem sobrescrever colisões. SaveQueue com debounce, serialização, retenção de pendências, retentativa e flush na troca/navegação.
- Lint aprovado, 19 testes Vitest, build aprovado. Playwright: 12 cenários anteriores passaram inicialmente; dois revelaram conflito entre feedback de preferências e autosave, corrigido aguardando flush. Os quatro cenários de campanhas passaram no reteste; quatro novos cenários cobrem criação independente e migração/restauração v1 nos dois perfis desktop.
- Próxima entrega: 3.1, editor Fabric. Não publicado ainda. Produção segue na Fase 2; Access e pendências do agendamento preservados.
