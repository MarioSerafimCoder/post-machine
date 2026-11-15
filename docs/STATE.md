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

Na conclusão da Fase 0, importação, Fabric, templates, uploads, auditoria e exportação estavam fora do escopo. As entregas posteriores abaixo atualizam esse registro.

## Etapa atual

Fase 3 — Studio, entregas incrementais registradas abaixo. Radar e campanhas implementados e publicados; validação do agendamento e da sessão Access são pendências de produção separadas.

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

## Entrega 3.1 — 14/11/2026

- Fabric 7.4.0 (MIT), API tipada instalada conferida e documentação oficial consultada. Canvas com ciclo de vida isolado, texto editável, propriedades, formas, imagem local validada, recorte/enquadramento, substituição, camadas, agrupamento, alinhamento, distribuição, bloqueio e zoom. Três formatos reais, fontes do sistema sem chamada externa.
- Código em src/features/studio, separado em model, CanvasView, objects, images, Properties e Studio. Carregado sob demanda.
- Build e lint aprovados. Dois Playwright desktop/laptop aprovados: edição de texto, duplicação/exclusão, imagem local, recorte, camadas e ausência de erro de página/overflow.
- Persistência, templates e exportação ainda não entregues neste commit. Próxima: 3.2.

## Entrega 3.2 — 14/11/2026

- Seis templates vetoriais editáveis, campos semânticos, tipografia com tamanho mínimo e limite de altura. Campanha → Criar design no Studio compõe até 20 slides, com vínculo de origem; futuras edições editoriais geram nova versão, sem sobrescrita visual.
- Slides com duplicação, exclusão confirmada e reordenação. Minha marca com nome, arroba, cores, fontes do sistema, margens e logotipo. Troca de template/aplicação global exige confirmação.
- Build e lint aprovados; quatro Playwright do Studio aprovados (desktop/laptop), incluindo campanha de três slides, edição, troca de template preservando título, reordenação e exclusão.
- Próxima entrega 3.3: persistência, backup, histórico e exportação. As miniaturas ainda são resumos semânticos; QA final substituirá por prévias reais.

## Entrega 3.3 — 14/11/2026

- IndexedDB Studio v2: projetos, imagens Blob deduplicadas por SHA-256, marca e última versão anterior confirmada. Migração cria recovery preservando v1. Autosave ordenado, salvamento explícito, retentativa, biblioteca, duplicação e exclusão confirmada. Histórico de 30 operações por sessão e recuperação da última versão anterior persistida.
- Backup ZIP completo do estado atual com imagens únicas e hashes verificados; restauração cria novo ID. Importação rejeita versões desconhecidas, URLs externas e dimensões abusivas.
- PNG real e ZIP numerado; exportador isolado do zoom. Aguarda fontes e imagens; avisos de overflow, margens, ausência de imagem e baixa resolução antes do download. Prévias rasterizadas reais para os slides.
- Lint, 20 Vitest e build aprovados. Dez Playwright do Studio passaram. Arquivos baixados conferidos: PNG 1080×1350 e ZIP com 01/02/03 nas mesmas dimensões; backup de três slides guarda uma única cópia da imagem e restaura após recarga. Teste de falha real simulada no IndexedDB passou; exceção global durante a simulação foi tratada e cenário revalidado.
- Próxima entrega 3.4: QA final, documentação e publicação. Fontes disponíveis nesta versão são fontes do sistema; nenhuma fonte remota é carregada. Undo/redo completo não atravessa recargas, mas há recuperação do checkpoint anterior.

## Entrega 3.4 — QA local, 14/11/2026

- Fluxo completo implementado: campanhas independentes/Radar → importação editorial → Studio → templates/marca/imagens/fontes → salvamento/recuperação → PNG/ZIP/backup.
- Inter regular/negrito hospedada localmente com SIL OFL; uploads WOFF2 locais carregam, são incluídos no backup e recuperam a fonte. Correções de enquadramento sem distorção, imagem semântica preservada em layouts sem fotografia, margens configuráveis, comandos de histórico e nomes acessíveis.
- Lint e 20 Vitest aprovados. Suíte completa de desenvolvimento: 28 Playwright antes da adição de fontes. Suíte completa do build pelo Wrangler/CSP: 30 aprovados. Após os ajustes finais de canvas/atalhos/acessibilidade, os 12 testes do Studio foram reconferidos no build de produção, incluindo edição direta no canvas e ausência de erros no console. Dry-run aprovado, sem bindings.
- PNG e ZIP conferidos por dimensões/ordem nos arquivos baixados. Layout inspecionado visualmente em screenshots de navegador a 1024/1280/1440 px; sem overflow da página, canvas rolável e zoom independente. Prévias reais dos slides substituíram os resumos semânticos.
- GitHub production consultado: faltam CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_ACCESS_READY. Não foram criadas credenciais ou removida a proteção. Publicação direta autorizada pelo proprietário; resultado remoto será registrado abaixo.
- Limites explícitos: 20 slides, 500 elementos/slide, imagem até 20 MB/40 MP, oito fontes WOFF2 até 2 MB, backup até 150 MB. Histórico de sessão + checkpoint anterior; backup representa o estado atual. Auditoria completa e Radar de Virais não implementados.

## Publicação e conferência online — 14/11/2026

- Entregas 3.0–3.4 enviadas para origin/main, código publicado no commit 2cf68bb. CI Linux aprovado: https://github.com/MarioSerafimCoder/post-machine/actions/runs/43660701534 (instalação limpa, lint, 20 Vitest, build, 30 Playwright e dry-run).
- Publicado no Worker existente post-machine, domínio posts.marioserafim.com.br, versão 41488b14-d0d5-4c50-833f-89ce6ab4bcca. Sem novos recursos ou bindings. Verificação posterior: /, /radar.json e /favicon.svg retornam 302 ao Access para visitantes anônimos.
- Sessão autorizada do Access conferida no navegador: Studio — Direto abriu; projeto de verificação criado, template editorial aplicado, texto editado, salvo e reaberto após recarga. PNG baixado de produção e inspecionado visualmente, 1080×1350, sem corte no texto. Nenhum erro do aplicativo registrado; o fluxo de login Cloudflare registrou aviso próprio de ViewTransition abortada, sem impedir o acesso.
- Projeto “Verificação do Studio” permanece apenas no IndexedDB do navegador usado na validação, não foi enviado ao repositório/servidor. Screenshot e PNG de evidência são locais, fora do versionamento.
- Fase 3 implementada, testada e publicada. Pendência externa preservada: configurar os dois segredos e a variável do environment production para o deploy agendado do Radar e validar o snapshot daquela execução. Fase 4 não iniciada.

## Fase 4 — Auditoria de design, 14/11/2026

### Entrega 4.1 — Motor

- `src/features/audit/` recebe o projeto sem alterá-lo e usa o canvas Fabric nas dimensões originais, independente do zoom. Relatório com IDs reproduzíveis por slide/caminho de objeto, gravidade, certeza, regras, data, versão e estado final.
- Regras de canvas/margens, tamanho/escala, overflow e invisibilidade de texto, fontes, tamanho tipográfico, imagens, contraste de cores sólidas com composição de opacidade, marca e campos exigidos. Fotografia e sobreposição ambígua são indicadas para revisão visual, sem afirmar erro medido.
- A antiga verificação isolada do exportador foi migrada para as mesmas regras. A exportação analisa o canvas já carregado para o PNG/ZIP, sem segunda renderização completa.
- 22 testes unitários do motor aprovados. Limite conhecido: alinhamento editorial sem regra explícita do template e intenção de sobreposições não podem ser julgados automaticamente.

### Entrega 4.2 — Interface

- Página Auditoria com seleção de projeto local, análise completa, resumo, filtros por gravidade/categoria/slide/situação, revisão manual e download JSON. Studio com “Auditar design”, análise do slide atual ou de todos, progresso/cancelamento e navegação para o objeto. Resultado anterior é marcado desatualizado quando o projeto muda.
- Configurações opcionais de marca, logo, paleta e limites de texto/contraste são salvas no projeto. `auditSettings` é opcional no contrato v1, preservando projetos e backups antigos.
- Antes de exportar, ocorrências relevantes são mostradas e ligadas ao elemento; exportar com avisos requer clique explícito. O PNG e o ZIP mantêm dimensões originais.
- Playwright integrado validou a interface em 1024, 1280 e 1440 px, a navegação e o relatório JSON.

### Entrega 4.3 — Correções assistidas

- Apenas objetos de primeiro nível, desbloqueados e que cabem na área podem ser movidos automaticamente para dentro do canvas ou margem. Grupos, texto editorial, cor e enquadramento ficam para edição manual.
- A proposta informa deslocamento e exige confirmação. O Studio salva o checkpoint anterior, insere a correção no histórico, reexecuta a auditoria e permite desfazer; o armazenamento mantém a versão anterior para recuperação. Duas tentativas por ocorrência no painel, incluindo falhas, encerram a sugestão automática.
- Teste unitário comprovou correção sem alterar o conteúdo e recusa de objeto que não cabe. Playwright comprovou correção, desfazer, nova auditoria e reabertura do projeto.

### Entrega 4.4 — QA local

- Lint aprovado; 42 testes Vitest; build TypeScript/Vite aprovado. 32 testes Playwright no Vite e 32 no build servido pelo Wrangler/CSP aprovados, incluindo regressões de IndexedDB, backup, fontes e PNG/ZIP. `wrangler deploy --dry-run` aprovado, sem bindings adicionais.
- Custo operacional adicional R$ 0: auditoria executa no navegador, sem API externa. Cloudflare Access, Worker e domínio não foram alterados na configuração.
- Publicação manual e conferência remota serão registradas após o deploy. A publicação automática do Radar segue pendente dos segredos `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` e da variável `CLOUDFLARE_ACCESS_READY` no GitHub Environment `production`.
