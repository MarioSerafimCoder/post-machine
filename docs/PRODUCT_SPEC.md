# PROJETO: POST MACHINE

Você é o arquiteto técnico e responsável pela fundação de uma plataforma web pessoal de criação de conteúdo chamada **Post Machine**.

**Domínio de produção:** https://posts.marioserafim.com.br

## 1. Objetivo

Desenvolver uma aplicação web completa para descobrir pautas, planejar campanhas e criar posts e carrosséis profissionais para redes sociais.

A Post Machine deve funcionar independentemente de Figma, Canva ou plugins externos.

O produto terá três áreas principais:

- **Radar:** descoberta de notícias, tendências e referências criativas.
- **Studio:** editor gráfico online, com templates profissionais e montagem automática de carrosséis.
- **Auditoria:** verificação de problemas técnicos, visuais e editoriais antes da exportação.

É uma ferramenta de uso exclusivamente pessoal.

**Restrição obrigatória: custo operacional adicional R$ 0.**

Não introduza serviços pagos, APIs comerciais de IA, infraestrutura desnecessária nem dependências que exijam assinatura.

## 2. Forma de trabalho e economia de tokens

Siga estas regras durante todo o desenvolvimento:

1. Inspecione o repositório e a estrutura existente antes de escrever código.
2. Não reescreva funcionalidades que já estejam corretas.
3. Crie `AGENTS.md` com instruções curtas e permanentes para outros agentes de programação.
4. Centralize a especificação em `docs/PRODUCT_SPEC.md`.
5. Crie `docs/ROADMAP.md` com fases e critérios de conclusão.
6. Mantenha `docs/STATE.md` com o estado real da implementação, pendências e próximos passos.
7. Crie `docs/SETUP.md` para procedimentos que dependam de contas, permissões ou credenciais.
8. Evite documentos redundantes e pesquisas repetidas.
9. Trabalhe exclusivamente na branch `main`, preservando os arquivos existentes.
10. Priorize código simples, modular, tipado, testável e reutilizável.
11. Ao terminar uma etapa, execute os testes relevantes e registre apenas erros, correções e resultados.
12. Não apresente funcionalidades simuladas como implementadas.
13. Não declare conclusão sem comprovação.
14. Não solicite confirmação para decisões técnicas pequenas e reversíveis.
15. Nunca exponha segredos em código, logs, commits ou variáveis públicas.

Faça uma pesquisa inicial curta para confirmar versões, licenças e limitações das bibliotecas. Depois registre as decisões para evitar pesquisas repetidas.

## 3. Stack preferencial

- React + TypeScript + Vite
- Tailwind CSS
- Fabric.js como motor de edição visual
- IndexedDB para projetos, configurações e uploads locais
- Zod para validação dos dados importados
- JSZip para exportação em lote
- Vitest para testes
- Playwright para testes de interface
- Cloudflare Workers Static Assets para hospedagem
- GitHub Actions para coleta agendada de dados

Não usar PostgreSQL, Firebase, Supabase ou banco de dados remoto na versão inicial.

Referências de código:

- https://github.com/fabricjs/fabric.js
- https://github.com/ciftcisamet/design-editor
- https://github.com/vipinyadav01/lumio-design-studio
- https://github.com/sansan0/TrendRadar

Utilize código de terceiros apenas após verificar licença, compatibilidade e dependências. O TrendRadar serve inicialmente como referência de arquitetura, não como código para copiar sem análise da GPL-3.0.

## 4. Direção de UI/UX

Criar uma interface editorial profissional, de alta qualidade visual e adequada a um diretor de arte.

Diretrizes:

- Design minimalista, contemporâneo e funcional.
- Predominância de fundos claros e tipografia sem serifa.
- Contraste elevado e acentos cromáticos moderados.
- Navegação objetiva e consistente.
- Exclusivamente desktop. Desktop first sempre. Atualização explícita do proprietário em 13/11/2026: não desenvolver experiência mobile; viewport mínimo inicial de 1024 px.
- Componentes e botões padronizados.
- Evitar excesso de painéis, controles e decorações.
- Utilizar estados claros de carregamento, vazio, erro e sucesso.
- Manter prévias fiéis aos arquivos exportados.

O aplicativo deve possuir uma identidade própria, sem copiar literalmente a interface de produtos existentes.

## 5. MÓDULO RADAR

O Radar é uma das funcionalidades mais importantes do produto.

Criar três seções:

### A. Notícias e Pautas

Agregar artigos e notícias por nicho.

Categorias iniciais configuráveis:

- Design e criatividade
- Arquitetura
- Marketing e publicidade
- Tecnologia e inteligência artificial
- Cinema e cultura
- Economia
- Saúde e bem-estar
- Psicologia

Utilizar fontes RSS verificáveis e Google Trends.

Priorizar notícias brasileiras e internacionais relevantes, com suporte a português e inglês.

Cada item deve possuir:

- ID estável
- Título original
- Resumo extraído da fonte, quando disponível
- Fonte
- URL original
- Data de publicação
- Data de coleta
- Categoria
- País/idioma, quando identificável
- Indicador de relevância
- Status de favorito

Implementar:

- Coleta automática três vezes por dia.
- Configuração das fontes por arquivo.
- Deduplicação por URL canônica e similaridade de título.
- Filtros por categoria, data, idioma e fonte.
- Busca textual.
- Favoritos.
- Histórico de notícias recentes.
- Indicação da última atualização.
- Estado de erro quando uma fonte estiver indisponível.

Arquitetura preferencial: coletor Node.js executado pelo GitHub Actions, que gera JSON validado e disponibiliza o resultado ao frontend estático.

Verificar e documentar como a atualização do JSON chegará à produção após as execuções agendadas. Não presumir que um commit automático aciona o deploy sem testar.

Não inventar notícias, fontes ou datas.

### B. Gerador de pautas e prompts

Cada notícia deve oferecer:

- Abrir fonte original.
- Salvar ideia.
- Criar pauta.
- Gerar prompt.
- Enviar conteúdo estruturado ao Studio.

O prompt deve incluir:

- Tema
- Fontes verificáveis
- Público-alvo
- Objetivo
- Tom editorial
- Quantidade de slides
- Formato
- Restrições de linguagem
- Instruções para separar fatos de interpretações

A plataforma não precisa chamar um LLM comercial.

O usuário copiará o prompt, trabalhará no ChatGPT, Claude ou Gemini e importará o resultado para o Studio.

Definir um contrato JSON versionado para a importação, mantendo suporte a Markdown estruturado.

### C. Radar de Virais e Formatos

Criar uma biblioteca de referências criativas e formatos editoriais.

Exemplos:

- Headline provocativa
- Comparação visual
- Antes e depois
- Conteúdo educativo
- Lista editorial
- Carrossel narrativo
- Opinião
- Storytelling visual

Para cada referência, registrar:

- Nome do formato
- Descrição
- Plataforma de origem
- Link original
- Nichos aplicáveis
- Mecanismo criativo
- Sugestão de aplicação
- Métricas reais, se disponíveis
- Data de observação

Nunca inventar curtidas, visualizações ou pontuações de viralidade.

Na primeira versão, permitir curadoria manual de referências.

Planejar integração posterior com a YouTube Data API para obter dados públicos verificáveis.

Não implementar scraping não autorizado de Instagram ou TikTok.

## 6. MÓDULO STUDIO

Criar um editor visual online usando Fabric.js.

Recursos fundamentais:

- Projetos e pastas.
- Galeria de templates.
- Criação de posts e carrosséis.
- Formatos 1080×1350, 1080×1080 e 1080×1920.
- Canvas com zoom e navegação.
- Painel de slides.
- Painel de camadas.
- Elementos editáveis.
- Upload de imagens.
- Ajuste de enquadramento.
- Tipografia e cores.
- Alinhamento e distribuição.
- Guias e áreas seguras.
- Undo/redo.
- Bloqueio de elementos.
- Auto-branding: logotipo, arroba e cores salvas.
- Auto-save local.
- Duplicação e ordenação de slides.
- Exportação PNG e ZIP.
- Backup e restauração dos projetos.

Começar com seis templates originais e profissionais, estruturados para capa, conteúdo, fotografia e CTA.

### Montagem automática

Importar conteúdos Markdown ou JSON.

O sistema deve:

1. Identificar o número de posts e slides.
2. Separar título, corpo, imagem e CTA.
3. Validar dados obrigatórios.
4. Selecionar templates compatíveis.
5. Aplicar identidade visual.
6. Distribuir os textos.
7. Evitar overflow.
8. Permitir alterações individuais.
9. Preservar a editabilidade dos elementos.

Utilizar um esquema semântico de template com campos como:

`title`, `body`, `image`, `cta`, `brand`, `safeArea`, `maxCharacters`, `preferredAspectRatio`.

O usuário poderá trocar o template sem perder o conteúdo.

## 7. MÓDULO DE IMAGENS

Permitir upload de imagens locais e pesquisa via Openverse.

Incluir:

- Busca por assunto.
- Prévia.
- Seleção de imagens.
- Verificação da resolução.
- Informações de licença e atribuição.
- Ajuste de enquadramento.
- Histórico local de imagens utilizadas.

Tratar falhas de CORS, URLs indisponíveis e imagens que contaminem o canvas de exportação.

Não remover créditos necessários nem assumir que toda imagem encontrada pode ser utilizada comercialmente.

## 8. MÓDULO DE HEADLINES

Criar botão "Melhorar título".

Na versão inicial:

- Verificar tamanho e legibilidade do título.
- Detectar repetições.
- Avaliar clareza e especificidade com regras explícitas.
- Disponibilizar prompts para IA externa.
- Receber sugestões importadas e permitir aplicação com um clique.

Planejar suporte opcional a WebLLM ou Ollama.

Não simular um modelo de IA com respostas pré-escritas e apresentar isso como inteligência artificial.

## 9. MÓDULO DE AUDITORIA

A auditoria deve analisar cada arte antes da exportação.

Verificações iniciais:

- Texto ultrapassando margens.
- Elementos fora do canvas.
- Sobreposição inadequada detectável geometricamente.
- Fontes ausentes.
- Imagens com resolução insuficiente.
- Campos obrigatórios vazios.
- Elementos de branding ausentes.
- Contraste insuficiente onde puder ser medido corretamente.
- Consistência de formatos entre slides.

Criar correções automáticas determinísticas, limitadas a duas tentativas.

Preservar a versão anterior e registrar cada correção.

Quando o problema não puder ser corrigido com segurança, emitir alerta para revisão manual.

Planejar uma auditoria visual multimodal opcional no futuro, sem contratar APIs pagas.

## 10. Segurança e persistência

- Aplicação de uso pessoal, protegida em produção com Cloudflare Access.
- Nunca implementar autenticação fictícia no frontend.
- Sanitizar Markdown, URLs e dados importados.
- Proteger chamadas de serviços externos.
- Não armazenar segredos no navegador.
- Projetos e imagens salvos localmente via IndexedDB.
- Exportar e importar backup completo.
- Informar que projetos não são sincronizados entre dispositivos.
- Impedir custos automáticos de serviços externos.
- Usar apenas bibliotecas com licenças compatíveis.

## 11. Organização do desenvolvimento

Dividir em etapas verificáveis:

**Fase 0 — Fundação**
Configuração do projeto, arquitetura, documentação, design system, navegação e deploy de teste.

**Fase 1 — Radar funcional**
RSS, Google Trends, coletor agendado, classificação, filtros, favoritos e visualização de fontes.

**Fase 2 — Prompts e campanhas**
Criação de pautas, geração de prompts, contratos JSON e importação estruturada.

**Fase 3 — Studio**
Editor Fabric.js, templates, projetos locais, composição automática e exportação.

**Fase 4 — Auditoria**
Validação de layout, relatório de problemas e correção automática.

**Fase 5 — Inteligência adicional**
Pesquisa de imagens, headlines com modelo local opcional e Radar de Virais com fontes verificáveis.

**Fase 6 — Refinamento**
Testes integrados, performance, acessibilidade, revisão visual e documentação final.

## 12. Sua tarefa agora

1. Audite o repositório disponível.
2. Defina a arquitetura mais simples que cumpra os requisitos.
3. Crie os documentos permanentes do projeto.
4. Inicialize a aplicação, caso ainda não exista.
5. Implemente a Fase 0 com navegação e design system funcionais.
6. Execute build, lint e testes possíveis.
7. Registre o estado real do projeto em `docs/STATE.md`.
8. Prepare instruções para o próximo agente implementar a Fase 1.

Não desenvolva todas as fases de uma vez.

Entregue um resumo curto contendo:

- Arquivos criados ou alterados.
- Funcionalidades efetivamente operacionais.
- Testes realizados.
- Pendências que exigem minha intervenção.
- Próxima fase pronta para implementação.

Priorize precisão, qualidade e baixo consumo de tokens.