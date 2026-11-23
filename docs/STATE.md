# Estado real — 23/11/2026

## Evolução 12 — Busca fotográfica automática

- O Studio publicado iniciou as buscas no carrossel sobre o filme natalino da GEICO, mas os cinco frames de imagem ficaram em “Sem sugestão”. A consulta exata em português e sua reformulação voltavam ao mesmo assunto da manchete. Depois das tentativas documentais, o Studio agora reconhece pistas explícitas do briefing, do título e do corpo e consulta termos em inglês para o evento ou a técnica. Os resultados precisam trazer evidências do contexto e continuam sujeitos às mesmas regras de licença. Incluem a indicação de apoio editorial e o link original nos créditos.
- Em um carrossel de teste com o mesmo recorte e texto reconstituído, o Openverse real forneceu fotos editoriais para quatro de cinco frames de imagem. O quinto terminou sem sugestão. Lint, 127 testes unitários, build, 134 cenários da suíte Playwright inicial e oito cenários dirigidos passaram localmente. A regressão confirmou em 1280 e 1440 px que uma falha na consulta exata ainda permite aplicar uma foto de contexto.
- O [CI](https://github.com/MarioSerafimCoder/post-machine/actions/runs/45199869186) aprovou `400db4f`. O [deploy protegido](https://github.com/MarioSerafimCoder/post-machine/actions/runs/45200923322) publicou a versão `41d7e765-bccb-442e-9ff8-380bb2cdc3fa` a 100% do tráfego e verificou o Cloudflare Access antes e depois da publicação.
- No projeto original reaberto no Chrome após o deploy, o frame 4 recebeu uma fotografia de apoio e a capa recebeu outra depois de repetir uma consulta interrompida. Os frames 2 e 5 terminaram sem sugestão compatível. O frame 3 ficou indisponível após novas tentativas, com requisição do Openverse interrompida. O encerramento continuou textual. O Studio salvou as duas fotos no projeto existente.
- A revisão durante a edição tratava cada caixa de texto vazia como pendência, inclusive a chamada para ação reservada pelo template em capas e slides de conteúdo. A regra agora verifica a função do slide e procura conteúdo em todas as caixas do mesmo tipo antes de avisar. Uma caixa obrigatória vazia ainda pode ser localizada pelo bot, inclusive em projetos salvos antes da mudança.

- Campanhas com quantidade compatível abrem o Studio no formato selecionado no briefing, inclusive quando o JSON ou Markdown traz outro rótulo de formato. Divergências de quantidade informam os dois valores. Lint, 125 testes unitários, build e 12 cenários Playwright dirigidos passaram.

- Colar ou importar conteúdo e organizar as peças inicia a consulta em segundo plano na Produção Expressa. Novos projetos enviados diretamente ao Studio reservam áreas de imagem e iniciam a busca a partir do título e do texto, inclusive com briefing visual vazio. Peças explicitamente textuais e encerramentos mantêm o layout textual. Projetos já salvos preservam suas composições.
- A política do Openverse tenta o modo Documental, reformula os termos e só então considera fotografia de apoio editorial. Metadados conceituais, ilustrações, correspondências frágeis e licenças incompatíveis são rejeitados. A procedência é inferida pelo catálogo e permanece sujeita à conferência na fonte.
- A mídia decodificada é posicionada na área existente. O ponto focal estimado por contraste pode ser ajustado. Confirmações, travas, escolhas manuais e remoções têm precedência. Consultas obsoletas são canceladas por slide. As respostas em memória são reaproveitadas por cinco minutos e as decisões e imagens aplicadas são recuperadas do IndexedDB.
- A consulta real sobre a Torre Eiffel recebeu HTTP 200 do Openverse e inseriu uma fotografia no Studio. Os testes controlados cobriram atraso de rede, resultado documental, apoio editorial, descarte de ilustrações, ausência de confiança, cancelamento por edição, trava, reabertura e créditos no ZIP. As capturas locais mostram os fluxos em 1280 e 1440 px. O Openverse anônimo, as fontes elegíveis e o CORS dos originais limitam a cobertura.
- `npm ci`, lint, 124 testes unitários, build e dry-run passaram. A suíte completa do Wrangler passou 134 cenários, com 10 repetições omitidas no laptop. A execução completa no Vite passou 133 cenários e encontrou uma fixture de pesquisa manual que interceptava também a consulta automática. Após isolar as chamadas na fixture e validar os últimos ajustes, passaram 39 cenários dirigidos no Vite e 18 no Wrangler. A regressão de overflow também passou na reexecução.
- A versão final `54b78ab` passou localmente em lint, 125 testes unitários, build e 134 cenários Playwright, com 10 repetições omitidas no perfil laptop. Em 1280 e 1440 px, um ensaio com respostas controladas verificou três consultas distintas e três fotos encaixadas após a importação direta no Studio, com briefing visual vazio. O encerramento textual ficou sem busca. Na reexecução com o Openverse real, o frame sobre a Ponte do Brooklyn recebeu foto editorial e duas consultas ficaram indisponíveis.
- O [CI](https://github.com/MarioSerafimCoder/post-machine/actions/runs/45196457433) aprovou `54b78ab`. O [deploy protegido](https://github.com/MarioSerafimCoder/post-machine/actions/runs/45197379375) promoveu a versão `5f55fcf5-4e5b-4d8c-8b07-9996ad57b175` a 100% do tráfego. O domínio, os dois feeds e o favicon responderam com HTTP 302 para o Cloudflare Access antes e depois da publicação. Para aplicar o fluxo a uma campanha cujo primeiro design foi criado antes da atualização, abra a campanha e use **Salvar e abrir no Studio** para gerar outro projeto.

## Evolução 11 — Templates autorais, formatos e análise visual local

- **Interface e movimento.** A navegação usa hover cinza, indicador ativo vermelho e foco visível. Controles, superfícies e rótulos receberam tokens compartilhados. As transições respeitam movimento reduzido. Produção Expressa mostra etapas concluídas, vínculos e progresso. Studio sinaliza gravação e mudanças de slides. Auditoria exibe progresso, localização e confirmação de correções.
- **Templates autorais.** Em **Mais ações → Salvar como template**, o Studio guarda a composição do slide ativo, com nome, finalidade editorial, miniatura e identidade. O painel do elemento atribui funções semânticas. **Meus templates** permite visualizar, usar, renomear, duplicar, editar, favoritar, filtrar, excluir com confirmação e importar ou exportar ZIP. A fabricação reaproveita as caixas do template, preserva camadas fixas e apresenta avisos de encaixe. Quando falta uma área obrigatória, a preparação fica disponível para correção.
- **Adaptação de formato.** Retrato, quadrado e Story têm comparação lado a lado e Auditoria antes de salvar. A cópia editável preserva texto, vínculos, mídia, fontes e créditos. A biblioteca reaproveita variantes da mesma família. Camadas sem função passam por ajuste geométrico e recebem aviso de revisão.
- **Classificação visual.** O MobileNetV2 INT8 é opcional e processa as imagens no navegador. No teste com nomes neutros, a distribuição por ordem sugeriu a foto de café para a pauta sobre gatos. Após a análise, o classificador direcionou a foto de gato à pauta. As duas fotos receberam classes esperadas. O PNG transparente ficou inconclusivo. A reanálise offline, o vínculo manual, o ajuste focal e o fallback por metadados foram exercitados.
- **Medição local.** No Chromium 158 em Intel Core Ultra 7 155H, os três arquivos levaram cerca de 2,4 s com carregamento inicial. Três reanálises offline levaram 0,52–1,01 s por lote. Os arquivos do modelo, runtime e worker somam 18,58 MB antes de compressão. O working set somado dos processos do navegador aumentou cerca de 142 MiB nesse ensaio. Esse valor inclui o navegador e é uma aproximação, pois a medição abrange a árvore de processos inteira.
- **Revisão visual.** Capturas comparativas de Visão geral, Radar, Campanhas, Produção Expressa, Coleções, Studio, Auditoria, exportação, menu e modal em 1024 × 768, 1280 × 800, 1440 × 900 e 1920 × 1080. A largura do documento coincidiu com o viewport nessas capturas. A interface mantém o aviso abaixo de 1024 px. As evidências estão no espaço de trabalho local.
- **Limites.** Cada template autoral representa um slide, e seus campos de fabricação são camadas de nível superior. A classificação cobre um vocabulário limitado de classes do ImageNet. O ponto focal automático estima concentração de contraste. A operação offline foi validada com o worker já carregado. A adaptação requer conferência editorial quando a Auditoria aponta ocorrências ou a composição contém camadas sem função.
- **Verificação local.** `npm ci`, lint, 122 testes unitários, build e dry-run aprovados. As suítes Playwright no Vite e no Wrangler local aprovaram 128 cenários cada, com 10 repetições intencionalmente omitidas no perfil laptop. A publicação usa exclusivamente o workflow protegido, com CI aprovado para o mesmo SHA e verificação do Cloudflare Access.
- **Publicação.** O [CI](https://github.com/MarioSerafimCoder/post-machine/actions/runs/45180941273) aprovou `864790d`. O [workflow protegido](https://github.com/MarioSerafimCoder/post-machine/actions/runs/45181772408) publicou a versão `286ba78b-7b66-4d33-a26f-302f9ae8f17d` a 100% do tráfego. O domínio, os dois feeds, o favicon e os três arquivos do classificador redirecionaram solicitações anônimas ao Cloudflare Access. A [execução anterior](https://github.com/MarioSerafimCoder/post-machine/actions/runs/45179970529) recebeu o erro `100146` na promoção. O workflow agora pode repetir a promoção da mesma versão quando recebe esse código.

## Evolução 10 — Criação, recuperação e automação local

- 10.1: a Produção Expressa retoma ou descarta preparações por campanha ou pela entrada independente. O IndexedDB v5 grava os arquivos como Blob e registra a revisão para rejeitar sobrescritas entre abas. O projeto aprovado usa o salvamento normal do Studio. Reorganizar texto preserva vínculos e enquadramento apenas quando há uma correspondência única. Edições contínuas de texto formam uma operação de desfazer, com autosave ativo. Alinhamento usa a margem da marca e a geometria em coordenadas da arte.
- 10.2: **Criar conteúdo** abre três origens e encaminha aos módulos existentes. Uma colagem estruturada válida organiza automaticamente uma preparação vazia. Substituir slides editados pede confirmação. A importação direta de Campanhas e a retomada de projetos na página inicial foram reaproveitadas.
- 10.3: o pareamento reserva imagens explícitas e usa termos do briefing, título, nome e título da fonte. Proporção e resolução ajudam a desempatar candidatos comparáveis. A tela mostra miniaturas, razões, distribuição e controles por teclado. A fabricação mantém três propostas editáveis e usa medições de título, corpo e CTA na escolha, com quebra por grafema quando uma palavra excede a caixa. Correções geométricas em lote têm prévia, confirmação e um passo de desfazer. O lote é recusado quando a revisão detecta nova ocorrência geométrica.
- 10.4: o painel detalhado do Assistente usa a área lateral sem sobrepor a arte. O modo silenciado usa o quadro estático e fechar a revisão editorial restaura o foco. Campos do Studio ganharam borda mais contrastante e os Frames, rótulos maiores. A Produção Expressa indica etapa, conteúdo preparado e próxima ação. O produto mantém a restrição desktop de 1024 px.
- `npm ci`, lint, 118 testes unitários, build e dry-run aprovados. Vite e Wrangler local completaram 112 cenários Playwright cada, com dez repetições intencionalmente omitidas no perfil laptop. Os arquivos de 1, 6 e 20 slides foram conferidos em PNG de 1080 × 1350. A suíte cobriu restauração v1, falhas de IndexedDB, cancelamento, recarga da preparação, comparação com a exportação e edição por teclado. A inspeção visual cobriu Studio, Radar, Produção Expressa e Auditoria em 1024 × 768, 1280 × 800, 1440 × 900 e 1920 × 1080.
- Limites: rascunhos estão no navegador. A sugestão de imagem depende de metadados e exige seleção editorial. O diagnóstico factual e visual subjetivo permanece sob revisão humana.
- O [CI](https://github.com/MarioSerafimCoder/post-machine/actions/runs/45168636015) aprovou `f557b37`. O [deploy protegido](https://github.com/MarioSerafimCoder/post-machine/actions/runs/45169494736) vinculou esse commit à versão `b30e7ce0-20a4-41ed-975c-e2547d268e01` e promoveu 100% do tráfego. A verificação após a publicação confirmou o Cloudflare Access no domínio, nos dois feeds e no favicon. Os testes funcionais desta entrega executaram no Chromium local.

## Aviso de leitura da matéria no Radar

- Criar uma pauta a partir de uma notícia do Radar não gera mais o aviso de íntegra pendente. A recomendação de acesso à fonte aparece quando o editor a marca como inacessível. O prompt continua indicando que o Radar forneceu título ou resumo, conforme os dados disponíveis.
- Lint, build, 116 testes Vitest e 100 cenários Playwright aprovados, com seis repetições omitidas no perfil laptop. O [CI](https://github.com/MarioSerafimCoder/post-machine/actions/runs/45163204874) aprovou `bb0f75a`. O [deploy](https://github.com/MarioSerafimCoder/post-machine/actions/runs/45163233678) publicou `101a15f7-c36b-418a-98c5-3f4408d8ad33` a 100% e o Cloudflare Access foi verificado após a publicação.

## Revisão editorial durante a produção

- O Studio reaproveita regras da Auditoria para inspecionar o slide ativo após 750 ms de estabilidade. Verifica campos editoriais vazios, transbordamento, visibilidade e geometria nas dimensões da arte. O robô exibe achados localizáveis e heurísticas de título, com dispensas associadas à ocorrência apresentada.
- A revisão do carrossel localiza títulos repetidos, peças incompletas, papéis fora da sequência e divergências verificáveis em relação ao briefing vinculado. A interpretação semântica fica em um prompt copiável para o ChatGPT externo, com o conteúdo atual dos slides.
- Campanhas e Produção Expressa mostram a prévia da resposta estruturada e indicam campos JSON fora do modelo antes da aplicação. A Produção Expressa usa a direção de imagem do slide para preencher a busca no Openverse e oferece vinculação explícita com os créditos selecionados.
- A biblioteca do Studio e da Auditoria lê resumos locais. A versão 4 do IndexedDB prepara o catálogo na primeira consulta e mantém os resumos na transação dos projetos, incluindo a revisão usada para proteger exclusões concorrentes. O Studio isola a revisão em um hook e painel dedicados, memoriza as miniaturas pelos dados da cena e agrupa posição e aparência nas propriedades.
- Lint, build, dry-run, 115 testes Vitest e 98 cenários Playwright aprovados. Seis repetições foram omitidas no perfil laptop. Oito cenários direcionados passaram no Wrangler local. A revisão visual e os testes de regressão cobriram 1280 e 1440 px, incluindo descarte de aviso resolvido e atualização somente da miniatura editada. A busca Openverse foi exercitada com fixture de imagem licenciada.
- O [CI](https://github.com/MarioSerafimCoder/post-machine/actions/runs/44362321646) aprovou `807f587`. O [deploy protegido](https://github.com/MarioSerafimCoder/post-machine/actions/runs/44362335806) promoveu a versão `85e9f797-68b8-47ac-949c-41b7279c1eda` a 100% do tráfego. O domínio, os dois feeds e o favicon responderam com HTTP 302 para o Cloudflare Access após a publicação.

## Refatoração pontual — memória editorial entre abas

- Commit funcional `f06c7fa`: a memória do Assistente Editorial agora observa alterações do `localStorage` feitas em outras abas, atualiza os assinantes e parte do estado persistido mais recente ao alterar notificações, limpar histórico ou registrar decisões. Em navegadores que bloqueiam o armazenamento, mantém o fallback em memória da sessão.
- Regressão incluída em `src/features/intelligence/feedback.test.ts`, cobrindo sincronização externa, preservação de decisões, mudança de modo e limpeza do armazenamento.
- [CI do código](https://github.com/MarioSerafimCoder/post-machine/actions/runs/44356989006) aprovado: lint, Vitest, build, Playwright e dry-run do Wrangler. Refatoração restrita ao módulo de memória; sem mudanças em projetos, editor Fabric, importação ou exportação. Nenhuma publicação de produção foi solicitada nesta auditoria.

## Correções da auditoria da Evolução 09

- O Studio verifica os limites do ZIP antes de encaminhar o download. Criação e restauração compartilham os limites do documento, dos arquivos e do tamanho total. O teste de regressão usa texto multibyte para verificar o limite em bytes.
- Studio e Auditoria identificam registros incompatíveis sem ocultar os projetos válidos. A abertura da biblioteca migra o IndexedDB para a versão 3 e cria o índice de data usado na retomada da edição. Alterações de slides e demais edições atualizam a data no fluxo comum de salvamento. A página inicial consulta novamente após uma gravação pendente.
- O salvamento reaproveita identificadores de arquivos da revisão anterior e grava somente mídias ausentes. O backup calcula seus próprios identificadores para exportar um ZIP autocontido.
- Lint, build, 115 testes Vitest e 94 cenários Playwright aprovados, com seis repetições omitidas no perfil laptop. Oito cenários direcionados passaram no Wrangler local em 1280 e 1440 px. Na gravação monitorada de um projeto com imagem existente, houve zero novos hashes e zero gravações de mídia.
- O [CI](https://github.com/MarioSerafimCoder/post-machine/actions/runs/44358788730) aprovou `e0ce8cd`. O [deploy protegido](https://github.com/MarioSerafimCoder/post-machine/actions/runs/44358810512) promoveu a versão `586339e9-e68a-4336-87a8-b4deb1437fbb` a 100% do tráfego. Após a publicação, a página inicial, ambos os feeds e o favicon responderam com HTTP 302 para o Cloudflare Access.

## Evolução 09 — Produtividade e consistência da interface

- Base `7756453`. A interface usa Inter local e tokens de tipografia, cor e interação. A barra do Studio separa gestão do projeto, edição, finalização e ações de manutenção. O Assistente Editorial põe a ação principal antes das referências, mantém as demais sugestões recolhidas e aguarda uma pausa da digitação para exibir o balão.
- A página inicial consulta metadados locais para criar ou retomar a edição. A Auditoria oferece projetos recentes com nome, número de slides e data, preservando a seleção completa da biblioteca. A consulta inicial usa um módulo próprio de armazenamento de 0,63 kB gzip. O JavaScript de entrada, incluindo o runtime separado, passou de 74,75 para 75,40 kB gzip. O CSS principal passou de 5,42 para 5,81 kB gzip.
- Lint, build, dry-run, 113 testes Vitest e 92 cenários Playwright aprovados, com seis repetições omitidas no laptop. Doze cenários direcionados passaram no Wrangler local. Capturas e verificações de overflow cobriram 1024 × 768, 1280 × 800, 1440 × 900 e 1920 × 1080. O navegador confirmou que a página inicial consulta a biblioteca sem carregar os módulos de edição, fabricação e auditoria.
- O [CI](https://github.com/MarioSerafimCoder/post-machine/actions/runs/44322007088) aprovou `0096820`. O [deploy protegido](https://github.com/MarioSerafimCoder/post-machine/actions/runs/44353331540) publicou a versão `54c3d3fe-f485-4b9c-957b-ec1c907e3e2e` a 100% do tráfego. O Cloudflare Access foi verificado antes e depois da publicação. Em produção autenticada, Continuar editando abriu um projeto existente no Studio e Revisar projeto abriu o diagnóstico pela lista da Auditoria.

## Evolução do Assistente Editorial

- Base `d5c0c43`. O GIF e o quadro estático originais permanecem. No editor, um portal ancora o avatar transparente, o balão pixel-art e o painel flutuante ao espaço cinza, fora da cena Fabric e dos controles dos Frames. Abrir ou fechar os detalhes preserva a grade e a rolagem.
- O assistente acompanha notícias e oportunidades em foco no Radar e, antes da Auditoria, reconhece capa, título selecionado e camada de imagem no Studio. A Produção Expressa orienta a comparação de propostas e prioriza avisos reais. A fila deduplica sinais, respeita a área ativa e retira ocorrências obsoletas. Ocultar o balão só afeta a apresentação. O feedback explícito continua no histórico local.
- Lint, build, dry-run do Wrangler, 113 testes Vitest e 90 cenários Playwright aprovados. Seis repetições foram omitidas no perfil laptop. Dez cenários passaram no Wrangler local, incluindo enquadramento, teclado, ausência de mudança de altura e rolagem, descarte e fluxo integrado com exportação e backup. A inspeção visual cobriu 1024 × 768, 1280 × 800, 1440 × 900 e 1920 × 1080, com o robô recolhido, o balão e os detalhes.
- O [CI](https://github.com/MarioSerafimCoder/post-machine/actions/runs/44313878059) aprovou `25f8fe6`. O [deploy protegido](https://github.com/MarioSerafimCoder/post-machine/actions/runs/44313918292) publicou a versão `7777297b-a2d6-4b3a-a70a-0398be27a73d` a 100% do tráfego e confirmou o Cloudflare Access antes e depois. Na sessão autenticada, o avatar abriu dentro da área cinza, com fundo transparente e sem sombra. O painel apareceu nesse mesmo espaço e fechou pelo controle existente.

## Editorial Intelligence 2.0 e Assistente Editorial

- Base `8deaf49`, com lint, build, 105 testes Vitest e 81 cenários Playwright aprovados antes da edição. A entrega inclui as 38 regras, 56 fontes, três evidências e seis perfis de plataforma do pacote v2.0.0. O carregamento do catálogo valida IDs, associações e referências. A biblioteca mantém separadas as fontes bibliográficas, alegações de evidência e datas de revisão documental.
- Radar e Campanhas reaproveitam notícias, oportunidades e referências criativas para sugerir recortes, formato e alternativas. A aplicação é explícita. A revisão editorial sinaliza divergências já declaradas, fontes parciais, títulos repetidos, CTAs, diferenças de formato e pontos de revisão em Headlines. O prompt adapta estrutura por peça, CTA, fontes, canal e direção de arte, preservando JSON e Markdown v1 e a quantidade escolhida. A comparação aceita pode informar a composição existente da Produção Expressa.
- O Assistente Editorial usa o GIF fornecido, com SHA-256 idêntico ao anexo, e um primeiro quadro estático para movimento reduzido. Sinais vêm da área ativa. O Studio usa indicador discreto durante o trabalho e painel abaixo do editor sob demanda. O assistente localiza avisos de fabricação e achados vigentes, e encaminha correções à Auditoria existente. Feedback e preferências locais são limitados a 80 decisões, por perfil explícito ou campanha.
- Lint, TypeScript, build, dry-run, 111 testes Vitest e 88 cenários Playwright aprovados. Seis repetições foram omitidas no perfil laptop. No Wrangler local, oito cenários direcionados passaram, incluindo oportunidade até fabricação, Auditoria, ZIP e backup. Inspeção do Studio em 1024 × 768, 1280 × 800, 1440 × 900 e 1920 × 1080. A análise pura em 30 amostras locais de um projeto sintético de 20 slides ficou em 4,99 ms na mediana e 10,35 ms no percentil 95. Essa medição cobre decisão e revisão editorial.
- O primeiro CI expôs diferença de fontes no Linux. O assistente agora prioriza texto excedente sobre aviso de fonte substituta, com regressão verificada nas duas resoluções. O [CI](https://github.com/MarioSerafimCoder/post-machine/actions/runs/44308224990) aprovou o commit `24be4b5`. No [deploy protegido](https://github.com/MarioSerafimCoder/post-machine/actions/runs/44308258875), a primeira promoção encontrou a versão ainda indisponível na API do Cloudflare. A segunda tentativa do job publicou a versão `27ef1fc6-603b-4253-b1d0-6fd7df46fc70` a 100% do tráfego. O domínio, os feeds JSON, o favicon e as duas formas do avatar redirecionaram acessos anônimos ao Cloudflare Access.
- Em sessão autenticada, o GIF publicado carregou em 420 × 415, uma oportunidade real abriu uma pauta, o prompt apresentou as instruções contextualizadas e o botão do assistente levou o foco ao briefing. A campanha de homologação ficou no armazenamento local do navegador. Fabricação, correção assistida, exportação e restauração desta entrega foram validadas nas suítes locais.
- Limites atuais: acesso à íntegra e divergência dependem de indicação do editor. O app apresenta exigências de canal com data e contexto de verificação. Aprovação humana formal, validação de arquivos de publicação específicos de redes, métricas com denominador e verificação factual de alegações seguem como extensões do fluxo. Nenhuma API de IA, nuvem ou custo adicional foi introduzido.

## Homologação de produção e lembrete de backup

- Na sessão autenticada do domínio publicado, uma oportunidade real do Radar abriu uma pauta. Foi importado conteúdo de teste, fabricadas três propostas e salva uma versão de dois slides. O título alterado persistiu após salvar e reabrir. A central mostrou a revisão atual com zero erros e zero avisos. O ZIP continha dois PNGs de 1080 × 1350 e o backup continha dois slides, o título editado e o vínculo da campanha. Esse mesmo ZIP restaurou os dois slides e o título editado no build local. A restauração na sessão publicada ficou pendente porque o controle do navegador não conseguiu selecionar o arquivo local.
- O Studio mostra a data do último ZIP enviado para download por projeto neste navegador. A ação de backup aparece quando não há registro, a partir de sete dias ou em caso de falha de salvamento. Nessa falha, o ZIP pode incluir a edição pendente, e o Studio indica a opção de restauração na biblioteca. A data registra o encaminhamento ao navegador. A confirmação de que o arquivo ficou guardado cabe ao usuário.
- Lint, build, 105 testes Vitest e 81 cenários Playwright aprovados, com cinco repetições omitidas no perfil laptop. Em 1280 e 1440 px, o teste comprovou o download da edição pendente quando o IndexedDB falha, a persistência da data ao reabrir e o retorno do lembrete após o prazo.
- O [CI](https://github.com/MarioSerafimCoder/post-machine/actions/runs/44301868556) aprovou `79afd4a`. O [deploy protegido](https://github.com/MarioSerafimCoder/post-machine/actions/runs/44301903916) publicou esse commit como versão `7c40dea4-31ae-463f-b8ff-3be1a574ecb7` a 100% do tráfego. Após a publicação, a página inicial, os dois feeds JSON e o favicon responderam com HTTP 302 para o Cloudflare Access.

## Auditoria de código após a Evolução 08

- A biblioteca do Studio compara a revisão exibida com a versão persistida na mesma transação que exclui o projeto e sua recuperação. Em caso de divergência, a biblioteca é atualizada e pede ao usuário que confira a versão atual. O cenário com duas abas reproduziu a exclusão indevida na base `1850dd4`.
- O salvamento, a restauração e a limpeza do Studio tratam apenas as fontes de imagens, logotipo e fontes tipográficas como arquivos. Nomes e textos que parecem referências são preservados. O manifesto continua no v1, com campo opcional para distinguir a codificação atual. Registros IndexedDB e ZIPs antigos continuam aceitos. Quando um ZIP antigo já converteu texto em arquivo, a restituição do tipo original depende de a assinatura do arquivo identificar o formato.
- No Chromium, duplicar um slide com uma imagem e um texto parecido com URL de imagem reduziu de quatro para um os cálculos de SHA-256 durante o salvamento. A revisão anterior compartilha os hashes das imagens e fontes idênticas com a revisão que está sendo gravada. A comparação mede chamadas de hash nesse cenário.
- A correção assistida usa a mesma verificação de integridade do Studio e da exportação. Um teste que simula a perda de um elemento na hidratação do Fabric confirma que a correção é interrompida antes de produzir uma cena incompleta.
- ESLint, TypeScript, build e dry-run do Wrangler aprovados. Vitest passou com 105 testes. Playwright passou com 81 cenários no Vite e cinco repetições omitidas no laptop. No build servido pelo Wrangler local, os oito cenários direcionados também passaram em 1280 e 1440 px, incluindo edição e restauração de um projeto com a codificação original do v1. Validação desta revisão realizada localmente em `main`.
- `npm audit --omit=dev` retornou zero alertas. A auditoria completa reportou 12 entradas de severidade alta na cadeia de ferramentas de desenvolvimento ligadas a `picomatch` 4.0.7. A versão publicada consultada ainda era 4.0.7, sem atualização corrigida no aviso. Acompanhar a publicação de uma versão compatível com as ferramentas atuais. [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)

## Evolução 08 — Integração e estabilidade

- Base `11076f2`: 97 testes Vitest e 74 cenários Playwright aprovados. A revisão reproduziu a remoção de destaques ao editar pelo painel lateral, a redução de quebras no texto simples, cortes altos em retratos inseridos em janelas largas e cinco avisos de encaixe em páginas quadradas densas sem fotografia. A edição agora usa os índices de grafemas do Fabric e mantém os estilos dos trechos preservados. A importação preserva as quebras internas e as composições quadradas densas dão prioridade ao texto.
- O fluxo integrado passou de uma oportunidade real do Radar até briefing, prompt, importação de uma resposta de teste, três propostas, edição, histórico, Auditoria, ZIP e restauração. O ChatGPT faz parte do fluxo editorial externo e não foi automatizado no teste. Frames aceitam setas, Home, End e Alt + setas. A primeira miniatura deixa de aguardar o debounce reservado às atualizações.
- Matriz local com 198 PNGs de prévia, 66 composições em três formatos, incluindo duas marcas, CTA, imagens claras e escuras e composição sem imagem. A amostra densa coube após o ajuste. Doze pares de prévia e PNG em resolução original foram comparados em 60 pontos fora do texto, com diferença máxima de 1 nível por canal. Textos extremos continuam editáveis e podem exigir ajuste manual, com aviso de encaixe.
- ESLint, TypeScript, build e dry-run do Wrangler aprovados. Vitest aprovou 104 testes e Playwright no Wrangler local aprovou 75 cenários, com cinco repetições omitidas no perfil laptop. A cobertura inclui os quatro viewports desktop, arquivos de exportação, créditos, fontes locais, IndexedDB e recuperação de backup.
- Duas medições no mesmo computador com um projeto de 20 slides e três JPEGs de 1800 × 1400. A primeira miniatura passou de 869–1.360 ms para 266–281 ms. A seleção do último frame até exibir sua miniatura passou de 854–872 ms para 142 ms. O ZIP levou 898–920 ms na base e 898–992 ms após a mudança. O heap JavaScript ficou entre 17 e 18 MiB, sem medir a memória nativa do canvas.
- O [CI do GitHub](https://github.com/MarioSerafimCoder/post-machine/actions/runs/44084037251) aprovou `d039c97`. O [deploy protegido](https://github.com/MarioSerafimCoder/post-machine/actions/runs/44084038077) verificou o CI do mesmo commit e publicou a versão `34d3f818-29de-49c4-830f-e80e32aa46e3` a 100% do tráfego. A página inicial, os dois feeds JSON e o favicon responderam com redirecionamento para o Cloudflare Access antes e depois da publicação. O navegador mostrou a tela de login. A verificação funcional autenticada em produção ficou pendente.

## Evolução 07.1 — Coleções editoriais e frames

- Impacto Fotográfico, Cartão Editorial e Narrativa Visual adicionam 18 composições editáveis em retrato, quadrado e story. As 48 composições anteriores e os layouts legados permanecem disponíveis.
- Gradiente linear é uma camada Fabric independente, com cor, intensidade, direção e intervalos ajustáveis. O destaque usa uma faixa de caracteres no próprio título e acompanha o PNG e o backup. A Produção Expressa continua avaliando seis papéis em três propostas da coleção selecionada.
- Frames à direita em uma ou duas colunas, com rolagem própria, miniaturas sob demanda, reordenação por arraste ou teclado e indicadores da Auditoria. As propriedades ficam junto às ferramentas à esquerda.
- Lint, TypeScript, build e dry-run do Wrangler aprovados, além de 97 testes Vitest e 74 cenários Playwright no Wrangler local. Quatro repetições ficaram de fora do perfil laptop. Foram conferidos quatro viewports desktop e 18 PNGs com amostras fotográficas claras e escuras, retrato e paisagem. As imagens das referências e as amostras de teste ficam fora do repositório.
- O [deploy protegido](https://github.com/MarioSerafimCoder/post-machine/actions/runs/44079969742) publicou `42318da` como versão `b0359e50-e31b-40a1-8a0b-efc75842c795` a 100% do tráfego. Cloudflare Access confirmado antes e depois da publicação. O conteúdo do Studio e a exportação foram verificados no build local.
- O [CI do GitHub](https://github.com/MarioSerafimCoder/post-machine/actions/runs/44079968579) aprovou `42318da`.
## Evolução 07 — Auditoria e Finalização

- Miniaturas mostram erros, avisos e estado da análise. A localização abre a arte e as propriedades do elemento identificável. Correções seguras mantêm confirmação, reanálise e opção de desfazer.
- Finalizar e exportar salva as alterações e reaproveita uma auditoria compatível com a arte ou executa nova análise. O PNG e o ZIP mantêm dimensões originais e ordem. O painel mostra progresso e permite cancelar a entrega. Uma operação nativa de codificação já iniciada pode terminar internamente sem efetuar download.
- A legenda usa os dados da campanha e pode ser editada, copiada ou baixada. O campo opcional é compatível com projetos e backups v1. O ZIP inclui um único arquivo de créditos quando há atribuições. A legenda no ZIP é opcional.
- ESLint, TypeScript, build e dry-run do Wrangler aprovados. Vitest aprovou 95 testes. Os seis cenários direcionados finais passaram no build servido pelo Wrangler. A revisão visual da central cobriu 1024 × 768, 1280 × 800, 1440 × 900 e 1920 × 1080, sem rolagem horizontal da página.
- O [deploy protegido](https://github.com/MarioSerafimCoder/post-machine/actions/runs/44077499375) publicou `501921e` como versão `748f4e98-f095-466d-b4cc-5ff76f41c68a` a 100% do tráfego. O Cloudflare Access redirecionou requisições anônimas antes e depois da publicação. A interação com os painéis e os downloads foi verificada no build local.
- O [CI do GitHub](https://github.com/MarioSerafimCoder/post-machine/actions/runs/44077498887) aprovou a versão publicada com 73 cenários Playwright e três repetições omitidas no perfil laptop.
## Evolução 06 — Studio simplificado e edição contextual

- O canvas se ajusta ao espaço disponível. O zoom manual inclui 100%, mais e menos, e permanece ao trocar de slide durante a sessão. As guias podem ser desligadas.
- O painel lateral acompanha a seleção. Texto tem edição por duplo clique, tipografia, aviso de excesso e acesso ao módulo Headlines. Imagens têm substituição local ou pelo fluxo existente de Openverse, recorte, reenquadramento por arraste e escala proporcional. O comando Restaurar enquadramento volta a exibir a imagem inteira dentro do espaço atual.
- Camadas acompanham a seleção no canvas. Shift + clique permite alinhar e agrupar vários elementos. Bloqueio e visibilidade gravam no projeto local. Slides têm miniaturas e avisos da última auditoria válida, e podem ser reordenados com os botões ou Alt + setas no slide ativo.
- Inspeção visual em 1024 × 768, 1280 × 800, 1440 × 900 e 1920 × 1080, com encaixe da arte e sem rolagem horizontal da página. Em 1024 px o painel de propriedades tem rolagem própria. Passaram lint, TypeScript, build, dry-run do Wrangler e 95 testes Vitest.
- Playwright no Wrangler local aprovou 72 cenários, com duas repetições omitidas no perfil laptop. Os testes cobriram edição de projeto fabricado, créditos na substituição de imagens, histórico, reabertura, auditoria, backup e exportação PNG/ZIP.
- O [workflow de publicação](https://github.com/MarioSerafimCoder/post-machine/actions/runs/44073911218) publicou `f931fa3` como versão `baef9bad-4bca-49d0-b09a-c3f19dee0527` a 100% do tráfego. O Cloudflare Access respondeu antes e depois do deploy. A rota do Studio abriu na sessão autenticada. A interação com o editor e o salvamento foram verificados no build local.
- O [CI do GitHub](https://github.com/MarioSerafimCoder/post-machine/actions/runs/44073910413) também aprovou `f931fa3`.

## Evolução 05 — Fabricação na Produção Expressa

- O Studio gera propostas Equilibrada, Fotográfica e Expressiva na coleção escolhida. O motor avalia até 18 candidatos por slide usando medidas de texto do Fabric, papel editorial, área de foto, recorte, margens e contraste. Texto excedente fica editável, com aviso e opção de dividir por parágrafos quando possível.
- Imagens manuais têm precedência sobre as vinculadas e a ordem dos arquivos. Créditos são preservados e a prévia permite verificar recorte e resolução. O processo é cancelável e grava apenas a versão escolhida, no contrato local v1 existente. Sem serviços novos ou custo adicional.
- Inspeção em Chromium: 1024 × 768, 1280 × 800, 1440 × 900 e 1920 × 1080, sem rolagem horizontal. Em uma execução local de 1/6/10/20 slides com três imagens de teste de até 1800 px de lado, a fabricação levou 52/478/991/2303 ms; renderizar as três capas levou 25/23/72/12 ms. O heap JS observado foi 68/45/44/51 MiB; não inclui a memória nativa de imagens e canvas.
- Revisão visual de capa, composição com imagem vertical, texto longo e encerramento. Um ensaio de divisão confirmou a preservação dos 2.748 caracteres do texto original.
- Lint, TypeScript, build e dry-run do Wrangler aprovados; Vitest: 95 testes. Playwright no build servido pelo Wrangler local: 71 aprovados e uma repetição deliberadamente omitida no perfil laptop.
- Radar: removido da interface o painel de diagnóstico fonte a fonte. A data da última coleta bem-sucedida, os links originais e o aviso se a edição não carregar continuam visíveis. O diagnóstico por fonte permanece no registro da coleta.
- O [CI](https://github.com/MarioSerafimCoder/post-machine/actions/runs/43919986799) aprovou `f2c8df2`. O [deploy protegido](https://github.com/MarioSerafimCoder/post-machine/actions/runs/43919987884) publicou a versão `bc6d5928-fa50-43c7-b480-dee19fdb0461` a 100% do tráfego. Cloudflare Access confirmado antes e depois para página e snapshots. Na sessão autenticada, o Radar exibiu notícias e a atualização de 14:35 (Brasília), sem diagnóstico por fonte; o Studio produziu três versões e renderizou o segundo slide sem erros de console. A sessão de produção não gravou projeto; edição, salvamento, reabertura, auditoria e exportação PNG/ZIP do projeto fabricado passaram no Wrangler local.

## Evoluções 03 e 04 — 16/11/2026

- Interface branca, preta e vermelha. Projetos existentes mantêm as cenas e marcas gravadas. A preferência antiga idêntica ao padrão provisório é substituída pelo novo padrão apenas ao criar projetos.
- Oito coleções, 48 composições e três formatos. As prévias são renderizadas a partir dos objetos Fabric e guardadas em cache de sessão. Os seis layouts legados continuam disponíveis no editor.
- Produção Expressa aceita JSON, Markdown de campanha, texto com ou sem separadores e campanhas locais já importadas. Permite editar e reordenar slides, carregar e distribuir imagens, escolher coleção e conferir prévia e avisos. Projetos seguem o contrato v1 do Studio. A aplicação de marca nas coleções recolore objetos existentes sem recompor suas posições.
- As imagens usam o validador existente, com até 30 imagens e 80 MB por preparação, distribuição por ordem e associação manual. A importação por URL exige HTTPS, um dos hosts permitidos pela CSP existente e resposta CORS válida. O envio local fica disponível quando o original remoto falha.
- Revisão visual da galeria com oito capas renderizadas e da Produção Expressa nas quatro resoluções desktop. Os pares de cores avaliados para ações, seleção e texto tiveram contraste entre 4,90:1 e 18,88:1.
- Lint, TypeScript, build, dry-run e 89 testes Vitest aprovados. A suíte Chromium no Wrangler local passou em 69 cenários, com uma repetição omitida no perfil laptop. Após o ajuste final de apresentação, os seis cenários de galeria, Produção Expressa e URL externa passaram novamente no Vite.
- O [CI](https://github.com/MarioSerafimCoder/post-machine/actions/runs/43914683027) aprovou `7a541b5`. O [workflow de produção](https://github.com/MarioSerafimCoder/post-machine/actions/runs/43914709478) publicou a versão `1af35800-ffbe-4736-a6d9-2180a5cba0ec` a 100% do tráfego, com Cloudflare Access confirmado antes e depois. No navegador autenticado foram verificados o vermelho oficial, os oito cartões e a prévia de texto na Produção Expressa, sem criar projeto no perfil de produção.

## Evoluções 01 e 02 — 16/11/2026

- Cabeçalho horizontal com Início, Radar, Studio e Auditoria. Barras contextuais, filtros recolhíveis do Radar, painel de ferramentas recolhível do Studio e atalhos para projetos, diagnóstico, correções e resultados. Rotas por hash, carregamento sob demanda, o editor Fabric e os bancos locais foram preservados.
- A coleta local reuniu 80 notícias elegíveis, 48 oportunidades e dez observações do Google Trends. Design Week retornou HTTP 403 e as demais fontes responderam. A edição não mostrou “Em alta” sem histórico comparável. Justificativas, fontes, datas e abordagens aparecem nos cartões.
- A ação Criar pauta abre o briefing existente com abordagem e orientações editáveis. As fontes são preservadas no prompt, no backup e na importação. Favoritos compartilham o IndexedDB das notícias.
- ESLint, TypeScript, build e dry-run do Wrangler aprovados. Vitest passou em 84 testes. Playwright passou em 63 cenários, com uma repetição deliberadamente omitida no perfil laptop porque o mesmo teste já percorre as quatro resoluções. Radar e Studio inspecionados em 1024 × 768, 1280 × 800, 1440 × 900 e 1920 × 1080, sem overflow horizontal.
- O [workflow de produção](https://github.com/MarioSerafimCoder/post-machine/actions/runs/43909844590) publicou `d8169f6` como versão `6a7a3c1d-6e3f-4061-b6c2-5af7cabe8464` a 100% do tráfego. A coleta do GitHub teve 87 notícias elegíveis e a sessão autenticada mostrou 48 oportunidades e o mesmo `collectedAt` do workflow, `2026-11-16T16:39:21.571Z`. Página, snapshots e favicon redirecionaram sessões anônimas ao Cloudflare Access. A publicação reutilizou os recursos existentes, sem custo adicional.

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
- A publicação manual e a conferência remota estão registradas abaixo. A publicação automática do Radar segue pendente dos segredos `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` e da variável `CLOUDFLARE_ACCESS_READY` no GitHub Environment `production`.

## Publicação da Fase 4 — 15/11/2026

- Código da Fase 4 enviado para `origin/main` no commit `5255c42`. Build publicado manualmente pelo Wrangler no Worker existente `post-machine`, domínio `posts.marioserafim.com.br`, versão `35d34fdd-3c8d-4059-baca-1d2cfe56087a`. Nenhum binding ou Worker adicional foi criado.
- Verificação anônima após o deploy: `/`, `/radar.json` e `/favicon.svg` continuam retornando HTTP 302 para o Cloudflare Access. Em sessão autorizada no navegador, a nova página Auditoria abriu, carregou um projeto local da Fase 3 e analisou seu slide, exibindo relatório real, filtros e resumo. O projeto e o relatório permaneceram no navegador.
- Publicação automática do Radar continua independente e pendente da configuração do GitHub Environment `production` indicada acima. A proteção do domínio permanece ativa.

## Publicação automática do Radar — 15/11/2026

- O ambiente `production` do GitHub recebeu os segredos `CLOUDFLARE_ACCOUNT_ID` e `CLOUDFLARE_API_TOKEN` e a variável `CLOUDFLARE_ACCESS_READY=true`. O token da conta tem a função Editor restrita ao Worker `post-machine`.
- A primeira execução enviou os arquivos, mas o comando `wrangler deploy` tentou atualizar o vínculo do domínio e falhou com o código 10084. O commit `c0a48b7` passou a enviar e promover a versão do Worker com `wrangler versions upload` e `wrangler versions deploy`.
- [Execução do GitHub Actions](https://github.com/MarioSerafimCoder/post-machine/actions/runs/43716907875) aprovada por disparo manual. A versão `ce562135-cb23-4d14-ad3e-53d6de1ebfc8` recebeu 100% do tráfego. O `radar.json` publicado corresponde ao conteúdo integral do artefato `radar-snapshot` com 321 itens e `collectedAt` de `2026-11-15T13:02:55.314Z`. O Access respondeu com redirecionamento anônimo antes e depois da publicação.
- O mesmo workflow está agendado para 06h17, 12h17 e 18h17 de Brasília. O primeiro disparo agendado após o ajuste ainda não foi observado.

## Fase 5.0 — Estabilização

- Post Machine é o nome público provisório. O Studio ainda consome a chave de navegação anterior da Auditoria, e os bancos, IDs de projetos e esquemas anteriores continuam válidos.
- O salvamento da Auditoria compara a versão lida com o registro persistido na mesma transação. O checkpoint pertence ao projeto e à revisão em que foi criado. Cancelar a proposta não consome tentativa. Desfazer no Studio continua integrado ao seu histórico.
- A configuração de armazenamento mede os bytes dos arquivos locais. A limpeza verifica projetos, checkpoints e marca, e reavalia as referências na mesma transação em que exclui os órfãos. Erros abortam a limpeza. O diagnóstico não mede o custo interno do IndexedDB.
- Lint, build, 42 testes unitários e os cenários focados de Auditoria e armazenamento no Chromium passaram. Sobreposições ambíguas e contraste sobre composição complexa continuam dependendo de revisão visual.

## Fase 5.1 — Agente de Headlines

- Campanhas e Studio compartilham diagnóstico em português brasileiro, sete abordagens, limites editáveis, propostas por regras, prompt para IA externa e importação JSON validada. O diagnóstico separa contagens de heurísticas e encaminha afirmações e impacto para revisão editorial.
- O Studio mede candidatos com a tipografia e caixa em uso, sinaliza os que excedem espaço e altera o texto sem recompor o template. Favoritos, original, preferências e histórico de aplicação acompanham a peça ou o objeto do título nos documentos locais e backups. Os contratos anteriores continuam aceitos.
- Ollama avaliado e fora desta entrega. Sua API local usa uma origem diferente da aplicação publicada, exige autorização de origem no serviço e é bloqueada pela CSP atual (`connect-src 'self'`). A lista de modelos seria consultada em `/api/tags` após resolver o acesso local em uma arquitetura optativa. Nenhum proxy foi criado. Consulte a [documentação do Ollama](https://docs.ollama.com/faq) e a [referência de CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src).
- Lint, 47 testes Vitest, build e 38 testes Playwright no build servido pelo Wrangler passaram. Os cenários conferem o layout em 1024, 1280 e 1440 px, a troca de projetos na Auditoria, o limite de tentativas, a reversão de transação de limpeza, a persistência de headlines e o aviso de altura no Studio.
- Próxima etapa prevista: 5.2, pesquisa de imagens e preservação de licenças e atribuições.

### Publicação das fases 5.0 e 5.1 — 15/11/2026

- Commits `e4be5c7` e `7760e06` na `main`. [CI](https://github.com/MarioSerafimCoder/post-machine/actions/runs/43719705704) aprovado. [Workflow de produção](https://github.com/MarioSerafimCoder/post-machine/actions/runs/43719706031) publicou a versão `14cfc0a8-60d3-4431-b977-39232f1d3a75` no Worker existente e confirmou o Access antes e depois.
- Na sessão autorizada, o Radar carregou notícias, a Auditoria abriu e analisou um projeto da Fase 3 e o Studio reabriu o mesmo projeto. O Agente de Headlines mostrou as medidas do título e gerou o prompt no site publicado. Aplicação, persistência e desfazer foram cobertos na suíte do build local.

## Fase 5.2 — Pesquisa de imagens e atribuição

- 5.2A: pesquisa anônima no Openverse, com prévias do endpoint oficial, filtros, paginação, cancelamento e cache de cinco minutos. A API real respondeu HTTP 200 com CORS. A resposta anônima indicou limites de 20 por minuto e 200 por dia na verificação. A interface respeita `Retry-After` quando o navegador o recebe e aguarda um minuto nos demais casos.
- 5.2B: o Studio inicia a busca pelo briefing visual ou pelo título. A importação automática usa somente originais dos hosts aprovados do Flickr e Wikimedia, sem redirecionamentos ou credenciais. O fluxo local preserva posição, ordem de camada, enquadramento e os novos créditos. Para outras origens, formatos incompatíveis ou bloqueio de CORS, a seleção de créditos permanece disponível para upload manual.
- 5.2C: créditos versionados são salvos com o objeto e o arquivo continua deduplicado no IndexedDB. O acervo lista referências de projetos e checkpoints. A Auditoria sinaliza metadados incompletos, atribuição e restrições da licença indicada. A exportação ZIP e o botão de créditos geram `creditos.txt`. O PNG preserva a arte. Arquivos ilegíveis aparecem na Auditoria e impedem uma exportação incompleta.
- A API pode omitir dados de origem e devolver miniaturas inacessíveis. Uma miniatura do Wikimedia retornou HTTP 424 na verificação; originais testados no Wikimedia e no Flickr responderam HTTP 200 com CORS. O sistema não toma decisões jurídicas e não substitui o arquivo original pela miniatura.
- Próxima etapa prevista: 5.3, Radar de Virais e Formatos com referências verificáveis.
- 5.2D: lint, build, 54 testes Vitest, 42 testes Playwright no build servido pelo Wrangler e dry-run aprovados. As fixtures cobrem CORS, fallback manual, troca de créditos, restauração, deduplicação e auditoria de arquivo ilegível. A revisão de layout cobriu 1024, 1280 e 1440 px.
- [CI](https://github.com/MarioSerafimCoder/post-machine/actions/runs/43723919148) aprovado. O [workflow de produção](https://github.com/MarioSerafimCoder/post-machine/actions/runs/43723919175) publicou o commit `857e1b4` como versão `668b18ba-828e-44b6-8138-d47da6e82cad` e confirmou a proteção do Access antes e depois.
- Verificação real no navegador autenticado: busca por `architecture` com filtros Flickr e CC BY, miniaturas carregadas, original de 683 × 1024 px de kevin dooley inserido no canvas, créditos recuperados ao reabrir o projeto e exigência de atribuição exibida pela Auditoria. O projeto de verificação ficou no IndexedDB do navegador.

## Fase 5.3 — Radar de Virais e Formatos

- 5.3A: `catalog.ts` e `FormatCatalog.tsx` substituem o placeholder com oito formatos, cada um com estrutura, objetivo, nichos e sequência sugerida. Build aprovado. Cadastro e métricas são etapas seguintes.
- 5.3B: `Virals.tsx`, `ReferenceForm.tsx`, `storage.ts`, `urls.ts`, `contract.ts` e `editorial.ts` formam a biblioteca manual e o diagnóstico por observações. IndexedDB isolado, restauração aditiva e deduplicação na mesma transação. Lint, dez testes de contrato e cenário Chromium de edição, filtros, exclusão e backup aprovados. Origem de campanha e métricas são etapas seguintes.
- 5.3C: campanhas v2 aceitam `creativeOrigin` opcional com referência e análise manual. O briefing sugere abordagem, o prompt pede adaptação original e a importação preserva a fonte. Campanhas antigas, Headlines e Studio utilizam o fluxo existente. Build, lint, quatro testes de contrato e Playwright pauta → prompt → importação → Studio aprovados. YouTube segue opcional.
- 5.3D: `virals/collect.ts`, `youtube.ts` e o workflow adicionam consulta opcional de vídeos públicos, por lotes, com cache, expiração, orçamento por execução/dia e backoff. A UI identifica datas, origem e falta de dados. A CSP só acrescenta o host de miniaturas do YouTube. Cinco testes de coleta com fixtures e o Playwright sem chave passaram. O secret `YOUTUBE_API_KEY` não estava cadastrado no GitHub. A consulta real fica pendente da configuração opcional descrita em SETUP.md.
- 5.3E: a comparação exige formatos de vídeo compatíveis, publicações com até 48 horas de diferença e observações com até uma hora de diferença. A interface mostra contagens disponíveis e a data da observação. Lint, 69 testes Vitest, build, 48 testes Playwright com Wrangler e dry-run de publicação aprovados. A suíte cobre 1024, 1280 e 1440 px. A próxima fase registrada no roadmap é a 6.

### Publicação da Fase 5.3 — 15/11/2026

- O commit `cfd2906` passou no [CI](https://github.com/MarioSerafimCoder/post-machine/actions/runs/43734369020). O [workflow de produção](https://github.com/MarioSerafimCoder/post-machine/actions/runs/43734368735) publicou a versão `9e3deef7-674c-4532-bdd9-0f26567c7255` no Worker existente com 100% do tráfego. A página e os arquivos `/radar.json`, `/virals-youtube.json` e `/favicon.svg` redirecionaram acessos anônimos para Cloudflare Access antes e depois da publicação.
- A sessão autenticada mostrou os oito formatos. Uma referência pública do YouTube foi cadastrada com uma observação, favoritada e recuperada após recarregar. A pauta preservou o link, gerou o prompt e abriu um projeto editável no Studio a partir de um JSON de teste. A referência e o projeto de verificação ficaram no navegador.
- A primeira publicação usou o estado desconectado com zero consultas. Depois do cadastro do segredo `YOUTUBE_API_KEY`, `YOUTUBE_VIDEO_IDS` recebeu o vídeo público de teste `jNQXAC9IVRw` (Me at the zoo). A [execução de produção](https://github.com/MarioSerafimCoder/post-machine/actions/runs/43734897766) obteve visualizações, curtidas e comentários em uma consulta, publicou o snapshot e confirmou o Cloudflare Access. A sessão autenticada mostrou as três contagens com o horário de observação no Radar.

## Fase 6 — Auditoria inicial

- Base `b882c5e`, Windows, Node 24.18.0 e Chromium. Lint, build e 69 testes unitários passaram. `npm audit` retornou zero alertas. A primeira rodada Wrangler passou em 47 de 48 testes: o cenário Openverse no perfil laptop não encontrou o editor de texto depois de acionar uma ferramenta logo após criar um projeto.
- Alto: o Studio aceita ações de inserção antes do Fabric sinalizar que terminou de carregar. Campanhas abertas em abas diferentes fazem `put` sem comparar a revisão e podem sobrescrever uma edição. A abertura de backups ZIP verifica CRC de todas as entradas antes de impor limites de descompressão. A biblioteca com 2.000 referências montou 2.000 cartões e demorou 919 ms para abrir e 1.080 ms para responder à busca (medianas de três amostras locais).
- Médio: a visão geral carrega o bundle editorial e solicita o snapshot do Radar em segundo plano. A barra do Studio mediu 178 px a 1024 × 768 e a área do canvas tem altura fixa de 689 px em todas as quatro resoluções. A seção de referências perde filtros ao alternar de seção, os atalhos globais do Studio continuam registrados quando o editor está oculto e desfazer volta sempre ao primeiro slide.
- Baixo: o roteiro integrado ainda apresenta fases já publicadas como pendentes e o foco de campos/controles depende de estilos diferentes por módulo.

### Entregas 6.1–6.4

- O Studio agrupa nome, salvamento e histórico. Auditoria, PNG e ZIP ficam visíveis. Créditos, backup, recuperação e duplicação ficam em Mais ações. O canvas usa a altura disponível e centraliza a arte quando ela cabe. Os controles mostram foco visível, a seleção em Camadas tem estado acessível e Escape fecha Mais ações e devolve o foco.
- Campanhas de referências voltam à biblioteca com os filtros preservados. Os atalhos do Studio operam na rota do editor, e Desfazer/Refazer preservam o slide ativo quando ele existe na revisão de destino. O editor aguarda o Fabric antes de liberar as ferramentas de inserção.
- O Radar tem carregamento sob demanda. Referências usam busca normalizada e páginas de 24 cartões. Miniaturas carregam quando entram na faixa visível. PNG/ZIP renderizam em uma superfície isolada e descartam uma exportação cuja fonte mudou enquanto ela era gerada.
- A versão persistida da campanha é conferida na mesma transação que grava ou exclui. Conflitos entre abas preservam a edição pendente para backup. O Studio torna o conflito explícito e trata abortos de IndexedDB sem propagar um segundo erro. Restauração ZIP limita bytes durante a descompressão e verifica a integridade dos assets por SHA-256.
- O Openverse apresenta falhas de conexão, tempo limite e HTTP 429 com instruções de retentativa. A Auditoria informa interrupção após Cancelar. Fonte local inválida tem instrução para recuperar o WOFF2. O esquema, armazenamento por origem e regras de acesso seguem descritos em [ARCHITECTURE.md](ARCHITECTURE.md).

### Medições locais

Windows, Intel i5-9400F, Node 24.18.0, Chromium do Playwright e build Vite servido na mesma máquina. Tempos de abertura e busca usam relógio de parede e incluem espera pela interface. Acervo sintético de 2.000 referências, três contextos novos por versão. A heap é uma amostra de JavaScript, com `--enable-precise-memory-info`, sem contabilizar GPU e memória nativa do canvas.

| Medida | Base | Fase 6 |
| --- | ---: | ---: |
| JavaScript inicial, gzip | 122,91 kB | 73,98 kB |
| CSS inicial, gzip | 6,32 kB | 5,40 kB |
| Pedidos ao snapshot de notícias na visão geral | 1 | 0 |
| Cartões montados ao abrir o acervo | 2.000 | 24 |
| Abertura do acervo, mediana | 919 ms | 615 ms |
| Aplicação de uma busca no acervo, mediana | 1.080 ms | 15 ms |
| Amostra de heap após abertura, mediana | 12 MiB | 9 MiB |
| Barra do Studio em 1024 × 768 | 178 px | 102 px |

- A abertura pós-mudança variou de 611 a 1.051 ms. A redução do custo da busca foi consistente nas três medições. Essas amostras locais não são Core Web Vitals de campo.
- Studio em 1280 × 800: fixture típica com 6 slides × 60 retângulos abriu em 113 ms, trocou para o último slide em 80 ms e registrou 9 MiB de heap. Fixture de estresse com 20 × 500 retângulos abriu em 406 ms, trocou em 348 ms e registrou 19 MiB. São amostras únicas sem fotografias e medem abertura, troca e disponibilidade das camadas. O limite global de complexidade continua aplicável a grupos, imagens e propriedades serializadas.
- Limites de uso: o navegador pode encerrar uma gravação ainda pendente. A interface e os backups oferecem recuperação enquanto a edição está na sessão. A inspeção de composição, arraste e seleção gráfica de grupos continuam dependentes da superfície visual. A revisão de acessibilidade usou a WCAG como referência e não certifica conformidade integral.

### Entrega 6.5 — Validação e publicação

- ESLint, 69 testes Vitest, TypeScript/Vite e dry-run do Wrangler aprovados. A suíte Playwright teve 60 aprovações no Vite e 60 no build servido pelo Wrangler. O [CI da revisão publicada](https://github.com/MarioSerafimCoder/post-machine/actions/runs/43737278795) também executou 60 testes com sucesso. `npm audit` retornou zero vulnerabilidades no inventário instalado.
- Cenários integrados passaram para notícia e referência até exportação, análise de headline, importação Openverse com fixtures, créditos, Auditoria e correção de margem. O backup de projeto preservou imagem, fonte, créditos e cópia restaurada. Os testes de falhas exercitaram gravação IndexedDB, conflito de abas, HTTP 429, falha de rede, imagem ilegível, ZIP excessivo, versão desconhecida, JSON inválido e retentativa de exportação.
- Revisão desktop em 1024 × 768, 1280 × 800, 1440 × 900 e 1920 × 1080. Os PNGs de exemplo foram inspecionados em 1080 × 1350, 1080 × 1080 e 1080 × 1920, com texto longo e forma translúcida. As verificações automatizadas também conferiram pixels sem guias, dimensões do ZIP, fonte local, imagens e `creditos.txt`. O foco novo mediu contraste de 6,17:1 sobre o fundo principal e de 5,63:1 sobre o fundo de seleção nas cores avaliadas.
- A [publicação](https://github.com/MarioSerafimCoder/post-machine/actions/runs/43737361339) do commit `348b088` promoveu a versão `43dd78c5-4ecf-4bd4-b40b-1eec45c5ebca` do Worker existente a 100%. Visitantes anônimos receberam HTTP 302 para o Cloudflare Access antes e depois. O navegador autenticado recebeu o mesmo bundle e o mesmo `collectedAt` do artefato, de `2026-11-15T16:46:56.144Z`, com 404 notícias no snapshot.
- Em produção, a referência de teste mostrou as contagens reais do YouTube observadas às 13h20 e reaproveitadas do cache. Um projeto salvo na Fase 5.3 reabriu no Studio, passou pela Auditoria e gerou PNG de 1080 × 1350. O deploy reutilizou os recursos existentes e o custo operacional adicional foi R$ 0.
