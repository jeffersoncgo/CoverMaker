# Plano de correções — CoverMaker, cdn e content-recommender

> Plano em fases para corrigir os itens de `docs/AUDITORIA.md` dos três repositórios
> (`CM-xx` aqui, `CDN-xx` em `jeffersoncgo/cdn`, `CR-xx` em `jeffersoncgo/content-recommender`).
> Iniciado em 2026-10-23. Cada fase é marcada ao ser concluída, com o que mudou no caminho.

## Regra principal (definida pelo usuário)

**Corrigir sem perder nenhuma funcionalidade.** Adicionar pode; remover ou perder, nunca.

Na prática:

1. **Nada é apagado**: funções, botões, layouts, efeitos, parâmetros, formatos de arquivo e dados salvos continuam
   existindo. Código morto (ver `CM-25`) só sai com ok explícito.
2. **Projetos antigos continuam abrindo e renderizando igual.** Mudança que altera a imagem de um projeto existente
   entra como **opção nova** cujo padrão é o comportamento antigo, ou só depois de mostrar antes/depois e receber ok.
3. **Conteúdo do usuário** (galeria, presets, configurações salvas) só muda com ok.

## Rede de segurança (Fase 0)

Toda fase só é dada como concluída se passar nestes três testes, comparados com a referência de 2026-10-23:

| Teste | O que verifica | Referência (2026-10-23) |
|---|---|---|
| **Inventário** | Globais, métodos de classe, `id`s e *handlers* do HTML, classes CSS, layouts/efeitos e seus parâmetros, itens da galeria, lista de fontes | cdn: 97 globais / 141 métodos · CoverMaker: 325 / 149, 40 layouts, 16 efeitos de imagem, 86 de texto, 11 itens de galeria, 1 899 fontes · content-recommender: 38 globais. **Nenhuma remoção permitida.** |
| **Referência visual** | Assinatura de pixels de cada layout (1, 2 e 6 imagens), efeito de imagem e efeito de texto com parâmetros padrão, entradas fixas | 222 assinaturas, nenhum erro. 12 delas variam a cada execução por usarem aleatoriedade (3 layouts: cctv, comicLayout, glitchMosaic; 7 efeitos de texto: glitch, ripple, paintBrush, crystallize, mosaic, glitterTexture, gummyCandy) e ficam fora da comparação. **As demais devem ficar idênticas**, exceto as que a fase corrige de propósito (listadas na fase). |
| **Fluxos reais (e2e)** | 42 fluxos no Chromium: slots, camadas e efeitos de texto, layouts, efeitos de imagem, formatos, exportar imagem/projeto/setup/config, importar, galeria, persistência, abrir em nova aba | **33/42 passam.** Os 9 que falham são exatamente bugs da auditoria: CM-02 (×2), CM-04 (×2), CM-11, CM-01, CM-12, CM-10, CM-09. **Os 33 devem continuar passando**; cada fase deve virar alguns dos 9 para verde. |

Os scripts estão no *scratchpad* da sessão e vão para `tests/` se o usuário aprovar (decisão D2).

## Fases

### Fase 0 — Rede de segurança ✅ (2026-10-23)

- [x] Inventário de funcionalidades dos três repositórios.
- [x] Referência visual de todos os layouts e efeitos.
- [x] Teste e2e de 42 fluxos; resultado registrado acima.

### Fase 1 — Bibliotecas base (`cdn`) e sincronização de `CoverMaker/js/vendor` ✅ (2026-10-23)

Sem mudança visual. Afeta os dois apps (o content-recommender carrega o `cdn` direto do `main`).

- [x] `CDN-01/02` — `Controller`: estado por execução (chamada antiga resolve, a nova recebe o próprio resultado) e
      throttle que **executa a última chamada** em vez de descartá-la. Mesma API (`wrap`, `.Controller`,
      `startDelayMs`, eventos). Aceita `startDelayMs` como sinônimo de `delayMs` nas opções.
- [x] `CDN-03` — `pageMemory`: o `AbortSignal` correto chega em `_savePageInfo`.
- [x] Trazer para o `cdn` as melhorias que só existem na cópia do CoverMaker (`canSave`, *fallback* de Blob URL
      revogada) e tornar configuráveis os atrasos e a lista de eventos (o CoverMaker usa 500 ms e não escuta `click`),
      para a cópia `vendor/` ficar idêntica ao `cdn` sem mudar o comportamento de nenhum dos dois.
- [x] `CDN-09` — `CSS.escape` nos seletores; `destroy()` sem erro; `added-trigger` fora dos atributos salvos.
- [x] `CDN-04` — `mergeObjects` ignora `__proto__`/`constructor`/`prototype`.
- [x] `CDN-05` — `SearchEngine.sort` passa a ordenar de fato.
- [x] `CDN-06` — `cleanObject` limpa sem trocar o objeto raiz.
- [x] `CDN-11` — `Observer.RemoveCallBack` funciona; nomes de evento corrigidos (`contextmenu`, `resize`, `copy`,
      `cut`, `paste`).
- [x] `CDN-14`, `CDN-17` — `safeWindowsFileName` (normaliza antes de limpar), `makeObjbyPath` retorna o objeto,
      `GetValueFromPath` tolera caminho inexistente.
- [x] `CDN-12` — página de demonstração volta a carregar todas as seções.
- [x] Testes unitários em Node para `controller`, `object`, `search`, `common` (casos da auditoria).
- Verificação: testes Node + demo do `cdn` no Chromium + rede de segurança do CoverMaker com a `vendor/` sincronizada.
- [x] Antecipado (achado durante a verificação): `CM-34`/`CR-14` — `tempLimit` recebia o `AbortSignal` e o
      content-recommender não mostrava nenhuma recomendação desde 2025-12-01. Correção de uma linha no `jellyfin.js`.
- [x] Adicionado à rede de segurança: servidor Jellyfin simulado (login admin/comum, 2 bibliotecas, 55 itens, imagens,
      Meilisearch opcional) e fluxos com ele para o CoverMaker e o content-recommender.
- Resultado: inventário sem remoções (5 adições); 210/210 renderizações idênticas; e2e 33/42 sem regressões (os 9 que
  falham são da Fase 2); 17 testes Node passando; demo do `cdn` sem erros; CoverMaker com Jellyfin simulado igual ao
  original e com a busca usando o texto completo; content-recommender com as mesmas recomendações (só o desempate de
  itens com a mesma nota passou a seguir a nota da comunidade, como o código pedia).

### Fase 1b — Componentes só usados pela demo do `cdn`

- [ ] `CDN-10` TableSorter, `CDN-13` popup/treelist (texto por padrão, HTML opcional), `CDN-15` themeControl, `CDN-16`.

### Fase 2 — CoverMaker: bugs funcionais

Sem mudança visual nos casos que já funcionam.

- [ ] `CM-15` (movido da Fase 3 e elevado a Alta) — IndexedDB do Jellyfin: conexão única, `onblocked`/`onversionchange`,
      gravação aguardável, timeout real. Medido: primeiro carregamento parado por 40 s+.
- [ ] `CM-01` — sliders de efeitos de imagem atualizam o projeto (fim do alias `Setup.Settings`).
- [ ] `CM-02` — camada de texto padrão criada na primeira visita; primeira sessão é salva.
- [ ] `CM-03` — retornos vazios não congelam mais o canvas (0/1 imagem, Scanlines 0, Reflection 0).
      Visual: com 0 imagens a tela passa a mostrar o fundo + texto (antes ficava congelada) — correção intencional.
- [ ] `CM-04` — exportar/abrir em nova aba usam o canvas visível (com ou sem texto).
- [ ] `CM-10` — Export/Import Config compatíveis (aceita o formato antigo e o novo).
- [ ] `CM-11` — IDs de slot únicos (IDs existentes preservados para a restauração).
- [ ] `CM-12` — miniaturas do Jellyfin voltam a 480×270 / 270×480.
- [ ] `CM-13` — exceções da lista (slots cheios, aleatório sem itens, botão "próxima", etc.).
- [ ] `CM-14` — cache de etapas correto (inclui parâmetros do layout no hash, sem depender do spread) sem mudar a saída.
- [ ] `CM-17` — `updateTextSettings` sem corrida (array local).
- [ ] `CM-19` — importar ZIP mantém slots vazios do fim.
- [ ] `CM-29` — Lightning com Seed 0 não quebra (0 = aleatório, como nos outros efeitos).
- [ ] `CM-30` — títulos de seção dos efeitos aparecem; o parâmetro `"undefined"` deixa de ser gravado
      (projetos antigos que o têm continuam abrindo).
- [ ] Guarda contra quadro antigo: um `drawComposite` abortado não sobrescreve o canvas de um mais novo.

### Fase 3 — Segurança mantendo os recursos

- [ ] `CM-05` / `CR-04` — guardar token em vez de senha; o login automático continua funcionando (decisão D4).
- [ ] `CM-06` / `CR-03` — nomes do Jellyfin e mensagens como texto (mesma aparência para nomes normais).
- [ ] `CM-08` — login com falha não é tratado como sucesso; Meilisearch com *fallback* para a carga normal.
- Verificação: servidor Jellyfin simulado (mock) para login, bibliotecas, Meilisearch indisponível e não-admin.

### Fase 4 — content-recommender e dados do Jellyfin

- [ ] `CR-01`/`CR-02` — `UserData` atualizado; servidores com Meilisearch.
- [ ] `CR-05` — fixar versões das dependências remotas (decisão D3).
- [ ] `CR-06`…`CR-12`, `CM-16` — busca por gosto, scroll infinito, exceções, imagens, cache incremental.

### Fase 5 — Mudanças visuais (só com aprovação; opção antiga mantida)

- [ ] `CM-07` — restaurar as versões antigas de `innerShadow`/`extrude` como efeitos adicionais e migrar projetos
      antigos (ex.: galeria "Batman").
- [ ] `CM-09` — corrigir o link do ZIP "Series — Rough" em `gallery.json` (conteúdo da galeria).
- [ ] `CM-21` — opção para blur sem halo nas bordas (padrão: atual).
- [ ] `CM-22` — opção de semente nos layouts/efeitos aleatórios (padrão: atual).
- [ ] `CM-23` — carregar pesos/itálico reais das Google Fonts.
- [ ] `CM-28` — Anime Speedlines deixa de apagar o texto (mostrar antes/depois).
- [ ] `CM-31` — desempenho dos efeitos de texto **com saída idêntica** (comparação de pixels).
- [ ] `CM-32` — limites de parâmetros que degeneram (Skew ±1).

### Fase 6 — HTML, acessibilidade e documentação

- [ ] `CM-20`, `CM-24`, `CM-27`, `CR-13` — HTML válido, janelas com toque, botões acessíveis, idioma.
- [ ] `CM-26`, `CDN-18` — README atualizados.
- [ ] `CM-25` — lista de código morto para decisão do usuário (nada é removido sem ok).

## Decisões pendentes

| ID | Pergunta | Recomendação |
|---|---|---|
| D1 | Seguir sem pausas nas Fases 1–4 e parar só antes da Fase 5 (mudanças visuais)? | Sim |
| D2 | Versionar os testes em `tests/` de cada repositório e rodá-los no workflow antes do deploy? | Sim (é só adição) |
| D3 | Como publicar: um PR por repositório a partir de `claude/beautiful-davinci-nd8o1m`, com merge feito por você? | Sim. O merge no `cdn` vai ao ar na hora para o content-recommender. |
| D4 | Senha salva: usar uma última vez para obter o token e então apagar `localStorage.password` e o campo salvo pelo `pageMemory`? | Sim (apagar dado salvo exige seu ok) |

## Checklist "mudei X, mexo em Y"

| Mudei | Também preciso |
|---|---|
| `cdn/js/*.js` | Copiar para `CoverMaker/js/vendor/` (mesmo conteúdo) e testar o content-recommender, que carrega o `cdn` do `main` ao vivo |
| `CoverMaker/js/jellyfin.js` ou `windowsHandle.js` | Testar o content-recommender (carrega esses arquivos do GitHub Pages do CoverMaker) |
| Parâmetros em `compositeRegistry.js`, `effectsRegistry.js` ou `textEffects.js` | Regenerar `docs/REFERENCIA-EFEITOS.md` e abrir os projetos da galeria |
| Formato de `projectConfig` ou do ZIP | Manter leitura do formato antigo; atualizar `docs/ARQUITETURA.md` §7 |
| Chaves de `localStorage`/IndexedDB | Lembrar que os três apps compartilham a origem `jeffersoncgo.github.io` |

## Medições de referência (2026-10-23, Chromium headless)

- e2e: 33/42 fluxos passando.
- Referência visual: 222 assinaturas, 0 erros, 12 não determinísticas.
- `longShadow` com os parâmetros da camada padrão: 2,9 s por execução; soma dos 86 efeitos de texto (padrão): ~18 s.
- `pageMemory`: ~340 KB gravados por salvamento.

## Registro de progresso

| Data | Fase | Resultado |
|---|---|---|
| 2026-10-23 | 0 | Rede de segurança criada; referência registrada acima. |
| 2026-10-23 | 1 | Concluída (exceto 1b). Mudanças no caminho: CM-34/CR-14 antecipado; CM-15 elevado a Alta e movido para a Fase 2; Jellyfin simulado adicionado à rede de segurança. |
