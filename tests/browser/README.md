# Testes no navegador (Playwright)

Rede de segurança usada nas correções de 2026-10-23 (ver `docs/PLANO-DE-CORRECOES.md`). Não rodam no CI — precisam
de um Chromium e de servidores locais. Os testes sem navegador ficam em `../unit.test.js` e rodam no CI.

## Preparar

```bash
npm install playwright            # ou aponte PLAYWRIGHT_MODULE para uma instalação existente
npx playwright install chromium
# servidores (cada um a partir da pasta do repositório)
python3 -m http.server 8765 --bind 127.0.0.1          # CoverMaker
python3 -m http.server 8768 --bind 127.0.0.1          # content-recommender (para cr_auth.js e fixes_phase4.js)
python3 -I tests/browser/mock_jellyfin.py 8769          # Jellyfin simulado (admin/secret, guest/guest)
python3 -I tests/browser/mock_jellyfin.py 8772 --meili  # o mesmo com o plugin Meilisearch
```

`PLAYWRIGHT_MODULE` (opcional) = caminho do módulo `playwright`. `HTTPS_PROXY` (opcional) = proxy para as requisições
externas (Google Fonts, imagens de exemplo); `127.0.0.1` nunca passa pelo proxy.

## Testes

| Arquivo | O que verifica | Como rodar |
|---|---|---|
| `e2e.js` | 42 fluxos de uso (slots, texto, layouts, efeitos, formatos, exportar/importar, galeria, persistência) | `node e2e.js out.json http://127.0.0.1:8765/` · comparar: `node compare.js e2e out.json outro.json` |
| `render_baseline.js` | Assinatura de pixels de cada layout (1, 2 e 6 imagens), efeito de imagem e de texto | `node render_baseline.js out.json http://127.0.0.1:8765/index.html` · `node compare.js render out.json render-reference.json` |
| `pipeline.js` | Pipeline completo via `drawComposite`, cache (mudar e voltar dá os mesmos pixels), edições rápidas, `Composites.Merged` | `node pipeline.js out.json http://127.0.0.1:8765/` |
| `auth_flow.js` | Login: migração da senha antiga para token, recarga só com token, token revogado, senha errada, troca de conta, Sign out, Meilisearch com usuário comum, servidor fora do ar | `node auth_flow.js <pasta do CoverMaker> <pasta de uma versão antiga do CoverMaker>` |
| `jellyfin_flow.js` | Bibliotecas, busca, pôster → slot, próxima página, tamanho das miniaturas | `NO_GC=1 node jellyfin_flow.js http://127.0.0.1:8765/ rótulo` |
| `fixes_phase2.js` | IDs de slot após recarregar, corrida no texto, Seed 0, títulos de seção, ZIP com slots vazios | `node fixes_phase2.js http://127.0.0.1:8765/` |
| `fixes_phase4.js` | Itens editados no servidor com a biblioteca em cache, "assistido" atualizado, scroll em lote, tokenizer, tipos | `node fixes_phase4.js` (reinicie o mock antes) |
| `cr_auth.js` | content-recommender: migração para token, recarga, cartões como texto, Sign out, login | `node cr_auth.js <pasta do cdn> <pasta do CoverMaker>` |

`render-reference.json` é a referência visual de 2026-10-23 (depois das correções). Itens marcados como não
determinísticos (aleatórios) ficam fora da comparação.
