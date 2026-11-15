# Post Machine

Plataforma pessoal de criação de conteúdo: **Radar**, **Studio** e **Auditoria** de posts e carrosséis.

## Estado

O Post Machine reúne Radar, campanhas, Studio e Auditoria em um fluxo para desktop a partir de 1024 px. O Studio edita imagens, fontes WOFF2 locais e carrosséis com seis templates. A Auditoria verifica geometria, texto, imagem, contraste e marca. O site usa Cloudflare Access e salva seu trabalho no navegador.

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
npm run test:e2e:production
npm run deploy:check
```

## Auditar uma arte

Abra um projeto no Studio e clique em **Auditar design** para verificar o slide atual ou o carrossel. A página **Auditoria** permite escolher um projeto salvo e filtrar as ocorrências. Clique em **Localizar no Studio** para editar o elemento. Quando houver uma correção segura de posição, a proposta mostra o deslocamento antes de aplicar; **Desfazer** retorna à versão anterior. O relatório pode ser baixado em JSON. Ao exportar PNG/ZIP com avisos, confirme explicitamente após a revisão.

## Trabalhar um título

Na revisão da campanha, abra **Melhorar headline** na peça desejada. No Studio, selecione um elemento de título e clique em **Melhorar título**. O painel conta caracteres e palavras, sinaliza pontos de revisão e permite comparar propostas locais ou importar o JSON produzido em ChatGPT, Claude ou Gemini. No Studio, o painel mede o encaixe na caixa atual e pode desfazer a edição pelo histórico do projeto.

Os títulos, favoritos e propostas ficam no documento local. No Studio, **Projetos → Configurações de armazenamento** permite verificar os arquivos de imagem e fonte e limpar os que perderam todas as referências.

## Pesquisar imagens e gerar créditos

No Studio, abra **Imagens → Pesquisar imagens** ou use **Buscar imagem para este slide** para preencher o termo com o briefing ou título. Confira a página original e a licença no painel de detalhes. Quando o provedor não permitir a importação direta, baixe o original e use **Importar arquivo com estes créditos**. As imagens salvas aparecem em **Imagens utilizadas**.

Em **Mais ações → Gerar créditos do projeto**, copie ou baixe as atribuições. O ZIP das artes inclui `creditos.txt` quando houver metadados de imagens. Confira as condições da fonte antes de publicar, especialmente em imagens adaptadas.

## Organizar referências criativas

Em **Radar → Virais e formatos**, explore os oito formatos, cadastre links, registre observações e salve favoritos. **Criar pauta com esta referência** envia o link e a análise para o briefing da campanha. Use **Exportar biblioteca** para fazer backup das referências locais. As métricas do YouTube exigem configuração opcional no GitHub Actions. Consulte [SETUP.md](docs/SETUP.md).

## Salvar e recuperar o trabalho

- No Studio, use **Mais ações → Backup completo** para guardar o projeto editável, imagens, fontes e créditos. Restaure em **Projetos → Restaurar projeto ZIP**. A restauração cria uma cópia com outro identificador.
- Em **Pautas e prompts → Exportar backup**, guarde as campanhas. Restaure em **Restaurar backup JSON**. Campanhas que já existem são mantidas e seus pares importados viram cópias.
- Em **Virais e formatos → Exportar biblioteca**, guarde as referências. **Restaurar biblioteca JSON** acrescenta entradas e ignora duplicatas.
- Se outra aba salvar uma versão concorrente, exporte um backup da edição pendente e restaure-o depois de recarregar. Aguarde a confirmação de salvamento antes de fechar o navegador.

## Documentação

- [Especificação integral](docs/PRODUCT_SPEC.md)
- [Arquitetura, versões, licenças e atualização do Radar](docs/ARCHITECTURE.md)
- [Roadmap e entregas](docs/ROADMAP.md)
- [Estado real e resultados](docs/STATE.md)
- [Configuração local, Cloudflare Access e deploy](docs/SETUP.md)
- [Instruções para agentes](AGENTS.md)

Domínio: [posts.marioserafim.com.br](https://posts.marioserafim.com.br). Custo operacional adicional obrigatório: **R$ 0**. Sem APIs comerciais de IA, banco remoto ou assinatura. Projetos e uploads serão locais, sem sincronização entre dispositivos. Não enviar segredos ou conteúdo pessoal para este repositório público.
