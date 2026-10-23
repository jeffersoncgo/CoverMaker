# CoverMaker — Arquitetura e documentação técnica

> Escrito a partir do código-fonte (revisão `9928358`). Erros conhecidos e correções sugeridas estão em
> [`AUDITORIA.md`](AUDITORIA.md); a lista completa de layouts e efeitos (gerada dos registros) está em
> [`REFERENCIA-EFEITOS.md`](REFERENCIA-EFEITOS.md).

## 1. Visão geral

Aplicação 100% *client-side* (HTML + CSS + JavaScript sem build) para montar capas/pôsteres de coleções do Jellyfin.
O usuário preenche **slots** com imagens (Jellyfin, arquivo local, colar da área de transferência ou projeto importado),
escolhe um **layout de composição**, empilha **efeitos de imagem**, adiciona **camadas de texto** com **efeitos de texto**
e exporta a imagem (PNG/JPEG/WEBP) ou o projeto (`.covermaker.zip`).

Publicado no GitHub Pages pelo workflow `.github/workflows/static.yml` (push em `main` → upload do repositório inteiro).

```
index.html ─┬─ css/ (variables, base, layout, components, toast, animations, utilities, gallery, mobile)
            ├─ CDN externos: Font Awesome 6.7.2, JSZip 3.10.1 (ambos com SRI), Google Fonts (sob demanda)
            ├─ js/vendor/  cópias do repositório jeffersoncgo/cdn + meilisearch-js 0.54.0
            └─ js/         código da aplicação
gallery/    gallery.json + projetos de exemplo (project.json, *.project.zip, imagens de preview)
fonts/      google-fonts.json (lista de 1 899 famílias)
images/     loading.gif, error.png
```

## 2. Ordem de carregamento dos scripts

Todos são scripts clássicos no fim do `<body>` (exceto `meilisearch_index.min.js`, `defer`, e `mobileViewport.js`, no
`<head>`). A ordem importa porque tudo é global:

| # | Arquivo | Papel | Globais principais |
|---|---|---|---|
| 1 | `vendor/base.js` | Namespace `JCGWeb`, utilitários DOM | `JCGWeb` |
| 2 | `vendor/common.js` | `utils`, extensões de `String/Array.prototype` | `utils` |
| 3 | `vendor/object.js` | `searchInArray`, `mergeObjects`, … | — |
| 4 | `vendor/search.js` | `SearchEngine` (não usado pelo app) | `SearchEngine` |
| 5 | `vendor/controller.js` | Debounce/abort de funções assíncronas | `Controller` |
| 6 | `vendor/pagememory.js` | Persistência de elementos `[save]` no IndexedDB (instanciado em `app.js` com `saveDelayMs`/`restoreDelayMs` 500 e sem escutar `click`) | `pageMemory` |
| 7 | `vendor/observer.js` | MutationObserver + eventos | `Observer` |
| 8 | `vendor/fetchqueue.js` | Fila de `fetch` concorrentes | `FetchQueue` |
| 9 | `jellyfin.js` | Cliente da API Jellyfin + cache IndexedDB + Meilisearch | `Jellyfin` |
| 10 | `windowsHandle.js` | Janelas flutuantes arrastáveis | `showWindow`, `hideWindow` |
| 11 | `config.js` | Estado global inicial | `Setup`, `projectConfig`, `slotsImages`, `composite` |
| 12 | `fonts.js` | Lista e carregamento de fontes | `populateFontSelect`, `loadFont` |
| 13 | `factory.js` | Fábrica de *dropdowns* (não utilizada) | `createDropdownMenu` |
| 14 | `toast.js` | Notificações | `toastMessage`, `closeToast` |
| 15 | `compositeRegistry.js` | 40 layouts | `COMPOSITE_REGISTRY` |
| 16 | `drawing.js` | Pipeline de renderização com cache | `drawComposite`, `runStep`, `loadImage` |
| 17 | `slots.js` | Gerência dos slots de imagem | `addImageSlot`, `setSlotImage`, … |
| 18 | `jellyfin_ui.js` | Painel do Jellyfin (bibliotecas, busca, paginação) | `CreateJellyfin`, `searchOnLibrary` |
| 19 | `effectsRegistry.js` | 16 efeitos de imagem | `EFFECTS_REGISTRY` |
| 20 | `paramsRenderer.js` | Gera controles a partir de esquemas de parâmetros | `ParamsRenderer` |
| 21 | `textEffects.js` | 86 efeitos de texto | `TEXT_EFFECTS`, `applyTextEffect` |
| 22 | `app.js` | UI, eventos, import/export, inicialização | quase todo o resto |
| 23 | `gallery.js` | Janela de galeria | `renderGallery`, `useSetup`, `useFullProject` |

## 3. Estado global

| Variável | Definida em | Conteúdo |
|---|---|---|
| `slotsImages` | `config.js` | `Array<HTMLImageElement \| null>` — uma posição por slot, na ordem da UI |
| `projectConfig` | `config.js` | O **projeto**: camadas de texto, layout, efeitos (ver §7) — é o que é renderizado |
| `Setup` | `config.js` | Preferências da aplicação: tamanhos, padrões de camada/efeito, exportação |
| `window.composite` | `config.js` | `{ size: {width, height}, lastHash }` — tamanho atual do canvas |
| `window.Composites` | `drawing.js` | Últimos resultados: `.Image` (fundo + efeitos), `.Text` (texto), `.Merged` (final, também sem texto) |
| `window.memory` | `app.js` | Instância de `pageMemory` |
| `window.jellyfin` | `jellyfin_ui.js` | Instância de `Jellyfin` |
| `window.memoryLoaded` | `app.js` | Libera a gravação em `localStorage` (`saveSetup`/`saveprojectConfig` só gravam se `true`) |
| `window.projectFileName` | `app.js` | Nome base para exportações, vindo do arquivo importado |

> `Setup.Settings` pode existir em `Setup` (vem de projetos importados e de `localStorage.setup` antigos), mas é só uma
> cópia: desde 2026-10-23 nenhum código lê ou escreve nele — tudo usa `projectConfig` (`CM-01`).

## 4. Inicialização (`window.load` em `app.js`)

1. Copia `Setup` e `projectConfig` para `window.defaultSetup` / `window.defaultprojectConfig`.
2. `loadFieldsFromStorage()` → preenche servidor/usuário/senha a partir do `localStorage`.
3. Liga as abas (`#imageslotsTab`, `#settingsTab`).
4. `loadSetup()` → mescla `localStorage.setup` sobre `Setup`.
5. `addtypeSelectOptions()` → popula o `<select>` de layouts e os controles do layout atual.
6. `drawComposite()` inicial.
7. `CreateJellyfin()` → instancia `Jellyfin` com os campos do formulário (tenta conectar imediatamente).
8. `await populateFontSelect()` → lista de fontes (locais + Google).
9. `initTextLayers()` → limpa camadas de texto.
10. `loadEssentials()` → cria `pageMemory`, registra eventos e chama `memory.init()`:
    - **sem dados salvos** → `onMemoryIsEmpty` → `dummyStart()` (4 pôsteres de exemplo do IMDb + uma cópia de
      `Setup.defaults.textLayers` como camada de texto; `loadTextLayers` aceita uma camada ou uma lista e libera
      `memoryLoaded`, então a primeira sessão já é salva);
    - **com dados salvos** → `onRestoreSucess` → `memoryLoaded = true`, `loadprojectConfig()`, `updateImageSettings()`,
      `renderEffectLayers()`, `searchOnLibrary()`.
    - também chama `addSettingListeners()` (listeners delegados no painel de configurações).
11. `renderEffectLayers()`, `renderTextEffectLayers()`, limites personalizados de pôsteres.

## 5. Pipeline de renderização (`drawing.js`)

`drawComposite` é envolvida por `Controller.wrap(drawComposite, true, 100)` (debounce de 100 ms, aborta a anterior).

```
drawComposite(signal)
 ├─ step 0  runStep(null, null, composite.size)           → hash base (muda com o tamanho)
 ├─ drawCompositeImage(hash)
 │   ├─ step  createBackgroundCanvas(signal, backgroundColor) → canvas preenchido com backgroundColor (#000)
 │   ├─ applyComposite → step runCompositeStep(type, canvas, slotsImages, params, signal, {srcOnly}, eff)
 │   │    (clona dentro da etapa e chama COMPOSITE_REGISTRY[type].apply; desligado/inexistente/erro → mantém o fundo)
 │   └─ applyImageEffects: para cada efeito habilitado
 │        └─ step runImageEffectStep(type, canvas, params, signal, eff) → clona e chama EFFECTS_REGISTRY[type].apply
 ├─ drawCompositeText(hash, w, h)
 │   ├─ para cada camada habilitada:
 │   │    ├─ step createBaseTextLayer(w, h, texto, posição, font, fillStyle, signal, fonteCarregada?)
 │   │    └─ para cada efeito de texto: step runTextEffectStep(canvas, texto, x, y, params, signal, eff)
 │   └─ step mergeImageLayers(canvases)                      → todas as camadas de texto empilhadas
 ├─ descarta do cache as etapas além das usadas nesta execução
 ├─ compara hash(imagem, texto) com composite.lastHash → se igual, não redesenha
 ├─ se o signal foi abortado (há uma execução mais nova) → não pinta
 └─ mergeCanvases(Image, Text) (ou só Image) → Composites.Merged → copia para #myCanvas
```

### Cache por etapas (`runStep`)

- Cada chamada de `runStep` recebe um índice sequencial (`lastStepIndex`, zerado a cada `drawComposite`).
- O hash da etapa = `stepHash(JSON.stringify({params, fnId: uid_da_função + índice}), hashAnterior)`.
  Canvases, contextos e `Image` serializam como `{}`; por isso `applyComposite` injeta `{ srcOnly: [fnv1a(img.src)…] }`
  para que trocar/reordenar imagens mude o hash.
- Se `stepsCache[índice].hash` for igual, o resultado guardado (canvas + ctx) é reutilizado e as etapas seguintes,
  encadeadas pelo hash, também. O hash da etapa sempre vence um campo `hash` devolvido pela função.
- As funções de etapa recebem a **chave** do registro (não o objeto de definição) e o canvas da etapa anterior, e
  clonam dentro da etapa: uma etapa reaproveitada não copia o canvas de novo e nunca altera o resultado guardado de
  outra etapa.
- Valores que mudam a imagem sem aparecer nos parâmetros entram como argumento extra só para o hash:
  `backgroundColor` no fundo e `document.fonts.check(fontStyle)` no texto (redesenha quando uma web font termina de
  carregar).
- `runStep` lança `AbortError` se o `signal` já foi abortado, antes de tocar no índice/cache compartilhados;
  `drawCompositeImage`, `applyComposite`, `applyImageEffects` e `drawCompositeText` repassam o `AbortError` (os
  outros erros continuam sendo registrados e o pipeline segue). O `Controller` resolve a chamada abortada com
  `undefined`.
- `clearStepsCache()` só é chamado ao importar projeto.

### Contratos das funções `apply`

| Registro | Assinatura | Deve retornar |
|---|---|---|
| `COMPOSITE_REGISTRY[id].apply` | `(ctx, canvas, images, params, abortSignal, meta, eff)` | `{ canvas, ctx, … }` |
| `EFFECTS_REGISTRY[id].apply` | `(ctx, canvas, params, abortSignal, eff)` | `{ canvas, ctx, … }` |
| `TEXT_EFFECTS[id].apply` | `(ctx, canvas, texto, x, y, params, abortSignal)` | `{ canvas, ctx }` (opcional: `applyTextEffect` usa o canvas recebido se nada vier) |

- `images` pode conter `null` (slot vazio). `canvas` já é um **clone**: pode ser alterado à vontade.
- Composições e efeitos de imagem que retornam `undefined` (vários fazem `return;` com 0 ou 1 imagem) mantêm o que
  desenharam: `runCompositeStep`/`runImageEffectStep` devolvem o próprio clone. Antes isso congelava o canvas (`CM-03`).
  Ainda assim, prefira `return { canvas, ctx }`.
- `applyTextEffect` adiciona a todos os efeitos de texto o parâmetro `globalOpacity` (mistura do resultado com o
  estado anterior) e aceita `params.blendMode`.

### Esquema de parâmetros (usado por `paramsRenderer.js`)

```js
{ key: 'spacing', label: 'Spacing', type: 'range', min: 0, max: 100, step: 1, default: 3,
  group: 'Overlay_Start',      // opcional: agrupa controles sob um rótulo
  options: ['A', 'B'],         // para type 'select' (array, array de objetos ou mapa)
  className: '…', style: '…' } // opcionais
```

Tipos: `range` (padrão), `number`, `color`, `checkbox`, `select`, `text`, `span`. Controles numéricos alternam entre
*slider* e campo numérico com **duplo clique** no controle ou no rótulo.

### Como adicionar um layout/efeito

```js
// compositeRegistry.js
meuLayout: {
  name: 'Meu Layout',
  params: [{ key: 'gap', label: 'Gap', type: 'range', min: 0, max: 50, step: 1, default: 8 }],
  apply: (ctx, canvas, images, params, abortSignal) => {
    const imgs = images.filter(Boolean);
    if (!imgs.length) return { canvas, ctx };          // nunca retorne undefined
    // … desenhar …
    return { canvas, ctx };
  }
},
```

O item aparece automaticamente no `<select>` (`getAvailableComposites`, `getAvailableEffects`,
`getAvailableTextEffects`), ordenado pelo `name`. Ao trocar o tipo, os parâmetros são reiniciados com os `default`.

## 6. Slots de imagem (`slots.js`)

- DOM: `#image-slots` contém um `.slot` por posição (template `#slot-template`), cada um com `img.preview[save]`.
  O atributo `slotsCount` de `#image-slots` + `customTrigger="setSlots"` recria a quantidade certa de slots na restauração.
- Fontes de imagem: Jellyfin (clique ou arrastar pôster), arquivo local, `Ctrl+V` (primeiro slot vazio), ZIP de projeto.
  URLs externas são baixadas com `fetch` e convertidas em Blob URL (`loadImage`) para evitar canvas "contaminado" (CORS).
- Ações: adicionar/remover, mover ↑/↓, arrastar para reordenar, fixar (*pin*), embaralhar, inverter ordem, limpar,
  preencher aleatoriamente a partir do Jellyfin.
- Blob URLs antigas são revogadas 100 ms depois da troca (`revokeBlobUrl`).
- IDs: o slot na posição *i* sempre tem `id="slot-i"` e a prévia `id="img-slot-i"` (`renumberSlotIds()` roda ao
  adicionar, remover, mover e trocar). O `pageMemory` restaura cada prévia pelo `id` em slots recriados nessa ordem,
  então IDs únicos e posicionais mantêm cada imagem no seu slot depois de recarregar (`CM-11`).

## 7. Formatos de arquivo

### Projeto completo — `<nome>.covermaker.zip` (botão "Save Project File")

```
project.json          { "Setup": { "Settings": <projectConfig> }, "imageSlots": ["placeholder" | null, …] }
images/slot_<N>.<ext> uma imagem por slot preenchido (formato/qualidade de Setup.Export.Project.Images)
```

Importação (`importProjectFromZip`): carrega as imagens `images/slot_N.(png|jpg|jpeg|webp|bmp|gif|tiff)`, aplica o
`project.json` (`loadFullProjectFromJson`) e completa a quantidade de slots com `imageSlots.length` (slots vazios do fim
não se perdem). Arquivos `.json` soltos são importados sem imagens.

### Imagem final — botão "Download" / "abrir em nova aba"

Ambos usam o canvas visível (`#myCanvas`), que sempre tem a imagem final, com ou sem camadas de texto. O download usa
`canvas.toBlob` (sem *data URL* gigante) no formato/qualidade de `Setup.Export.Canvas`.

### Setup — `<nome>.covermaker.setup.json` (botão "Save Setup (JSON)")

O `projectConfig` puro (sem imagens). Pode ser importado pelo mesmo botão de abrir projeto e pela galeria ("Use Json").

### `projectConfig`

```jsonc
{
  "textLayers": [{
    "id": "layer_0",
    "overlayText": "MOVIES",
    "enabled": true,
    "font": { "family": "Bangers", "source": "Google", "weight": "lighter", "style": "normal",
              "size": 362, "color": "#ffffff", "opacity": 1 },
    "position": { "textAlign": "center", "textBaseline": "middle", "x": 0, "y": 0, "rotation": 0 },
    "fontStyle": "normal lighter 362px \"Bangers\"",   // derivado
    "fillStyle": "rgba(255, 255, 255, 1)",              // derivado
    "effects": [{ "type": "outline", "enabled": true, "params": { "color": "#000000", "thickness": 10.5 } }]
  }],
  "canvas": {
    "format": "cover",            // cover | poster | square | custom
    "type": "line",               // id do layout (espelha composite.type)
    "composite": { "type": "line", "enabled": true, "params": { … } },
    "effects": [{ "type": "vignette", "enabled": true, "params": { "intensity": 0.78 } }],
    "backgroundColor": "#000000"  // opcional
    // + chaves legadas (overlayColorStart, reflectionDistance, salt, …) ignoradas pelo pipeline atual
  }
}
```

### Configuração — `covermaker-config.json` (Options → "Export Config")

`{ "Setup": <Setup> }` (tamanhos, padrões de camada/efeito, formatos de exportação). A importação também aceita o
`Setup` solto, formato gravado antes de 2026-10-23; ela aplica o arquivo direto na UI (`applySetupToUI`) e só então
grava. A qualidade das imagens do projeto fica em `Setup.Export.Project.Images.quality` (`jpegQuality` só é lido de
arquivos antigos).

### Tamanho do canvas

`updateImageSettings()` calcula o tamanho a partir da proporção de `Setup.Sizes[format]` **sem alterar** `Setup.Sizes`
(que também define as miniaturas do Jellyfin, 480×270 / 270×480), fixando o **maior lado em 1920 px**:
`cover` 1920×1080, `poster` 1080×1920, `square` 1920×1920. Em `custom`, largura/altura funcionam como **proporção**
(ex.: 3 × 1 → 1920×640), não como pixels.

## 8. Galeria (`gallery.js` + `gallery/gallery.json`)

```jsonc
[{
  "id": "war-metal",
  "title": "War — Metal",
  "shortDescription": "…",
  "image": "gallery/projects/war-metal/war.metal.result.png",   // miniatura
  "type": "cover",            // agrupa os cartões (poster, cover, …)
  "author": "jeffersoncgo",
  "page": "https://github.com/…",                               // link do autor
  "setup": "gallery/projects/war-metal/project.json",           // botão "Use Json"
  "project": "gallery/projects/war-metal/war.metal.project.zip"  // botão "Use Full Project" (opcional)
}]
```

A janela agrupa por `type`, permite busca por título/autor/descrição e abre um modal com os dois modos de importação.

## 9. Integração Jellyfin (`jellyfin.js` + `jellyfin_ui.js`)

Fluxo de `new Jellyfin(host, usuário, senha, eventos)`:

1. `GET /System/Info/Public` → nome, versão, `Id` e `LocalAddress` do servidor.
2. `setFastestAddress()` → mede o endereço externo e o local, usa o mais rápido.
3. `POST /Users/authenticatebyname` → `AccessToken` (enviado no cabeçalho `authorization: MediaBrowser … Token="…"`).
4. `setupMeiliSearch()` → se a página `/web/configurationpage?name=Meilisearch` existir, lê a configuração do plugin
   (`/Plugins/{id}/Configuration`, requer administrador), cria o cliente `meilisearch` e garante `path`/`type` como
   atributos filtráveis/ordenáveis no índice.
5. `getLibraries()` (1 s depois) → `GET /UserViews`, `GET /Library/VirtualFolders`; para cada biblioteca de tipo suportado:
   - se o cache IndexedDB tiver o mesmo número de itens, usa o cache;
   - senão baixa todos os itens (Meilisearch ou `GET /Users/{id}/Items` paginado em blocos de `loadLimit` via `FetchQueue`).
   - agrega Tags/Genres/Studios (para o `<datalist>` da busca).
6. `onLibraryLoad` → a UI lista as bibliotecas; clique abre a biblioteca; a caixa de busca filtra (`searchInArray`
   sobre todos os campos do item) com paginação (10/20/50/100/personalizado).

URLs de imagem: `/Items/{id}/Images/Primary?fillWidth=…&fillHeight=…&quality=…` (miniaturas usam `Setup.Sizes`;
imagens dos slots pedem 2000×2000 qualidade 100).

**Cache IndexedDB do Jellyfin:** banco com o nome do `Server.Id`; *stores* `Tags`, `Genres`, `Studios` e uma por
biblioteca (`<libraryId>`), cada uma com a chave `"result"` contendo JSON em string. "Clean Saved Memory" apaga tudo e
recarrega a página.

## 10. Fontes (`fonts.js`)

- **Local**: `window.queryLocalFonts()` (Chrome/Edge; exige gesto do usuário — a lista é carregada ao abrir o `<select>`).
  Sem a API, usa uma lista de fontes seguras. Fontes locais não padrão são carregadas como `FontFace` a partir do Blob.
- **Google**: lista em `fonts/google-fonts.json`; ao usar, injeta `<link href="https://fonts.googleapis.com/css2?family=…">`
  (apenas o peso/estilo padrão da família) e aguarda `document.fonts.load`.

## 11. Persistência local

| Onde | Chave | Conteúdo |
|---|---|---|
| `localStorage` | `server`, `username`, `password` | Credenciais do formulário de login (texto puro) |
| `localStorage` | `setup` | `Setup` serializado |
| `localStorage` | `projectConfig` | Projeto atual |
| `localStorage` | `customPostersLimits` | Limites personalizados de paginação |
| IndexedDB `pageMemoryDB` | URL da página | Estado dos elementos `[save]` (inclusive imagens dos slots em base64 e o formulário de login) |
| IndexedDB `<Server.Id>` | `Tags`, `Genres`, `Studios`, `<libraryId>` | Cache das bibliotecas Jellyfin |

> **Origem compartilhada:** no GitHub Pages, CoverMaker, content-recommender e a demo do cdn rodam todos em
> `https://jeffersoncgo.github.io`, portanto **compartilham** `localStorage` e IndexedDB. As chaves
> `server`/`username`/`password` e o cache do Jellyfin (banco `<Server.Id>`) são lidos e escritos pelos dois apps.

O botão **Clean Saved Memory** chama `memory.reset()`, `jellyfin.cleanDb()` (que recarrega a página) e limpa `setup`,
`projectConfig` e camadas de texto.

## 12. Interface

- `windowsHandle.js`: `.floatWindow` com `.windowBar` arrastável (mouse) e `.closeBtn`; `showWindow(id)` centraliza e
  traz para frente (`z-index = Date.now()`).
- `toast.js`: `toastMessage(msg, {position, type: default|success|danger|loading, duration})`; `duration <= 0` mantém
  o toast até `closeToast(toast)`.
- Painéis: esquerda (slots / configurações), centro (canvas + barra de exportação), direita (Jellyfin, oculto até o login).
- Responsividade: `css/mobile.css` (≤ 768 px, ≤ 480 px, paisagem) e `mobileViewport.js` (`--app-height`, `--vh`).
- Arrastar e soltar: slots, efeitos de imagem, camadas de texto e efeitos de texto (entre camadas).
- Copiar/colar efeitos de texto via área de transferência (JSON).

## 13. Como rodar localmente

```bash
git clone https://github.com/jeffersoncgo/CoverMaker.git
cd CoverMaker
python3 -m http.server 8080      # qualquer servidor estático serve; file:// não funciona (fetch/IndexedDB/CORS)
# abrir http://localhost:8080/
```

Para usar o Jellyfin, o servidor precisa aceitar requisições do domínio onde o app está (CORS) — o Jellyfin aceita por
padrão; proxies reversos podem bloquear.

## 14. Dependências externas

| Dependência | Versão | Origem | Uso |
|---|---|---|---|
| Font Awesome | 6.7.2 | cdnjs (SRI) | Ícones |
| JSZip | 3.10.1 | cdnjs (SRI) | Exportar/importar `.zip` |
| meilisearch-js | 0.54.0 | `js/vendor/meilisearch_index.min.js` | Carga rápida de bibliotecas |
| Google Fonts | — | fonts.googleapis.com | Fontes sob demanda |
| jeffersoncgo/cdn | cópia idêntica (sincronizada em 2026-10-23) | `js/vendor/` | Utilitários base. Alterou o `cdn`? Copie o arquivo para cá sem editar a cópia. |
