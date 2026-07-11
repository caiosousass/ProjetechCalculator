# ProjeTech Calc

PWA com calculadoras para eventos:

- **Pixel Map** — painel de LED (resolução, dimensão, pitch, peso, consumo) + gerador de imagem de teste (PNG)
- **Elétrica** — potência, corrente, disjuntor, cabo (NBR 5410) e queda de tensão, por setor
- **Projeção** — distância / throw ratio / tamanho da tela + blending (multi-projetor)

App estático (HTML/CSS/JS), instalável no celular e no computador.

## Rodar localmente
Sirva a pasta com qualquer servidor estático, por exemplo:

```
npx serve -p 5501 .
```

E abra `http://localhost:5501/`.

## Hospedagem
Site estático — funciona em GitHub Pages, Netlify, Vercel ou Cloudflare Pages.
Todos os caminhos são relativos, então funciona tanto na raiz quanto em subpasta.
