---
title: "ユーザー生成コンテンツ（UGC）と最新 AI 技術で切り拓く LIPS の広告クリエイティブの未来"
emoji: "💄"
type: "tech"
topics: ["research"]
publication_name: appbrew
published: true
published_at: 2025-09-29
---

こんにちは [@shunk031](https://twitter.com/shunk031) です。以前、AppBrew で業務委託としてお世話になっており、先日開催された AppBrew 同窓会[^1]に参加しました。その際にお声がけいただいたことをきっかけに、久しぶりに [AppBrew Tech Blog](https://zenn.dev/p/appbrew) へ本記事を寄稿することになりました[^2][^3]。

<!-- textlint-disable -->
:::message
筆者は現在 AppBrew に所属しておらず、外部の立場から公開情報と一般的な知見、過去の業務委託経験を踏まえて執筆しています。記載の内容・見解は筆者個人のものであり、AppBrew の公式見解を代表するものではありません。
:::
<!-- textlint-enable -->

## はじめに：UGC が拓く新たなデザインの可能性

AppBrew が運営する日本最大級のコスメ・美容プラットフォーム [LIPS](https://lipscosme.com/) には、毎日数千件のクチコミが投稿されます。これらは単なる商品の評価にとどまらず、ユーザーの「美への情熱」が宿る **極めて価値の高い User Generated Content（UGC）**[^4]です。本稿では、この膨大な UGC をどう活用すれば、より魅力的な商品画像や広告クリエイティブを生み出せるかを、外部の視点から考察します。

従来の広告制作は、専門スキルと多くの時間を要する作業でした。LIPS の豊富なデータ資産と最新の AI グラフィックデザイン技術の組み合わせには、その課題を乗り越える大きな可能性があると考えます。AI を使えば日々更新される多様なニーズを捉えやすく、「クチコミから購入へ」という LIPS の強みと掛け合わせることで、コスメ市場の変化に俊敏に対応できるはずです。結果として、個々の関心に寄り添ったクリエイティブの大規模生成が視野に入ります。本記事では、UGC 活用に資する最先端の AI グラフィックデザイン研究を概観し、LIPS へ適用した際の示唆について外部の立場から検討します。

<!-- textlint-disable -->
:::message
以降、具体的な実装・再現手順については原論文を合わせて参照ください。
:::
<!-- textlint-enable -->

## AI グラフィックデザインの進化と応用

AI、とりわけ **大規模言語モデル（Large Language Model; LLM）** はいまや単なる補助ツールを超え、創造プロセスの中核を担う存在へと進化しています。AI 駆動型グラフィックデザイン（Artificial Intelligence in Graphic Design; AIGD）[^5]は多様なニーズに応え、ユーザーの細やかな制御にも対応します。設計の質を定量化し、広大な設計空間を効率的に探索できる点も特徴です。この流れは広告をはじめ多くの産業で、生成の可能性を大きく押し広げています[^6]。初期研究が要素分解に焦点を当てていたのに対し[^7]、2023 年以降はグラフィックデザイン全体を対象にする包括的研究が台頭しています[^8][^9]。審美的一貫性を保ちながら、デザインワークフロー全体を扱う方向への進化です。

応用領域は広告画像[^5][^10][^11]、ポスター[^9][^12][^13]、UI[^14][^15][^16]、さらに一般的なデザイン[^17][^18]、インフォグラフィック[^19][^20][^21]、プレゼン資料[^22][^23]など幅広く、多様なビジュアルコンテンツの生成・改善が行われています。ロゴ作成[^26]や芸術的テキスト生成[^27]といった個別要素でも AI の活用が進んでいます。さらに、ウェブサイト[^24]や印刷物などの「視覚的に豊かな文書（visually-rich document; VrD）」の自動生成[^25]、デザインからコードを直接生成する新しいフロントエンド開発の潮流[^15]も現実味を帯びてきました。

ビジネス面でも大きな変化をもたらします。AI により物理プロトタイプへの依存が減り、リリースまでの時間を短縮できます。特に EC では「売れるまで作らない」という革新的なモデル[^10]すら提案され始めました。企業は多様なパッケージ案を素早く生み、マーケティング向けの高品質クリエイティブを効率良く制作できます[^5]。これにより、実際のエンゲージメントや投資対効果に基づくリアルタイムのデザイン検証と、より高いパーソナライズが可能になります。

現時点の研究では、生成 AI は既存広告の「編集・修正」よりも、新規広告の「創作」タスクで高い性能を示すことが報告されています[^5]。人間の専門家が持つ暗黙知の取り込みに課題があることを示唆しますが、ここは今後の重要な研究領域です。完全自動生成に向けては、引き続き解決すべき点が残っています。

<!-- textlint-disable -->
:::message
UGC に対する AI グラフィックデザインの活用の具体的なアイディアは記事後半の「[LIPS での UGC 活用ロードマップ](#lips-での-ugc-活用ロードマップ)」をご参照ください。
:::
<!-- textlint-enable -->

## コア技術：AI による画像生成のメカニズム

AI による画像生成は、大きく「ラスタ画像生成」と「ベクタ画像生成」に分けられます。一方で、要素の配置を決める「レイアウト生成」は両方式を横断する上位概念であるため、本稿ではまずレイアウト生成を概観し、その後にラスタ／ベクタの代表手法を紹介します。


### レイアウト生成：デザインの骨格を AI が設計する

レイアウト生成[^29]は、画像・テキスト・背景といった要素を視覚的に魅力ある形で配置する技術です。人の専門知や作業時間を節約し、多様なニーズに対応可能です。与えられたコンテンツに合わせて合理的な表現を自動で導き、ポスター、ドキュメント、モバイル UI、雑誌、スライドなどに応用されています。

![Figure by [Shi+ Information Fusion'23]](https://ars.els-cdn.com/content/image/1-s2.0-S1566253523002567-ga1_lrg.jpg)
*Figure by [Shi+ Information Fusion'23]*

直近の代表的研究をいくつか紹介します。

#### PosterO

PosterO[^12]は LLM のレイアウト知識を活用し、さまざまな目的に対応するポスターを生成するレイアウト中心の手法です。SVG（Scalable Vector Graphics）でレイアウトをツリー構造として表現し、LLM に新たなレイアウトツリーを予測させることで、多様な意図と形状に対応する汎化と多様性を実現します。

![Figure by [Hsu+ CVPR'25]](https://arxiv.org/html/2505.07843v2/x2.png)
*Figure by [Hsu+ CVPR'25]*

#### Uni-Layout

Uni-Layout[^30]は、レイアウトの生成と、人間を模倣した評価の両方をアライメントする枠組みです。LLM ベースの評価と Chain-of-Thought（CoT）[^31]を組み合わせ品質を測定し、Dynamic-Margin Preference Optimization（DMPO）で人間の判断との整合性を高めます。

![Figure by [Lu+ ACM MM'25]](https://arxiv.org/html/2508.02374v1/samples/images/Figure1.jpg)
*Figure by [Lu+ ACM MM'25]*

#### LGGPT

<!-- textlint-disable -->
LGGPT[^32]は、科学記事・アプリ UI・雑誌・スライドの 4 領域のレイアウトデータを統合し、単一モデルで多様なタスクに対応します。1.5B パラメータ級モデルで性能と効率の良いトレードオフを示し、入出力テンプレート（Arbitrary Layout Instruction; ALI/Universal Layout Response; ULR）と Interval Quantization Encoding（IQE）により冗長トークンを削減しています。
<!-- textlint-enable -->

![Figure by [Zhang+ arXiv'25]](https://arxiv.org/html/2502.14005v1/extracted/6216509/arch.png)
*Figure by [Zhang+ arXiv'25]*

#### CreatiLayout

CreatiLayout[^33]は Multi-modal Diffusion Transformer (MM‑DiT)[^36] に基づき、レイアウトから画像を生成します。色・質感・形状・テキストなど複雑な属性を高品質かつ細やかに制御しながらレンダリングできます。

![Figure by [Zhang+ ICCV'25]](https://arxiv.org/html/2412.03859v3/x2.png)
*Figure by [Zhang+ ICCV'25]*

### ラスタ画像生成：ピクセル単位で多様なビジュアルを操る

ラスタ画像生成は、画像をピクセルの集合として扱います。Text-to-Image（T2I）[^34][^35][^36][^37]の発展により、テキストから高品質な画像を生成でき、既存画像の編集や欠損補完（インペインティング）も可能になりました。広告バナーや EC 商品画像、ポスター背景など、商用クリエイティブの自動生成で活用が進んでいます。

![Figure by [Esser+ ICML'24]](https://arxiv.org/html/2403.03206v1/img/teaser.jpg)
*Figure by [Esser+ ICML'24]*

主な研究は次のとおりです。

#### PerFusion

PerFusion[^10]は EC におけるパーソナライズドな生成アイテムのフレームワークです。ユーザーのグループレベル嗜好を捉え、生成アイテムがクリック率・コンバージョン率を向上させることを示しました。物理プロトタイプへの依存を減らし市場投入を加速、ひいては「売れるまで作らない」というモデルを可能にします。

![Figure by [Lin arXiv'25]](https://arxiv.org/html/2503.22182v1/x1.png)
*Figure by [Lin arXiv'25]*

![Figure by [Lin arXiv'25]](https://arxiv.org/html/2503.22182v1/x2.png)
*Figure by [Lin arXiv'25]*

#### PAID

PAID[^38]は、製品の全景画像・マーケティング対象・目標サイズのみを入力として、製品中心の広告画像を自動生成するフレームワークです。

![Figure by [Chen+ arXiv'25]](https://arxiv.org/html/2501.14316v2/x1.png)
*Figure by [Chen+ arXiv'25]*

#### BizGen

BizGen[^20]は、記事レベルのビジュアルテキストレンダリングを実現するインフォグラフィック生成技術です。スケーラブルなデータエンジンとレイアウトガイド付きクロスアテンションで、データ不足や超長文という課題を克服し、長文テキストの正確な表示を可能にします。

![Figure by [Peng+ CVPR'25]](https://arxiv.org/html/2503.20672v2/extracted/6590311/img/infographics-example-final.png)
*Figure by [Peng+ CVPR'25]*

![Figure by [Peng+ CVPR'25]](https://arxiv.org/html/2503.20672v2/extracted/6590311/img/retrieval_augmented_infographics_gen_new.png)
*Figure by [Peng+ CVPR'25]*

#### CreatiDesign

CreatiDesign[^28]は、主要視覚要素・副次視覚要素・テキスト要素という異種要素の正確な制御と調和配置を可能にする、拡散モデルベースの生成手法です。

![Figure by [Zhang+ arXiv'25]](https://arxiv.org/html/2505.19114v2/x3.png)
*Figure by [Zhang+ arXiv'25]*

#### DreamPoster

DreamPoster[^39]は、ユーザー提供の画像とテキストから高品質なポスターを合成する T2I フレームワークで、コンテンツ忠実度を保ったまま解像度やレイアウトの柔軟性を実現します。

![Figure by [Hu+ arXiv'25]](https://arxiv.org/html/2507.04218v1/x2.png)
*Figure by [Hu+ arXiv'25]*

#### TKG‑DM

TKG‑DM[^40]は、学習なしでクロマキーコンテンツを生成する拡散モデルです。前景と背景を独立に制御したい多様な生成アプリケーションへの展開が期待されます。

![Figure by [Morita+ CVPR'25]](https://arxiv.org/html/2411.15580v3/x1.png)
*Figure by [Morita+ CVPR'25]*

### ベクタ画像生成：コンポーネントを自在に扱う

ベクタ画像生成は、点・線・多角形・曲線といった幾何学プリミティブで画像を表現します。ロスレスに拡大縮小でき、軽量で、要素ごとに編集しやすいのが利点です。SVG は XML でシーンを表し、LLM が直接コードを取り扱える点も強みです。ロゴやアイコン、イラスト、グラフなどの生成に適し、LIPS のようなプラットフォームで編集可能な資産を効率的に運用できます。

主な研究は次のとおりです。

#### LLM4SVG

LLM4SVG[^41]は、学習可能なセマンティックトークンにより SVG コンポーネントの理解を深めるアプローチです。

![Figure by [Xiang+ CVPR'25]](https://arxiv.org/html/2412.11102v3/x3.png)
*Figure by [Xiang+ CVPR'25]*

#### SVGen

SVGen[^42]は、LLM を用いた解釈可能なベクタグラフィックス生成を目指し、CoT[^31]と強化学習を組み合わせて、構造と解釈可能性を高めます。

![Figure by [Wang+ arXiv'25]](https://ar5iv.labs.arxiv.org/html/2508.09168/assets/x3.png)
*Figure by [Wang+ arXiv'25]*

#### StarVector

StarVector[^43]は、画像の意味を理解し、SVG プリミティブでコンパクトかつ正確な出力を生成する MLLM です。従来のピクセル指標では測りにくい SVG の品質を評価する新ベンチマーク SVG‑Bench も導入しています。

![Figure by [Rodriguez+ CVPR'25]](https://arxiv.org/html/2312.11556v4/x1.png)
*Figure by [Rodriguez+ CVPR'25]*

#### CreatiPoster

CreatiPoster[^44]は、ユーザー指示やアセットから編集可能な多層コンポジションを生成します。プロトコルモデルがテキストやアセットのレイヤー情報を含む JSON 仕様を作成し、背景モデルが前景レイヤーに整合する背景を合成します。生成後のテキスト修正やアセット差し替えが容易です。

![Figure by [Wang+ arXiv'25]](https://arxiv.org/html/2506.10890v1/x2.png)
*Figure by [Wang+ arXiv'25]*

## AI エージェントによるデザイン自動化：人と AI の協調

AI エージェントによる自動化は、マルチモーダル大規模言語モデル（MLLM）を基盤に、人間と協調しながらデザインプロセス全体を自動化するアプローチです。戦略立案から実装までを AI が担うことで、生産性の大幅向上が期待できます。ツール呼び出しやメモリ共有を活用し、広大な探索空間を効率良く渡り歩きます。

AI は特にアイデア創出や「ゼロからの作成」で力を発揮する一方、既存デザインの微修正では人間の暗黙知にまだ及ばない部分が残ります。ゆえに人と AI の協調が重要です。広告バナー設計やプレゼン資料生成など、多段階タスクのエンドツーエンド自動化により、人はより創造的・戦略的な業務に集中できます。

代表的な研究として以下があります。

#### BannerAgency

BannerAgency[^11]は、広告主と協働してブランドアイデンティティやバナーの目的を理解し、広告バナーを自動生成する MLLM エージェントです。背景画像の生成、前景要素の設計図作成、Figma／SVG への編集可能なレンダリングまで行います。構成は広告の売り文句を考える「Strategist」、広告バナーの背景を生成する「Background Designer」、レイアウトやデザインを考える「Foreground Designer」、そしてデザインを SVG や Figma の形式に落とし込む「Developer」の 4 エージェントから成ります。特に Background Designer と Foreground Designer は、以下のような特徴を持ちます。

<!-- textlint-disable -->
- Background Designer は、ReAct エージェント[^45]と T2I ツールを用いて適切なビジュアルキャンバスを生成。テキスト混入を避ける自己改善ループを持ち、検出時はプロンプトを修正して再生成
- Foreground Designer は、ロゴ・キャンペーンテキスト・CTA ボタン・装飾要素などの配置・スタイル・内容を JSON 形式の設計図として生成し、要素レベルでの完全な編集性を担保
<!-- textlint-enable -->

![Figure by [Wang+ EMNLP'25]](https://arxiv.org/html/2503.11060v1/x4.png)
*Figure by [Wang+ EMNLP'25]*

#### PPTAgent

PPTAgent[^23]は、ドキュメントからプレゼンテーションを自動生成し、その品質を評価するフレームワークです。コンテンツ・デザイン・一貫性の 3 軸で品質を測定します。ワークフローは「プレゼンテーション分析（スライドのクラスタリングとスキーマ抽出）」と「プレゼンテーション生成（アウトライン駆動＋フィードバック機構）」の二段構えです。

![Figure by [Zheng+ arXiv'25]](https://arxiv.org/html/2501.03936v3/x2.png)
*Figure by [Zheng+ arXiv'25]*

## デザイン品質の評価と人間のフィードバック活用

生成デザインの質を高めるには、客観的指標と人間の審美判断を統合し、結果をモデル改善へ還流させる仕組みが不可欠です。定量評価・修正案の提示・人間評価との整合性向上・利用可能画像の増加など、多面的な取り組みが進んでいます。広告クリエイティブ支援は当面「人と計算機のコラボレーション」が中心であり、完全自動化には継続的な R&D が必要です。

代表的な取り組みは次のとおりです。

#### Design‑o‑meter

Design‑o‑meter[^46]は、グラフィックデザインの品質を定量化し、視覚的魅力を高める修正案を提案する手法です。複雑な設計空間を効率的に探索し、要素の位置・スケールを自動改善することで、より魅力的なデザインを実現します。

![Figure by [Goyal+ WACV'25]](https://arxiv.org/html/2411.14959v1/x1.png)
*Figure by [Goyal+ WACV'25]*

#### Human‑mimicking Evaluator

Uni‑Layout[^30]では、LLM ベースの評価に CoT を組み合わせた Human‑mimicking Evaluator を導入し、DMPO により人間判断とのアライメントを高めます。Layout‑HF100k を用いた評価で、読みやすく整理されたレイアウトと不適切な配置を区別できることを示しました。プレゼンの品質評価でも人間評価と高い相関を示し、生成能力の向上に寄与しています。

![Figure by [Lu+ ACM MM'25]](https://arxiv.org/html/2508.02374v1/samples/images/Outline.png)
*Figure by [Lu+ ACM MM'25]*

#### RFNet

RFNet[^47]は、広告画像生成に人間検査官の役割を果たす Reliable Feedback Network を導入し、生成された「利用可能」画像の数を大幅に増やすことに成功しました。

![Figure by [Du+ ECCV'24]](https://arxiv.org/html/2408.00418v1/extracted/5767848/Fig3.png)
*Figure by [Du+ ECCV'24]*

#### PPTEval

PPTEval[^23]は、コンテンツ・デザイン・一貫性の 3 軸でプレゼン品質を評価するフレームワークです。類似スライドのクラスタリングやコンテンツスキーマ抽出、参照プレゼンに基づくスライド選択・生成から成り、人間評価と高い相関を示します。

![Figure by [Zheng+ arXiv'25]](https://arxiv.org/html/2501.03936v3/x3.png)
*Figure by [Zheng+ arXiv'25]*

#### AesthetiQ

AesthetiQ[^48]は、美的観点を取り入れてレイアウト品質を高める枠組みです。MLLM を評価者として用い、美的評価に基づくランク付け（AAPA）で候補を選別します。

![Figure by [Patnaik+ CVPR'25]](https://arxiv.org/html/2503.00591v1/extracted/6244445/imgs/heroFigureLayout.png)
*Figure by [Patnaik+ CVPR'25]*

#### Infogen

Infogen[^19]は、文書から複雑な統計インフォグラフィックを生成します。人手評価で可読性・視覚的魅力・データ精度・アライメントの各指標で高評価を獲得。コーダー／フィードバックの 2 つの LLM モジュールが反復連携し、最終コードを洗練します。

![Figure by [Ghosh+ ACL'25]](https://arxiv.org/html/2507.20046v1/Final_diagram.png)
*Figure by [Ghosh+ ACL'25]*

これらの評価・フィードバック機構により、AI 生成デザインは技術的達成にとどまらず、人間の美学や実用ニーズにより深く適合していきます。

## LIPS における UGC 活用の未来：AI との共創

LIPS には毎日数千件のクチコミが蓄積され、ユーザーの「なりたい自分」を後押しする UGC の宝庫となっています。このデータ資産と最新の AI グラフィックデザイン技術の掛け合わせは、美容領域のデジタルマーケティングに新たな価値をもたらし得ます。

### LIPS のデータ資産と AI の可能性

従来は専門スキルと時間が必要だった広告制作も、LIPS の「クチコミから購入へ」という体験設計と、AI による需要分析を組み合わせれば様変わりし得ます。多様化するニーズに迅速に応え、パーソナライズされた魅力的なクリエイティブを大規模に生み出せる可能性があります。AI 駆動型デザインは物理プロトタイプを大幅に減らし、リードタイムを短縮する「売れるまで作らない」[^10]といった革新的なモデルも後押しします。EC においては特に重要です。

### LIPS での UGC 活用ロードマップ

UGC が豊富な LIPS では、次のロードマップが有効だと考えられます。

<!-- textlint-disable -->
:::message
いずれも**筆者の提案**であり、実装状況や方針を示すものではありません
:::
<!-- textlint-enable -->

まず、口コミ画像からの高精度な商品画像生成が挙げられます。PerFusion[^10] のようなフレームワークを活用することで、ユーザーのグループレベルの好みを捉えた AI 生成アイテムを生み出すことができ、LIPS ユーザーの興味を惹きつける商品画像を最適化することが期待されます。

次に多様な広告クリエイティブの自動生成に AI エージェントシステムを応用します。BannerAgency[^11] は広告主と協力してブランドアイデンティティとバナー目標を理解します。高精度で多用途かつ編集可能な広告バナーを Figma や SVG 形式で自動生成します。CreatiDesign[^28] は拡散モデルを用いて主要な視覚要素、二次的な視覚要素、テキスト要素といった複数の異種要素を正確に制御します。これらの技術によりコスメ企業のデザイナーや LIPS ユーザに高品質で多様な広告クリエイティブを効率的に制作できる支援ができるでしょう。

さらに LIPS に蓄積された膨大なデータを活用した魅力的な情報可視化も可能です。Infogen[^19] は文書から複雑な統計的インフォグラフィックを生成するフレームワークであり、人間による評価で高い可読性、視覚的魅力、データ精度を示すことが報告されています。これを活用して LIPS に蓄積されたユーザーの美容事情や「毛穴・角栓ケア」といったビューティートレンドを複雑な統計的インフォグラフィックとして自動生成できます。これによりブランド向けのマーケティング支援ツール「[LIPS for BRANDS](https://biz.lipscosme.com/lips_for_brands)」での情報提供を強化できます。

https://biz.lipscosme.com/lips_for_brands

また編集可能なデザイン資産の創出も重要な方向性です。LLM4SVG[^41]、SVGen[^42]、StarVector[^43] といったベクター画像生成技術を LIPS のデザインシステムと連携させます。これにより拡大縮小しても劣化しないロゴ、アイコン、グラフなどの編集可能なデザイン要素を効率的に生成・管理できるようになります。ベクター画像はロスレススケーリングが可能であり、LLM との統合に適しています。

最後に人間と AI の協調デザインの促進です。Design‑o‑meter[^46] や Uni-Layout[^30] のような品質評価・フィードバックシステムを導入します。これにより LIPS ユーザーやコスメ専門家の知見を AI に組み込み、AppBrew の企業バリューである「USER FIRST」を体現します。同時に「LEAN」なプロセスで迅速に学び「OPEN」な姿勢でチーム強化を実現できます。

## まとめと展望

本記事では、AI グラフィックデザインの最新研究を概観し、LIPS の豊富な UGC を源泉に、商品画像や広告クリエイティブへどう応用できるかを外部の視点から考察しました。レイアウト生成、ラスタ／ベクタ画像生成、AI エージェントによる自動化、そして品質評価と人間フィードバックという多角的アプローチが、デザインプロセスを大きく変えうることを示しました。

AI グラフィックデザインは、個別サブタスクから全体最適へと進化しています。LLM とマルチモーダルの活用は、ローカルな視覚特徴とグローバルなデザイン意図の溝を埋めます。さらに、AIGD ではピクセルからベクタへのシフトにも注目が集まっています。ロスレススケーリングや編集性に優れ、LLM と統合しやすいためです。

AI との共創により、LIPS はよりパーソナライズされ、視覚的に魅力的で心に響くコンテンツを提供できるようになる、その可能性を外部の立場から展望しました。

<!-- textlint-disable -->
:::message
AppBrew の取り組みに関心のある方は、以下の採用情報をご覧ください！
:::
<!-- textlint-enable -->

https://herp.careers/v1/appbrew

<!-- textlint-disable -->

[^1]: AppBrew が取り組むアルムナイ施策：第２回同窓会開催レポート！｜AppBrew @appbrew_inc [https://note.com/appbrew/n/n3b2b9b83041f](https://note.com/appbrew/n/n3b2b9b83041f)

[^2]: お声がけ頂いた AppBrew のみなさん、ありがとうございます。この場をお借りしてお礼申し上げます。

[^3]: [前回寄稿したとき](https://zenn.dev/appbrew/articles/lips-ad-creative-research) は、はてなブログへ公開していただきましたが、今回からは Zenn で公開していただきました。> AppBrew のテックブログをはてなブログから Zenn にお引越ししました！ [https://zenn.dev/appbrew/articles/tech-blog-migration](https://zenn.dev/appbrew/articles/tech-blog-migration)

[^4]: What is User Generated Content (UGC)? | Webopedia [https://www.webopedia.com/definitions/ugc/](https://www.webopedia.com/definitions/ugc/)

[^5]: AIS Electronic Library (AISeL) - ICIS 2024 Proceedings: The Impact of Generative AI on Advertising Effectiveness [https://aisel.aisnet.org/icis2024/digital_comm/digital_comm/](https://aisel.aisnet.org/icis2024/digital_comm/digital_comm/)

[^6]: [2503.18641] From Fragment to One Piece: A Survey on AI-Driven Graphic Design [https://arxiv.org/abs/2503.18641](https://arxiv.org/abs/2503.18641)

[^7]: DesignScape | Proceedings of the 33rd Annual ACM Conference on Human Factors in Computing Systems [https://dl.acm.org/doi/abs/10.1145/2702123.2702149](https://dl.acm.org/doi/abs/10.1145/2702123.2702149)

[^8]: [2507.05601] Rethinking Layered Graphic Design Generation with a Top-Down Approach [https://arxiv.org/abs/2507.05601](https://arxiv.org/abs/2507.05601)

[^9]: [2506.10741] PosterCraft: Rethinking High-Quality Aesthetic Poster Generation in a Unified Framework [https://arxiv.org/abs/2506.10741](https://arxiv.org/abs/2506.10741)

[^10]: [2503.22182] Sell It Before You Make It: Revolutionizing E-Commerce with Personalized AI-Generated Items [https://arxiv.org/abs/2503.22182](https://arxiv.org/abs/2503.22182)

[^11]: [2503.11060] BannerAgency: Advertising Banner Design with Multimodal LLM Agents [https://arxiv.org/abs/2503.11060](https://arxiv.org/abs/2503.11060)

[^12]: [2505.07843] PosterO: Structuring Layout Trees to Enable Language Models in Generalized Content-Aware Layout Generation [https://arxiv.org/abs/2505.07843](https://arxiv.org/abs/2505.07843)

[^13]: [2504.06632] PosterMaker: Towards High-Quality Product Poster Generation with Accurate Text Rendering [https://arxiv.org/abs/2504.06632](https://arxiv.org/abs/2504.06632)

[^14]: [2303.08605] RICO: Regularizing the Unobservable for Indoor Compositional Reconstruction [https://arxiv.org/abs/2303.08605](https://arxiv.org/abs/2303.08605)

[^15]: [2403.03163] Design2Code: Benchmarking Multimodal Code Generation for Automated Front-End Engineering [https://arxiv.org/abs/2403.03163](https://arxiv.org/abs/2403.03163)

[^16]: [2409.16689] Layout-Corrector: Alleviating Layout Sticking Phenomenon in Discrete Diffusion Model [https://arxiv.org/abs/2409.16689](https://arxiv.org/abs/2409.16689)

[^17]: [2404.14368] Graphic Design with Large Multimodal Model [https://arxiv.org/abs/2404.14368](https://arxiv.org/abs/2404.14368)

[^18]: [2403.09093] Desigen: A Pipeline for Controllable Design Template Generation [https://arxiv.org/abs/2403.09093](https://arxiv.org/abs/2403.09093)

[^19]: [2507.20046] Infogen: Generating Complex Statistical Infographics from Documents [https://arxiv.org/abs/2507.20046](https://arxiv.org/abs/2507.20046)

[^20]: [2503.20672] BizGen: Advancing Article-level Visual Text Rendering for Infographics Generation [https://arxiv.org/abs/2503.20672](https://arxiv.org/abs/2503.20672)

[^21]: Integrating LLM, VLM, and Text-to-Image Models for Enhanced Information Graphics: A Methodology for Accurate and Visually Engaging Visualizations | IJCAI [https://www.ijcai.org/proceedings/2024/995](https://www.ijcai.org/proceedings/2024/995)

[^22]: [2101.11796] DOC2PPT: Automatic Presentation Slides Generation from Scientific Documents [https://arxiv.org/abs/2101.11796](https://arxiv.org/abs/2101.11796)

[^23]: [2501.03936] PPTAgent: Generating and Evaluating Presentations Beyond Text-to-Slides [https://arxiv.org/abs/2501.03936](https://arxiv.org/abs/2501.03936)

[^24]: [2308.12700] A Parse-Then-Place Approach for Generating Graphic Layouts from Textual Descriptions [https://arxiv.org/abs/2308.12700](https://arxiv.org/abs/2308.12700)

[^25]: Content-aware generative modeling of graphic design layouts | ACM Transactions on Graphics [https://dl.acm.org/doi/10.1145/3306346.3322971](https://dl.acm.org/doi/10.1145/3306346.3322971)

[^26]: [2204.02701] Aesthetic Text Logo Synthesis via Content-aware Layout Inferring [https://arxiv.org/abs/2204.02701](https://arxiv.org/abs/2204.02701)

[^27]: [2411.11435] GLDesigner: Leveraging Multi-Modal LLMs as Designer for Enhanced Aesthetic Text Glyph Layouts [https://arxiv.org/abs/2411.11435](https://arxiv.org/abs/2411.11435)

[^28]: [2505.19114] CreatiDesign: A Unified Multi-Conditional Diffusion Transformer for Creative Graphic Design [https://arxiv.org/abs/2505.19114](https://arxiv.org/abs/2505.19114)

[^29]: Intelligent layout generation based on deep generative models: A comprehensive survey - ScienceDirect [https://www.sciencedirect.com/science/article/abs/pii/S1566253523002567](https://www.sciencedirect.com/science/article/abs/pii/S1566253523002567)

[^30]: [2508.02374] Uni-Layout: Integrating Human Feedback in Unified Layout Generation and Evaluation [https://arxiv.org/abs/2508.02374](https://arxiv.org/abs/2508.02374)

[^31]: [2201.11903] Chain-of-Thought Prompting Elicits Reasoning in Large Language Models [https://arxiv.org/abs/2201.11903](https://arxiv.org/abs/2201.11903)

[^32]: [2502.14005] Smaller But Better: Unifying Layout Generation with Smaller Large Language Models [https://arxiv.org/abs/2502.14005](https://arxiv.org/abs/2502.14005)

[^33]: [2412.03859] CreatiLayout: Siamese Multimodal Diffusion Transformer for Creative Layout-to-Image Generation [https://arxiv.org/abs/2412.03859](https://arxiv.org/abs/2412.03859)

[^34]: [2112.10752] High-Resolution Image Synthesis with Latent Diffusion Models [https://arxiv.org/abs/2112.10752](https://arxiv.org/abs/2112.10752)

[^35]: [2307.01952] SDXL: Improving Latent Diffusion Models for High-Resolution Image Synthesis [https://arxiv.org/abs/2307.01952](https://arxiv.org/abs/2307.01952)

[^36]: [2403.03206] Scaling Rectified Flow Transformers for High-Resolution Image Synthesis [https://arxiv.org/abs/2403.03206](https://arxiv.org/abs/2403.03206)

[^37]: [2403.12015] Fast High-Resolution Image Synthesis with Latent Adversarial Diffusion Distillation [https://arxiv.org/abs/2403.12015](https://arxiv.org/abs/2403.12015)

[^38]: [2501.14316] PAID: A Framework of Product-Centric Advertising Image Design [https://arxiv.org/abs/2501.14316](https://arxiv.org/abs/2501.14316)

[^39]: [2507.04218] DreamPoster: A Unified Framework for Image-Conditioned Generative Poster Design [https://arxiv.org/abs/2507.04218](https://arxiv.org/abs/2507.04218)

[^40]: [2411.15580] TKG-DM: Training-free Chroma Key Content Generation Diffusion Model [https://arxiv.org/abs/2411.15580](https://arxiv.org/abs/2411.15580)

[^41]: [2412.11102] Empowering LLMs to Understand and Generate Complex Vector Graphics [https://arxiv.org/abs/2412.11102](https://arxiv.org/abs/2412.11102)

[^42]: [2508.09168] SVGen: Interpretable Vector Graphics Generation with Large Language Models [https://www.arxiv.org/abs/2508.09168](https://arxiv.org/abs/2508.09168)

[^43]: [2312.11556] StarVector: Generating Scalable Vector Graphics Code from Images and Text [https://arxiv.org/abs/2312.11556](https://arxiv.org/abs/2312.11556)

[^44]: [2506.10890] CreatiPoster: Towards Editable and Controllable Multi-Layer Graphic Design Generation [https://arxiv.org/abs/2506.10890](https://arxiv.org/abs/2506.10890)

[^45]: [2210.03629] ReAct: Synergizing Reasoning and Acting in Language Models [https://arxiv.org/abs/2210.03629](https://arxiv.org/abs/2210.03629)

[^46]: [2411.14959] Design-o-meter: Towards Evaluating and Refining Graphic Designs [https://arxiv.org/abs/2411.14959](https://arxiv.org/abs/2411.14959)

[^47]: [2408.00418] Towards Reliable Advertising Image Generation Using Human Feedback [https://arxiv.org/abs/2408.00418](https://arxiv.org/abs/2408.00418)

[^48]: [2503.00591] AesthetiQ: Enhancing Graphic Layout Design via Aesthetic-Aware Preference Alignment of Multi-modal Large Language Models [https://arxiv.org/abs/2503.00591](https://arxiv.org/abs/2503.00591)

<!-- textlint-enable -->
