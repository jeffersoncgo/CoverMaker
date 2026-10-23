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

### Fase 1b — Componentes só usados pela demo do `cdn` ✅ (2026-10-23)

- [x] `CDN-10` TableSorter, `CDN-13` popup/treelist (texto por padrão, HTML opcional), `CDN-15` themeControl, `CDN-16`.

### Fase 2 — CoverMaker: bugs funcionais ✅ (2026-10-23)

Sem mudança visual nos casos que já funcionam.

- [x] `CM-15` (movido da Fase 3 e elevado a Alta) — IndexedDB do Jellyfin: conexão única, `onblocked`/`onversionchange`,
      gravação aguardável, timeout real. Medido: primeiro carregamento parado por 40 s+.
- [x] `CM-01` — sliders de efeitos de imagem atualizam o projeto (fim do alias `Setup.Settings`).
- [x] `CM-02` — camada de texto padrão criada na primeira visita; primeira sessão é salva.
- [x] `CM-03` — retornos vazios não congelam mais o canvas (0/1 imagem, Scanlines 0, Reflection 0).
      Visual: com 0 imagens a tela passa a mostrar o fundo + texto (antes ficava congelada) — correção intencional.
- [x] `CM-04` — exportar/abrir em nova aba usam o canvas visível (com ou sem texto).
- [x] `CM-10` — Export/Import Config compatíveis (aceita o formato antigo e o novo).
- [x] `CM-11` — IDs de slot únicos (IDs existentes preservados para a restauração).
- [x] `CM-12` — miniaturas do Jellyfin voltam a 480×270 / 270×480.
- [x] `CM-13` — exceções da lista (slots cheios, aleatório sem itens, botão "próxima", etc.).
- [x] `CM-14` — cache de etapas correto (inclui parâmetros do layout no hash, sem depender do spread) sem mudar a saída.
- [x] `CM-17` — `updateTextSettings` sem corrida (array local).
- [x] `CM-19` — importar ZIP mantém slots vazios do fim.
- [x] `CM-29` — Lightning com Seed 0 não quebra (0 = aleatório, como nos outros efeitos).
- [x] `CM-30` — títulos de seção dos efeitos aparecem; o parâmetro `"undefined"` deixa de ser gravado
      (projetos antigos que o têm continuam abrindo). Os controles sem efeito (`grout`, `bgColor`) mudam a imagem e
      ficaram para a Fase 5.
- [x] Guarda contra quadro antigo: um `drawComposite` abortado não sobrescreve o canvas de um mais novo.
- [x] `CM-09` (antecipado da Fase 5: é só o caminho do arquivo) — link do ZIP "Series — Rough" corrigido; todos os
      caminhos de `gallery.json` existem.
- [x] Achado na verificação (`cdn`): o `pageMemory` identificava imagens só por `tipo + tamanho em bytes`; duas
      imagens diferentes com o mesmo tamanho eram gravadas como a mesma e um slot voltava com a imagem de outro.
      Agora a assinatura inclui o SHA-256 do conteúdo (FNV-1a fora de contexto seguro).
- Ficou para a Fase 3: `jellyfin.js:127` (`throw` em `init()`, parte do `CM-08`).

### Fase 3 — Segurança mantendo os recursos ✅ (2026-10-23)

- [x] `CM-05` / `CR-04` — guardar token em vez de senha; o login automático continua funcionando (decisão D4).
      O usuário confirmou em 2026-10-23: "apagar o usuário e senha, e deixar só o token de acesso, pode fazer, contanto
      que tenha certeza que realmente funcione". Usuário e senha deixam de ser gravados; a senha antiga é usada uma vez
      e apagada. Adicionado: botão **Sign out** (revoga o token no servidor).
- [x] `CM-06` / `CR-03` — nomes do Jellyfin e mensagens como texto (mesma aparência para nomes normais).
- [x] `CM-08` — login com falha não é tratado como sucesso; Meilisearch com *fallback* para a carga normal.
- [x] Achados na verificação (`cdn`, `pageMemory`): a trava `canSave` começava liberada (uma gravação entre abrir o
      banco e terminar a restauração sobrescreveria o estado salvo com o padrão da página — o login dispara uma
      gravação justamente nessa janela); e uma gravação já superada continuava lendo imagens revogadas
      (`ERR_FILE_NOT_FOUND` no console) e atualizava o "estado anterior" mesmo abortada.
- Verificação: servidor Jellyfin simulado (mock) para login, bibliotecas, Meilisearch indisponível e não-admin.
  O mock passou a validar o token como o Jellyfin (`GET /Users/{id}` → 401 com token inválido; `POST /Sessions/Logout`
  revoga o token).

### Fase 4 — content-recommender e dados do Jellyfin ✅ (2026-10-23)

- [x] `CR-01`/`CR-02` — `UserData` atualizado a cada carga (também com a biblioteca em cache); IDs normalizados para
      itens vindos do Meilisearch.
- [x] `CR-05` — dependências copiadas para `content-recommender/js/vendor/` (opção 1 da auditoria, como o CoverMaker
      já faz com o `cdn`).
- [x] `CR-08` scroll infinito com trava e lote vazio sem apagar a página; `CR-09` tipos recomendados (filtro na
      montagem das listas — carregar menos tipos faria os dois apps recarregarem o cache compartilhado um do outro);
      `CR-10` exceções; `CR-11` tokenizer Unicode (igual para ASCII), Fisher-Yates, `isPlayed`, troca de conta;
      `CR-12` imagens em retrato 360×540.
- [x] `CM-16` — itens editados no servidor entram no cache (`MinDateLastSaved`), `UserData` com `Map`,
      `PlayedPercentage`, filtro do Meilisearch escapado, Fisher-Yates.
- [ ] `CR-06` — **decisão do usuário**: só entraram as correções sem efeito no resultado. Corrigir os operadores do
      perfil de gosto (`between` → `..`, `all` → `any`) muda as recomendações; sem um critério de pontuação novo, o
      filtro ficaria quase sem efeito. Proposta: implementar como opção, com o atual como padrão, e o usuário compara
      na biblioteca real.
- `CR-07` (README cita atores/diretores/estúdios que o cálculo não usa) vai com a documentação na Fase 6.

### Fase 5 — Mudanças visuais (opção antiga mantida) ✅ (2026-10-23)

- [x] `CM-07` — as versões antigas de `innerShadow`/`extrude` voltaram como efeitos adicionais (`innerShadowOffset`,
      `extrudeShaded`); os atuais renderizam igual. **Sem migração automática** do projeto "Batman": comparado com a
      imagem de resultado da galeria, a versão antiga com os valores do arquivo ficou ~1 % mais perto na média e um pouco
      mais longe nos pixels muito diferentes (inconclusivo) → decisão do usuário (D6).
- [x] `CM-09` — feito na Fase 2.
- [x] `CM-21` — Blur com `edges: Extend Edges` (padrão `Classic`, idêntico).
- [x] `CM-22` — `seed` nos layouts/efeitos aleatórios (0 = aleatório, padrão, como antes).
- [x] `CM-23` — faces reais (negrito/leve/itálico) das Google Fonts quando a família as tem; opção para desligar
      (desligada = como antes). Muda a aparência de textos em negrito/itálico com essas fontes — por isso a opção.
- [x] `CM-28` — Anime Speedlines mostra o texto; `Lines Only` = o antigo `Behind Text`, pixel a pixel. Antes/depois em
      imagem.
- [x] `CM-30` (resto) — largura do rejunte do Stained Glass como opção (padrão idêntico).
- [x] `CM-31` — com **saída idêntica**: `stainedGlass` (grade espacial) e `longShadow` (canvas reaproveitado). O recorte
      do `longShadow` à área do texto mudou pixels em 2 de 8 casos (até 85/255) e foi descartado.
- [x] `CM-32` — Skew ±1; `focusTabName`; `return` no `finally`; `new Promise(async …)`.

### Fase 6 — HTML, acessibilidade, documentação e testes ✅ (2026-10-23)

- [x] `CM-20` — HTML equilibrado sem mudar o DOM (comparado com o `DOMParser`: idêntico).
- [x] `CM-24` — janelas: Pointer Events (toque), `z-index` com ordem correta, parâmetro `window` renomeado.
- [x] `CM-27` (em parte) — zoom, ícones acessíveis por teclado, estilos de toast, foco nas janelas.
- [x] `CR-13` — README, comentário do HTML, foco, confirmação no "Clean Saved Memory", cartões com `role="link"`.
      A confirmação também foi para o CoverMaker (o botão apaga o projeto inteiro).
- [x] `CM-26`, `CDN-18`, `CR-07` — READMEs: só correções do que não era verdade.
- [x] `CDN-08` (`outerHTML` opcional), `CDN-17` (resto) — `FetchQueue` com `res.ok` e Promise, `base.js`.
- [x] `CM-25` — lista de código morto conferida, **nada removido** (D7).
- [x] Testes no repositório: `cdn/tests` (23), `CoverMaker/tests/unit.test.js` (8) e `content-recommender/tests` (5)
      no CI — no cdn e no CoverMaker o deploy só roda se passarem; `CoverMaker/tests/browser/` com a suíte do
      Playwright e o Jellyfin simulado.

## Decisões (respondidas em 2026-10-23)

| ID | Pergunta | Decisão |
|---|---|---|
| D1 | Seguir sem pausas? | **Sim, todas as fases** ("pode corrigir tudo que precisar, alterar o que for preciso"). Mudanças visuais mantêm a opção antiga disponível, conforme o protocolo. |
| D2 | Versionar os testes em `tests/`? | Não respondida diretamente; adotado o padrão **sim** (é só adição e os testes se perderiam com o contêiner). |
| D3 | Como publicar? | **Merge na `main` feito por mim**, sem PR. Depois do merge, conferir o deploy do GitHub Pages e os arquivos no ar. |
| D4 | Senha salva → token? | **Sim.** A senha é a da conta Jellyfin digitada na janela de login; o app a usa uma última vez para obter o token e então a apaga do navegador. |
| D7 | Código morto (`CM-25`) | **Pendente.** Lista conferida na auditoria (`factory.js`, `vendor/search.js` no CoverMaker, `pipelineManager`, `libraryImagetoCanvas`, ajudantes de depuração, `isLibrarySizeChanged`, bloco morto no content-recommender, variáveis não usadas). Recomendação: remover `factory.js`, `pipelineManager`/`PipelineStep` e `libraryImagetoCanvas`; manter os ajudantes de depuração. |
| D6 | Projeto "Batman" da galeria (`CM-07`) | **Pendente.** Usar o efeito restaurado "Inner Shadow (Offset)" com os valores originais do arquivo (`offsetX 9`, `offsetY -1`)? Medição inconclusiva (~1 %). Recomendação: manter como está; o efeito antigo fica disponível para quem quiser. |
| D5 | Perfil de gosto do content-recommender (`CR-06`) | **Pendente.** Hoje só a nota mínima filtra (os filtros de gênero, tag e ano não têm efeito). Recomendação: criar um modo novo como opção, mantendo o atual como padrão, para comparar na biblioteca real. |

## Checklist "mudei X, mexo em Y"

| Mudei | Também preciso |
|---|---|
| `cdn/js/*.js` | Copiar para `CoverMaker/js/vendor/` e `content-recommender/js/vendor/` (mesmo conteúdo), rodar `node --test "tests/*.test.js"` nos três repositórios (o do content-recommender confere as cópias quando estão lado a lado) e testar os dois apps |
| `CoverMaker/js/jellyfin.js` ou `windowsHandle.js` | Copiar para `content-recommender/js/vendor/` (mesmo conteúdo) e testar o content-recommender |
| `cdn/js/*.js` usados pelo content-recommender | Copiar também para `content-recommender/js/vendor/` |
| Parâmetros em `compositeRegistry.js`, `effectsRegistry.js` ou `textEffects.js` | Regenerar `docs/REFERENCIA-EFEITOS.md` e abrir os projetos da galeria |
| Formato de `projectConfig` ou do ZIP | Manter leitura do formato antigo; atualizar `docs/ARQUITETURA.md` §7 |
| `fonts/google-fonts.json` (lista de Google Fonts) | Regenerar `fonts/google-fonts-variants.json` a partir de `https://fonts.google.com/metadata/fonts` |
| Chaves de `localStorage`/IndexedDB | Lembrar que os três apps compartilham a origem `jeffersoncgo.github.io` |

## Medições de referência (2026-10-23, Chromium headless)

- e2e: 33/42 fluxos passando.
- Referência visual: 222 assinaturas, 0 erros, 12 não determinísticas.
- `longShadow` com os parâmetros da camada padrão: 2,9 s por execução; soma dos 86 efeitos de texto (padrão): ~18 s.
- `pageMemory`: ~340 KB gravados por salvamento.

### Depois da Fase 2 (2026-10-23)

- e2e: **41/42** (0 regressões, 8 corrigidos; o restante, a galeria "Series — Rough", passa com o `CM-09` incluído
  depois da rodada).
- Referência visual: 210/210 idênticas (12 aleatórias fora da comparação).
- Pipeline completo (layout + efeitos de imagem + texto, via `drawComposite`): 5 cenários com pixels idênticos aos do
  original; editar e voltar um parâmetro devolve exatamente a mesma imagem; com layout desligado o fundo e o texto
  aparecem (antes a tela congelava); edições rápidas terminam no último estado.
- Jellyfin simulado, primeira visita: bibliotecas em **7 s** (versão anterior: 30 s, por causa do `CM-15`). Sem a
  camada de texto padrão seriam 4 s: ~3 s são o desenho da camada padrão (`longShadow`), que antes só aparecia a
  partir da segunda visita. Ver `CM-31`.
- Inventário: 0 remoções, 18 adições.

### Depois da Fase 6 (2026-10-23)

- `pageMemory`: registro do CoverMaker de **383 KB para 7 KB**; gravação de 10 ms para 2 ms (sem o `outerHTML`).
- HTML: DOM idêntico ao de antes (comparação com o `DOMParser`), agora com as tags equilibradas.
- Testes no repositório: cdn 23/23 (3 deles falham no código anterior: `FetchQueue`, `saveDom`, mouse), CoverMaker 8/8
  (no código original falham o link da galeria e os efeitos duplicados), content-recommender 5/5.

### Depois da Fase 5 (2026-10-23)

- Referência visual: 209 idênticas + 1 alterada de propósito (`actionSpeedlines`, o texto aparece); 2 efeitos novos.
  `crystallize` deixou de ser aleatório com a semente padrão (1), como o parâmetro prometia.
- Pipeline completo: os 5 cenários com os mesmos pixels da Fase 2.
- `stainedGlass`: 6/6 combinações com saída idêntica; Shard Size 5 **34,7 s → 0,17 s**; padrão 1,5 s → 0,1 s.
- `longShadow`: 6/6 idênticas; padrão da camada do app 1,9 s → 1,6 s; máximos 4,9 s → 3,9 s.
- Fontes: Roboto `bold` usa a face 700 real; Open Sans `lighter` a 300; Bangers (só 400) sem nenhum pedido extra e
  idêntico; nenhum erro HTTP no Google Fonts.
- Lint: 61 → 53 achados (só remoções).

### Depois da Fase 4 (2026-10-23)

- Verificações da fase: **8/8** — item editado no servidor aparece com a biblioteca vinda do cache (na recarga só 4
  pedidos de itens: 2 contagens + 2 consultas de editados, em vez de baixar tudo) e fica no cache; item assistido
  depois da primeira visita passa a contar como assistido (19 → 20); 10 eventos de scroll seguidos carregam 1 lote
  (3 grupos); tokenizer igual ao antigo para títulos ASCII; coleções/playlists fora das recomendações; Fisher-Yates
  uniforme (20 000 sorteios, desvio < 7,5 %).
- content-recommender: mesmas recomendações da Fase 3 (lista e notas idênticas). Login 6/6; CoverMaker login 10/10.

### Depois da Fase 3 (2026-10-23)

- Login (CoverMaker, 10 cenários): migração a partir do app antigo **na mesma origem** (o antigo grava a senha no
  `localStorage` e no `pageMemory`; o novo loga com ela uma vez e depois nenhuma das duas cópias existe); recarga só com
  token (0 logins por senha no servidor); token revogado → janela de login; senha errada; troca de conta; Sign out
  (token passa a dar 401 no servidor); usuário comum com Meilisearch carrega as 2 bibliotecas; servidor fora do ar sem
  erro não tratado. **10/10.**
- content-recommender: migração, recarga só com token (mesmas recomendações: 19 assistidos, 36 não assistidos, 6 por
  gosto, 3 grupos × 6), cartões com nome malicioso exibido como texto, Sign out e login pelo formulário. **6/6.**
- e2e: **42/42** (a galeria "Series — Rough" passa: o teste agora acompanha o aviso durante a espera; no original ele
  também falhava por olhar só depois que o aviso sumia).

## Registro de progresso

| Data | Fase | Resultado |
|---|---|---|
| 2026-10-23 | 0 | Rede de segurança criada; referência registrada acima. |
| 2026-10-23 | 1 | Concluída (exceto 1b). Mudanças no caminho: CM-34/CR-14 antecipado; CM-15 elevado a Alta e movido para a Fase 2; Jellyfin simulado adicionado à rede de segurança. |
| 2026-10-23 | 1b | Concluída: TableSorter, popup/treelist, themeControl verificados no Chromium. |
| 2026-10-23 | 2 | Concluída. CM-09 antecipado; achado e corrigido o conflito de assinatura de imagens no `pageMemory`. Medições acima. Observação: a porta do proxy do contêiner mudou no meio da rodada (imagens externas falhavam); os testes passaram a ler `HTTPS_PROXY`. |
| 2026-10-23 | 3 | Concluída. Achados extras no `pageMemory` (trava `canSave`, gravação superada). Teste e2e: aviso da galeria acompanhado durante a espera e "Failed to fetch" (sem Jellyfin em `localhost:8096`) tratado como erro conhecido, como já era "Fetch error: undefined". |
| 2026-10-23 | 4 | Concluída, exceto `CR-06` (decisão do usuário). Observação: um mock caiu no meio dos testes por um `cd` que valia só para o primeiro comando; o cenário foi refeito com o mock no ar. |
| 2026-10-23 | 5 | Concluída. Pendentes de decisão: D6 (Batman). O processo de trabalho foi reiniciado no meio da fase (servidores de teste caíram e foram reabertos). Um e2e deu 41/42 (export na abertura) enquanto o lint rodava em paralelo: as duas versões estabilizam o canvas antes dos 9 s do teste; o mapa de variações de fonte passou a ser baixado em paralelo no carregamento e o e2e, rodado sozinho, deu 42/42. |
| 2026-10-23 | 6 | Concluída. Pendentes de decisão: D5 (perfil de gosto), D6 (Batman), D7 (código morto). |
