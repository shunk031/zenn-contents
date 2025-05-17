---
title: "コスメプラットフォームLIPSと広告クリエイティブ: 最新の研究事例から見る広告クリエイティブの作成支援と自動生成"
emoji: "💄"
type: "tech"
topics: ["research"]
publication_name: appbrew
published: true
published_at: 2021-04-28
---
こんにちは [@shunk031](https://twitter.com/shunk031) です。 ご縁があって [appbrew Tech Blog](https://tech.appbrew.io/) へ本記事を寄稿しました[^1]。 今回のお話は、私が取り組んでいる研究分野の 1 つである「機械学習と広告クリエイティブ[^2]」を特に評価していただき実現しました。

ここで簡単に、本記事の著者である私の自己紹介をします。私は以下のような自然言語処理の研究を中心に進めております。

- 基礎研究: 深層学習モデルによる解釈可能な自然言語処理[^3]
- 応用研究: 自然言語処理等による広告クリエイティブの評価や生成[^4]

今回こうしたバックグラウンドから、 AppBrew の LIPS において商品推薦を広告宣伝の観点から議論・相談を受ける形でお仕事をさせていただきました。

![f:id:shunk031:20210412153034p:plain](/images/lips-ad-creative-research/20210412153034.png)

本記事では、機械学習による広告クリエイティブ作成支援の観点から、最新の研究事例について紹介し、議論することが目標です。 特に AppBrew が展開するコスメプラットフォーム LIPS が抱えるビックデータと、今回紹介する研究事例の橋渡しをします。

本記事で紹介する実用的な研究事例を通して、より魅力的な商品推薦や広告配信を実現するための手がかりが得られると考えています。 また、こうした手がかりを元に **LIPS をより良くするお手伝いをしてくださる方にリーチする** ことも本記事の目標の 1 つです。 以下はソフトウエアエンジニアリングの観点から LIPS をより良くしていくアルゴリズムエンジニアのポジションと実際に働いている社員のインタビューです。

https://herp.careers/v1/appbrew/N71dKrjFhi11

https://www.wantedly.com/companies/appbrew/post_articles/319184

## LIPS と商品推薦

AppBrew では日本最大級のコスメ・美容プラットフォーム [LIPS](https://lipscosme.com/) を開発・運営しています。 LIPS における商品情報やクチコミは増え続けており、ユーザに適切な情報を推薦する仕組みの重要度が増しています。

https://lipscosme.com/

商品検索や推薦における問題設定では、しばしば推薦対象の候補群を所与のものとし、そのうちどれを推薦すべきかを考えます。 しかし実際には、情報をどのように提示するかという点も、ユーザに魅力的な情報を届けられるかどうかを左右します。

この意味で、商品を宣伝するために効果的な広告クリエイティブを効率的に作成・生成するモチベーションがあります。 広告を人手で作るにはコストがかかり、デジタル広告もまた例外ではありません。 特に広告クリエイティブは宣伝対象の商品の魅力をユーザへ伝えるために、様々なパターンのテキストや画像の組み合わせや配置を吟味して制作する必要があります。 このコストを削減するために、機械学習による広告クリエイティブの作成支援が期待されています。

事例はまだまだ少ないですが、コンピュータサイエンスの国際会議でもこのような研究発表が盛んになってきています。 これらの研究には企業が共著として入っているものが多く、実応用が期待できます。 以下に、トップカンファレンスで発表されているものを中心に研究事例を紹介します。

## 広告クリエイティブの作成支援の "研究開発" と "実応用"

効果的な広告クリエイティブを大規模に作成するための機械学習技術を研究開発と実応用の面から紹介します。 まず研究開発の面で、最近投稿された広告クリエイティブに関する研究を 4 つほど紹介し、その後実際に応用している中国のテックジャイアントの事例を紹介します。

### 研究開発

本セクションでは最新の広告クリエイティブに関する論文の概要を紹介し、その論文がどのように広告クリエイティブ作成支援に繋がるかを検討します。 簡単のため、モデルと入出力を示すにとどめて紹介します。

#### Conversion Prediction Using Multi-task Conditional Attention Networks to Support the Creation of Effective Ad Creative (KDD 2019)

- KDD 2019 Applied Data Science Track 採択論文
- Preprint: [https://arxiv.org/abs/1905.07289](https://arxiv.org/abs/1905.07289)

##### 概要

広告クリエイティブの配信効果を事前に予測する、マルチタスク学習と動的な attention 適用を含めた枠組みを提案しています。 拙著で大変恐縮ですが、本論文は効果の高い広告クリエイティブの作成支援を見据えて、この領域に先駆けて発表できた論文だと考えております。

- モデル
    - LSTM[^5] ベース
- 入力
    - テキスト
        - タイトルテキスト
        - 説明テキスト
    - 広告カテゴリ変数
        - 配信対象の性別
        - 広告クリエイティブのジャンル
- 出力
    - 予測コンバージョン数，予測クリック数

##### マルチタスク学習と conditional attention

マルチタスク学習により、不均衡なコンバージョンやクリックの予測の精度向上を達成しています。
また、conditional attention を用いた広告属性に対する動的な attention の適用を、実世界で配信された広告クリエイティブ 14,000 件を用いて評価した結果を報告しています。

![](/images/lips-ad-creative-research/20210412133858.png)
*Figure by (Kitada+ KDD'19)*

##### どのように広告クリエイティブ作成支援へ応用可能か

動的に attention を割り当てる conditional attention 機構により、広告属性に応じた重要語の可視化を行えることを確認し、クリエイティブの作成支援を行える可能性を示唆しています。 具体的には対象の広告属性 (例えばどのデモグラに配信するか、広告クリエイティブのジャンルはどれか) を設定すると、入力テキストにおいてクリックやコンバージョンに寄与する箇所を可視化可能です。 このような結果を活用したクリエイティブ作成支援機能の開発が検討できます。

![](/images/lips-ad-creative-research/20210412134039.png)
*Figure by (Kitada+ KDD'19)*

#### Guiding Creative Design in Online Advertising (RecSys 2019)

- RecSys 2019 short 採択論文[^6]
- 拙著のまとめ: [Guiding Creative Design in Online Advertising - scrapbox](https://scrapbox.io/gunosydm/Guiding_Creative_Design_in_Online_Advertising)

##### 概要

クリエイティブ作成の支援に向けて、与えられたブランドに対してキーワードを推薦するシステムを提案しています。

- モデル
    - Deep Relevance matching model (DRMM)[^7] をベース
- 入力
    - Query
        - 商品ブランド
        - 商品カテゴリ
    - Document
        - キーワード
- 出力
    - 類似度
        - 人手で作成されたかどうか
            - label generation phase で生成

![](/images/lips-ad-creative-research/20210412134115.png)![](/images/lips-ad-creative-research/20210412134126.png)
*Figure by (Mishra+ RecSys'19)*

##### DRMM を元にしたモデルの訓練と label generation

DRMM を元にしたモデルの訓練方法として、label generation phase で訓練対象の正例と負例を取得します。

- 正例: [\[Hussian+ CVPR'17\]](https://arxiv.org/abs/1707.03067)[^8] でアノテーションされた ground truth を使用
- 負例: wikipedia ページの対象ブランドからランダムにサンプルした単語を使用

取得した正例負例とブランドラベルを元に triplet loss を最小化するように DRMM を訓練させます。

##### どのように広告クリエイティブ作成支援へ応用可能か

商品情報とキーワードのペアから人手で作成されたかどうかを DRMM で学習する問題設定は、様々な設定で広告クリエイティブの作成支援を行える余地があります。 前述のように人手で広告クリエイティブを作成するのは難しいため、LIPS が独自で大量に保持しているデータを賢く利用して同様の問題設定に落とし込むことができると考えられます[^9]。

#### Recommending Themes for Ad Creative Design via Visual-Linguistic Representation (WWW 2020)

- WWW 2020 採択論文^[^10]
- Preprint: [https://arxiv.org/abs/2001.07194](https://arxiv.org/abs/2001.07194)
- 拙著まとめ: [Recommending Themes for Ad Creative Design via Visual-Linguistic Representation - scrapbox](https://scrapbox.io/gunosydm/Recommending_Themes_for_Ad_Creative_Design_via_Visual-Linguistic_Representation)

##### 概要

マルチモーダルな Transformer[^11] ベースのモデルによる広告クリエイティブ作成支援のためのキーフレーズ推薦システムを提案しています。

本研究では、ブランド固有の広告クリエイティブ作成支援のために、キーフレーズ推薦を visual question answering (VQA)[^12] タスクとして定式化し、複数のモーダルを活用することに焦点を当てています。

![](/images/lips-ad-creative-research/20210412134342.png)
*Figure by (Zhou+ WWW'20)*

- 入力
    - 画像
        - 広告画像
    - テキスト
        - データセットに収録されている質問文テキスト
        - 広告画像から OCR を実行して得られるテキスト
        - 対象ブランドの wikipedia ページから得られるテキスト
- 出力
    - キーフレーズ
        - 複数のキーワードからなる

![](/images/lips-ad-creative-research/20210412134441.png)
*Figure by (Zhou+ WWW'20)*

##### どのように広告クリエイティブ作成支援へ応用可能か

広告クリエイティブの作成支援を、画像から与えられた質問を回答するように学習する VQA タスクとして解く問題設定は、特にコスメ商品の推薦や広告作成支援で有効に働くと考えられます。 このとき「なぜこのコスメを買ったか？」という質問を入力として与え、ユーザがなぜ購入したか[^13] [^14]を出力できるようなシステムを構築することで、ユーザの推しポイントを考慮したクリエイティブ作成支援システムの実現が可能になります。

#### Generating Better Search Engine Text Advertisements with Deep Reinforcement Learning

- KDD 2019 Applied Data Science Track 採択論文[^15]
- 拙著まとめ: [Generating Better Search Engine Text Advertisements with Deep Reinforcement Learning- scrapbox](https://scrapbox.io/gunosydm/Generating_Better_Search_Engine_Text_Advertisements_with_Deep_Reinforcement_Learning)

##### 概要

ランディングページの情報を元に、CTR が高い検索連動型広告のテキストを自動生成する枠組みを提案しています。

##### ランディングページから要約する

ランディングページから強化学習手法の 1 つである self critical sequence training[^16]を元に oracle model[^17] が予測する CTR が高くなるように訓練させます。

![](/images/lips-ad-creative-research/20210412134543.png)
*実際に生成された広告文の例. Figure by (Hughes+ KDD'19)*

##### どのように広告クリエイティブ作成支援へ応用可能か

本研究は検索連動型広告を対象に、CTR が高くなるように広告文を生成する枠組みです。 よって、この仕組をそのまま使用して生成された文を元に人手で微修正を加えて入稿することがあると考えられます。 一方で強化学習による枠組みは学習が簡単ではなく、またクリックされやすいようないわゆる釣りテキストのようなものが生成されてしまう危険性があります。 こうした懸念は最終的に人手チェックを通すことで回避可能ですが、ユーザの満足度を表すような CTR 以外の指標で最適化すると面白い結果が得られるのではないかと考えられます。

### 実応用

本セクションでは機械学習を元にしたシステムで実際に広告クリエイティブ作成支援や自動生成する事例を紹介します。

#### Alibaba Luban: Ai-based Graphic Design Tool

- Alibaba Luban: AI-based Graphic Design Tool - Alibaba Cloud Community[^18]

https://www.youtube.com/watch?v=C4izVFzarug

2018 年の登場した Alibaba の Luban はバナーや広告のポスターなどを作成する AI ツールです。 Alibaba が運営する Tmall[^19] や Taobao[^20] や Alibaba Cloud 上で多種多様な広告クリエイティブ向けのデザインを、機械学習を元にしたシステムで作成したと報告されています。 Tmall で表示されているバナーや宣伝写真の殆どが Luban がデザインしたものであると言われています。 Luban はすでに熟練のデザイナーの域に達しているとされ、毎秒 8,000 種類のバナー広告をデザインできるとされています。

##### Luban’s Design Knowledge Profile

Luban は数百万のマーケティング画像から構成されている知識ベースを元に訓練されています。 Luban が作成した画像やデザインには自動でタグ付けされ、見た目のスタイルやデザインの構造を分析対象としています。 これらは各デザインにおける視覚的構成や色合い、商品の魅力的に伝えるコピーライティングのスタイルを認識し、知識ベースとして蓄えています。

知識ベースを構築する際は各構成要素を無向グラフを使用し、ストレージにはリレーショナルデータベースや NoSQL データベースを使用しているようです。 Luban は処理後のデータをアルゴリズムが依存する elastic search インデックスに同期します。

![](/images/lips-ad-creative-research/c420ec1ade9cd700c73ea8d8a3dc76a02885166b.png)

##### Luban’s Intelligent Design Deep Learning Algorithm

Luban は深層学習モデルをベースにしていると言われています。 ユーザが希望するデザインやスタイル、画像サイズを入力するだけで、素材分析・画像のレタッチ・カラーブレンド・レイアウトなどの時間のかかるデザイン作業を Luban に任せることができるようです。

![](/images/lips-ad-creative-research/a713f98dc1d725e4cfec47baab3deb7d07f1af37.png)

##### Image Protocol and Image Rendering Capabilities

Luban はデザインを記述する専用の domain specific language (DSL) を利用して画像を生成します。 このとき、DSL を通して画像の主な構成要素と視覚的な詳細を、レイヤーを分けて記述可能なのようです。 このような DSL によりソフトウエア間で画像を操作するためのプロトコル基盤が整備されています。

GPU ベースの画像レンダリング技術との組み合わせにより、Luban は毎秒数万枚の画像を設計および生成することが可能になっています。 これにより、大量のバナー画像やポスター等を短時間で作成できるとされています。 GPU を用いた効率的な画像生成により、Luban は企業やデザイナーに対してワンクリックで簡単かつ高速に画像を生成し、サイズ拡大・多様な色相の使用・その他のデザイン・サービスを提供できると言われています。

![](/images/lips-ad-creative-research/01d7f2581dffa7c15d3a0c915247fad820f6437a.png)

日本語で Luban についてまとめている記事も参考になります[^21]。

#### Tencent Ads: Interesting Problems and Unique Challenges

- ADKDD 2019 招待講演[^22]

##### DPA: パーソナライズされた広告クリエイティブの自動生成

Tencent Ads では VideoIn Ads[^23] という、広告対象の商品画像を動画に対して自然に合成する革新的な広告プロダクトがありますが、今回はユーザ個人の趣向を捉えた広告クリエイティブの自動生成技術である DPA[^24] に触れます。

![](/images/lips-ad-creative-research/20210412135319.png)
*Figure by (Liu+ ADKDD'19)*

予め作られた static な広告クリエイティブは大規模な広告枠を持つ広告主向けに最適化するのは難しく、個々人にパーソナライズされた dynamic な広告クリエイティブ自動生成技術が求められています。 Tencent の DPA では、こうした static な広告クリエイティブの問題点に対してユーザの行動履歴を元にパーソナライズされた広告クリエイティブの自動生成技術が使われているようです。

## まとめと今後の展望

### 広告クリエイティブに関する研究は発展途上

広告関連のデータは一般的に大規模なため、深層学習を中心としたモデルと非常に相性が良い反面、コンピュータサイエンスのトップカンファレンスにはこうした研究成果があまり現れてきません。 これはさまざまな大人の事情が反映されているとはいえ、「データがたくさんある」だけでは解決できない様々な問題点があり、取り組みがいのあるテーマだと感じています。

特に実応用のセクションで示した Alibaba や Tencent の例は大規模な広告チームが長年取り組んできた成果が現れており、一長一短で同様のシステムを構築するのはかなりタフな仕事になると考えております。 一方で、現実的な機械学習技術を組み合わせた堅実な作りであるため、必ずしも実現が難しいかは手を動かす私たちにかかっているように思えます。 私は特に「研究」の面から LIPS に携わりましたが、「実応用」の面で連携してくださる方が増えると良いなと考えております。

### 広告クリエイティブの作成支援から自動生成へ

今回取り上げた研究は主に「人と計算機のコラボレーション」であり、多少人間が介入するようなシステムの提案が多いです。 こうした広告クリエイティブの作成支援は実世界への応用を見据えると現実的な解決方法である一方で、人間が介入しない自動生成技術に移行するには依然として取り組まなければならない課題があり、研究開発の重要性は増していると感じています。

こうした広告クリエイティブの作成支援や自動生成は、LIPS においても非常に重要な役割を担う技術であります。 本記事を読んで、実際に手を動かしたいと考えてくださる方やお力添えいただける方がいらっしゃると良いなと考えております。

株式会社 AppBrew では一緒に働く仲間を募集しています！

https://herp.careers/v1/appbrew/N71dKrjFhi11

<!-- textlint-disable -->
[^1]: お声がけ頂いた AppBrew のみなさん、ありがとうございます。この場をお借りしてお礼申し上げます。
[^2]: 広告クリエイティブと機械学習技術における現状と展望 / The Present and Future of Machine Learning for Ad Creatives - Speaker Deck https://speakerdeck.com/shunk031/the-present-and-future-of-machine-learning-for-ad-creatives
[^3]: [2009.12064] Attention Meets Perturbations: Robust and Interpretable Attention with Adversarial Training https://arxiv.org/abs/2009.12064
[^4]: [1905.07289] Conversion Prediction Using Multi-task Conditional Attention Networks to Support the Creation of Effective Ad Creative https://arxiv.org/abs/1905.07289
[^5]: Long Short-Term Memory | Neural Computation https://dl.acm.org/doi/10.1162/neco.1997.9.8.1735
[^6]: Guiding creative design in online advertising | Proceedings of the 13th ACM Conference on Recommender Systems https://dl.acm.org/doi/10.1145/3298689.3347022
[^7]: [1711.08611] A Deep Relevance Matching Model for Ad-hoc Retrieval https://arxiv.org/abs/1711.08611
[^8]: [1707.03067] Automatic Understanding of Image and Video Advertisements https://arxiv.org/abs/1707.03067
[^9]: LIPS の持つユニークなデータについてはカジュアル面談等でぜひ聞いてみてください！
[^10]: Recommending Themes for Ad Creative Design via Visual-Linguistic Representations | Proceedings of The Web Conference 2020 https://dl.acm.org/doi/10.1145/3366423.3380001
[^11]: [1706.03762] Attention Is All You Need https://arxiv.org/abs/1706.03762
[^12]: VQA: Visual Question Answering https://visualqa.org
[^13]: コスメ商品のレビューにはユーザがなぜ購入したか、どこが推しポイントかを記述している傾向があります。
[^14]: ユーザレビュー文から期待する表現を抽出するのはまた難しい問題の 1 つです。
[^15]: Generating Better Search Engine Text Advertisements with Deep Reinforcement Learning | Proceedings of the 25th ACM SIGKDD International Conference on Knowledge Discovery & Data Mining https://dl.acm.org/doi/10.1145/3292500.3330754
[^16]: Simple Statistical Gradient-Following Algorithms for Connectionist Reinforcement Learning | Machine Language https://dl.acm.org/doi/10.1007/BF00992696
[^17]: 価値関数 (今回は CTR) の真の値を予測するモデル
[^18]: Alibaba Luban: AI-based Graphic Design Tool - Alibaba Cloud Community https://www.alibabacloud.com/blog/alibaba-luban-ai-based-graphic-design-tool_594294 
[^19]: 天猫 tmall.com-- 理想生活上天猫 https://www.tmall.com/
[^20]: 淘宝网 (淘寶網) https://world.taobao.com/
[^21]: AI Designer の逆襲！｜CrowdWorks DesignDiv｜note https://note.com/designdiv/n/nd0e3afc68c09
[^22]: Tencent Ads: Interesting Problems and Unique Challenges | AdKDD 2019 https://www.adkdd.org/Papers/Tencent-Ads%3A-Interesting-Problems-and-Unique-Challenges/2019
[^23]: 拙著のテンセント Ads のまとめ記事で VideoIn Ads の凄さを解説しています: テンセントの広告技術が未来すぎる！AdKDD2019 のテンセント Ads 招待講演まとめ - Gunosy データ分析ブログ https://data.gunosy.io/entry/adkdd2019-tencent-ads-invited-talk#VideoIn-Ads
[^24]: DPA が何の略かは不明
<!-- textlint-enable -->
