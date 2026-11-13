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

## Próximo agente: Fase 1

1. Ler STATE, ARCHITECTURE e SETUP. Resolver o deploy protegido antes de afirmar entrega end-to-end.
2. Definir contrato Zod para fonte, notícia, snapshot e erros por fonte; datas ISO, IDs estáveis e URLs http/https canônicas.
3. Verificar RSS reais nas categorias da especificação e Google Trends; registrar termos, disponibilidade, idioma e país apenas quando conhecidos. Não usar dados inventados no produto.
4. Implementar coletor com timeout, limite de resposta, redirects limitados, deduplicação e proteção contra URLs locais/privadas. Evitar SSRF no coletor; configuração de fontes versionada e revisada.
5. Testar feeds malformados, falhas parciais/totais, datas inválidas, títulos similares e URLs equivalentes. Fixtures de teste identificadas como fixtures.
6. Construir busca/filtros, favoritos IndexedDB, estados loading/empty/error/success e indicação de último sucesso; não instalar Fabric antes da fase correspondente.
7. Publicar no MESMO workflow da coleta. Conferir timestamp do JSON em produção e documentar o resultado real.
8. Atualizar STATE com testes e pendências; não avançar para Fase 2 nesta entrega.
