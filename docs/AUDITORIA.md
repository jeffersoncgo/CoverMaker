# CoverMaker — Auditoria: erros, correções sugeridas e melhorias

> Plano de correções em andamento: [`PLANO-DE-CORRECOES.md`](PLANO-DE-CORRECOES.md).
> Status: ✅ corrigido · ◐ corrigido em parte (o que falta está indicado no item).

> Revisão do código em `9928358`. Cada item indica **como foi verificado**:
> 🧪 reproduzido no Chromium (Playwright) com o app servido localmente · 🔎 leitura de código.
> Severidade: **Alta** (função quebrada, perda de dados ou segurança), **Média** (falha em casos comuns),
> **Baixa** (borda, desempenho, manutenção).
> Problemas das bibliotecas copiadas em `js/vendor/` estão documentados em `jeffersoncgo/cdn` → `docs/AUDITORIA.md`
> (IDs `CDN-xx`); os que afetam o CoverMaker são citados aqui.
>
> Segunda rodada (CM-28 a CM-32): ESLint com regras de erro (`no-undef`, `no-dupe-keys`, `no-unsafe-finally`, …)
> em todo o JS e um teste que executa **todos** os layouts (0, 1, 2 e 6 imagens), efeitos de imagem e efeitos de texto
> no Chromium com parâmetros padrão, mínimos e máximos, registrando exceções, saída vazia e tempo.

## Resumo

| ID | Sev. | Onde | Problema |
|---|---|---|---|
| CM-01 ✅ | Alta | `app.js:107` | Mexer nos parâmetros de um **efeito de imagem** não altera nada 🧪 |
| CM-02 ✅ | Alta | `app.js:2213`, `:1066` | Primeira visita: camada de texto padrão não é criada e **nada é salvo** — tudo se perde ao recarregar 🧪 |
| CM-03 ✅ | Alta | `compositeRegistry.js`, `effectsRegistry.js:320,446` | Com 0 ou 1 slot (ou Scanlines com opacidade 0) o canvas **congela** 🧪 |
| CM-04 ✅ | Alta | `app.js:1641`, `:1936` | "Download" falha quando não há camada de texto (e pode exportar imagem antiga) 🧪 |
| CM-05 ✅ | Alta | `app.js:708`, `index.html:39-43` | Senha do Jellyfin gravada em texto puro (localStorage **e** IndexedDB) 🧪 |
| CM-06 ✅ | Alta | `jellyfin_ui.js:324,338`, `jellyfin.js:1151`, `toast.js:51` | XSS: nomes vindos do Jellyfin inseridos com `innerHTML` 🔎 |
| CM-07 | Alta | `textEffects.js:1938,2140,5833,5945` | `innerShadow` e `extrude` declarados duas vezes; o projeto da galeria "Batman" perde parâmetros 🔎 |
| CM-08 ✅ | Alta | `jellyfin.js:124-143,372-410,1188-1221` | Login falho tratado como sucesso; com o plugin Meilisearch, usuário não-admin nunca carrega bibliotecas 🔎 |
| CM-09 ✅ | Alta | `gallery/gallery.json:122` | "Series — Rough → Use Full Project" aponta para um ZIP que não existe 🧪 |
| CM-10 ✅ | Média | `app.js:1440,1479,1489,941` | Export/Import Config incompatíveis; importação é sobrescrita pelo que estava salvo 🧪 |
| CM-11 ✅ | Média | `slots.js:178` | IDs de slot duplicados após remover + adicionar (restauração troca imagens) 🧪 |
| CM-12 ✅ | Média | `app.js:1185-1195` | `updateImageSettings` muta `Setup.Sizes`: miniaturas do Jellyfin passam a ser pedidas em 1920 px 🧪 |
| CM-13 ✅ | Média | vários | Exceções não tratadas e IDs/elementos errados (lista) 🧪/🔎 |
| CM-14 ✅ | Média | `drawing.js:65,322,488,569` | Cache de etapas só funciona por acidente; clones de canvas a cada redesenho 🧪 |
| CM-15 ✅ | **Alta** | `jellyfin.js:171-208,317-334` | IndexedDB do Jellyfin: conexões nunca fechadas **travam o primeiro carregamento das bibliotecas** (40 s+ medidos); timeout inexistente 🧪 |
| CM-16 | Média | `jellyfin.js:476-504,1039-1099` | Cache de bibliotecas só invalida por contagem; `UserData` nunca atualiza por padrão 🔎 |
| CM-17 ✅ | Média | `app.js:2021`, `vendor/controller.js` | Corrida em `updateTextSettings` pode duplicar camadas (potencial) 🔎 |
| CM-18 | Média | `index.html`, `vendor/pagememory.js` | `pageMemory` pesado: ~340 KB de `outerHTML` por gravação, varre o painel inteiro a cada clique 🧪 |
| CM-19 ✅ | Baixa | `app.js:1851-1897`, `gallery.js:164-220` | Importar ZIP descarta slots vazios do fim; fluxo "Use Json" inconsistente 🔎 |
| CM-20 | Baixa | `index.html` | HTML inválido (`#app` sem fechamento, `div` faltando no template, `src` duplicado) 🧪 |
| CM-21 | Baixa | `effectsRegistry.js`, `drawing.js:224` | Filtros redesenhados sobre o próprio canvas (bordas do blur); `ctx.filter` em Safari 🔎 |
| CM-22 | Baixa | `compositeRegistry.js`, `textEffects.js` | Aleatoriedade sem semente: o mesmo projeto renderiza diferente após recarregar 🔎 |
| CM-23 | Baixa | `fonts.js:214-229` | Google Fonts carrega só o peso/estilo padrão (negrito/itálico sintetizados) 🔎 |
| CM-24 | Baixa | `windowsHandle.js:85-100` | Parâmetro `window` sombreia o global; janelas não arrastam no toque 🔎 |
| CM-25 | Baixa | vários | Código morto / legado 🔎 |
| CM-26 | Baixa | `README.md`, `CONTRIBUTING.md` | Documentação desatualizada ou incorreta 🔎 |
| CM-27 | Baixa | `index.html`, `paramsRenderer.js:213` | Acessibilidade e consistência de idioma 🔎 |
| CM-28 | Média | `textEffects.js` (`actionSpeedlines`) | "Anime Speedlines" apaga o texto com os valores padrão 🧪 |
| CM-29 ✅ | Média | `textEffects.js:1205` (`lightning`) | "Lightning" com Seed = 0 (mínimo do slider) lança `rnd is not a function` 🧪 |
| CM-30 ◐ | Média | `textEffects.js` | Controles que não fazem nada e parâmetro `"undefined"` salvo nos projetos 🧪 |
| CM-31 | Média | `textEffects.js` | Efeitos de texto travam a página por segundos (Stained Glass: 46 s no mínimo) 🧪 |
| CM-32 | Baixa | vários | Achados de lint e casos-limite de parâmetros 🧪 |
| CM-33 ✅ | Média | `app.js:2013` + `vendor/controller.js` | Busca do Jellyfin ignorava as últimas teclas digitadas (corrigido via `CDN-02`) 🧪 |
| CM-34 ✅ | Alta | `jellyfin.js:754` | `searchItems` com 3 argumentos recebia o `AbortSignal` como `tempLimit` → lista vazia (quebra o content-recommender, `CR-14`) 🧪 |

---

## Alta

### CM-01 — Parâmetros de efeitos de imagem não têm efeito 🧪 — ✅ corrigido (2026-10-23)

`onEffectParamChange` (`app.js:107`) escreve em `Setup.Settings.canvas.effects`, mas o pipeline lê
`projectConfig.canvas.effects`. `Setup.Settings` só é o mesmo objeto que `projectConfig` logo após importar um projeto
(`loadFullProjectFromJson`); em uma sessão normal ele é `{}` (criado em `ensureCompositeDefaults`, `app.js:852`) ou uma
cópia antiga desserializada do `localStorage.setup`.

Reprodução: abrir o app, **Image → Effects → +** (Blur), arrastar o slider "Blur Amount" →
`projectConfig.canvas.effects[n].params.amount` continua `5` e o canvas não muda.

O mesmo padrão existe em `onTextEffectParamChange` (`app.js:630`), mascarado pelo listener delegado de
`#settingsContent` que relê todo o DOM das camadas de texto.

Correção:

```js
// app.js:107
const effects = projectConfig?.canvas?.effects;
// app.js:630
const effects = projectConfig?.textLayers?.[layerIndex]?.effects;
```

E eliminar o alias: remover `Setup.Settings` de `ensureCompositeDefaults` (852), `addtypeSelectOptions` (2313) e
`drawing.js:575`, e não gravar `Settings` dentro de `localStorage.setup` (hoje o projeto inteiro é duplicado ali).

### CM-02 — Primeira visita não persiste nada 🧪 — ✅ corrigido (2026-10-23)

- `dummyStart()` chama `loadTextLayers(Setup.defaults.textLayers)` (`app.js:2213`), mas `Setup.defaults.textLayers`
  é **um objeto**, não um array → o `for` não roda e nenhuma camada é criada.
- No fim de `loadTextLayers`, `idsToCheck.length == layersData.length` (`app.js:1066`) compara `0 == undefined` →
  `window.memoryLoaded` fica `false`.
- `saveprojectConfig()`/`saveSetup()` (`app.js:922-931`) só gravam quando `memoryLoaded` é `true`.

Resultado medido: na primeira sessão `localStorage.projectConfig` e `localStorage.setup` nunca são criados; layout,
efeitos e camadas de texto adicionados somem ao recarregar (só a partir da 2ª sessão, quando a restauração do
`pageMemory` liga `memoryLoaded`, a persistência funciona).

Correção:

```js
// dummyStart()
loadTextLayers([JSON.parse(JSON.stringify(Setup.defaults.textLayers))]);
window.memoryLoaded = true;

// loadTextLayers(): aceitar objeto único e liberar a gravação mesmo sem camadas
if (layersData && !Array.isArray(layersData)) layersData = [layersData];
…
window.memoryLoaded = true;
```

### CM-03 — Canvas congela com 0/1 imagem ou em efeitos com retorno vazio 🧪 — ✅ corrigido (2026-10-23)

O pipeline (`drawing.js:65`) guarda `{hash, ...resultado}`; quando um `apply` faz `return;`, o resultado fica sem
`canvas`, `applyImageEffects`/`drawComposite` encerram e **o canvas visível para de atualizar** — inclusive o texto.

- Medido executando cada layout: **40 de 40** não devolvem canvas com 0 imagens e **34 de 40** com 1 imagem
  (`if (!N) return;` / `if (N === 1) return;` em carousel, fanSpread, scatteredPhotos, polaroidWall, honeycomb, …),
  às vezes depois de já terem desenhado o fundo. Com 2 ou mais imagens, todos funcionam e nenhum lança exceção.
- `effectsRegistry.js:446` (Scanlines com `opacity` 0 — o mínimo do slider) e `:320` (Reflection com tamanho 0).

Reprodução: deixar 1 slot, layout "3D Carousel", editar o texto → canvas não muda. Ou Scanlines com opacidade 0 →
nenhuma alteração posterior aparece.

Correção em um ponto só (mantém a identidade das funções, então o cache continua funcionando):

```js
// drawing.js — executar uma vez, depois que os registros carregarem
function normalizeApplyResults(registry) {
  for (const def of Object.values(registry)) {
    const original = def.apply;
    if (typeof original !== 'function' || original.__normalized) continue;
    def.apply = async (ctx, canvas, ...rest) => (await original(ctx, canvas, ...rest)) || { canvas, ctx };
    def.apply.__normalized = true;
  }
}
normalizeApplyResults(COMPOSITE_REGISTRY);
normalizeApplyResults(EFFECTS_REGISTRY);
```

E, nos layouts, trocar `return;` por `return { canvas, ctx };` (com 1 imagem, desenhar ao menos o fundo/a imagem).

### CM-04 — Exportação depende de existir texto 🧪 — ✅ corrigido (2026-10-23)

`exportAsPNG` usa `Composites.Merged.toDataURL` (`app.js:1641`), mas `Merged` só é criado quando há canvas de texto
(`drawing.js:277-279`). Na primeira visita (sem camadas, ver CM-02) o botão **Download** lança
`TypeError: Cannot read properties of undefined (reading 'toDataURL')`. Se as camadas forem desativadas depois de
existirem, `Merged` fica com a imagem **antiga** e é ela que é exportada/aberta (`openInNewTab`, `app.js:1936`).

Correção: exportar o canvas visível (sempre o resultado final) e usar `toBlob` (evita *data URLs* de dezenas de MB):

```js
mainCanvas.toBlob(blob => {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: getExportFileName() });
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}, `image/${format}`, quality);
```

Em `drawComposite`, zerar `window.Composites.Merged` quando não houver texto.

### CM-05 — Senha em texto puro 🧪 — ✅ corrigido (2026-10-23)

- `saveFieldsToStorage` grava `localStorage.password` (`app.js:708`).
- `#Password` tem o atributo `save` (`index.html:43`) → o `pageMemory` grava o valor no IndexedDB `pageMemoryDB`
  (confirmado: a senha digitada aparece no registro).
- O formulário vem pré-preenchido com `admin` / `password` e o app tenta logar com isso ao abrir.

Qualquer script na mesma origem (`jeffersoncgo.github.io` hospeda também `cdn` e `content-recommender`) consegue ler
essas credenciais. Correção sugerida:

1. Remover `save` do campo de senha e a gravação de `localStorage.password`; deixar os campos vazios por padrão.
2. Após o login, guardar apenas `{ server, userId, accessToken }` e reutilizar o token
   (`authorization: MediaBrowser … Token="…"`); oferecer "Sair" que chama `POST /Sessions/Logout`.
3. Quem já usa o app tem a senha gravada: na próxima versão, apagar `localStorage.password` e o registro do `pageMemory`.

Como ficou (2026-10-23): o login guarda só `localStorage.jellyfinAuth = { server, serverId, userId, token }`; no
carregamento o token é validado com `GET /Users/{userId}` e nenhuma senha é enviada. Quem já tinha a senha salva loga com
ela **uma última vez**; com o token obtido (ou se o servidor recusar a senha), `localStorage.password`/`username` são
apagados e o registro do `pageMemory` é regravado sem os campos de login (que perderam o `[save]`). O formulário não vem
mais com a senha `password` preenchida. Botão novo **Sign out** chama `POST /Sessions/Logout`. Verificado contra o
Jellyfin simulado: migração a partir do app antigo na mesma origem, recarga só com token, token revogado, senha errada,
troca de conta, sair, usuário comum com Meilisearch e servidor fora do ar (10/10).

### CM-06 — XSS via metadados do Jellyfin 🔎 — ✅ corrigido (2026-10-23)

`addVideoposter`/`addLibrarycover` fazem `label.innerHTML = item.Name` (`jellyfin_ui.js:324,338`) e
`showLoadingLibraries` monta HTML com `lib.Name` (`jellyfin.js:1151`). Nomes vêm de metadados (arquivos NFO, scrapers,
qualquer usuário com permissão de edição). `toastMessage` também usa `innerHTML` (`toast.js:51`) e recebe
`err.message` em vários pontos. Correção: `label.textContent = item.Name;` e, no toast,
`span.textContent = message` (montar o ícone separadamente).

### CM-07 — Efeitos de texto duplicados 🔎

`TEXT_EFFECTS` declara `extrude` (linhas 1938 e 5945) e `innerShadow` (2140 e 5833). Em um literal de objeto a segunda
declaração substitui a primeira silenciosamente, e os esquemas são diferentes:

| Efeito | 1ª definição (morta) | 2ª definição (ativa) |
|---|---|---|
| `innerShadow` | `color, blur, offsetX, offsetY, opacity` | `color, distance, angle, blur, opacity` |
| `extrude` | `depth, angle, color, shading` | `depth, angle, color, fade` |

`gallery/projects/batman-collection/project.json` usa `innerShadow` com `offsetX/offsetY` → esses valores são ignorados
e o resultado difere do original. Correção: renomear as primeiras (`innerShadowOffset`, `extrude3D`) para preservar
projetos antigos, ou migrar parâmetros ao carregar (`distance = hypot(offsetX, offsetY)`,
`angle = atan2(offsetY, offsetX)`). Um teste simples que falhe com chaves duplicadas evita a repetição
(ex.: `grep -E "^  [a-zA-Z0-9]+: \{" | sort | uniq -d`).

### CM-08 — Fluxo de login/Meilisearch 🔎 — ✅ corrigido (2026-10-23)

Como ficou: `init()` não rejeita mais (servidor fora do ar e falta de credenciais viram `onServerSetupError` /
`onLoginError`); login com falha para o fluxo; sem acesso à configuração do plugin, ou com erro do Meilisearch, as
bibliotecas carregam pelo Jellyfin (verificado com usuário comum e o plugin presente). **Mantido de propósito:** o ajuste
automático dos atributos do índice Meilisearch (`updateFilterableAttributes`/`updateSortableAttributes`) — é um recurso
que o app usa; perguntar antes de alterar o índice fica como sugestão.

- `login()` captura o erro e retorna `undefined` (`jellyfin.js:397-409`); em `init()` o `.then` roda mesmo assim
  (`:132-140`), marca `isAuthenticated = true` e chama Meilisearch/bibliotecas sem token (cascata de 401).
- `init()` é `async` e chamado no construtor sem `catch`: com o servidor fora do ar gera
  `Uncaught (in promise) Error: Server is offline` (visto no console a cada carregamento sem Jellyfin).
- Meilisearch: a página `/web/configurationpage?name=Meilisearch` não exige privilégio, então `isAvailable` vira `true`
  para qualquer usuário; mas `/Plugins/{id}/Configuration` exige administrador (vale confirmar com uma conta comum).
  Para não-admin, `ApiKey/Url` ficam indefinidos, `new meilisearch.Meilisearch({ host: undefined })` lança erro e o `setTimeout(getLibraries)` nunca é agendado →
  **as bibliotecas não carregam**. O mesmo ocorre se a URL interna do Meilisearch não for acessível pelo navegador.
- O app expõe a chave de API do Meilisearch ao navegador e **altera a configuração do índice** do servidor
  (`updateFilterableAttributes`, `updateSortableAttributes`, `updatePagination`) sem avisar — isso dispara reindexação
  no Meilisearch.

Correção:

```js
async login() { … if (!response.ok) throw new Error(`HTTP ${response.status}`); … }   // propagar
async init() {
  await this.getPublicInfo(); if (!this.Server.isOnline) return;
  await this.setFastestAddress();
  if (!this.User.Username) return;
  try { await this.login(); } catch { return; }          // onLoginError já foi disparado
  try { await this.setupMeiliSearch(); } catch (e) { console.warn('Meilisearch indisponível', e); this.Meilisearch.isAvailable = false; }
  await this.getLibraries();
}
```

Em `loadLibraryItems`, cair para `loadLibraryItemsVanilla` se a chamada ao Meilisearch falhar; pedir confirmação
antes de alterar o índice.

### CM-09 — Link quebrado na galeria 🧪 — ✅ corrigido (2026-10-23)

`gallery.json:122` aponta para `series.rough.project.zip`; o arquivo é `series-rough.project.zip`.
Correção: `"project": "gallery/projects/series-rough/series-rough.project.zip"`. Um passo no workflow que valide
todos os caminhos de `gallery.json` evitaria isso:

```bash
python3 -c "import json,os,sys;b=[(i['id'],k,i[k]) for i in json.load(open('gallery/gallery.json')) for k in ('image','setup','project') if i.get(k) and not os.path.exists(i[k])];print(b);sys.exit(bool(b))"
```

---

## Média

### CM-10 — Export/Import Config 🧪 — ✅ corrigido (2026-10-23)

- **Export Config** grava `JSON.stringify(Setup)` (chaves `Sizes, Library, Images, …`; `app.js:1440`).
- **Import Config** exige `jsonData.Setup` (`app.js:1479`) → o arquivo exportado pelo próprio app é recusado
  ("missing Config object").
- Mesmo com o formato certo, `importConfigFile` chama `loadSetup()` (`:1489`), que relê `localStorage.setup` e o mescla
  **por cima** do importado (os valores antigos vencem).
- `loadSetup` mostra `Setup.Export.Project.Images.jpegQuality` (`:941`), chave inexistente (é `quality`) → a UI sempre
  exibe 0,95.

Correção: exportar `{ Setup }` (ou aceitar os dois formatos na importação), aplicar o importado diretamente
(`Setup = deepMerge(importado, window.defaultSetup)`), atualizar a UI a partir de `Setup` e só então `saveSetup()`.

### CM-11 — IDs duplicados nos slots 🧪 — ✅ corrigido (2026-10-23)

`addImageSlot` usa `slot-${slotsImages.length - 1}` (`slots.js:178`). Após remover o slot 1 de 4 e adicionar outro, os IDs
ficam `slot-0, slot-2, slot-3, slot-3` (verificado). O `pageMemory` localiza `img-slot-3` por `#id` → duas prévias
apontam para o mesmo registro e uma imagem é restaurada no slot errado ou perdida.
Correção: contador monotônico (`let nextSlotId = 0; … slot-${nextSlotId++}`) ou o `ensureUniqueId` já existente em `app.js`.

### CM-12 — `Setup.Sizes` mutado 🧪 — ✅ corrigido (2026-10-23)

`updateImageSettings` faz `const _format = Setup.Sizes[format]` e altera `_format.width/height` (`app.js:1185-1195`).
`Setup.Sizes.cover/poster` também definem o tamanho das **miniaturas** do painel do Jellyfin (480×270 / 270×480):
depois do primeiro desenho, `Setup.Sizes.cover` vira 1920×1080 e, ao escolher "Poster", `Setup.Sizes.poster` vira
1080×1920 (medido) — cada miniatura passa a ser pedida com ~16× mais pixels. O valor mutado também vai para o
`localStorage.setup`.
Correção: calcular em variáveis locais e separar "proporção do canvas" de "tamanho de miniatura":

```js
const { width: rw, height: rh } = Setup.Sizes[format];
const ratio = rw / rh;
const size = ratio > 1 ? { width: 1920, height: Math.round(1920 / ratio) } : { width: Math.round(1920 * ratio), height: 1920 };
setCanvasSize(size.width, size.height);
```

### CM-13 — Exceções e referências erradas — ✅ corrigido (2026-10-23; `jellyfin.js:127` junto com o CM-08)

| Local | Problema | Correção |
|---|---|---|
| `slots.js:6-7` | Slots cheios: `alert` e continua → `TypeError` em `preview.src` | `return` após o alerta (ou criar um slot novo) |
| `slots.js:356` | `fillSlotsRandomly` com menos itens que slots → `item.Id` de `undefined` | `if (!item) continue;` |
| `slots.js:372-376` | `radomizeSlotImage` sem item: mostra erro e continua → `TypeError` | `return` dentro do `if` |
| `slots.js:422` | `delete el.files[0]` não faz nada (FileList é somente leitura) | `el.value = ''` |
| `jellyfin_ui.js:29` | `Server.Speed.time` quando `setFastestAddress` falha → `TypeError` | `Server.Speed?.time ?? 0` |
| `jellyfin_ui.js:299` | `jellyfinContainer.value = …` (um `div`) | `jellyfinsearchInput.value = …` |
| `app.js:693` | `getElementById('jellyfinNextPage')`; o id é `nextPage` → botão "próxima" nunca desabilita | `'nextPage'` |
| `jellyfin.js:127` | `throw` em `init()` não tratado (ver CM-08) | retornar e disparar `onServerSetupError` |
| `drawing.js:575` | Mensagem de erro lê `Setup.Settings` (sempre vazio) | `projectConfig.canvas.composite.type` |
| `app.js:1959` | `cropCanvas` devolve `null` para canvas vazio → `null.toBlob` | checar antes |
| `slots.js:474-483` | `getIndexFromButtonClick` retorna `undefined` e `clearImageSlot(undefined)` cria `slotsImages.undefined` | validar índice |

### CM-14 — Cache de etapas frágil e trabalho repetido 🧪 — ✅ corrigido (2026-10-23)

Instrumentando `runStep` no navegador:

- A etapa externa de `applyComposite` (`drawing.js:569`) não inclui os parâmetros do layout no hash (só canvases e
  `slotsImages`, que viram `{}`); ela só é recalculada porque `{ hash: newHash, ...result }` (`drawing.js:65`) deixa o
  `hash` do resultado **interno** sobrescrever o da etapa — então essa etapa **nunca** acerta o cache. Se alguém
  "corrigir" a ordem do spread, mudar parâmetros do layout deixará de redesenhar. Correção: incluir
  `projectConfig.canvas.composite` nos parâmetros da etapa e gravar `{ ...result, hash: newHash, index }`.
- `applyImageEffects` (`:322`) e `drawCompositeText` (`:488`) clonam um canvas de 1920×1080 (~8 MB) por efeito **antes**
  de consultar o cache — em todo redesenho, mesmo quando nada mudou. Mova o `cloneCanvas` para dentro da função da etapa.
- O hash do texto não considera o estado da fonte: se o Google Fonts terminar de carregar depois do primeiro desenho,
  a camada fica com a fonte de *fallback* até outro parâmetro mudar. Inclua `document.fonts.check(font)` nos parâmetros
  ou chame `clearStepsCache()` em `document.fonts.onloadingdone`.
- `stepsCache` mantém todos os canvases intermediários (dezenas de MB com várias camadas/efeitos) e nunca é aparado
  quando o número de etapas diminui: `stepsCache.length = lastStepIndex` ao final de `drawComposite`.

### CM-15 — IndexedDB do cliente Jellyfin 🧪 — ✅ corrigido (2026-10-23)

**Confirmado em 2026-10-23** com um servidor Jellyfin simulado e perfil de navegador limpo: o carregamento das
bibliotecas ficou parado por mais de 40 s logo após `getLibrarySize`; cada coleta de lixo forçada (`gc()`, que fecha as
conexões esquecidas) destravou um passo. Em navegadores reais a coleta acontece em algum momento, o que explica o
"First login takes 10-30 seconds" do README. Afeta CoverMaker e content-recommender.

- `openDB` (`jellyfin.js:171-199`) abre uma conexão nova em **cada** `saveData/loadData/clearData` e nunca fecha.
  Quando um *store* não existe ele reabre com `version + 1`; as conexões antigas abertas recebem `versionchange` e não
  fecham → a requisição de upgrade fica bloqueada e a Promise nunca resolve (não há `onblocked`). Abra uma conexão
  única, trate `onversionchange = () => db.close()` e `onblocked`.
- `saveData` retorna `tx.complete` (`:207`), propriedade inexistente em `IDBTransaction` (é da biblioteca `idb`) →
  ninguém consegue aguardar a gravação nem ver erros. Retorne uma Promise com `tx.oncomplete/onerror`.
- `signal.timeout = 5000` (`:320`) não cria timeout. Use `AbortSignal.timeout(5000)`
  (ou `AbortSignal.any([controller.signal, AbortSignal.timeout(5000)])`).

### CM-16 — Cache de bibliotecas 🔎

- O cache só é invalidado se a **quantidade** de itens mudar (`jellyfin.js:485`): troca de capas, títulos, gêneros ou
  itens substituídos não são percebidos. Para sincronização incremental, guarde a data da última carga e peça só o que
  mudou com o parâmetro `minDateLastSaved` de `/Users/{id}/Items` (e `minDateLastSavedForUser` para `UserData`).
  O README fala em "delta sync", que não existe hoje.
- `isLibrarySizeChanged(library.Id, …)` (`:501`) procura por **Id** num objeto indexado por **nome** → sempre `true`
  (código morto; se fosse `false`, `this.Libraries[library.Name].Status` quebraria).
- `updateLibraryUserData` sai cedo quando `needsUserData` é `false` (padrão) → `UserData` (assistido/favorito) fica
  como na primeira carga. No CoverMaker não importa; no content-recommender sim (ver auditoria de lá).
  Quando roda, usa `allItems.find` por item (O(n²)); use um `Map`.
- Filtro do Meilisearch: `path STARTS WITH "${loc}"` (`:884`) não escapa `"` nem `\` (caminhos Windows `C:\Media`).
- `showLoadingLibraries` reconstrói o HTML do painel de progresso em **todo** `requestAnimationFrame` enquanto carrega.
- A busca (`searchItems`) roda `searchInArray` sobre **todos** os campos de cada item (Overview, Path, Id…): buscar
  "2020" ou "the" casa quase tudo; e como o array é recriado a cada chamada (`concat`/`filter`), o cache do
  `searchInArray` nunca é aproveitado. Buscar em `Name`/`OriginalTitle` (opção "buscar em tudo" separada).
- `sort(() => 0.5 - Math.random())` não embaralha uniformemente; use Fisher-Yates.

### CM-17 — Corrida em `updateTextSettings` (potencial) 🔎 — ✅ corrigido (2026-10-23)

`updateTextSettings` zera `projectConfig.textLayers` e depois faz `await loadFont(...)` por camada. Envolta por
`Controller.wrap(..., true)` (`app.js:2021`), uma nova chamada "aborta" a anterior, mas a anterior continua rodando
(não verifica o `signal`) e faz `push` no array **novo** → camadas duplicadas no `projectConfig` (e no `localStorage`)
quando uma fonte demora a carregar enquanto o usuário digita. Agravado por `CDN-01`. Correção: montar um array local e
atribuir no fim, abortando se `signal.aborted`:

```js
async function updateTextSettings(signal) {
  const layers = [];
  for (const layerEl of …) { …; await loadFont(…); if (signal?.aborted) return; layers.push(newLayer); }
  projectConfig.textLayers = layers;
  drawComposite(); saveprojectConfig();
}
```

### CM-18 — Custo do `pageMemory` 🧪

`#leftSide`, `#rightSide` e `#jellyfinimages` têm `save`. Com a implementação atual (`CDN-03`, `CDN-07`, `CDN-08`):
cada clique/entrada/mutação nesses painéis agenda uma gravação que serializa `outerHTML` da página (**~340 KB** medidos)
mais todos os elementos `[save]` e as imagens dos slots em base64; o salvamento tem debounce de 500 ms e intervalo
mínimo de 2 s, então a **última** alteração pode não ser gravada. Sugestões: marcar só os controles necessários com
`save` (não os painéis), remover o campo `dom`, e persistir as imagens dos slots em um *store* próprio (Blob direto no
IndexedDB, sem base64).

---

## Baixa

### CM-19 — Importação 🔎 — ✅ corrigido (2026-10-23)

- `importImagesFromZip` faz `setSlots(0)` e depois `setSlots(maiorÍndice + 1)`; como a importação de ZIP chama
  `loadFullProjectFromJson(…, true)` (ignora `imageSlots`), slots vazios no fim do projeto somem.
  Usar `projectData.imageSlots.length` quando existir.
- `useSetup` importa o `project.json` de um ZIP sem `isSetupOnly` e o de um `.json` com `true` (o argumento é ignorado
  por `importProjectFromJson`, que sempre passa `true`).
- O seletor de arquivo aceita `.json,.zip,.covermaker.zip`, mas o "Save Setup" gera `*.covermaker.setup.json` e o
  "Export Config" gera um JSON de outro formato que, se aberto pelo botão de projeto, é interpretado como projeto.

### CM-20 — HTML inválido 🧪

- `<div id="app">` (`index.html:341`) nunca é fechado (os `<script>` e `#toast-root` ficam dentro dele).
- No `#text-layer-template` falta um `</div>` na seção "Position/Rotation" (o navegador fecha no `</template>`).
- `<img src="" … src="">` duplicado (`:108`); `<img></img>`; `<li class="tab">` fora de `<ul>`; `value` em `<select>`.

### CM-21 — Filtros de imagem 🔎

Os efeitos `blur`, `grayscale`, `brightness`, … (`effectsRegistry.js`) e `blurImage` (`drawing.js:224`) aplicam
`ctx.filter` desenhando o canvas **sobre ele mesmo**: o resultado é a imagem filtrada composta por cima da original.
No `blur`, as bordas desfocadas ficam semitransparentes e a imagem nítida aparece por baixo (halo nas bordas). Limpe
antes ou desenhe a partir de uma cópia: `const src = cloneCanvas(canvas).canvas; ctx.clearRect(…); ctx.filter = …; ctx.drawImage(src, 0, 0)`.
O app usa `ctx.filter` em 67 pontos; o suporte a `CanvasRenderingContext2D.filter` no Safari foi historicamente
ausente — vale testar e, se necessário, oferecer *fallback* (o README declara "Safari 14.1+ ✅").

### CM-22 — Resultados não reproduzíveis 🔎

`comicLayout`, `glitchMosaic`, `cctv` (composições) e `mosaic`, `woodTexture`, `gummyCandy` (texto) usam
`Math.random()` sem semente; outros efeitos caem em `Math.random` quando `seed` é vazio/0. O cache esconde isso
durante a sessão, mas após recarregar/importar o mesmo projeto a imagem muda. Use `createSeededRandom(params.salt || 1)`
(já existe em `textEffects.js:37`) e exponha `seed` onde faltar.

### CM-23 — Variações de fonte 🔎

`loadFont` pede `css2?family=Nome` (só peso 400 normal). Ao escolher `bold`/`italic`, o navegador sintetiza.
Peça os eixos disponíveis (ex.: `family=Nome:ital,wght@0,400;0,700;1,400;1,700` — a API retorna 400 se a variação não
existir, então trate o erro e tente sem eixos). `document.fonts.load` resolve mesmo quando a fonte não carrega
(retorna `[]`): confira o tamanho do array.

### CM-24 — Janelas 🔎

`document.querySelectorAll('.floatWindow').forEach(window => …)` (`windowsHandle.js:85`) sombreia o `window` global:
`window.innerWidth` vira `undefined` e o ajuste ao viewport nunca ocorre. Renomeie para `win`. O arrasto usa apenas
eventos de mouse; troque por *Pointer Events* (`pointerdown/move/up` + `setPointerCapture`) para funcionar no toque.
`z-index = Date.now()` ultrapassa o máximo de 32 bits (é limitado pelo navegador); um contador simples basta.

### CM-25 — Código morto / legado 🔎

- `factory.js` inteiro (nenhum chamador; `Object.assign(select, { options })` lançaria erro).
- `pipelineManager`, `PipelineStep._stableStringify`, `markImageBaseDirty` (`slots.js:157-171`, `app.js:270`) — de um
  pipeline antigo.
- `libraryImagetoCanvas` (`jellyfin_ui.js:77-87`) usa variáveis inexistentes.
- `vendor/search.js` é carregado e não é usado.
- `blendMode` lido em `applyTextEffect` sem parâmetro na UI.
- Chaves legadas em `projectConfig.canvas` (`overlayColorStart`, `reflectionDistance`, `salt`, …) e `Setup.Sizes.square = 1×1`.
- `dummyStart` usa *hotlink* de pôsteres do IMDb (`m.media-amazon.com`) — podem sair do ar ou ser bloqueados.
  Prefira imagens próprias em `gallery/` ou `images/`.
- `fillSlotsWithNumbers`/`debugSlotsImages` e botões comentados de debug.

### CM-26 — Documentação 🔎

- README afirma "OffscreenCanvas rendering for non-blocking UI" — não há `OffscreenCanvas` nem *Workers*; tudo roda na
  thread principal.
- "Complete project save/load as JSON files" — o formato principal é `.covermaker.zip`.
- Lista 19 efeitos de texto; existem 86 (ver [`REFERENCIA-EFEITOS.md`](REFERENCIA-EFEITOS.md)). A seção "Text Layer Effects"
  e a lista de efeitos aparecem duplicadas.
- Cita `gallery/GALLERY.md`, que não existe; o `CONTRIBUTING.md` cita uma automação que regenera esse arquivo, que
  também não existe no repositório.
- "Custom: Define any dimensions (width/height in pixels)" — os valores são usados como proporção (maior lado = 1920 px).
- "Multiple strokes and shadows", "3D depth 0-50", "Glow intensity 0-3" descrevem uma UI antiga; hoje tudo é efeito.

### CM-27 — Acessibilidade e idioma 🔎

- `maximum-scale=1.0, user-scalable=no` (`index.html:6`) impede zoom (WCAG 1.4.4).
- Ações principais são `<i onclick>`: sem foco por teclado, sem `role="button"`, sem nome acessível além do `title`.
  Use `<button type="button" aria-label="…"><i aria-hidden="true"></i></button>`.
- Interface em inglês com dica em português (`paramsRenderer.js:213`: "duplo clique alterna número/slider") e
  comentários misturados; escolher um idioma (ou i18n simples com um dicionário).
- Tipos de toast `warning`, `error` e `info` são usados mas não têm estilo em `css/toast.css` (aparecem como "default").
- Slot fixado não tem destaque visual além do ícone, e o ícone exibido quando fixado é o de "desafixar".

---

## Segunda rodada

### CM-28 — "Anime Speedlines" apaga o texto 🧪

`actionSpeedlines.apply` faz `ctx.clearRect(0, 0, w, h)` **antes** de usar `canvas` como máscara e como fonte do texto
(o `ctx` é do próprio `canvas`). No modo padrão "Inside Text" a máscara fica vazia e a camada some inteira; em
"Behind Text" sobram só as linhas, sem o texto. Correção: copiar o texto antes de limpar.

```js
const src = cloneCanvas(canvas).canvas;   // antes do clearRect
ctx.clearRect(0, 0, w, h);
// … usar `src` no lugar de `canvas` em lCtx.drawImage(…) e ctx.drawImage(…)
```

### CM-29 — "Lightning" com Seed 0 🧪 — ✅ corrigido (2026-10-23)

`createSeededRandom(0)` retorna `null` (semente 0 significa "aleatório"), e `lightning` (`textEffects.js:1205`) chama
`rnd()` sem *fallback* → `TypeError: rnd is not a function` ao arrastar o Seed até 0. Correção:
`const rnd = createSeededRandom(seedVal) ?? Math.random;` (como já fazem `channelTear` e `nordicRuneforge`).

### CM-30 — Controles sem efeito e parâmetro `"undefined"` 🧪 — ◐ (2026-10-23: títulos e chave `"undefined"` corrigidos; `grout`/`bgColor` mudam a imagem e vão para a Fase 5)

- `stainedGlass`: o slider **Grout Width** (`grout`) é lido e nunca usado (`textEffects.js:4829`).
- `blueprint`: **Paper Color** (`bgColor`) nunca é lido (o próprio comentário diz que é "só referência").
- `sauronFire`, `chiseledMetal`, `engravedMetal` e `plasma` usam `{ type: 'span', label: 'Colors' }` como título de
  seção, sem `key`. `renderParamsOptions` agrupa por `key` num `Set`, então **só o primeiro título aparece**
  ("Colors"; "Texture", "Pupil", "Effects"… somem) e o controle recebe `data-param-key="undefined"` → o projeto salva
  `"undefined": ""` nos parâmetros (verificado no Chromium). Correção: em `renderParamsOptions`, tratar entradas sem
  `key` como títulos (renderizar um rótulo e pular `dataset.paramKey`), ou trocar por `group: 'Colors'` nos parâmetros.

### CM-31 — Efeitos de texto lentos na thread principal 🧪

Tempo de **um** efeito num canvas 1920×1080 (Chromium *headless*, renderização por software — numa máquina com GPU os
números são menores, mas a proporção se mantém):

| Efeito | Parâmetros | Tempo |
|---|---|---|
| `stainedGlass` | mínimos (Shard Size 5) | **45,8 s** |
| `neon` | máximos | 8,7 s |
| `longShadow` | máximos | 7,1 s |
| `paintBrush` | máximos | 5,1 s |
| `longShadow` | **os da camada padrão do app** (length 48, blur 2) | 2,9 s |
| `nordicRuneforge`, `stainedGlass`, `infernoForge` | padrão | 1,2 – 2,0 s |

Os 86 efeitos com parâmetros padrão somam ~18 s. Como cada alteração no texto invalida o cache dos efeitos daquela
camada, digitar com a camada padrão congela a interface por segundos, e um slider no extremo pode travar a aba.

- `longShadow` cria `length + 1` canvases de tela cheia (49 × ~8 MB) e aplica `blur` em cada um. Recorte para a área
  do texto (`cropCanvas` já existe), reutilize um único canvas de passo e aplique o blur uma vez a cada N passos.
- Em geral: processar só o retângulo que contém o texto (não 1920×1080), limitar extremos dos sliders
  (ex.: `stainedGlass.size` mínimo 15) e mover efeitos de pixel para um *Worker* com `OffscreenCanvas`, mantendo uma
  prévia em resolução reduzida enquanto o usuário arrasta.

### CM-33 — Busca ignorava as últimas teclas ✅

`searchOnLibrary` usa `Controller.wrap(…, 100, 1000)`. Com o throttle antigo (`CDN-02`), teclas digitadas dentro de 1 s
depois de uma busca eram descartadas: digitar "Horror" rápido mostrava o resultado de um prefixo ("Movie 000 Drama"…).
Corrigido junto com o `Controller` (a última chamada roda no fim da janela) e com uma proteção em `searchOnLibrary`
para buscas substituídas (`jellyfin_ui.js:258`).

### CM-34 — `tempLimit` recebia o `AbortSignal` ✅

`searchItems(Name, library, query, tempLimit)` é envolvida pelo `Controller`, que acrescenta o `AbortSignal` depois dos
argumentos. Chamadas com três argumentos (como a do content-recommender) recebiam o sinal em `tempLimit` e
`items.slice(0, 0 + signal)` devolvia `[]`. Agora só um número positivo substitui o tamanho da página.

### CM-32 — Lint e casos-limite 🧪

- `app.js:1084` — `focusTabName` é global implícita.
- `slots.js:324` — `return items` dentro de `finally` engole exceções de `getRandomImages`.
- `drawing.js:149` — `new Promise(async (resolve, reject) => …)`: erros fora do `try` não rejeitam a Promise.
- `skew` com Skew X = Skew Y = ±1 gera matriz de transformação singular e o texto desaparece; limitar a ±0,95.
- 28 variáveis atribuídas e nunca usadas (ex.: `compositeRegistry.js:3926-3932` no Jigsaw, `:3993-4000`,
  `textEffects.js:3201`, `5448`, `5507`, `6564`) — cálculos mortos ou recursos inacabados; vale revisar caso a caso.

---

## Melhorias recomendadas

1. **Fonte única de estado.** Eliminar `Setup.Settings`; `projectConfig` como única fonte; o DOM é derivado dele.
   Hoje parte da UI lê do DOM (`updateTextSettings`) e parte de objetos (`onEffectParamChange`), o que gerou CM-01/CM-17.
2. **Pipeline robusto.** Normalizar retornos (`CM-03`), incluir no hash tudo que influencia a saída, mover clones para
   dentro das etapas, aparar o cache. Considerar `OffscreenCanvas` + *Worker* para os efeitos de pixel (`sharpen`,
   `distress`, `crystallize`…), o que tornaria verdadeira a afirmação do README.
3. **Testes automatizados.** Os testes desta auditoria foram feitos com Playwright + `python -m http.server`. Um
   *smoke test* no CI cobriria: carregamento sem erros no console, mudança de cada controle altera o canvas,
   export funciona com e sem texto, persistência após recarregar, e um teste de registro que rode cada `apply` com
   0, 1 e N imagens verificando que devolve `{ canvas }`.
4. **Segurança.** Token em vez de senha (`CM-05`), `textContent` (`CM-06`), e uma CSP via `<meta http-equiv>`
   restringindo `script-src` a `self` e `cdnjs.cloudflare.com`.
5. **Persistência versionada.** `{ schemaVersion, projectConfig }` com migrações (ex.: parâmetros de `innerShadow`),
   imagens dos slots como Blob em *store* próprio, e salvamento explícito após cada alteração de `projectConfig` em vez
   de depender do `pageMemory` observar o DOM.
6. **Vendor como submódulo** do `jeffersoncgo/cdn` (o workflow já faz checkout com `submodules: recursive`) para não
   divergir das correções feitas lá.
7. **Desempenho do Jellyfin.** Sincronização incremental por `DateLastSaved`, busca restrita ao nome, conexão única de
   IndexedDB, miniaturas com tamanho fixo.
8. **Validação da galeria no CI** (caminhos existentes, JSON válido, ZIP contendo `project.json`).
