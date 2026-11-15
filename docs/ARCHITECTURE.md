# Arquitetura e decisões

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
