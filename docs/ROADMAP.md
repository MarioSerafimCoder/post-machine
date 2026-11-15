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

## Etapa atual: Fase 4 — Auditoria

Fases 1 a 3 implementadas e publicadas. A Fase 4 acrescenta auditoria local e revisão antes da exportação; veja resultados e limites em STATE.md. A publicação agendada do Radar continua pendente de configuração no GitHub Environment `production`.

- 4.1: regras mensuráveis e relatório estruturado com incertezas explícitas.
- 4.2: painel no Studio, página consolidada, filtros e navegação até o elemento.
- 4.3: reposicionamento seguro com proposta, checkpoint, reauditoria e desfazer.
- 4.4: testes integrados, documentação e publicação no Worker existente.

Sem Radar de Virais ou serviços externos de IA nesta fase.
