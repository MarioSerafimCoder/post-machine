# Roteiro por fases

Fonte de requisitos: PRODUCT_SPEC.md. Evidências e estado corrente: STATE.md.

| Fase | Entrega | Critérios de conclusão |
| --- | --- | --- |
| 0 — Fundação | Arquitetura, docs, shell, design system, CI, deploy de teste | Navegação com histórico/links diretos, layout exclusivamente desktop (1024 px+), teclado, lint/test/build aprovados; deploy protegido verificado. Interface pronta não implica deploy concluído. |
| 1 — Radar | RSS e Trends, configuração, coleta 3×/dia, filtros/busca, favoritos e histórico | Fontes reais verificadas; deduplicação URL/título; datas e falhas por fonte; snapshot validado; execução agendada e mesmo JSON conferido em produção. |
| 2 — Prompts e campanhas | Pautas, prompts, contrato JSON versionado, Markdown estruturado | Dados importados validados/sanitizados; fatos separados de interpretações; links originais; integração estruturada pronta para Studio. |
| 3 — Studio | Fabric, seis templates originais, IndexedDB, uploads, projetos, carrosséis, exportação/backup | Elementos editáveis, undo/redo, autosave, reordenação, branding, troca de template sem perder conteúdo; PNG/ZIP e restauração testados; resolução e CORS tratados. |
| 4 — Auditoria | Geometria, margens, fontes, resolução, campos e contraste mensurável | Relatórios verificáveis; no máximo duas tentativas determinísticas; versão anterior preservada; alertas manuais para incerteza. |
| 5 — Inteligência adicional | Openverse, headlines, referências manuais | Atribuição/licenças preservadas; métricas somente reais; heurísticas explícitas; modelos locais opcionais, sem APIs pagas ou scraping não autorizado. |
| 6 — Refinamento | Testes integrados, performance, acessibilidade e revisão visual | Fluxo Radar → conteúdo importado → Studio → auditoria → exportação/backup verificado e documentação atualizada. |

## Fase 5 — Ferramentas editoriais publicadas

Fases 1 a 4 implementadas e publicadas. O Radar tem publicação agendada ativa e o fluxo de produção foi validado no GitHub Actions. Veja resultados e limites em STATE.md.

- 5.0: estabilização do armazenamento e da Auditoria, com identidade provisória Post Machine.
- 5.1: análise, comparação, importação e aplicação de headlines em campanhas e no Studio.
- 5.2: pesquisa pelo Openverse, importação de originais, acervo local e créditos de imagens.
- 5.3: catálogo de oito formatos, curadoria local, geração de pauta e métricas opcionais da YouTube Data API.

## Fase 6 — Refinamento geral

- Studio adaptável às quatro resoluções desktop auditadas. Ferramentas e retorno ao contexto editorial revisados.
- Carregamento sob demanda, biblioteca paginada e miniaturas sob demanda. Salvamento protegido contra gravações concorrentes e restauração com limites durante a leitura.
- Fluxos integrados de notícia e referência até exportação, backups e falhas simuladas. Resultados e publicação registrados em [STATE.md](STATE.md).

## Radar Criativo

- Taxonomia de sete áreas, curadoria bilíngue, prioridade para branding, design gráfico e publicidade e equilíbrio entre criação e contexto.
- O coletor mantém fontes públicas brasileiras e internacionais e reclassifica o histórico de origens ativas. A verificação de disponibilidade e publicação está em [STATE.md](STATE.md).

## Propostas futuras

- Avaliar navegação e leitura das camadas complexas com tecnologias assistivas e sessões de uso real.
- Medir exportações de projetos com fotografias grandes e muitas fontes antes de rever o orçamento de memória ou introduzir renderização em segundo plano.
