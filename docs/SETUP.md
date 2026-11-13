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

`npm run preview` serve o build de produção local. A aplicação não pede credenciais, não implementa login frontend e ainda não salva projetos.

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

`ci.yml` valida main e pull requests; usa runners Linux públicos padrão. Não usar runners pagos/maiores. `deploy.yml` é manual e roda somente em main; repete lint/test/build e publica usando environment `production`.

Configurar no environment `production`:

- Secret `CLOUDFLARE_API_TOKEN`: token limitado à conta necessária, Workers Scripts Edit e permissões de zona necessárias para o domínio, conforme procedimento oficial Cloudflare. Nunca variável VITE_.
- Secret `CLOUDFLARE_ACCOUNT_ID`.
- Variable `CLOUDFLARE_ACCESS_READY=true` somente depois de confirmar a política Access e a rota no wrangler.jsonc. É uma trava operacional, não autenticação e não prova automática da política.

Sem esses valores, deploy falha com mensagem explícita. CI não depende de credenciais Cloudflare. Autenticação para publicar não foi inventada ou embutida no app.

Para Fase 1, integrar coleta e deploy no mesmo workflow conforme ARCHITECTURE.md. Não criar agendamento sem fontes verificadas e configuração de produção válida.

## Dados e segredos

Repositório público: não salvar uploads, projetos pessoais, backups, tokens ou arquivos .env. Somente código e futuros metadados públicos das fontes. O domínio de produção é planejado; o README não deve tratá-lo como aplicação publicada antes da verificação.
