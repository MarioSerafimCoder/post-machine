# Arquitetura e decisões

Decisões registradas em 13/11/2026. Escopo implementado: fundação da interface. Especificação integral em PRODUCT_SPEC.md.

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
| Fabric.js | 7.4.0 | MIT | Adiar instalação para Fase 3 |
| Zod | 4.6.7 | MIT | Adiar para contratos e coleta |
| JSZip | 3.10.2 | MIT OR GPL-3.0-or-later | Adiar para exportação; usar opção MIT |

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

Preservar último snapshot válido ao falhar, expor erro por fonte e data real; falhas totais não devem apagar histórico. Definir armazenamento/versionamento do snapshot público na Fase 1. Não enviar favoritos e projetos pessoais ao repositório.

Aceite end-to-end obrigatório: gerar snapshot com `collectedAt` real, publicar no mesmo workflow e conferir, após autenticação Access, o mesmo timestamp em produção. Este circuito NÃO está implementado nem testado na Fase 0.
