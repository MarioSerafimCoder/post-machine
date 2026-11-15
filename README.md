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

## Trabalhar um título

Na revisão da campanha, abra **Melhorar headline** na peça desejada. No Studio, selecione um elemento de título e clique em **Melhorar título**. O painel conta caracteres e palavras, sinaliza pontos de revisão e permite comparar propostas locais ou importar o JSON produzido em ChatGPT, Claude ou Gemini. No Studio, o painel mede o encaixe na caixa atual e pode desfazer a edição pelo histórico do projeto.

Os títulos, favoritos e propostas ficam no documento local. No Studio, **Projetos → Configurações de armazenamento** permite verificar os arquivos de imagem e fonte e limpar os que perderam todas as referências.

## Pesquisar imagens e gerar créditos

No Studio, abra **Imagens → Pesquisar imagens** ou use **Buscar imagem para este slide** para preencher o termo com o briefing ou título. Confira a página original e a licença no painel de detalhes. Quando o provedor não permitir a importação direta, baixe o original e use **Importar arquivo com estes créditos**. As imagens salvas aparecem em **Imagens utilizadas**.

**Gerar créditos do projeto** permite copiar e baixar as atribuições. O ZIP das artes inclui `creditos.txt` quando houver metadados de imagens. Confira as condições da fonte antes de publicar, especialmente em imagens adaptadas.

## Organizar referências criativas

Em **Radar → Virais e formatos**, explore os oito formatos, cadastre links, registre observações e salve favoritos. **Criar pauta com esta referência** envia o link e a análise para o briefing da campanha. Use **Exportar biblioteca** para fazer backup das referências locais. As métricas do YouTube exigem configuração opcional no GitHub Actions. Consulte [SETUP.md](docs/SETUP.md).

## Documentação

- [Especificação integral](docs/PRODUCT_SPEC.md)
- [Arquitetura, versões, licenças e atualização do Radar](docs/ARCHITECTURE.md)
- [Roadmap e entregas](docs/ROADMAP.md)
- [Estado real e resultados](docs/STATE.md)
- [Configuração local, Cloudflare Access e deploy](docs/SETUP.md)
- [Instruções para agentes](AGENTS.md)

Domínio: [posts.marioserafim.com.br](https://posts.marioserafim.com.br). Custo operacional adicional obrigatório: **R$ 0**. Sem APIs comerciais de IA, banco remoto ou assinatura. Projetos e uploads serão locais, sem sincronização entre dispositivos. Não enviar segredos ou conteúdo pessoal para este repositório público.
