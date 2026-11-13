# Post Machine

Plataforma pessoal de criação de conteúdo: **Radar**, **Studio** e **Auditoria** de posts e carrosséis.

## Estado

Fundação da interface disponível: navegação exclusivamente desktop (1024 px+), links diretos, estados vazios reais, roteiro do produto e design system editorial. **Desktop first, sempre; sem versão mobile.** Coletor, editor, persistência e auditoria ainda não implementados. O deploy de teste está protegido pelo Cloudflare Access.

## Executar

Node 24.15+ (linha 24 LTS) e npm:

```sh
npm ci
npm run dev
```

```sh
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

## Documentação

- [Especificação integral](docs/PRODUCT_SPEC.md)
- [Arquitetura, versões, licenças e atualização do Radar](docs/ARCHITECTURE.md)
- [Roadmap e instruções para Fase 1](docs/ROADMAP.md)
- [Estado real e resultados](docs/STATE.md)
- [Configuração local, Cloudflare Access e deploy](docs/SETUP.md)
- [Instruções para agentes](AGENTS.md)

Domínio: [posts.marioserafim.com.br](https://posts.marioserafim.com.br). Custo operacional adicional obrigatório: **R$ 0**. Sem APIs comerciais de IA, banco remoto ou assinatura. Projetos e uploads serão locais, sem sincronização entre dispositivos. Não enviar segredos ou conteúdo pessoal para este repositório público.
