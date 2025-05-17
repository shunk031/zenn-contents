---
title: "IEEEtran の bibtex style で、同じ著者名の論文が複数存在する時に \"----\" になってしまう問題の解決方法"
emoji: "✍️"
type: "tech"
topics:
  - "tex"
  - "bibtex"
published: true
published_at: "2023-02-10 20:05"
---

## 背景

IEEE の論文を書く際の bibtex style として [`IEEEtran`](http://www.michaelshell.org/tex/ieeetran/bibtex/) が使用されます。この style の特徴は論文中に引用がされた順番に文献情報のセクションに文献情報が表示される点です。

IEEEtran style では同じ著者名の論文が複数存在する場合、以下のように　`----` で著者名が省略されてしまうことがあります。

![](https://storage.googleapis.com/zenn-user-upload/49bf2f258336-20230210.png)

これを次のように省略されないようにしたいです。

![](https://storage.googleapis.com/zenn-user-upload/4d3c0c6f095d-20230210.png)

## 解決方法

- `@IEEEtranBSTCTL` を bibtex の先頭に記述する:

```bibtex:references.bib
@IEEEtranBSTCTL{IEEEexample:BSTcontrol,
   CTLdash_repeated_names = "no"
 }
```

- `\bstctlcite{IEEEexample:BSTcontrol}` を `\begin{document}` のすぐ下に書く:

```tex:main.tex
\begin{document}

% こちらを追記
\bstctlcite{IEEEexample:BSTcontrol}
 
 % ...
 
 \end{document}
```

以上。


## 参考

- rules - Is it normal for BibTeX to replace similar author names with "------"? - TeX - LaTeX Stack Exchange https://tex.stackexchange.com/questions/29381/is-it-normal-for-bibtex-to-replace-similar-author-names-with 
- bibtex - Author name not showing when using IEEEtran bib style - TeX - LaTeX Stack Exchange https://tex.stackexchange.com/questions/237929/author-name-not-showing-when-using-ieeetran-bib-style 
