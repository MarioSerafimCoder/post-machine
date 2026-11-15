# Post Machine

Plataforma pessoal de criação de conteúdo: **Radar**, **Studio** e **Auditoria** de posts e carrosséis.

## Estado

Fundação da interface disponível: navegação exclusivamente desktop (1024 px+), links diretos, estados vazios reais, roteiro do produto e design system editorial. **Desktop first, sempre; sem versão mobile.** Radar e campanhas implementados. Studio: Fabric, seis templates, carrosséis, marca, fontes WOFF2 locais, imagens, IndexedDB e exportação PNG/ZIP. Auditoria: regras locais de geometria, texto, imagem, contraste e marca, relatório JSON, revisão antes de exportar e correção segura de posição. O site permanece protegido pelo Cloudflare Access.

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

## Auditar uma arte

Abra um projeto no Studio e clique em **Auditar design** para verificar o slide atual ou o carrossel. A página **Auditoria** permite escolher um projeto salvo e filtrar as ocorrências. Clique em **Localizar no Studio** para editar o elemento. Quando houver uma correção segura de posição, a proposta mostra o deslocamento antes de aplicar; **Desfazer** retorna à versão anterior. O relatório pode ser baixado em JSON. Ao exportar PNG/ZIP com avisos, confirme explicitamente após a revisão.

## Documentação

- [Especificação integral](docs/PRODUCT_SPEC.md)
- [Arquitetura, versões, licenças e atualização do Radar](docs/ARCHITECTURE.md)
- [Roadmap e entregas](docs/ROADMAP.md)
- [Estado real e resultados](docs/STATE.md)
- [Configuração local, Cloudflare Access e deploy](docs/SETUP.md)
- [Instruções para agentes](AGENTS.md)

Domínio: [posts.marioserafim.com.br](https://posts.marioserafim.com.br). Custo operacional adicional obrigatório: **R$ 0**. Sem APIs comerciais de IA, banco remoto ou assinatura. Projetos e uploads serão locais, sem sincronização entre dispositivos. Não enviar segredos ou conteúdo pessoal para este repositório público.
