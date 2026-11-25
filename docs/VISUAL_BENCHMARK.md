# Benchmark do motor visual

## Consolidação visual 2/2 — 25/11/2026

Dez pautas públicas inéditas nos dois corpus do repositório, com três slides fotográficos cada, foram importadas e abertas no Studio em Chromium a 1280 e 1440 px. Os originais foram baixados das páginas públicas. A revisão por miniaturas definiu antes do replay quais arquivos correspondiam ao objeto de cada slide. As duas versões receberam os mesmos metadados, arquivos e atrasos de rede capturados. O JSON novo acrescentou 22 sugestões por slide, elaboradas manualmente a partir das fontes para testar o contrato que o prompt pede ao ChatGPT. Brave e Openverse responderam por interceptação local, sem consultas reais nessa comparação. Os tempos partem da entrada do JSON.

| Medida automática | `1a1a76c` | Consolidação 2/2 |
| --- | ---: | ---: |
| Slides corretos / total | 9/30 (30,0%) | 15/30 (50,0%) |
| Precisão entre imagens aplicadas | 9/16 (56,3%) | 15/15 (100%) |
| Incorretos / vazios | 7 / 14 | 0 / 15 |
| Enquadramentos que exigiriam intervenção para completar os 30 | 21 | 15 |
| Editor utilizável | 1,08–1,98 s | 1,10–1,98 s |
| Primeira imagem, mediana e máximo | 2,49 / 2,76 s, 8 pautas | 2,62 / 2,85 s, 7 pautas |
| Pesquisa total, mediana e máximo | 2,76 / 3,32 s | 2,76 / 3,62 s |
| Pedidos automáticos a Brave interceptados localmente | 7 | 7 |
| Exportação ZIP e reabertura | 10/10 | 10/10 |

Na nova versão, os 22 candidatos permaneceram no projeto e 15 foram aplicados ao slide correspondente. A busca manual foi acionada nos dez projetos. Quatro intervenções com os respectivos originais locais foram executadas, persistiram após reabrir e elevaram a cobertura observada a 19/30. O ensaio dirigido também verificou a substituição com resultado contextual, a procedência e os campos do backup nas duas larguras. A meta de cobertura acima de 85% ficou pendente.

| Pauta e fonte | Área | Corretos antes → depois, de 3 |
| --- | --- | ---: |
| [Carling](https://www.creativeboom.com/news/carlings-new-identity-is-a-badge-of-belonging-inspired-by-football-clubs/) | Identidade visual | 2 → 2 |
| [Zero](https://www.creativeboom.com/news/whats-the-answer-to-a-sea-of-lookalike-ai-brands-a-fossilised-typewriter-a-flight-delay-and-some-hand-drawn-cave-art-of-course/) | Branding | 0 → 3 |
| [Insomnia Cookies](https://www.creativeboom.com/news/walsh-takes-a-bite-out-of-the-moon-for-insomnia-cookies/) | Branding | 2 → 3 |
| [Hering](https://www.b9.com.br/hering-transforma-o-medo-de-errar-no-amigo-secreto-em-campanha-de-natal/) | Publicidade | 1 → 1 |
| [Pares Originais do Brasil](https://updateordie.com/2026/11/23/havaianas-celebra-os-pares-originais-do-brasil/) | Publicidade | 0 → 0 |
| [Pennsylvania Horticultural Society](https://www.creativebloq.com/news/this-beautiful-logo-design-was-created-to-grow-like-nature) | Identidade visual | 0 → 2 |
| [Vendôme Nouveau](https://www.creativebloq.com/news/it-took-designers-20-years-to-bring-this-font-back-from-the-dead) | Design gráfico | 1 → 1 |
| [Flachet](https://www.creativeboom.com/news/camille-walala-is-covering-a-lyon-metro-station-in-30000-hand-made-tiles/) | Design gráfico | 3 → 3 |
| [Pets at Home](https://www.creativebloq.com/news/how-pets-at-homes-vibrant-new-family-solves-the-biggest-challenge-of-designing-sub-brands) | Identidade visual | 0 → 0 |
| [Loewe](https://www.b9.com.br/loewe-tim-burton-estranho-mundo-de-jack-campanha/) | Publicidade | 0 → 0 |

Separadamente, o diagnóstico autenticado rodou cinco consultas reais Brave Images em `1a1a76c`. As cinco retornaram HTTP 200 e 60 URLs no total. A classificação marcou 58 como rejeitadas e duas de Gatto como relacionadas. Os dois originais estavam em hosts bloqueados, portanto houve zero downloads elegíveis nesse diagnóstico. A análise dos termos revelou um prefixo numérico isolado e uma palavra quebrada ao mover o nome da pauta. O código agora preserva as fronteiras de palavra e prioriza a consulta explícita do slide. Essa correção foi testada localmente. A conta manteve a configuração pré-paga existente, sem recarga acionada pela tarefa. [Execução do diagnóstico](https://github.com/MarioSerafimCoder/post-machine/actions/runs/45602149607).

O replay de regressão, executado à parte, manteve 32 corretas, 0 incorretas e 12 slides vazios em 44. Os resultados dos dez carrosséis são exploratórios e dependem das fontes e sugestões desse ensaio.

## Consolidação Brave Images — 24/11/2026

O replay local de regressão continua em **32/32 imagens corretas, 0 incorretas e 12/44 slides vazios**. Os 12 vazios permanecem nos detalhes de Minthis e GWM, nas capas de PlayStation, Gusto, Ray Gunn, da artista entrevistada, da identidade australiana, de Gatto, da comunidade esportiva e de Julien Gobled, e nos dois slides da Caixa. O erro histórico da Fase A em `15f6be0:slide1` (outra peça do mesmo estúdio) fica como regressão negativa; o motor atual rejeita essa atribuição.

O diagnóstico do código encontrou dois gargalos generalizáveis: a classificação Brave Images conferia o briefing apenas contra legenda e nome do arquivo, embora o provedor normalmente entregue a correspondência no título e na descrição; e o escalonador consumia as três consultas específicas primeiro no mesmo slide pendente. A classificação agora usa os metadados descritivos dos resultados de busca, sem ampliar esse atalho às imagens documentais já extraídas. As até três consultas específicas restantes são distribuídas em rodízio pelos slides ainda pendentes.

Resultados relacionados/apoio continuam visíveis enquanto a busca específica prossegue e podem ser substituídos por um resultado confirmado. Essa pesquisa em segundo plano não muda a apresentação do slide para “Buscando imagem” quando ele já recebeu imagem. Confirmações, imagens travadas e escolhas manuais continuam fora da substituição automática. A resposta da Brave Images também fornece até duas páginas de origem permitidas para extração HTMLRewriter; hosts, redirects, DNS público, formatos e tamanho seguem as mesmas verificações do Worker.

A validação local executou 153 testes unitários, lint, build, replay congelado, compilação/smoke da extração HTMLRewriter e dry-run do Wrangler. A suíte E2E passou em 162 cenários, com 12 omitidos, usando quatro workers; os quatro testes de busca progressiva também passaram isoladamente. O diagnóstico de rede usa no máximo cinco consultas Brave Images, espaçadas em pelo menos 8,1 s, preserva o sinal de cota e testa até dois downloads de raster permitido por consulta. OCR, YouTube e Browser Run não fazem parte dessa execução. **Resultados de rede Brave Images, CI e publicação protegida pendentes**; não misturar essas medidas com o replay controlado acima.

## Otimização de 24/11/2026

O replay congelado manteve o GEICO e corrigiu a atribuição do detalhe da série de Max Cameron. O detalhe de briefing passou a preceder sinais genéricos do restante do texto. A precisão passou de 31/32 para 32/32, a cobertura de 31/44 para 32/44 (72,7%) e os vazios permaneceram em 12.

| Diagnóstico das 13 lacunas originais | Slides | Evidência e tratamento |
| --- | ---: | --- |
| HTML truncado | 4 | A nova leitura em fluxo abriu as quatro páginas na rede. Uma retornou três candidatos elegíveis. |
| Evidência insuficiente para verificar o detalhe ou a campanha | 5 | Aliases, dimensões, legendas genéricas e arquivos opacos limitaram a classificação de GWM, Gusto, Ray Gunn e Caixa, com dois slides na mesma pauta. |
| Material repetido ou visualmente pouco distinto | 2 | Minthis e a galeria esportiva exigem outra peça elegível para ocupar o slide que ficou livre. |
| Atribuição a outro autor nos metadados | 1 | A candidata da matéria de Julien Gobled atribui o trabalho a outro autor. |
| Alocação na série certa e no detalhe errado | 1 | A correção geral de ranking resolveu o caso no replay. |

Os dois downloads indisponíveis do corpus anterior estão registrados abaixo. Os replays reutilizam a captura anterior, inclusive nos quatro casos de HTML truncado. Em um ensaio separado pela rede, a capa de Gatto foi extraída e o raster confirmado foi baixado em 641 ms.

A amostra inédita contém 30 notícias públicas, com cinco de cada área pedida. Em rede real, as 30 fontes responderam HTTP 200. A mediana do tempo entre solicitar a fonte e concluir a extração e classificação foi 674 ms. Houve 24 downloads elegíveis, com mediana de 415 ms e mediana de 1,03 s da fonte ao primeiro raster. A revisão visual aceitou 22 de 24 atribuições (91,7% de precisão), ou 22 de 30 capas (73,3% de cobertura). Seis capas ficaram vazias. O automóvel escolhido para a pauta da McLaren ficou sem comprovação de exibir o novo wordmark, e a imagem da Riff mostrava a fachada em vez da embalagem. Houve oito intervenções manuais potenciais e nenhuma observada. O ensaio mede uma capa por notícia na etapa documental direta. Ele não inclui a pesquisa completa do Studio, o Openverse ou o desempenho em produção.

A comparação com Brave fez uma consulta Web para cada uma das seis capas vazias, com seis respostas bem-sucedidas e mediana de 552 ms. Cinco URLs adicionais autorizadas foram lidas na rede e nenhuma passou a classificação direta aplicada à pauta original. A cobertura medida permaneceu em 22/30. O diagnóstico consumiu seis consultas dentro dos créditos já concedidos. Ele cobre a descoberta Web, sem testar o catálogo de imagens Brave. A YouTube Data API aceitou uma consulta e devolveu um resultado. O saldo diário da conta não ficou visível. [Execução de provedores](https://github.com/MarioSerafimCoder/post-machine/actions/runs/45463829661).

No Chromium com navegador novo e pesos servidos pelo Vite local, CLIP quantizado carregou em 1,78 s, inferiu o primeiro par em mais 1,78 s e apresentou mediana de 1,69 s na sessão quente. Os pesos somam 128,1 MB. Em teste separado pela internet, o tokenizer e a configuração chegaram completos, enquanto os dois pesos não terminaram dentro de 55 s. O resultado mantém CLIP opcional e OCR desligado.

Na Cloudflare, a retestagem do Browser Run com a página de Gatto retornou HTTP 404. A navegação restrita antes convertia esse status em `net::ERR_FAILED`. A leitura direta da mesma URL respondeu HTTP 200. Browser Run continua desativado e nenhuma política de origem foi afrouxada.

Reprodução com `node benchmarks/capture-independent.mjs`, `node benchmarks/review-independent.mjs`, `node benchmarks/capture-independent.mjs --regression` e `node benchmarks/run-visual.mjs`. A checagem autenticada de provedores usa o workflow manual de diagnóstico visual. [Amostra inédita](../benchmarks/independent-sample.json).

## Amostra e método

31 notícias públicas de oito áreas, com 31 capas e 13 slides de detalhe. O GEICO faz parte da amostra e usa as mesmas regras das demais campanhas. A revisão cruzou as fontes, legendas e imagens em uma folha de contato local. A rubrica identifica as imagens aceitas por slide. Quatro pautas ficaram sem imagens nesta extração e dois dos 71 URLs distintos estavam indisponíveis como raster elegível. As 69 imagens obtidas ficaram no cache local. [Amostra de notícias](../src/features/images/fixtures/documentary-sample.json), [rubrica](../benchmarks/visual-subjects.json) e [fonte oficial do GEICO](https://www.geico.com/about/pressreleases/2026/20261123/).

O replayer executa o motor de `4721bb2`, a Fase A de `3884ebc` e a implementação atual no Chromium em 1440 px, em um Intel Core Ultra 7 155H. Ele reutiliza os resultados reais capturados do Openverse e da extração documental, expõe as respostas pela mesma interface HTTP e mede o processamento local. A Brave ficou desligada durante a comparação para usar o mesmo corpus e preservar os créditos. Os ensaios autenticados da Fase A em produção e as medições da interface em 1280 e 1440 px ficam em [STATE.md](STATE.md).

Precisão é a proporção de imagens atribuídas que a rubrica aceita. Relevância por slide inclui todo o denominador de capas e detalhes, inclusive frames vazios. Revisão manual potencial conta frames vazios ou em desacordo com a rubrica. O teste de intervenção efetiva no Studio verifica a aprovação, preservação no backup e reabertura. As medidas de heap são do JavaScript no navegador. Memória nativa do WASM, GPU e uso de outras abas ficam fora dessa leitura.

## Resultado em 31 notícias

| Medida | Motor anterior | Fase A | Atual após ajuste de 24/11 |
| --- | ---: | ---: | ---: |
| Precisão documental das imagens aplicadas | 0/2 | 23/27 (85,2%) | 32/32 (100%) |
| Capas relevantes | 0/31 | 15/31 | 22/31 |
| Detalhes relevantes | 0/13 | 8/13 | 10/13 |
| Frames para revisão manual potencial | 44/44 | 21/44 | 12/44 |
| Duplicidades aplicadas no mesmo carrossel | 0 | 0 | 0 |
| Chamadas à extração direta | 0 | 31 | 31 |
| Consultas ao Openverse | 132 | 17 | 12 |
| Tentativas de download pelo Worker | — | 28 | 34 |
| Primeira imagem, mediana quando houve imagem | 1,70 s | 76 ms | 67 ms |
| Tempo total, mediana do replay | 8 ms | 46 ms | 59 ms |
| Heap JavaScript, mediana | 16,0 MiB | 44,4 MiB | 33,8 MiB |

Depois do ajuste de ranking, o replay de regressão atribuiu 32/44 imagens válidas, sem atribuições incorretas. O E2E dirigido mediu abertura em 197–405 ms e primeira imagem em 904–1.123 ms para carrosséis de três a dez slides. As respostas dirigidas foram controladas. O ensaio confirmou que exportar continua possível enquanto a pesquisa documental está pendente.

As 146 consultas distintas capturadas do Openverse retornaram HTTP 200. A mediana das chamadas reais ao catálogo foi 1,61 s. Os downloads públicos dos candidatos documentais tiveram mediana de 0,41 s. Na reprodução, as respostas de catálogo e os rasters da fonte vieram do cache. As duas fotos escolhidas pelo motor anterior vieram do Flickr pela rede e seus tempos até primeira imagem incluem essa latência. Os números de tempo de replay servem para comparar o processamento da Fase A com o atual.

O motor antigo sugeriu um desfile de 2021 para a pauta de 2026 sobre o filme do GEICO e uma fotografia de exposição para a pauta sobre a ilustradora Carolina Soares. A Fase A atribuiu o material do comunicado do GEICO, mas ainda produziu erros de campanha e de detalhe. O replay após o ajuste de ranking aceitou 32/32 atribuições; o erro de detalhe da mesma série não ocorre mais. O ganho observado é deste corpus, que também orientou a calibração. [Pauta de Carolina Soares](https://www.creativebloq.com/features/this-artist-specialises-in-emotional-characters-and-ethereal-scenes) e [comunicado do GEICO](https://www.geico.com/about/pressreleases/2026/20261123/).

No build servido pelo Wrangler em 1280 e 1440 px, oito carrosséis de 3 a 10 slides abriram em 0,14–0,33 s. A primeira imagem chegou em 0,48–1,28 s e a pesquisa estabilizou em 0,49–1,29 s. A reabertura com os arquivos locais levou 0,50–0,66 s. Os testes usaram respostas controladas, incluindo um erro transitório de download, investigação complementar e exportação durante a busca.

## Comparação de modelos e OCR

| Modelo | Pesos | Capas corretas | Detalhes corretos | Carga inicial | Mediana de inferência por pauta |
| --- | ---: | ---: | ---: | ---: | ---: |
| CLIP ViT-B/32, texto INT8 e visão 4 bits | 128,1 MB | 24/27 | 11/13 | 1,16–2,37 s | 1,59–1,63 s |
| SigLIP 2 ViT-B/32, INT8 | 379,4 MB | 23/27 | 13/13 | 3,89–4,73 s | 0,86–1,00 s |

Os modelos receberam as mesmas imagens de 27 notícias com material disponível e as mesmas descrições. O corpus inclui casos sem imagem aceitável. A semântica isolada ainda escolhe uma imagem nesses casos, o que reforça a necessidade de confirmar a procedência antes de sugerir. O CLIP é a opção do piloto pelo menor conjunto de pesos e pela carga inicial menor. Nenhum modelo semântico foi habilitado por padrão.

O Tesseract.js rodou no navegador, com dados de idioma locais. O ensaio de três cartazes e letreiros demorou de 0,43 a 3,14 s e recuperou 0/3 textos de referência completos. O OCR segue em piloto e só roda em candidatos sem procedência suficiente, quando há indícios de texto útil.

## Reprodução

```sh
node benchmarks/collect-candidates.mjs
node benchmarks/run-visual.mjs
node benchmarks/run-visual.mjs --catalog
node benchmarks/run-visual.mjs
node benchmarks/prepare-models.mjs clip siglip2
node benchmarks/run-visual.mjs --models
```

A primeira execução registra as consultas do corpus, e `--catalog` captura as respostas com intervalos de 3,4 s. O coletor encerra em HTTP 429 e limita a captura a 120 buscas por execução. `--ocr` repete apenas a avaliação de texto. Os manifestos de revisão dos pesos, os candidatos baixados e os resultados ficam em diretórios locais. O repositório versiona os IDs, URLs públicas, rótulos e os scripts.


## Evolução 13 — 25/11/2026

O replay de regressão (`node benchmarks/run-visual.mjs`) preservou 32 atribuições corretas de 32 em 44 slides: precisão observada 100%, cobertura documental e visual 72,7%, 12 vazios, zero incorretas. Os valores são iguais ao estado anterior desta evolução. Nenhuma imagem de apoio adicional foi selecionada nesse recorte.

A amostra inédita `benchmarks/evolution13-sample.json` reúne oito pautas da edição local que não pertencem aos corpora documental, independente ou de consolidação anteriores. Inclui evento de motion design, ferramenta de web design, oferta de frame, três campanhas publicitárias e duas pautas Adobe. É uma amostra exploratória de capas, concentrada em dois veículos, não uma homologação de carrosséis longos. O caso promocional foi mantido no denominador.

A captura real de oito páginas recuperou oito HTMLs e cinco imagens pertinentes baixáveis e decodificáveis, inspecionadas na folha de contato. São registros das pautas, inclusive material gráfico da campanha Adobe; não são substitutos inventados para documentos ausentes. Três páginas excedem o antigo limite de 1,8 MB, mas passam no limite atual. Os três vazios correspondem à ferramenta de web design, oferta de frame e crítica ao Firefly: nenhum candidato recuperado passou pelos filtros atuais. Não foi acrescida uma origem autorizada sem evidência de necessidade.

Comparação pareada do orquestrador de `b6861d7` com a implementação local, usando os mesmos cinco candidatos revisados e tempos de extração gravados:

| Métrica | Antes | Depois |
| --- | ---: | ---: |
| Precisão documental observada | 5/5 (100%) | 5/5 (100%) |
| Cobertura documental | 5/8 (62,5%) | 5/8 (62,5%) |
| Apoio editorial adicional | 0/8 | 0/8 |
| Cobertura visual por imagem | 5/8 (62,5%) | 5/8 (62,5%) |
| Vazios / incorretas | 3 / 0 | 3 / 0 |
| Mediana até a primeira imagem, somente preenchidos | 1,092 s | 1,100 s |
| Mediana do tempo total, oito pautas | 1,104 s | 1,105 s |
| Maior tempo total | 1,754 s | 1,747 s |
| Tentativas Brave / consultas reais nesse replay | 3 / 0 | 3 / 0 |
| Custo adicional | R$ 0 | R$ 0 |

No replay, Brave responde desativada e Openverse responde vazio. Portanto, a comparação valida preservação da extração e aplicação progressiva, mas não mede ganho de consultas Brave ao vivo nem reutilização comercial dos provedores. O teste não inclui custos de API: a captura usa páginas públicas e arquivos públicos, e o replay é local. Oferecer uma composição textual não foi contado como cobertura visual concluída. As metas de precisão ≥98% e cobertura adequada ≥90% não estão comprovadas em produção; a cobertura ficou abaixo da meta nas duas amostras, sem relaxamento da classificação. A redistribuição precisa de uma rodada real controlada com a franquia gratuita existente para demonstrar ganho.

Reprodução com as ferramentas existentes:

```sh
node benchmarks/capture-independent.mjs --sample=benchmarks/evolution13-sample.json --output=evolution13-network.json
node benchmarks/review-independent.mjs --prefix=evolution13
node benchmarks/replay-captured.mjs --prefix=evolution13
```

Rasters, folha de contato, capturas e resultados completos permanecem em `benchmarks/.cache`, fora dos arquivos versionados. O script de replay arquiva o `HEAD` na primeira execução como baseline; a comparação registrada aqui usou `b6861d7`. Nova coleta pela rede pode devolver conteúdo e disponibilidade diferentes e requer nova inspeção das seleções antes de comparar precisão.
# Evolução 13.1 — 25/11/2026

O painel Brave confirmou US$ 4,90 de crédito gratuito, US$ 0 comprado e recarga automática desligada antes da captura. O preço Search publicado é US$ 5/1000 consultas. O diagnóstico usou dez consultas reais na fase de captura e desenvolvimento (US$ 0,05 do crédito concedido, custo adicional R$ 0), com teto local de 60 consultas e reserva de US$ 0,50. A comparação abaixo reproduz os mesmos retornos de rede guardados em `benchmarks/.cache/evolution131/`; não cobra novas consultas. O arquivo local da chave e os HTMLs/rasters são ignorados pelo Git.

| Medida | Antes, evolução 13 | Após 13.1 |
| --- | ---: | ---: |
| Slides com imagem documental pertinente | 10/12 (83,3%) | 10/12 (83,3%) |
| Precisão documental observada | 10/10 (100%) | 10/10 (100%) |
| Cobertura editorial por fotografia | 0/12 | 0/12 |
| Cobertura visual total por imagem | 10/12 (83,3%) | 10/12 (83,3%) |
| Slides sem imagem | 2 | 2 |
| Mediana até primeira imagem, entre preenchidos | 0,834 s | 0,797 s |
| Mediana total, 12 slides | 1,096 s | 0,893 s |
| Média total, 12 slides | 1,550 s | 1,617 s |
| Consultas no replay pareado | 4 Images | 2 Images + 2 Web |
| Custo adicional | R$ 0 | R$ 0 |

A amostra tem oito pautas já usadas na evolução 13 e quatro matérias de feeds recentes; portanto mede regressão comparável e comportamento em casos adicionais, não generalização de 98% em produção. As imagens aplicadas foram inspecionadas como contato visual local. A única seleção nova de um ensaio intermediário era uma obra alheia em uma matéria sobre molduras; ela motivou reverter o afrouxamento, não foi incluída no resultado final. A amostra de um slide por pauta não mede reaproveitamento entre vários slides. O replay preserva respostas e tempo de cada requisição capturada; diferenças de renderização local e carga do navegador ainda influem nos milissegundos.

Os dois vazios são as matérias sobre ferramenta de web design e moldura digital: HTML e Brave entregaram imagens, mas os metadados não provaram que uma imagem representa o objeto específico. Na ferramenta, o `alt` descreve genericamente capturas de software. Na moldura, a legenda de uma imagem em destaque descreve uma moldura embora o raster mostre outra obra; usar só a legenda causaria falso positivo. Há URLs de outros hosts bloqueadas durante a pesquisa, mas não explicam os dois vazios: os resultados da página original também foram rejeitados por evidência insuficiente. Não houve falha de download nos dez arquivos finais. As razões de cada candidato, as consultas e o tempo de cada etapa estão nos relatórios locais `before-replay.json` e `after-replay.json`. O limite de 24 candidatos por resposta e 3 MB por HTML continua em vigor.

O Radar foi avaliado com 114 notícias publicadas nos 14 dias anteriores à coleta local, reunindo feeds acessíveis e o snapshot existente. A rubrica manual de título e resumo usa grau 2 para produção/cultura visual direta, 1 para contexto criativo e 0 para comércio, finanças ou audiência sem análise visual. No topo de 20 notícias: grau 2, 13→17; grau 0, 3→0; NDCG@20, 0,745→0,930. Exemplos rebaixados corretamente: receita publicitária da Best Buy e ofertas de laptops. Exemplos antes baixos: identidade da Carling, tipografia recuperada e desenho editorial. Pesos mantidos; somente expressões de contexto e promoção foram alteradas. A etiqueta e o snapshot têm autoria/metodologia no arquivo `benchmarks/evolution131-radar-review.json`. Essa rubrica depende de julgamento humano e da edição; não foi apresentada como verdade factual do conteúdo integral.

Reprodução local sem consumo: `node benchmarks/diagnose-visual.mjs --before`, `node benchmarks/diagnose-visual.mjs`, `node benchmarks/audit-radar.mjs`. A captura `--live` só é permitida com orçamento verificado no painel e arquivo local de chave, e incrementa o ledger antes de cada consulta. O catálogo Openverse foi consultado sem custo e não gerou apoio elegível nos dois vazios. O código de produção mantém Access, lista de origens, DNS público, redirects controlados e assinatura dos rasters.
