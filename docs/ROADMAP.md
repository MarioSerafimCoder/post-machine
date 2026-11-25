# Roteiro por fases

## Finalização 13.1 e Evolução 14

- 13.1: diagnóstico real controlado com Brave Web/Images, extração `alt` corrigida, pesquisa adaptativa e revisão de 114 notícias. Os 12 slides pareados mantiveram 10 imagens corretas, dois vazios e cobertura de 83,3%. Código validado localmente; publicação autorizada pelo proprietário mediante CI do mesmo commit e workflow protegido.
- 14: piloto local de inteligência visual multimodal, partindo do CLIP, OCR, Web Workers, deduplicação e memória existentes. Análise visual complementa a prova documental, com medição fria/quente, corpus independente e cancelamento. Só será ativado por padrão se demonstrar benefício sem regressão de precisão, segurança, memória ou latência. A publicação requer autorização específica posterior.

## Evolução 13 — estabilidade e relevância

- 13.1: identidade opcional no JSON v1, migração local e reconciliação conservadora, com preservação de decisões da peça.
- 13.2: redistribuição das consultas para pendentes, diagnósticos e recuperação; a meta de 90% de cobertura permanece em aberto, conforme medição em VISUAL_BENCHMARK.md.
- 13.3: revisão editorial, fotos, atalhos, codec e diagnósticos separados por responsabilidade, sem troca de stack.
- 13.4: ordenação editorial do Radar, relações entre pautas, interesses e preferências locais redefiníveis. Não representa previsão de viralização.
- Implementação local; publicação depende de autorização do proprietário.

## Visual Intelligence Engine

- Fase A introduz contexto opcional no JSON v1, extração direta, adaptadores Brave e Openverse, acervo de campanha compartilhado, alocação em segundo plano e continuidade entre Expressa e Studio. A publicação segue o workflow protegido após a configuração do Worker.
- Fase B melhora a seleção pela narrativa, a deduplicação e a memória de decisões manuais. As alternativas de semântica e OCR ficam em piloto local, com critérios de ativação registrados no benchmark.
- Fase C disponibiliza descoberta contextual do YouTube e renderização de páginas dinâmicas como complementos opcionais. A ativação depende de ensaio real com as contas existentes, cotas verificadas e ganho editorial.

## Evolução 12 — Busca fotográfica automática

- Preparações organizadas pesquisam fotografias documentais em segundo plano. A busca expandida precede o apoio editorial e o slide fica vazio quando a evidência é insuficiente.
- A Produção Expressa exibe resultados por peça. O Studio aplica sugestões em frames compatíveis. Vínculos manuais, travas, recortes, backups e créditos permanecem sob controle do editor.

## Evolução 11 — Templates autorais e automação visual

- 11.1 e 11.2 consolidam estados de interação, controles e movimento reduzido, com feedback das ações do Studio, Produção Expressa e Auditoria.
- 11.3 guarda templates autorais e funções semânticas no navegador, com edição protegida por revisão, backup e preenchimento dentro da Produção Expressa.
- 11.4 compara e audita cópias entre retrato, quadrado e Story. Templates podem guardar variantes da mesma família.
- 11.5 usa classificação de imagem local sob demanda e permite controle manual do ponto focal. Sugestões por metadados continuam disponíveis.
- 11.6 verifica os fluxos desktop em quatro resoluções e a publicação pelo workflow protegido. Os resultados ficam em [STATE.md](STATE.md).

## Evolução 09 — Produtividade e consistência da interface

- Retomar o último projeto local pelo início e iniciar a revisão pelos projetos recentes da Auditoria.
- Padronizar a apresentação dos controles desktop, organizar a barra do Studio e adiar os balões do assistente durante a digitação.

## Editorial Intelligence 2.0

- EI-01 e EI-02 incorporam o catálogo v2.0.0 e usam regras rastreáveis para selecionar, comparar e explicar recomendações conforme o contexto.
- EI-03 a EI-05 conectam briefing, importação, Headlines, Produção Expressa e Auditoria ao Assistente Editorial. A saída de campanha continua no contrato v1.
- EI-06 mantém feedback delimitado por perfil editorial ou campanha. EI-07 valida os fluxos desktop, o armazenamento local e a publicação protegida.
- Casos de plataforma sem artefato correspondente, revisão factual de alegações, aprovação humana formal e métricas com denominadores ficam para extensões específicas do fluxo de publicação.

## Evolução 08 — Integração e estabilidade

- Pautas importadas podem abrir diretamente na Produção Expressa. A edição preserva os destaques dos caracteres que permaneceram no título.
- Frames podem ser navegados e reordenados por teclado. A publicação exige CI aprovado para o mesmo commit e mantém o Cloudflare Access.

## Evolução 07.1 — Coleções editoriais e frames

- Impacto Fotográfico, Cartão Editorial e Narrativa Visual acrescentam 18 composições. A fabricação segue limitada a 18 candidatos por slide na coleção escolhida.
- Frames verticais reúnem miniaturas reais, papel editorial e estado da Auditoria. O canvas recalcula o encaixe quando o painel é recolhido.

## Evolução 07 — Auditoria e Finalização

- Revisão no Studio com contadores por slide, indicação de resultados desatualizados e acesso ao elemento com orientação para corrigir.
- A ação Finalizar e exportar salva o projeto, reaproveita a última revisão válida e reúne PNG, ZIP, legenda e créditos.

## Evolução 06

- Studio com canvas ajustável à janela, zoom manual persistido durante a edição e propriedades conforme a seleção.
- Revisão de texto e imagem, organização de camadas e slides e integração com os projetos da Produção Expressa.

## Evolução 05

- A Produção Expressa gera três propostas editáveis dentro da coleção escolhida, com avaliação de tipografia e enquadramento, revisão de cada slide e salvamento apenas da versão selecionada.
- A fabricação usa o navegador, preserva texto e créditos e reaproveita o Studio, a Auditoria e a exportação existentes.

## Evoluções 03 e 04

- Evolução 03 introduz a identidade branca, preta e vermelha e oito coleções visuais com seis composições editáveis em três formatos.
- Evolução 04 permite preparar texto e imagens no Studio, escolher uma coleção, conferir o encaixe e salvar um projeto editável.

## Evoluções 01 e 02

- Evolução 01 reorganiza a navegação principal no cabeçalho e as ferramentas por área, com painéis recolhíveis e manutenção das rotas e dos dados locais.
- Evolução 02 adiciona oportunidades editoriais justificadas, fontes originais, filtros, favoritos e criação de pauta no briefing existente. O sinal “Em alta” depende de observações comparáveis do Google Trends.

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
- A interface mostra a última coleta bem-sucedida. O diagnóstico por fonte fica no registro da coleta.

## Propostas futuras

- Avaliar navegação e leitura das camadas complexas com tecnologias assistivas e sessões de uso real.
- Medir exportações de projetos com fotografias grandes e muitas fontes antes de rever o orçamento de memória ou introduzir renderização em segundo plano.
