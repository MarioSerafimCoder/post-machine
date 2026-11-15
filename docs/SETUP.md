# Configuração e publicação

## Desenvolvimento

Pré-requisito: Node 24 LTS (24.15+), npm e Git.

```sh
npm ci
npm run dev
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run deploy:check
```

No ambiente original npm não estava no PATH. Foi usado temporariamente o npm 11.6.2 oficial baixado de registry.npmjs.org, fora do repositório. Em instalações normais de Node, os comandos acima funcionam diretamente. Não versionar ferramentas temporárias.

`npm run preview` serve o build de produção local. A aplicação não pede credenciais, não implementa login frontend e salva campanhas, projetos e arquivos no IndexedDB deste navegador. Faça backups antes de limpar os dados do site.

## Cloudflare — passos dependentes da conta

1. Usar somente Workers Free e Zero Trust/Access gratuito compatível com um usuário. Não contratar upgrades, serviços pagos ou billing por uso adicional. Conferir o plano real antes de publicar.
2. Fazer `npx wrangler login` no seu ambiente ou disponibilizar credenciais pelo mecanismo de segredos do CI. Nunca colar tokens no chat, código ou arquivos públicos.
3. Configurar uma aplicação Access para `posts.marioserafim.com.br`, com política Allow restrita à sua identidade e demais usuários negados. Verificar autenticação em sessão anônima e sessão autorizada. Não usar política bypass pública.
4. A rota `posts.marioserafim.com.br` já está no wrangler.jsonc. Antes de novos deploys, confirmar que o Access continua protegendo o hostname e seus arquivos estáticos.
5. Manter `workers_dev: false` e `preview_urls: false`. Se habilitar qualquer URL alternativa para testes, proteger essa URL com Access antes de disponibilizar dados.
6. Para deploy local, executar `npm run deploy` com Wrangler autenticado e plano Free. Para deploy automatizado, configurar o ambiente abaixo.
7. Verificar: sessão anônima recebe desafio/negação Access; sessão autorizada abre o app; refresh/link direto funciona; assets carregam; cabeçalhos de segurança chegam; URLs alternativas não contornam Access.

O comando dry-run valida empacotamento; NÃO comprova deploy, DNS, Access ou gratuidade da configuração da conta.

## GitHub Actions

`ci.yml` valida main e pull requests em runners Linux públicos padrão. `deploy.yml` roda em main manualmente e às 06:17, 12:17 e 18:17 (Brasília). O job de coleta independe de credenciais Cloudflare. Ele restaura o último artefato de coleta válido (ou usa a edição inicial de `public/radar.json`), coleta, valida e gera o build. O job seguinte publica exatamente esse build, sem outro push ou workflow.

Configurar no environment `production`:

- Secret `CLOUDFLARE_API_TOKEN`: token da conta Cloudflare com a função Editor limitada ao Worker `post-machine`. O workflow envia uma versão com `wrangler versions upload` e publica essa versão com `wrangler versions deploy`. O domínio já vinculado é administrado na Cloudflare. Nunca use uma variável VITE_ para o token.
- Secret `CLOUDFLARE_ACCOUNT_ID`.
- Variable `CLOUDFLARE_ACCESS_READY=true` somente depois de confirmar a política Access e a rota no wrangler.jsonc. É uma trava operacional, não autenticação e não prova automática da política.

Sem esses valores, apenas a publicação falha com mensagem explícita. Configure em **Settings → Environments → production** no GitHub. Depois execute **Actions → Radar e deploy protegido → Run workflow → main**. Compare `collectedAt` no artefato `radar-snapshot` com [radar.json](https://posts.marioserafim.com.br/radar.json) em sessão autorizada. O workflow verifica redirecionamento anônimo antes e depois da publicação.

Para reproduzir localmente, use `npm run radar:collect`, `npm run build` e `npm run preview`. Edite `radar/sources.json` para ajustar fontes, nichos, destinos de redirecionamento e palavras-chave. Os favoritos ficam no IndexedDB do navegador e não são enviados ao servidor.

## Dados e segredos

### YouTube opcional em Virais e Formatos

No Google Cloud, habilite a YouTube Data API v3 e use uma chave dedicada com restrição à YouTube Data API. Cadastre a chave em **Settings → Secrets and variables → Actions → Repository secrets**, com o nome `YOUTUBE_API_KEY`. No mesmo painel, em **Variables**, configure `YOUTUBE_VIDEO_IDS` com IDs públicos separados por vírgula. Use apenas IDs autorizados para publicação no snapshot. A biblioteca pessoal e as notas não alimentam essa variável e ficam no navegador. Rode o workflow `Radar e deploy protegido` para atualizar.

O coletor usa lotes de até 50 IDs e aceita no máximo 200 IDs. `YOUTUBE_REQUESTS_PER_RUN` (padrão 2, máximo 4) e `YOUTUBE_REQUESTS_PER_DAY` (padrão 6, máximo 20) são limites opcionais deste workflow. O orçamento diário segue o fuso do Pacífico. O cache evita nova consulta ao mesmo vídeo por 24 h e descarta observações após sete dias. Artefatos de cache duram sete dias. Sem chave ou sem lista pública, o modo manual continua disponível. Consulte [videos.list](https://developers.google.com/youtube/data/reference/rest/v3/videos/list) e as [políticas de dados](https://developers.google.com/youtube/terms/developer-policies).

Repositório público: não salvar uploads, projetos pessoais, backups, tokens ou arquivos .env. Somente código e futuros metadados públicos das fontes. O domínio de produção está publicado com Access; a validação da sessão autorizada e do agendamento deve ser registrada separadamente em STATE.

QA do build com os cabeçalhos reais: `npm run test:e2e:production` usa Wrangler local na porta 44174. A suíte de desenvolvimento usa 44173; nenhuma utiliza a porta 4173 do BRasa.
