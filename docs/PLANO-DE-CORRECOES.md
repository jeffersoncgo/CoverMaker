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

### Fase 4 — content-recommender e dados do Jellyfin

- [ ] `CR-01`/`CR-02` — `UserData` atualizado; servidores com Meilisearch.
- [ ] `CR-05` — fixar versões das dependências remotas (decisão D3).
- [ ] `CR-06`…`CR-12`, `CM-16` — busca por gosto, scroll infinito, exceções, imagens, cache incremental.

### Fase 5 — Mudanças visuais (só com aprovação; opção antiga mantida)

- [ ] `CM-07` — restaurar as versões antigas de `innerShadow`/`extrude` como efeitos adicionais e migrar projetos
      antigos (ex.: galeria "Batman").
- [x] `CM-09` — feito na Fase 2.
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

## Decisões (respondidas em 2026-10-23)

| ID | Pergunta | Decisão |
|---|---|---|
| D1 | Seguir sem pausas? | **Sim, todas as fases** ("pode corrigir tudo que precisar, alterar o que for preciso"). Mudanças visuais mantêm a opção antiga disponível, conforme o protocolo. |
| D2 | Versionar os testes em `tests/`? | Não respondida diretamente; adotado o padrão **sim** (é só adição e os testes se perderiam com o contêiner). |
| D3 | Como publicar? | **Merge na `main` feito por mim**, sem PR. Depois do merge, conferir o deploy do GitHub Pages e os arquivos no ar. |
| D4 | Senha salva → token? | **Sim.** A senha é a da conta Jellyfin digitada na janela de login; o app a usa uma última vez para obter o token e então a apaga do navegador. |

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
