# Buraco Negro Cinematográfico

Projeto estático, pronto para GitHub Pages, que renderiza um buraco negro cinematográfico inspirado em Interstellar.

## O que já faz

- câmera livre com clique e arraste
- zoom com scroll
- órbita suave ao redor do buraco negro
- disco de acreção emissivo
- distorção gravitacional aproximada em shader
- fundo procedural com estrelas
- compatível com GitHub Pages sem etapa de build

## Estrutura

```text
buraco-negro-pages/
├─ index.html
├─ style.css
├─ main.js
└─ README.md
```

## Como publicar no GitHub Pages

1. Crie um repositório
2. Envie estes arquivos para a raiz do repositório
3. Vá em **Settings > Pages**
4. Em **Source**, escolha **Deploy from branch**
5. Selecione a branch principal e a pasta **/(root)**
6. Salve

## Como rodar localmente

Você pode abrir com uma extensão de servidor local, ou usar qualquer servidor simples.

Exemplo com Python:

```bash
python -m http.server 8000
```

Depois abra:

```text
http://localhost:8000
```

## Controles

- clique e arraste: orbitar a câmera
- scroll: zoom
- o alvo da câmera fica travado no centro

## Stack

- HTML
- CSS
- JavaScript
- Three.js via CDN
- GLSL inline no arquivo `main.js`

## Observação

Este projeto foi montado para evitar tela branca no GitHub Pages.
Ele não depende de Vite, npm ou importações locais de shader.
