---
title: "LLM 事後学習 (SFT / RLHF / DPO / RLVR / GRPO / 自己蒸留) を教師信号から眺める"
emoji: "🧠"
type: "tech"
topics: ["llm", "事後学習", "rlhf", "dpo", "強化学習"]
published: true
published_at: 2026-06-27
---

こんにちは [@shunk031](https://twitter.com/shunk031) です。最近は、GPT や Claude の API を呼び出すだけではない AI エージェントの構築に興味があります。[^api_wrapper] 本記事では、既存の大規模言語モデル (Large Language Model; LLM) をどう事後学習 (post-training) すれば、ツール利用、探索、検証、修正を挟みながらタスクを解けるようになるのかを整理します。以下に、LLM エージェントと Agentic RL について以前まとめたスライドも載せておきます。

https://speakerdeck.com/shunk031/large-language-model-agent-a-survey-on-methodology-applications-and-challenges

https://speakerdeck.com/shunk031/the-landscape-of-agentic-reinforcement-learning-for-llms-a-survey

事後学習の手法名は増えていますが、名前だけを追っても関係が見えにくいです。模範応答、人間評価、比較データ、検証できる正誤、生成途中の教師分布。どの情報を学習に使うかで、モデルの動かし方が変わります。

教師信号が変わると、モデルの更新のされ方も変わります。Shen ら[^opd_geometry] の比較では、OPD は SFT と RLVR の中間というより、別の軌跡をたどる更新として描かれています。

![SFT / OPD / RLVR の更新幾何を比較した模式図](/images/llm-post-training-overview/opd-geometry-sft-rlvr.png)
*SFT / OPD / RLVR の更新軌跡の比較。Shen et al. の Fig. 1 より。[^opd_geometry]*

## はじめに

事後学習は、事前学習済みモデルを、人間やタスクに合わせて使いやすくする段階です[^instructgpt][^ziegler]。事前学習では、大量のテキストから次のトークンを予測する力を得ます。一方で、そのままでは指示に素直に従うとは限りません。安全性、形式、推論の進め方、好ましい応答の癖も別途整える必要があります。

この段階でモデルに渡せる手がかりはいくつかあります。人間が書いた模範応答、どちらの応答が好ましいかという比較、応答全体への報酬、テスト結果や最終答えの正誤、教師モデルの出力分布などです。どれを使うかで、必要なデータ、訓練の構成、得意なタスクが変わります。

模範応答だけなら実装は単純ですが、モデルが自分で崩れた文脈に入ったときの直し方までは教えにくいです。人間評価を報酬にすると好ましさを入れられますが、報酬モデルや価値推定器まで持つと訓練の構成は重くなります。比較データや検証可能な報酬を用意できる場合は、この重さを避けたり、評価を自動化したりする別の入口ができます。

AI エージェント的なタスクでは、最終的な成功や失敗だけでは足りない場面も多いです。ツールを呼び、結果を見て、方針を直す途中で、どの文脈のどの出力を直すべきかを学びたくなります。そのため、応答全体への粗い信号だけでなく、生成中の文脈に沿った細かい信号や、追加情報を見た自分を通常時へ移す方法まで扱います。

## LLM 事後学習の全体像

まずは、以降で扱う手法を教師信号とデータ形式で並べます。モデルへ何を渡して、何を増やしたいのかを先にまとめてみました。

| 手法 | 主な教師信号 | 何を学ぶか | 典型的なデータ |
| --- | --- | --- | --- |
| SFT[^instructgpt] | 模範応答 | 正解らしい応答をまねる | 入力と模範応答 |
| RLHF[^christiano] / PPO[^ppo] | 報酬モデル | 高く評価される応答を増やす | 応答のランキング、報酬 |
| DPO[^dpo] | 選好ペア | 好ましい応答を直接増やす | 勝ち応答と負け応答 |
| RLVR[^rlvr] / GRPO[^deepseekmath] | 検証可能な報酬 | 正解する応答を相対評価で増やす | 問題、複数応答、正誤 |
| OPD[^opd_gkd] | 教師モデルの分布 | 自分の生成軌跡上で教師をまねる | 生徒生成、教師分布 |
| OPSD[^opsd] | 追加情報つきの自己分布 | 追加情報を使った自分を通常時へ蒸留する | 問題、検証済み解法など |
| SDPO 区間型[^segment_sdpo] / SDPO 自己蒸留型[^self_distillation_sdpo] | 追加情報つきの自己分布、または区間選好 | 細かい単位で方策を直す | フィードバック、区間、複数ターン |

SFT と DPO は静的なデータから学ぶ色が強く、GRPO や OPD 系は現在のモデルが出した応答を学習に戻します。ここから先は式が増えるので、先に記号をそろえておきます。

固定データで学ぶ SFT、報酬で学ぶ RLVR、オンポリシー蒸留としての OPD。この関係は次の記事でも整理されています。

https://nrehiew.github.io/blog/sft_rl_opd/

## 共通の記法

以降の章では、入力、応答、方策、報酬、選好ペアが繰り返し出てきます。手法ごとの差分を追いやすくするため、先に記号をそろえます。

| 記号 | 意味 |
| --- | --- |
| $x$ | 入力、質問、問題文 |
| $y$ | モデルの応答 |
| $y = (y_1, y_2, \dots, y_T)$ | 応答をトークンに分けて並べたもの |
| $y_{<t} = (y_1, \dots, y_{t-1})$ | $t$ 番目より前までの出力 |
| $\pi_\theta(y \mid x)$ | 学習対象の方策 |
| $\pi_{\mathrm{ref}}(y \mid x)$ | 基準モデル |
| $r(x, y)$ | 応答 $y$ に対する報酬 |
| $y_w$ | 選好ペアの勝ち応答 |
| $y_l$ | 選好ペアの負け応答 |

$\pi_\theta$ は、入力 $x$ に対して応答 $y$ を出す確率分布です。強化学習の言葉では、この確率分布を方策と呼びます。LLM では、ここまでの文脈から次に出すトークンを選ぶ確率分布として考えると分かりやすいです。応答全体の確率は、各時点の出力確率の積として分解できます。

$$
\pi_\theta(y \mid x)
=
\prod_{t=1}^{T}
\pi_\theta(y_t \mid x, y_{<t})
$$

## 模範応答から学ぶ

模範応答そのものを教師信号にする系列です。

教師ありファインチューニング (Supervised Fine-Tuning; SFT)[^instructgpt] は、入力 $x$ と模範応答 $y^\ast$ の組を使って、模範応答の尤度を上げます。目的関数は、次の負の対数尤度です。

<!-- textlint-disable -->

$$
\mathcal{L}_{\mathrm{SFT}}(\theta)
= - \mathbb{E}_{(x, y^\ast)}
\left(
\sum_{t=1}^{T}
\log
\pi_\theta(y_t^\ast \mid x, y_{<t}^\ast)
\right)
$$

<!-- textlint-enable -->

これは「模範応答を、どれだけ高い確率で再現できるか」を見ています。つまり、$\pi_\theta(y^\ast \mid x)$ を大きくする学習です。

長所は単純さです。よい模範応答があれば、指示形式、文体、出力フォーマット、基本的なタスク解法を一気に教えられます。InstructGPT[^instructgpt] でも、まず人が書いた模範応答で教師ありファインチューニングし、その後に人間の比較を使っています。

弱点は、訓練時と生成時のずれです。訓練時は常に模範応答の途中までを見て、次に来るべき出力を予測します。しかし生成時は、自分が直前までに出した内容を条件に続きを出します。一度変な方向に進むと、訓練時にあまり見ていない文脈へ入ってしまいます。

直感的には、訓練時は模範応答の途中まで $y^\ast_{<t}$ を条件にして、次のトークン $y^\ast_t$ を予測します。生成時は、モデル自身がここまでに出した応答を条件にして、次のトークンを出します。

SFT は出力の各位置に細かい信号を与えられます。一方で、その信号は基本的に模範応答上の文脈に限られます。

## 人間評価を報酬にする

応答に点数をつけ、その点が高くなるように方策を更新する系列です。ここでは、人間のフィードバックからの強化学習 (Reinforcement Learning from Human Feedback; RLHF)[^christiano] と PPO (Proximal Policy Optimization)[^ppo] を扱います。

強化学習では、モデルが自分で応答を生成し、その応答に点数をつけます。その点数が高くなるようにモデルを更新します[^christiano]。もっとも単純には、期待報酬 $J(\theta)$ を最大化します。

$$
J(\theta)
=
\mathbb{E}_{x, y\sim\pi_\theta}
\left(
r(x, y)
\right)
$$

つまり、「良い応答を出す確率を上げる」という考え方です。ただし、言語モデルを報酬だけで動かすと、報酬を稼ぐために変な応答を出すことがあります。そこで、元のモデルから離れすぎないように KL (Kullback-Leibler) 正則化を入れることが多いです。

$$
\max_\theta
\mathbb{E}_{y \sim \pi_\theta(\cdot \mid x)}
\left(
r(x, y)
- \beta
\mathrm{KL}
\left(
\pi_\theta(\cdot \mid x)
\| \pi_{\mathrm{ref}}(\cdot \mid x)
\right)
\right)
$$

後半の KL 項は、現在のモデルが基準モデルからどれくらい離れたかを表します。$\beta$ は、その離れ具合をどれくらい強く抑えるかを決める係数です。

RLHF では、この報酬 $r(x, y)$ を人間の好みから作ります[^ziegler][^stiennon]。手順は 3 段階です。

1. SFT[^instructgpt] で初期モデルを作る。
2. 人間の比較データから報酬モデルを作る。
3. PPO[^ppo] などの強化学習でモデルを更新する。

同じ問いに対する複数の応答を人間に比べてもらい、勝ち応答 $y_w$ と負け応答 $y_l$ の組を作ります。報酬モデル $r_\phi(x, y)$ は、勝ち応答に高い点をつけるように学習します。

$$
P(y_w \succ y_l \mid x)
=
\sigma
\left(
r_\phi(x, y_w) - r_\phi(x, y_l)
\right)
$$

ここで $\sigma$ は、報酬差を勝ち応答の確率として読める値に写す活性化関数です。

報酬モデルの損失関数は、たとえば次のように書けます。

$$
\mathcal{L}_{\mathrm{RM}}(\phi)
=
- \mathbb{E}_{(x, y_w, y_l)}
\left(
\log
\sigma
\left(
r_\phi(x, y_w) - r_\phi(x, y_l)
\right)
\right)
$$

この式は、$r_\phi(x, y_w) > r_\phi(x, y_l)$ となるように報酬モデルを学習している、と読めます。

PPO は、この方策更新を安定させるための代表的な手法です。古い方策 $\pi_{\mathrm{old}}$ と新しく更新したい方策 $\pi_\theta$ の確率比を、次のように置きます。

$$
\rho_t(\theta)
=
\frac{
\pi_\theta(y_t \mid x, y_{<t})
}{
\pi_{\mathrm{old}}(y_t \mid x, y_{<t})
}
$$

この比が大きすぎると、モデルは急に変わりすぎます。PPO では、この比を一定範囲で切ります。これにより、更新を「少しずつ変える」形にします。利得を $A_t$、クリップ幅を $\epsilon$ とします。このとき、よく見る目的関数は次の形です。

<!-- textlint-disable -->

$$
\mathcal{L}_{\mathrm{PPO}}(\theta)
= \mathbb{E}_t
\left(
\min
\left(
\rho_t(\theta) A_t,
\mathrm{clip}(\rho_t(\theta), 1 - \epsilon, 1 + \epsilon) A_t
\right)
\right)
$$

<!-- textlint-enable -->

ここで $A_t$ は、その行動が平均よりどれくらい良かったかを表す値です。利得差、または有利度と考えるとよいです。PPO の直感は、良かった出力の確率は上げ、悪かった出力の確率は下げる。ただし、一度に変えすぎない、というものです。

RLHF / PPO の強みは、応答の良し悪しをスカラー報酬として扱える点です。一方で、LLM では重くなりがちです。応答を生成する方策モデルのほかに、基準モデル、報酬モデル、価値推定器を持つ構成になることが多いからです。

こうした訓練構成の重さを避けたい、という流れから DPO や GRPO などが注目されました。

## 比較データから学ぶ

選好に基づく調整では、勝ち応答と負け応答の比較を教師信号にします。

### DPO

直接選好最適化 (Direct Preference Optimization; DPO)[^dpo] は、報酬モデルを明示的に作らず、PPO も使わずに、比較データから直接モデルを調整する方法です。DPO の出発点は、RLHF でよく使う KL 正則化つきの目的関数です。

$$
\max_\pi
\mathbb{E}_{y\sim\pi}
\left(
r(x, y)
-
\beta
\log
\frac{\pi(y \mid x)}
{\pi_{\mathrm{ref}}(y \mid x)}
\right)
$$

この最適解は、次の形になることが知られています。

$$
\pi^\star(y \mid x)
=
\frac{1}{Z(x)}
\pi_{\mathrm{ref}}(y \mid x)
\exp
\left(
\frac{1}{\beta}r(x, y)
\right)
$$

ここで $Z(x)$ は正規化定数です。この式を変形すると、報酬は次のように書けます。

$$
r(x, y)
=
\beta
\log
\frac{\pi^\star(y \mid x)}
{\pi_{\mathrm{ref}}(y \mid x)}
+
\beta \log Z(x)
$$

DPO は、この関係を使って、明示的な報酬モデル $r_\phi(x, y)$ を学習せずに済ませます。勝ち応答 $y_w$ と負け応答 $y_l$ があるとき、DPO の損失は次のように書けます。

<!-- textlint-disable ja-technical-writing/sentence-length -->

$$
\mathcal{L}_{\mathrm{DPO}}(\theta)
= - \mathbb{E}_{(x, y_w, y_l)}
\left(
\log \sigma
\left(
\beta
\log
\frac{\pi_\theta(y_w \mid x)}{\pi_{\mathrm{ref}}(y_w \mid x)}
- \beta
\log
\frac{\pi_\theta(y_l \mid x)}{\pi_{\mathrm{ref}}(y_l \mid x)}
\right)
\right)
$$

<!-- textlint-enable ja-technical-writing/sentence-length -->

直感的には、基準モデルに比べて勝ち応答の確率を上げ、負け応答の確率を下げます。報酬モデルを別に持たず、訓練中のサンプリングも不要なので、PPO より扱いやすいです。

より細かく見ると、勝ち応答 $y_w$ では次の量が大きくなるように更新します。

$$
\log
\frac{\pi_\theta(y_w \mid x)}
{\pi_{\mathrm{ref}}(y_w \mid x)}
$$

負け応答 $y_l$ では、対応する量が小さくなるように更新します。

$$
\log
\frac{\pi_\theta(y_l \mid x)}
{\pi_{\mathrm{ref}}(y_l \mid x)}
$$

つまり DPO は、「基準モデルと比べて、好ましい応答を出しやすくする」「好ましくない応答を出しにくくする」方法です。

弱点は、既存の比較データに強く依存することです。比較ペアが粗い場合や、生成中のどこが悪かったのかを知りたい場合は、応答全体への信号だけでは足りません。長い推論では、途中の一手だけが原因で失敗することもあります。

### DPO 以降の関連手法

DPO 以降は、比較データをどう使うか、基準モデルをどう扱うか、という方向で多くの派生が出ています。また、好ましい応答と好ましくない応答の差をどう作るかも重要です。

Identity Preference Optimization (IPO)[^ipo] は、選好学習をより一般的な理論枠組みから見直します。そして、DPO の近似や失敗しやすい条件を議論します。DPO では、次の差を大きくし続けやすいという見方ができます。

$$
\Delta_\theta
=
\log
\frac{\pi_\theta(y_w \mid x)}
{\pi_{\mathrm{ref}}(y_w \mid x)}
-
\log
\frac{\pi_\theta(y_l \mid x)}
{\pi_{\mathrm{ref}}(y_l \mid x)}
$$

IPO では、この差を無限に大きくするのではなく、ほどよい目標値に近づけます。代表的には、次のような二乗誤差として書けます。

$$
\mathcal{L}_{\mathrm{IPO}}
=
\mathbb{E}
\left(
\left(
\Delta_\theta
-
\frac{1}{2\beta}
\right)^2
\right)
$$

オッズ比選好最適化 (Odds Ratio Preference Optimization; ORPO)[^orpo] は、SFT と選好最適化を分けません。好ましい応答を学びながら、好ましくない応答のオッズを下げます。基本形は、次のように SFT 的な負の対数尤度と選好項を足した形です。

$$
\mathcal{L}_{\mathrm{ORPO}}
=
\mathcal{L}_{\mathrm{NLL}}
+
\lambda
\mathcal{L}_{\mathrm{pref}}
$$

DPO は基準モデルを使いますが、ORPO はそれを省くのが特徴です。

単純選好最適化 (Simple Preference Optimization; SimPO)[^simpo] は、基準モデルを使いません。応答長で正規化した平均対数確率を暗黙の報酬として使います。好ましい応答の平均対数確率が、好ましくない応答を余白 $\gamma$ だけ上回るようにします。

$$
\mathcal{L}_{\mathrm{SimPO}}
=
- \mathbb{E}
\log
\sigma
\left(
\beta
\left(
\frac{1}{|y_w|}
\log
\pi_\theta(y_w \mid x)
-
\frac{1}{|y_l|}
\log
\pi_\theta(y_l \mid x)
\right)
-
\gamma
\right)
$$

Kahneman-Tversky 最適化 (Kahneman-Tversky Optimization; KTO)[^kto] は、ペア比較ではなく、望ましいかどうかの二値信号から学ぶ方向です。比較データを作るのは高コストです。KTO は、「この応答は望ましい」「この応答は望ましくない」という単独評価でも学びやすくするための手法です。人間は損失に敏感で利益には鈍感、という行動経済学の考え方を目的関数に入れます。

これらはすべて、PPO 型の重い強化学習ループを避けつつ、SFT よりも「好ましさ」を直接入れたいという流れにあります。

### 区間単位の直接選好最適化

SDPO という名前は複数の意味で使われています。その 1 つが、区間単位の直接選好最適化 (Segment-Level Direct Preference Optimization; SDPO)[^segment_sdpo] です。長い会話では、応答全体をまとめて「良い」「悪い」としても、どこが良かったのか、どこが悪かったのかが分かりにくいです。そこで、重要な区間だけを取り出します。

文脈を $c$、好ましい区間を $g_w$、好ましくない区間を $g_l$ とします。このとき、区間単位の DPO は次のように書けます。

<!-- textlint-disable -->

$$
\mathcal{L}_{\mathrm{SDPO\text{-}seg}}
=
- \mathbb{E}
\log
\sigma
\left(
\beta
\left(
\log
\frac{\pi_\theta(g_w \mid c)}
{\pi_{\mathrm{ref}}(g_w \mid c)}
-
\log
\frac{\pi_\theta(g_l \mid c)}
{\pi_{\mathrm{ref}}(g_l \mid c)}
\right)
\right)
$$

<!-- textlint-enable -->

標準 DPO と形はほぼ同じです。違いは、応答全体ではなく、会話や推論の一部分を単位にしている点です。長いやり取り、対話エージェント、複数手順の推論などで有効です。

## 検証可能な報酬から学ぶ

数学やコードでは、最終答えやテスト結果を報酬にしやすいです。この章では、自動検証できる報酬を使う枠組みと、その方策更新の 1 つを扱います。

検証可能な報酬による強化学習 (Reinforcement Learning with Verifiable Rewards; RLVR)[^rlvr] は、数学、コード、ツール利用のように、最終結果を自動検証できるタスクで使いやすい枠組みです。人間のランキングではなく、正解判定、単体テスト、実行結果などを報酬として使います。

GRPO (Group Relative Policy Optimization)[^deepseekmath] は、同じ入力 $x$ に対して複数の応答を生成し、そのグループ内で相対的な利得を作ります。DeepSeekMath[^deepseekmath] では、GRPO を PPO の変種として導入し、価値推定器を使わずに数学推論を改善しています。その後、DeepSeek-R1[^deepseek_r1] でも GRPO が使われました。この結果、推論モデル向けの強化学習手法として広く知られるようになりました。

同じ問い $x$ に対して、$G$ 個の応答を生成します。

$$
y_1, y_2, \dots, y_G
\sim
\pi_{\mathrm{old}}(\cdot \mid x)
$$

それぞれに報酬を与えます。

$$
r_1, r_2, \dots, r_G
$$

そして、同じ問いの中で平均と標準偏差を使って正規化します。

<!-- textlint-disable -->

$$
A_i =
\frac{
r_i - \mathrm{mean}(r_1, \dots, r_G)
}{
\mathrm{std}(r_1, \dots, r_G) + \epsilon
}
$$

<!-- textlint-enable -->

この $A_i$ が、その応答が同じ問いの中でどれくらい良かったかを表します。目的関数は PPO に似ています。

<!-- textlint-disable ja-technical-writing/sentence-length -->

$$
\mathcal{L}_{\mathrm{GRPO}}
=
\mathbb{E}
\left(
\frac{1}{G}
\sum_{i=1}^{G}
\frac{1}{|y_i|}
\sum_{t=1}^{|y_i|}
\min
\left(
\rho_{i,t} A_i,
\mathrm{clip}(\rho_{i,t}, 1-\epsilon, 1+\epsilon) A_i
\right)
-
\beta
D_{\mathrm{KL}}
\left(
\pi_\theta
\| \pi_{\mathrm{ref}}
\right)
\right)
$$

<!-- textlint-enable ja-technical-writing/sentence-length -->

ここで、$\rho_{i,t}$ は新旧方策の確率比です。

<!-- textlint-disable -->

$$
\rho_{i,t}
=
\frac{
\pi_\theta(y_{i,t} \mid x, y_{i,<t})
}{
\pi_{\mathrm{old}}(y_{i,t} \mid x, y_{i,<t})
}
$$

<!-- textlint-enable -->

PPO[^ppo] は価値推定器を使って良さを見積もります。GRPO[^deepseekmath] はそこを省き、同じ問いに対する複数応答の相対比較から良さを見ます。

GRPO は、答えが正しいかどうかを自動判定しやすい課題と相性がよいです。たとえば、数学の最終答えが一致するか、コードがテストを通るか、という課題です。一方で、この報酬は疎になりやすいです。最終結果に点はつけられても、出力のどの位置やどの推論ステップが効いたのかまでは分かりにくいからです。

RLVR で生成中の修正やロールアウトをどう扱うかは、次の記事でも詳しく整理されています。

https://tech-blog.abeja.asia/entry/llm-rl-rollout-correction-202606

## 生成中の文脈で蒸留する

蒸留に基づく調整では、教師モデルや追加情報を見た自分の分布を教師信号にします。この章では、生成中の文脈で教師分布を使う方法と、追加情報を使った自己蒸留を同じ流れで扱います。

検証可能な報酬は、応答全体を押し上げる信号になりやすいです。一方で、生成途中の各位置で教師分布を見れば、現在のモデルが実際に通った文脈上で、より密な教師信号を与えられます。

### OPD

知識蒸留[^distillation] では、教師モデルの出力分布を生徒モデルにまねさせます。LLM では、教師モデルが作った固定データを生徒モデルに学ばせる形もよく使われます。この場合、生徒が実際に生成しやすい文脈とは別の文脈で学ぶため、オフポリシー蒸留と見ることができます。これに対してオンポリシー蒸留 (On-Policy Distillation; OPD)[^opd_gkd] は、生徒モデル自身が現在の方策で生成した応答を使います。ここでのオンポリシーは、「現在のモデルが実際に生成する分布に沿う」という意味です。

$$
y \sim \pi_\theta(\cdot \mid x)
$$

生徒が自分で応答 $y$ を生成したあと、その途中文脈 $x, y_{<t}$ に対して教師が次に何を出しやすいかを見ます。学習では、教師分布と生徒分布の KL 距離を最小化します。

<!-- textlint-disable -->

$$
\mathcal{L}_{\mathrm{OPD}}(\theta)
=
\mathbb{E}_{y \sim \pi_\theta(\cdot \mid x)}
\left(
\sum_t
D_{\mathrm{KL}}
\left(
\pi_T(\cdot \mid x, y_{<t})
\| \pi_\theta(\cdot \mid x, y_{<t})
\right)
\right)
$$

<!-- textlint-enable -->

ここで $\pi_T$ は教師モデルです。OPD は生徒自身の文脈上で教えるため、訓練時と生成時のずれを減らす方向に働きます。2026 年には OPD のサーベイも出ており、長い推論やモデル圧縮の文脈で整理されています[^opd_survey]。

SFT / 強化学習 / OPD は、使う文脈と教師信号が違います。

| 手法 | 使う文脈 | 教師信号 |
| --- | --- | --- |
| SFT[^instructgpt] | 人間や教師が書いた応答の途中文脈 | 各位置の正解 |
| 強化学習 | 現在のモデルが生成した応答 | 応答全体への点数 |
| OPD[^opd_gkd] | 現在のモデルが生成した応答の途中文脈 | 各位置の教師分布 |

SFT は細かい信号を与えますが、文脈は固定されています。強化学習は現在のモデルに沿いますが、報酬は粗いことが多いです。OPD は、現在のモデルが実際に通った文脈上で、各位置の教師分布を見る方法です。

### OPSD

オンポリシー自己蒸留 (On-Policy Self-Distillation; OPSD)[^opsd] は、OPD の教師を外部モデルではなく自分自身にしたものとして読むと分かりやすいです。ただし、完全に同じ条件で自分をまねても意味が薄いため、教師側には追加情報を与えます。たとえば、正解、検証結果、推論の手がかり、途中証明のような情報です。

<!-- textlint-disable -->

$$
z = \text{正解、検証結果、推論の手がかり、途中証明}
$$

<!-- textlint-enable -->

教師側は追加情報 $z$ を見られますが、生徒側は見られません。そのうえで、生徒が実際に生成した文脈上の出力分布を近づけます[^opsd]。つまり、訓練時だけ「答えや手がかりを見た自分」を作り、その分布を通常の自分へ移します。

<!-- textlint-disable -->

$$
\mathcal{L}_{\mathrm{OPSD}}(\theta)
=
\mathbb{E}_{x, z, y \sim \pi_\theta}
\left(
\sum_t
D_{\mathrm{KL}}
\left(
\mathrm{sg}
\left[
\pi_{\bar{\theta}}(\cdot \mid x, z, y_{<t})
\right]
\| \pi_\theta(\cdot \mid x, y_{<t})
\right)
\right)
$$

<!-- textlint-enable -->

ここで $\mathrm{sg}$ は勾配を止める操作です。つまり、教師側は更新せず、生徒側だけを教師に近づけます。直感的には、「答えや手がかりを見た自分」が「答えや手がかりを見ていない自分」に教える方法です。数学やコードのように、「解いた後なら、どこが良かったか分かる」課題と相性がよいです。

OPSD や自己蒸留まわりの日本語での整理としては、次の記事も参考になります。

https://note.com/kei_disign/n/nd60818508c1a

### 自己蒸留による方策最適化

自己蒸留による方策最適化 (Self-Distillation Policy Optimization; SDPO)[^self_distillation_sdpo] は、実行結果、判定理由、評価文などを追加情報として使い、自己蒸留で密な学習信号へ変換する方法です。たとえばコード生成では、モデルがコードを書きます。そのコードを実行すると、実行エラーやテスト結果が返ってきます。この実行結果を見れば、「どこが悪かったか」が分かります。しかし通常の強化学習では、最終的に成功なら 1、失敗なら 0 のような粗い報酬しか使わないことがあります。

SDPO は、実行結果や判定結果を使って、より細かい教師信号を作ります。応答を $y \sim \pi_\theta(\cdot \mid x)$、実行結果や評価文を $f$ とします。教師側は、この $f$ を見られる自分です。生徒側は、$f$ を見られない通常の自分です。

<!-- textlint-disable -->

$$
\mathcal{L}_{\mathrm{SDPO\text{-}self}}
=
\mathbb{E}_{x, y, f}
\left(
\sum_t
w_t
D_{\mathrm{KL}}
\left(
\mathrm{sg}
\left[
\pi_{\bar{\theta}}(\cdot \mid x, f, y_{<t})
\right]
\| \pi_\theta(\cdot \mid x, y_{<t})
\right)
\right)
$$

<!-- textlint-enable -->

ここで $w_t$ は、どの位置を強く学ばせるかを決める重みです。直感的には、「失敗後の反省を見た自分」が「失敗前の自分」に教える方法です。単なる成功・失敗の報酬よりも、出力のどこやどの推論段階を直すべきかを学びやすいです。

## 使い分けの目安

各手法の違いを、先に教師信号と構成で並べます。

| 手法 | 現在のモデルが生成した応答を使うか | 教師信号 | 報酬モデル | 基準モデル | 強み | 弱み |
| --- | ---: | --- | ---: | ---: | --- | --- |
| SFT[^instructgpt] | 使わない | 模範応答の各位置 | 不要 | 不要 | 安定、簡単 | 生成時のずれに弱い |
| RLHF[^christiano] + PPO[^ppo] | 使う | 応答全体の報酬 | 必要 | よく使う | 強力、汎用的 | 重い、不安定になりやすい |
| DPO[^dpo] | 基本的に使わない | 勝ち応答と負け応答の組 | 不要 | 必要 | 実装しやすい、安定 | 比較データに依存 |
| GRPO[^deepseekmath] | 使う | 同じ問い内での相対報酬 | 不要な場合が多い | よく使う | 価値推定器が不要、数学・コード向き | 細かい原因分析は苦手 |
| OPD[^opd_gkd] | 使う | 教師モデルの出力分布 | 不要 | 任意 | 現在の生成に沿って細かく学べる | 教師モデルの計算が重い |
| OPSD[^opsd] | 使う | 追加情報を見た自分の分布 | 不要 | 任意 | 外部教師が不要 | 追加情報の設計が重要 |
| SDPO 区間型[^segment_sdpo] | 場合による | 区間ごとの選好 | 不要 | 多くは必要 | 長い会話や多段推論に向く | 区間の選び方が難しい |
| SDPO 自己蒸留型[^self_distillation_sdpo] | 使う | 実行結果や評価文を見た自分の分布 | 不要 | 任意 | 失敗原因を細かく学べる | 評価文や実行結果の質に依存 |

使えるデータごとに、最初の候補になる手法を並べます。

| 手元のデータ | まず考える手法 | 理由 |
| --- | --- | --- |
| 入力と模範応答 | SFT[^instructgpt] | 形式や基本動作を教えやすい |
| 勝ち応答と負け応答 | DPO 系[^dpo] | 報酬モデルなしで選好を入れやすい |
| 人間評価を継続的に集められる | RLHF[^christiano] / PPO[^ppo] | 報酬モデルを経由して探索できる |
| 正誤を自動検証できる | RLVR[^rlvr] / GRPO[^deepseekmath] | 複数応答を相対評価しやすい |
| 実行エラーや解説などの追加情報がある | OPSD[^opsd] / SDPO 系[^self_distillation_sdpo] | 追加情報を細かい学習信号にしやすい |
| 複数ターンのどこが悪いか分かる | 区間型 SDPO[^segment_sdpo] | 応答全体ではなく重要区間を直せる |

実務では、どれか 1 つだけを使うとは限りません。SFT で最低限の形式を作り、DPO で選好を入れます。検証可能なタスクでは GRPO を使い、追加情報が取れるところで OPSD / SDPO 系を足す、という組み合わせも考えられます。

正解応答がたくさんあるなら、まず SFT が自然です。データは $(x, y^\ast)$ の形です。人間や評価器による比較データがあるなら、DPO が扱いやすいです。データは $(x, y_w, y_l)$ の形です。応答に点数をつけられるなら、RLHF や PPO が使えます。これは $r(x, y)$ が作れる場合です。

数学やコードのように、答えが正しいか自動で判定できるなら、RLVR や GRPO が向いています。たとえば $r(x, y) \in \{0, 1\}$ のような報酬を作りやすいからです。実行エラー、判定理由、正解の推論過程、追加のヒントなどがあるなら、OPD / OPSD / SDPO 系が有力です。粗い報酬ではなく、出力の各位置や各推論段階への細かい教師信号に変換できるからです。

## まとめ

最後に、各手法を教師信号の違いとして見直します。

| 手法 | 見方 |
| --- | --- |
| SFT[^instructgpt] | 良い応答をまねる |
| RLHF[^christiano] / PPO[^ppo] | 人間に好まれる応答に高い報酬を与えて伸ばす |
| DPO[^dpo] | 好ましい応答を、好ましくない応答より出しやすくする |
| GRPO[^deepseekmath] | 同じ問いへの複数応答を比べて、良い応答を伸ばす |
| OPD[^opd_gkd] | 現在のモデルが実際に出した途中文脈で、教師モデルをまねる |
| OPSD[^opsd] | 追加情報を見た自分を、通常の自分に蒸留する |
| SDPO 区間型[^segment_sdpo] | 会話や推論の一部分に DPO をかける |
| SDPO 自己蒸留型[^self_distillation_sdpo] | 実行結果や評価文を見た自分を、通常の自分に蒸留する |

事後学習は、何を教師信号として使うかの設計です。模範応答、選好、報酬、検証結果、追加情報を見た自己分布のどれを使うかで、必要なデータ、実装の重さ、得意なタスクが変わります。新しい手法名を追うと混乱しがちですが、この軸で見るとかなり整理しやすくなります。

## 参考文献

<!-- textlint-disable ja-technical-writing/sentence-length -->

[^api_wrapper]: OpenAI や Anthropic が出してきた AI をただ叩いて「すごい」と驚くだけで、本当に楽しいですか、という気持ちがあります。便利なのはそうですが、中身の見通しを持ったうえで、もう少し踏み込んでいろいろやりたい。

[^instructgpt]: Long Ouyang et al. "Training language models to follow instructions with human feedback."
    arXiv:2203.02155. [https://arxiv.org/abs/2203.02155](https://arxiv.org/abs/2203.02155)

[^christiano]: Paul F. Christiano et al. "Deep reinforcement learning from human preferences."
    arXiv:1706.03741. DOI: 10.48550/arXiv.1706.03741. [https://arxiv.org/abs/1706.03741](https://arxiv.org/abs/1706.03741)

[^ppo]: John Schulman et al. "Proximal Policy Optimization Algorithms."
    arXiv:1707.06347. [https://arxiv.org/abs/1707.06347](https://arxiv.org/abs/1707.06347)

[^ziegler]: Daniel M. Ziegler et al. "Fine-Tuning Language Models from Human Preferences."
    arXiv:1909.08593. DOI: 10.48550/arXiv.1909.08593. [https://arxiv.org/abs/1909.08593](https://arxiv.org/abs/1909.08593)

[^stiennon]: Nisan Stiennon et al. "Learning to summarize from human feedback."
    arXiv:2009.01325. DOI: 10.48550/arXiv.2009.01325. [https://arxiv.org/abs/2009.01325](https://arxiv.org/abs/2009.01325)

[^chatgpt]: OpenAI. "Introducing ChatGPT." [https://openai.com/index/chatgpt/](https://openai.com/index/chatgpt/)

[^dpo]: Rafael Rafailov et al. "Direct Preference Optimization: Your Language Model is Secretly a Reward Model."
    arXiv:2305.18290. [https://arxiv.org/abs/2305.18290](https://arxiv.org/abs/2305.18290)

[^ipo]: Mohammad Gheshlaghi Azar et al. "A General Theoretical Paradigm to Understand Learning from Human Preferences."
    arXiv:2310.12036. [https://arxiv.org/abs/2310.12036](https://arxiv.org/abs/2310.12036)

[^orpo]: Jiwoo Hong et al. "ORPO: Monolithic Preference Optimization without Reference Model."
    arXiv:2403.07691. [https://arxiv.org/abs/2403.07691](https://arxiv.org/abs/2403.07691)

[^simpo]: Yu Meng et al. "SimPO: Simple Preference Optimization with a Reference-Free Reward."
    arXiv:2405.14734. [https://arxiv.org/abs/2405.14734](https://arxiv.org/abs/2405.14734)

[^kto]: Kawin Ethayarajh et al. "KTO: Model Alignment as Prospect Theoretic Optimization."
    arXiv:2402.01306. [https://arxiv.org/abs/2402.01306](https://arxiv.org/abs/2402.01306)

[^deepseekmath]: Zhihong Shao et al. "DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models."
    arXiv:2402.03300. [https://arxiv.org/abs/2402.03300](https://arxiv.org/abs/2402.03300)

[^deepseek_r1]: DeepSeek-AI. "DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning."
    arXiv:2501.12948. [https://arxiv.org/abs/2501.12948](https://arxiv.org/abs/2501.12948)

[^agentic_rl_survey]: Guibin Zhang et al. "The Landscape of Agentic Reinforcement Learning for LLMs: A Survey."
    arXiv:2509.02547. [https://arxiv.org/abs/2509.02547](https://arxiv.org/abs/2509.02547)

[^rlvr]: Xumeng Wen et al. "Reinforcement Learning with Verifiable Rewards Implicitly Incentivizes Correct Reasoning in Base LLMs."
    arXiv:2506.14245. [https://arxiv.org/abs/2506.14245](https://arxiv.org/abs/2506.14245)

[^opd_geometry]: Zhennan Shen et al. "On the Geometry of On-Policy Distillation."
    arXiv:2606.07082. [https://arxiv.org/abs/2606.07082](https://arxiv.org/abs/2606.07082)

[^distillation]: Geoffrey Hinton, Oriol Vinyals, and Jeff Dean. "Distilling the Knowledge in a Neural Network."
    arXiv:1503.02531. [https://arxiv.org/abs/1503.02531](https://arxiv.org/abs/1503.02531)

[^opd_gkd]: Rishabh Agarwal et al. "On-Policy Distillation of Language Models: Learning from Self-Generated Mistakes."
    arXiv:2306.13649. DOI: 10.48550/arXiv.2306.13649. [https://arxiv.org/abs/2306.13649](https://arxiv.org/abs/2306.13649)

[^opd_survey]: Mingyang Song and Mao Zheng. "A Survey of On-Policy Distillation for Large Language Models."
    arXiv:2604.00626. [https://arxiv.org/abs/2604.00626](https://arxiv.org/abs/2604.00626)

[^opsd]: Siyan Zhao et al. "Self-Distilled Reasoner: On-Policy Self-Distillation for Large Language Models."
    arXiv:2601.18734. [https://arxiv.org/abs/2601.18734](https://arxiv.org/abs/2601.18734)

[^segment_sdpo]: Aobo Kong et al. "SDPO: Segment-Level Direct Preference Optimization for Social Agents."
    arXiv:2501.01821. [https://arxiv.org/abs/2501.01821](https://arxiv.org/abs/2501.01821)

[^self_distillation_sdpo]: Jonas Hübotter et al. "Reinforcement Learning via Self-Distillation."
    arXiv:2601.20802. [https://arxiv.org/abs/2601.20802](https://arxiv.org/abs/2601.20802)

<!-- textlint-enable ja-technical-writing/sentence-length -->
