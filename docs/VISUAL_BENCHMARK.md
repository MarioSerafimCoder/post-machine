# Benchmark do motor visual

## Otimização de 24/11/2026

O replay congelado manteve o GEICO e corrigiu a atribuição do detalhe da série de Max Cameron. O detalhe de briefing passou a preceder sinais genéricos do restante do texto. A precisão passou de 31/32 para 32/32, a cobertura de 31/44 para 32/44 (72,7%) e os vazios permaneceram em 12.

| Diagnóstico das 13 lacunas originais | Slides | Evidência e tratamento |
| --- | ---: | --- |
| HTML truncado | 4 | A nova leitura em fluxo abriu as quatro páginas na rede. Uma retornou três candidatos elegíveis. |
| Evidência insuficiente para verificar o detalhe ou a campanha | 5 | Aliases, dimensões, legendas genéricas e arquivos opacos limitaram a classificação de GWM, Gusto, Ray Gunn e Caixa, com dois slides na mesma pauta. |
| Material repetido ou visualmente pouco distinto | 2 | Minthis e a galeria esportiva exigem outra peça elegível para ocupar o slide que ficou livre. |
| Atribuição a outro autor nos metadados | 1 | A candidata da matéria de Julien Gobled atribui o trabalho a outro autor. |
| Alocação na série certa e no detalhe errado | 1 | A correção geral de ranking resolveu o caso no replay. |

Os dois downloads indisponíveis do corpus anterior estão registrados abaixo. Os replays reutilizam a captura anterior, inclusive nos quatro casos de HTML truncado. Os candidatos descobertos pela nova leitura são dados de rede em um ensaio separado, sem alteração da rubrica histórica.

A amostra inédita contém 30 notícias públicas, com cinco de cada área pedida. Em rede real, as 30 fontes responderam HTTP 200. HTMLRewriter e classificação levaram 674 ms na mediana. Houve 24 downloads elegíveis, com mediana de 415 ms e mediana de 1,03 s da fonte ao primeiro raster. Seis capas ficaram vazias. O ensaio mede uma capa por notícia na etapa documental direta. Ele não inclui a pesquisa completa do Studio, o Openverse ou o desempenho em produção.

No Chromium com navegador novo e pesos servidos pelo Vite local, CLIP quantizado carregou em 1,78 s, inferiu o primeiro par em mais 1,78 s e apresentou mediana de 1,69 s na sessão quente. Os pesos somam 128,1 MB. O ensaio a frio inclui a transferência local, sem medir o primeiro download pela internet. O resultado mantém CLIP opcional e OCR desligado.

Reprodução com `node benchmarks/capture-independent.mjs`, `node benchmarks/review-independent.mjs`, `node benchmarks/capture-independent.mjs --regression` e `node benchmarks/run-visual.mjs`. A checagem autenticada de provedores usa o workflow manual de diagnóstico visual. [Amostra inédita](../benchmarks/independent-sample.json).

## Amostra e método

31 notícias públicas de oito áreas, com 31 capas e 13 slides de detalhe. O GEICO faz parte da amostra e usa as mesmas regras das demais campanhas. A revisão cruzou as fontes, legendas e imagens em uma folha de contato local. A rubrica identifica as imagens aceitas por slide. Quatro pautas ficaram sem imagens nesta extração e dois dos 71 URLs distintos estavam indisponíveis como raster elegível. As 69 imagens obtidas ficaram no cache local. [Amostra de notícias](../src/features/images/fixtures/documentary-sample.json), [rubrica](../benchmarks/visual-subjects.json) e [fonte oficial do GEICO](https://www.geico.com/about/pressreleases/2026/20261123/).

O replayer executa o motor de `4721bb2`, a Fase A de `3884ebc` e a implementação atual no Chromium em 1440 px, em um Intel Core Ultra 7 155H. Ele reutiliza os resultados reais capturados do Openverse e da extração documental, expõe as respostas pela mesma interface HTTP e mede o processamento local. A Brave ficou desligada durante a comparação para usar o mesmo corpus e preservar os créditos. Os ensaios autenticados da Fase A em produção e as medições da interface em 1280 e 1440 px ficam em [STATE.md](STATE.md).

Precisão é a proporção de imagens atribuídas que a rubrica aceita. Relevância por slide inclui todo o denominador de capas e detalhes, inclusive frames vazios. Revisão manual potencial conta frames vazios ou em desacordo com a rubrica. O teste de intervenção efetiva no Studio verifica a aprovação, preservação no backup e reabertura. As medidas de heap são do JavaScript no navegador. Memória nativa do WASM, GPU e uso de outras abas ficam fora dessa leitura.

## Resultado em 31 notícias

| Medida | Motor anterior | Fase A | Atual |
| --- | ---: | ---: | ---: |
| Precisão documental das imagens aplicadas | 0/2 | 23/27 (85,2%) | 31/32 (96,9%) |
| Capas relevantes | 0/31 | 15/31 | 22/31 |
| Detalhes relevantes | 0/13 | 8/13 | 9/13 |
| Frames para revisão manual potencial | 44/44 | 21/44 | 13/44 |
| Duplicidades aplicadas no mesmo carrossel | 0 | 0 | 0 |
| Chamadas à extração direta | 0 | 31 | 31 |
| Consultas ao Openverse | 132 | 17 | 12 |
| Tentativas de download pelo Worker | — | 28 | 34 |
| Primeira imagem, mediana quando houve imagem | 2,34 s | 50 ms | 49 ms |
| Tempo total, mediana do replay | 7 ms | 31 ms | 47 ms |
| Heap JavaScript, mediana | 16,0 MiB | 44,4 MiB | 37,0 MiB |

As 146 consultas distintas capturadas do Openverse retornaram HTTP 200. A mediana das chamadas reais ao catálogo foi 1,61 s. Os downloads públicos dos candidatos documentais tiveram mediana de 0,41 s. Na reprodução, as respostas de catálogo e os rasters da fonte vieram do cache. As duas fotos escolhidas pelo motor anterior vieram do Flickr pela rede e seus tempos até primeira imagem incluem essa latência. Os números de tempo de replay servem para comparar o processamento da Fase A com o atual.

O motor antigo sugeriu um desfile de 2021 para a pauta de 2026 sobre o filme do GEICO e uma fotografia de exposição para a pauta sobre a ilustradora Carolina Soares. A Fase A e a versão atual atribuíram o material do comunicado do GEICO. O único erro da versão atual foi uma foto da série correta usada para um detalhe visual diferente. O ganho observado é deste corpus, que também orientou a calibração. [Pauta de Carolina Soares](https://www.creativebloq.com/features/this-artist-specialises-in-emotional-characters-and-ethereal-scenes) e [comunicado do GEICO](https://www.geico.com/about/pressreleases/2026/20261123/).

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
