# Benchmark do motor visual

## Amostra e método

31 notícias públicas de oito áreas, com 31 capas e 13 slides de detalhe. O GEICO faz parte da amostra e usa as mesmas regras das demais campanhas. A revisão cruzou as fontes, legendas e imagens em uma folha de contato local. A rubrica identifica as imagens aceitas por slide. Quatro pautas ficaram sem imagens nesta extração e dois dos 71 URLs distintos estavam indisponíveis como raster elegível. As 69 imagens obtidas ficaram no cache local. [Amostra de notícias](../src/features/images/fixtures/documentary-sample.json), [rubrica](../benchmarks/visual-subjects.json) e [fonte oficial do GEICO](https://www.geico.com/about/pressreleases/2026/20261123/).

O replayer executa o motor de `4721bb2`, a Fase A de `3884ebc` e a implementação atual no Chromium em 1440 px, em um Intel Core Ultra 7 155H. Ele reutiliza os resultados reais capturados do Openverse e da extração documental, expõe as respostas pela mesma interface HTTP e mede o processamento local. A Brave ficou desligada durante a comparação para usar o mesmo corpus e preservar os créditos. Os ensaios autenticados da Fase A em produção e as medições da interface em 1280 e 1440 px ficam em [STATE.md](STATE.md).

Precisão é a proporção de imagens atribuídas que a rubrica aceita. Relevância por slide inclui todo o denominador de capas e detalhes, inclusive frames vazios. Revisão manual potencial conta frames vazios ou em desacordo com a rubrica. O teste de intervenção efetiva no Studio verifica a aprovação, preservação no backup e reabertura. As medidas de heap são do JavaScript no navegador. Memória nativa do WASM, GPU e uso de outras abas ficam fora dessa leitura.

## Comparação de modelos e OCR

| Modelo | Pesos | Capas corretas | Detalhes corretos | Carga inicial | Mediana de inferência por pauta |
| --- | ---: | ---: | ---: | ---: | ---: |
| CLIP ViT-B/32, texto INT8 e visão 4 bits | 128,1 MB | 24/27 | 11/13 | 2,37 s | 1,59 s |
| SigLIP 2 ViT-B/32, INT8 | 379,4 MB | 23/27 | 13/13 | 4,73 s | 0,86 s |

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
