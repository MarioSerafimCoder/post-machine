# Arquitetura e decisões

## Evolução visual e finalização integrada

- Tokens compartilhados em `src/design-tokens.css`, com ambiente grafite restrito à interface do Studio. A arte, os templates e os dados locais mantêm suas cores e contratos. Menus contextuais têm rótulos centralizados e largura própria para Radar e Studio.
- A central de finalização reutiliza o diálogo nativo, as miniaturas Fabric, o motor de Auditoria, PNG/ZIP e backup existentes. Revisões automáticas usam debounce e cancelamento; o cache local é validado por esquema e impressão do conteúdo e das regras. Resultados desatualizados não aprovam a exportação.
- A impressão SHA-256 da entrega registra conteúdo, ordem, formato, nome e legenda. O registro do download não substitui o checkpoint editável, inclusive na migração de mídia legada. O estado indica download iniciado, sem confundir exportação com publicação.
- CSS nativo para movimento e foco, com respeito a movimento reduzido. Nenhuma dependência, licença, API paga ou serviço adicional foi introduzido.

## Miniaturas do Radar

- A edição v1 aceita uma URL opcional de miniatura. A coleta reutiliza imagens declaradas no item pelo veículo em [Media RSS](https://www.rssboard.org/media-rss) ou no anexo RSS. Cada feed elegível tem um host HTTPS aprovado. A coleta não abre páginas de artigos para buscar Open Graph.
- Os cinco hosts também constam na política de imagens do build. O navegador carrega sob demanda, sem enviar o referenciador. Imagem ausente, inválida, pequena demais ou indisponível dá lugar à assinatura tipográfica da fonte. As miniaturas servem à leitura do Radar.
- O assistente da lista abre em uma coluna em fluxo com a seleção explícita do cartão. Exibe até três frases do resumo publicado pela fonte. O recorte de pauta usa a oportunidade correspondente ou a categoria editorial da notícia. Histórico e preferências continuam no armazenamento editorial existente. Nenhuma nova dependência ou API foi adicionada.

## Retomada e interação no desktop

- A página inicial e a biblioteca compartilham a renderização sob demanda da primeira página do projeto. O histórico da aba guarda a campanha aberta e os filtros de origem. Um marcador local por campanha permite retomar a importação após copiar o prompt. O conteúdo editorial continua no armazenamento existente.
- Studio e Produção Expressa agrupam os estados da fila fotográfica existente. Repetir uma busca incrementa a revisão apenas das consultas interrompidas, mantendo os controles manuais e a concorrência existentes.
- As microinterações usam CSS nativo e respeitam a preferência de movimento reduzido. A entrega reutiliza as dependências e licenças existentes.

## Evolução 12

- A Produção Expressa inicia a busca após organizar o conteúdo. O Studio direto inicia a busca quando a peça pede imagem e tem um frame compatível. No catálogo, os dois caminhos pedem apenas a categoria `photograph`. A consulta usa termos selecionados localmente do título, subtítulo, corpo, CTA, briefing e campanha.
- A classificação documental usa correspondência de assunto e indícios de acervo ou descrição. A expansão traduz termos concretos conhecidos. O apoio editorial exige fotografia pertinente e só é consultado após as tentativas documentais. A pontuação considera resolução, proporção e diversidade. Metadados conceituais, imagens sensíveis e licenças incompatíveis com o recorte são excluídos. A categoria do catálogo e os metadados indicam a natureza documental, com verificação editorial na fonte.
- O Openverse continua anônimo. O original vem de Wikimedia Commons ou Flickr por uma conexão CORS sem credenciais, passa por decodificação local e mantém os créditos no documento e no ZIP. O enquadramento automático estima concentração de contraste. O sistema compara origem, título e uma impressão visual aproximada para reduzir repetição.
- Duas buscas podem progredir em paralelo. As consultas idênticas compartilham a requisição em andamento e o cache de cinco minutos. A chave do slide deriva da intenção, do formato do frame e da revisão de busca. Alterar a chave cancela apenas a busca afetada. O IndexedDB guarda as fotos aprovadas pela política, a estratégia, o motivo e as escolhas manuais. As miniaturas usam a mídia local depois da importação.

## Evolução 11

- O IndexedDB do Studio v6 adiciona a store `authorTemplates`. O contrato v1 guarda uma composição, formato, identidade, finalidade, miniatura PNG e revisão. A transação de gravação compara a revisão esperada. Templates, projetos e recuperação referenciam o mesmo acervo de blobs por SHA-256. A limpeza inclui esses três conjuntos de referências.
- A marcação `templateRole` é opcional em objetos Fabric. Objetos antigos podem herdar funções semânticas compatíveis. A fabricação usa os campos visíveis das camadas de nível superior, mantém as camadas fixas e informa campos ausentes ou texto excedente sem descartar a preparação. O template autoral rende uma proposta por fabricação. As coleções continuam oferecendo três.
- O ZIP autoral usa `template.json` e o mesmo empacotamento e verificação de mídia do projeto. A restauração cria um novo registro, incluindo imagens, logotipos, fontes WOFF2 e créditos associados. Alterar uma composição autoral passa por uma cópia de trabalho do Studio e exige **Atualizar template**.
- A adaptação considera margens e relações verticais, ajusta áreas de texto e imagem de forma independente e ancora chamadas, assinaturas e logotipos próximos do rodapé. A Auditoria roda antes da confirmação. As variantes autorais compartilham um identificador de família e a geometria é usada quando a biblioteca ainda não tem o formato de destino.
- A classificação opcional usa [MobileNetV2 INT8 do ONNX Model Zoo](https://huggingface.co/onnxmodelzoo/mobilenetv2-12-int8) (Apache 2.0, revisão `b5c248f66acc836ca8893c58229b00d2520c388b`, SHA-256 `cc028fe6cae7bc11a4ff53cfc9b79c920e8be65ce33a904ec3e2a8f66d77f95f`) e [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/deploy.html) 1.31.1 (MIT). O worker carrega 3,66 MB de pesos, 14,85 MB de WASM e cerca de 78 kB de JS antes de compressão. Todos os arquivos são estáticos e servidos pela própria aplicação. A CSP autoriza compilação WASM e o worker usa uma thread.
- O MobileNet classifica imagens inteiras nas classes do ImageNet. A aplicação liga um subconjunto dessas classes a termos em português e inglês, exige pontuação mínima e explica a associação encontrada. Vínculos manuais têm prioridade. Um cálculo separado procura concentração de contraste e sugere um ponto focal apenas acima do limiar. Recortes manuais têm precedência.
- A reanálise offline funciona enquanto o worker e os recursos dele estão carregados. A aplicação preserva as sugestões por metadados quando o carregamento ou a execução falha. Fotos, classificações e arquivos de trabalho permanecem no navegador. A classificação e o download dos arquivos estáticos têm custo operacional adicional de R$ 0.

## Evolução 10

- O IndexedDB do Studio v5 adiciona `expressDrafts` e `expressPhotos`. Cada campanha tem uma preparação recuperável, e a entrada independente tem sua própria chave. O metadado referencia as fotos armazenadas como Blob. A transação verifica a revisão anterior e grava as duas stores juntas. O fluxo converte a proposta aprovada em projeto independente antes de limpar a preparação.
- O planejador reserva primeiro as associações explícitas. O pareamento seguinte usa termos do briefing ou título e metadados dos arquivos. Proporção e resolução ajudam a desempatar. O fallback mantém a ordem e a prévia usa o mesmo planejador da fabricação.
- A Auditoria reúne movimentos geométricos sobre uma cópia do projeto, reexecuta o diagnóstico e submete a proposta à confirmação. O lote usa o mesmo checkpoint da correção individual.

## Editorial Intelligence 2.0

- `src/features/intelligence/` contém catálogo e esquemas de validação, decisão contextual, briefing, leitura dos resultados da Auditoria e interface do assistente. O catálogo normaliza os IDs bibliográficos do ZIP como `sourceIds` e conserva os registros experimentais separados. As ligações explícitas de concretude, negatividade em manchetes e coerência multimídia conservam o escopo da evidência. As datas e o tipo de verificação documental vêm do pacote v2.0.0.
- Campanhas adicionam metadados opcionais ao briefing. O adaptador de prompt reutiliza o exemplo e a validação v1, com instruções limitadas ao contexto e à quantidade de peças selecionada. A intenção comparativa aprovada entra como preferência de composição quando o conteúdo e o papel da peça são compatíveis.
- A área ativa fornece sinais tipados e ações transitórias a uma store de sessão. Só o assistente subscreve o conjunto de sinais. Relatórios são elegíveis enquanto `sameReviewVersion()` confirmar a revisão, e correções passam pelo fluxo existente de confirmação, tentativas e desfazer.
- Preferências do assistente usam `localStorage` com esquema versionado e até 80 decisões. A memória registra identificadores, data e escolha, sem texto de campanhas, artigos, imagens ou projetos. O GIF fornecido e seu primeiro quadro são ativos locais. Não há API de modelo, sincronização ou serviço adicional.

## Evoluções 01 e 02

O cabeçalho usa as rotas por hash existentes. A barra contextual reutiliza os controles de cada área. Após a primeira visita, Radar e Studio permanecem montados para preservar filtros, briefing e edição. O Fabric continua usando o mesmo modelo de projeto e armazenamento.

O coletor gera até 48 oportunidades a partir da edição do Radar e até quatro artigos por oportunidade. O agrupamento exige proximidade de publicação, categoria e termos específicos em comum. Nome e domínio ajudam a evitar a repetição do mesmo veículo. Isso não comprova independência societária nem autoria independente.

O snapshot v1 aceita os campos opcionais `opportunities` e `observations`. O coletor compara com a edição anterior e guarda até 120 observações da edição atual. “Em alta” exige aumento do patamar aproximado do mesmo tema, feed e episódio do Google Trends, observado entre uma e 24 horas depois. Sem evidência compatível, o motor usa critérios editoriais e de publicação. O navegador exibe as recomendações já calculadas. A pauta usa o contrato v2 e preserva o conjunto de fontes na importação.

Decisões registradas em 13/11/2026. Escopo implementado: fundação, Radar e campanhas. Fase 3 em andamento. Especificação integral em PRODUCT_SPEC.md.

## Estrutura

SPA estática: React + TypeScript estrito + Vite. Tailwind via plugin oficial e CSS com tokens de cor, tipografia, espaçamento e componentes. Sem fontes externas, rastreadores, imagens remotas ou backend. Ilustração editorial original em CSS; não representa um projeto salvo ou um template operacional.

Plataforma exclusivamente desktop, por instrução do proprietário em 13/11/2026. Desktop first sempre. Viewport mínimo 1024 px; abaixo dele somente aviso, sem navegação ou ferramentas. QA em 1280×800 e 1440×1000. Nenhuma experiência mobile será implementada.

- `src/App.tsx`: shell e áreas iniciais. Separar cada módulo em `src/features/<modulo>` quando receber comportamento real.
- `src/components`: ícones e diálogo de roteiro, reutilizáveis.
- `src/lib/navigation.ts`: navegação por hash com histórico nativo e links diretos; não exige roteamento no servidor.
- `src/test`, `e2e`: testes de comportamento e interface desktop, incluindo aviso em telas não suportadas.
- `public`: ícone e cabeçalhos de segurança para Static Assets.
- `wrangler.jsonc`: build estático, sem Worker de aplicação, banco ou rotas ativas por padrão.

O shell atual não persiste dados. Na Fase 3, IndexedDB versionado guardará projetos, imagens como Blob e configurações. Não salvar uploads no GitHub nem em localStorage. Backup explícito, validação antes de restaurar e migrações testadas; não há sincronização entre dispositivos.

## Bibliotecas

Versões e licenças verificadas no registro npm oficial (`https://registry.npmjs.org/<pacote>/latest`); versões instaladas fixadas no package.json e lockfile. Revalidar compatibilidade ao atualizar, sem pesquisa repetida a cada tarefa.

| Biblioteca | Versão consultada | Licença | Decisão |
| --- | --- | --- | --- |
| React / React DOM | 19.3.1 | MIT | Interface |
| TypeScript | 6.0.3 | Apache-2.0 | Tipagem estrita; 7.0.2 rejeitado por peer dependency de typescript-eslint (<6.1) |
| Vite | 8.3.8 | MIT | Build estático |
| Tailwind CSS | 4.3.5 | MIT | Tokens e utilitários |
| Vitest | 5.1.0 | MIT | Testes unitários/componentes |
| Playwright | 1.65.0 | Apache-2.0 | Testes desktop/laptop |
| Wrangler | 4.162.0 | MIT OR Apache-2.0 | Deploy de Static Assets |
| Fabric.js | 7.4.0 | MIT | Studio, carregado sob demanda |
| Zod | 4.6.7 | MIT | Validação do Radar na coleta e no navegador |
| Saxes | 6.0.0 | ISC | Parser XML sem DTD e sem entidades externas |
| JSZip | 3.10.2 | MIT OR GPL-3.0-or-later | Backup e exportação; opção MIT |

Node 24 LTS, mínimo 24.15, atende requisitos atuais do Vite, Vitest e jsdom. Versão usada localmente: 24.22.1. Dependências de desenvolvimento não são incluídas automaticamente no bundle do usuário.

Override transitivo: minimatch 11.0.8 (BlueOak-1.0.0, permissiva), para corrigir GHSA-g3hv-75wg-m249 nas ferramentas de lint. Remover o override quando upstream declarar dependência corrigida; validar lint/test/build após alteração.

Fabric exige tratamento explícito de fontes, imagens cross-origin e serialização; não promete exportação de imagens sem CORS. IndexedDB está sujeito a limpeza/limite do navegador; backup será obrigatório no desenho da funcionalidade. Google Trends e RSS exigem verificação das fontes, quotas e disponibilidade na Fase 1. Openverse exigirá licença, atribuição, resolução e teste de CORS por imagem na Fase 5.

## Referências e custos

- [Vite: requisitos](https://vite.dev/guide/): Node 20.19+ ou 22.12+; usamos Node 24.
- [Fabric: MIT](https://github.com/fabricjs/fabric.js/blob/master/LICENSE).
- [Lumio](https://github.com/vipinyadav01/lumio-design-studio): referência declara MIT; nenhum código reutilizado.
- [design-editor](https://github.com/ciftcisamet/design-editor): apenas referência; licença/compatibilidade não auditadas para reutilização.
- [TrendRadar](https://github.com/sansan0/TrendRadar): referência arquitetural; tratar GPL-3.0 como impeditivo de cópia sem análise. Nenhum código incorporado.
- [Static Assets: custos e limites](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/): requisições estáticas gratuitas/ilimitadas; Workers têm limites separados. Usar plano Free, sem bindings ou produtos pagos. Não fazer upgrade automático.
- [Cloudflare Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/): proteger todos os hostnames expostos; desabilitar workers.dev e previews se não protegidos. A escolha do plano gratuito e da identidade depende da conta e está em SETUP.md.

## Coleta e chegada à produção (Fase 1)

Um coletor Node lê configuração de fontes, normaliza/deduplica e valida um snapshot JSON versionado. Guardar somente títulos, metadados, resumos disponibilizados e links; não republicar artigos integrais.

Agendar três execuções/dia no GitHub Actions (proposta: `17 9,15,21 * * *` UTC = 06:17, 12:17, 18:17 em São Paulo). Horários não são SLA e execuções podem atrasar. O mesmo workflow deverá coletar, validar, executar testes, compilar e publicar o snapshot. Não depender de um push feito pelo GITHUB_TOKEN para iniciar outro deploy: [GitHub documenta a ausência desse disparo](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).

O snapshot v1 inicial é versionado; as atualizações ficam em artefatos do GitHub Actions por 14 dias. Até 600 itens são retidos, com janela de 14 dias desde a coleta de cada item. Uma falha total preserva as notícias e a última data de sucesso e atualiza o estado das fontes. Links originais são preservados; a deduplicação usa URL canônica e similaridade conservadora de títulos.

As fontes RSS recebem o nicho do arquivo de configuração. Os artigos relacionados no [RSS oficial do Google Trends](https://support.google.com/trends/answer/3076011?hl=pt-BR) recebem o nicho por palavras-chave, com fallback “Em alta”. A associação ao Trends é um destaque editorial; não representa audiência do artigo. O coletor não usa a data da tendência como data de publicação.

Aceite end-to-end: conferir, após autenticação Access, o mesmo `collectedAt` do artefato da execução no JSON de produção.

## Campanhas v2

As headlines usam um contrato local versionado e opcional, salvo por peça na campanha e no objeto de título do Studio. O JSON externo é validado com Zod. A campanha é usada como contexto para o prompt, que pode ser copiado e usado fora da aplicação. O Studio mede a caixa com Fabric e aplica somente o texto e seus metadados de edição. Os backups carregam esses campos com o documento.

O armazenamento do Studio coordena gravações e coleta de órfãos via Web Locks quando disponíveis. A limpeza valida e usa a mesma transação para ler e excluir arquivos. A escrita da Auditoria e as revisões subsequentes do Studio comparam a versão persistida antes de substituir um projeto.

## Imagens e créditos

A pesquisa usa o endpoint anônimo do Openverse, valida o JSON com Zod e mantém um cache de cinco minutos por consulta e página. A CSP permite o catálogo e suas miniaturas. Downloads automáticos fazem uma requisição CORS sem credenciais, rejeitam redirecionamentos e se limitam a `upload.wikimedia.org` e `live.staticflickr.com`. Outros provedores podem ser usados pelo fluxo de upload manual. Nenhum proxy foi adicionado.

O original entra no mesmo fluxo de arquivos locais do Fabric. O contrato versionado de créditos é opcional no objeto de imagem. O URL remoto fica como referência textual. O canvas renderiza dados locais e o IndexedDB deduplica bytes por SHA-256. O histórico lê referências de projetos e de recuperação. O ZIP de artes inclui créditos consolidados sem alterar o PNG.

Identificadores técnicos post-machine preservados. Contrato editorial importado continua v1. Documentos locais v2 admitem origem nula e título próprio; leitura de v1 migra sem notícia fictícia. IndexedDB v2 atualiza registros em transação atômica, abortando se algum registro for inválido. Backups v1 continuam aceitos e restauração preserva colisões como cópias.

SaveQueue agrupa edições por 350 ms, serializa gravações por ID e retém a última alteração em falhas. Navegação, troca de documento e perda de visibilidade disparam flush; beforeunload é proteção complementar. A área editorial permanece montada para manter pendências e permitir retentativa. Dados locais não são sincronizados entre abas/dispositivos.

## Studio (Fase 3)

- Fabric.js 7.4.0: API moderna com imports nomeados, loadFromJSON e dispose assíncronos. Propriedades semânticas registradas em FabricObject.customProperties. Fontes/imagens carregadas antes de renderizar ou exportar. Referências: https://fabricjs.com/docs/ e https://fabricjs.com/docs/using-custom-properties/.
- Documento gráfico schemaVersion 1, até 20 slides e 500 objetos por slide. Contrato Zod validado antes de hidratar Fabric; sem URLs externas, classes arbitrárias ou HTML. Campos semânticos preservam título/corpo/CTA/imagem ao trocar de template; ajustes gráficos exigem confirmação e têm undo.
- IndexedDB post-machine-studio v2: projects, assets, settings e recovery. Migração aditiva de v1. Imagens e fontes em Blob por SHA-256; referências asset: são hidratadas em memória. Backup ZIP preserva o estado atual, marca e arquivos únicos, com verificação de hash ao restaurar; novo ID impede sobrescrita. Checkpoint anterior persistido; undo/redo de 30 operações é de sessão. Projetos nunca são enviados ao servidor.
- Exportação por StaticCanvas isolado em resolução original, independente do zoom/seleção/retina. PNG individual e ZIP ordenado. Avisos técnicos determinísticos; não equivalem à auditoria da Fase 4.
- Fontes: Inter regular/negrito latinas distribuídas localmente via pacote @fontsource/inter 5.3.0, SIL OFL 1.1 (licença em public/fonts/Inter-LICENSE.txt). Fontes do sistema são alternativas; WOFF2 próprio até 2 MB/arquivo, máximo oito, incluído em backup. Sem Google Fonts remoto. Usuário deve possuir licença de seus uploads.
- FontFace carrega uploads por ArrayBuffer; imagens são decodificadas sem fetch(data:) para respeitar connect-src self. A suíte de produção roda pelo Wrangler local com os mesmos cabeçalhos CSP.
- Custo adicional R$ 0: nenhum novo Worker, serviço, API de IA ou armazenamento remoto.

## Refinamento da Fase 6

- A visão geral carrega a navegação e o shell. Radar, Studio e Auditoria entram sob demanda. Radar e Studio permanecem montados após a primeira visita para conservar filtros, seleção e documentos pendentes. A biblioteca de referências normaliza texto e URLs por edição do acervo e exibe páginas de 24 cartões.
- A sessão do slide mantém o canvas editável. Miniaturas entram na fila ao aparecer na faixa de slides e usam uma superfície de 10% da escala original. A troca da cena cancela miniaturas pendentes. A exportação renderiza uma vez em canvas isolado, sem seleção ou guias.
- A fila de salvamento de campanhas compara o registro esperado na mesma transação que grava ou exclui. Conflitos preservam a alteração pendente na sessão e permitem exportar o backup. O Studio já comparava a revisão persistida. No empacotamento e na hidratação de um projeto, ocorrências repetidas de uma imagem ou fonte compartilham sua conversão.
- Os ZIPs de projeto continuam no contrato v1. A restauração lê as entradas necessárias em blocos, limita o documento e cada arquivo a 20 MB descompactados e a soma a 150 MB, valida o documento com Zod e confere o SHA-256 de cada arquivo referenciado. Entradas extras não são descompactadas. Os dados existentes permanecem disponíveis em caso de falha.
- A interface usa a [WCAG 2.2](https://www.w3.org/TR/WCAG22/) como referência. A lista de camadas permite selecionar pelo teclado, usar propriedades numéricas, editar texto, duplicar, excluir e alterar ordem. Arrastar objetos, selecionar grupos na superfície e inspecionar composição visual continuam sendo operações gráficas.
