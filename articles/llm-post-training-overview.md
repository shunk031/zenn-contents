---
title: "LLM 事後学習 (SFT / RLHF / DPO / RLVR / GRPO / 自己蒸留) を教師信号から眺める"
emoji: "🧠"
type: "tech"
topics: ["llm", "事後学習", "rlhf", "dpo", "強化学習"]
published: true
published_at: 2026-06-27
---

こんにちは [@shunk031](https://twitter.com/shunk031) です。最近は、GPT や Claude の API を呼び出すだけで終わらない AI エージェントの構築に興味があります。

GPT や Claude のような closed LLM はもちろん強いです。ただ、OpenAI や Anthropic が学習していないタスクになると、急にこちらが欲しい手順や評価基準から外れることがあります。[^api_wrapper] しかも最近は、open-weight な大規模言語モデル (Large Language Model; LLM) もかなり性能がよくなっています[^qwen3][^qwen35_omni][^gemma4][^glm52]。手元で動かせる LLM が強くなると、自前で事後学習 (post-training) し、必要な振る舞いを引き出す選択肢も現実的になります。

事後学習が大きく注目されたきっかけの 1 つは、ChatGPT[^chatgpt] の指示追従や対話品質でした。ChatGPT には、InstructGPT[^instructgpt] で導入された人間のフィードバックからの強化学習が応用されていると言われています。そこから、DeepSeek-R1[^deepseek_r1] の GRPO[^deepseekmath] のように、数学やコードのような検証しやすい課題で推論能力を伸ばす事後学習も目立つようになりました。さらに最近は、ローカルでも動かせる open-weight モデルの GLM-5.2[^glm52] でも、長い coding agent の軌跡を扱うために critic-based PPO が使われています。ツール利用、探索、検証、修正まで含むエージェントを考えると、Agentic Reinforcement Learning (Agentic RL)[^agentic_rl_survey] の文脈でも事後学習が重要になります。

LLM エージェント全般と Agentic RL は、以前のスライドにまとめました。Agentic RL は事後学習とも重なりますが、スライドではエージェントの方法論まで広めに扱っています。この記事では、既存 LLM の振る舞いを変えるためのデータと学習方法を扱います。

https://speakerdeck.com/shunk031/large-language-model-agent-a-survey-on-methodology-applications-and-challenges

https://speakerdeck.com/shunk031/the-landscape-of-agentic-reinforcement-learning-for-llms-a-survey

教師信号の違いは、更新の軌跡にも出ます。Shen ら[^opd_geometry] は、模範応答で学ぶ方法、検証可能な報酬で学ぶ方法、オンポリシー蒸留が、モデルを別々の方向へ動かす様子を図示しています。

![模範応答、オンポリシー蒸留、検証可能な報酬の更新幾何を比較した模式図](/images/llm-post-training-overview/opd-geometry-sft-rlvr.png)
_模範応答、オンポリシー蒸留、検証可能な報酬の更新軌跡の比較。Shen et al. の Fig. 1 より。[^opd_geometry]_

## LLM 事後学習の全体像

事後学習は、事前学習済みモデルを、人間やタスクに合わせて扱えるようにする段階です[^instructgpt][^ziegler]。事前学習では、大量のテキストから次のトークンを予測する力を得ます。ただ、そのままでは指示形式、安全性、推論の進め方、好ましい応答の癖まではそろいません。

事後学習で使うデータには、人間が書いた模範応答、応答同士の比較、応答全体への報酬、テスト結果や最終答えの正誤、教師モデルの出力分布などがあります。データの形が変わると、報酬モデルを持つのか、比較損失にするのか、生成途中の分布まで合わせるのかも変わります。

AI エージェント的なタスクでは、ツールを呼び、結果を見て、方針を直す途中で失敗が起きます。応答全体を採点できるなら報酬、応答同士を比べられるなら選好損失、生成途中の文脈まで見られるなら教師分布との距離を学習に使います。

| 学習に使うデータや評価             | 主な手法                                                               | 目的関数が主に扱う単位     |
| ---------------------------------- | ---------------------------------------------------------------------- | -------------------------- |
| 入力と模範応答                     | SFT[^instructgpt]                                                      | 模範応答上の各位置         |
| 人間評価や報酬                     | RLHF[^christiano] / PPO[^ppo]                                          | 生成した応答全体           |
| 応答同士の比較                     | DPO[^dpo] / IPO[^ipo] / ORPO[^orpo] / SimPO[^simpo] / KTO[^kto]        | 応答ペアの相対差           |
| 検証器が返す正誤や点数             | RLVR[^rlvr] / GRPO[^deepseekmath]                                      | 最終答えやテスト結果       |
| 区間ごとの選好                     | 区間型 SDPO[^segment_sdpo]                                             | 会話や推論の一部分         |
| 教師分布や追加情報を条件にした分布 | OPD[^opd_gkd] / OPSD[^opsd] / 自己蒸留型 SDPO[^self_distillation_sdpo] | 生成中の文脈と出力の各位置 |

SFT や DPO は、あらかじめ用意した模範応答や比較データを使います。GRPO や OPD 系では、現在のモデルが生成した応答上で方策や分布を更新します。目的関数の更新方向まで踏み込むなら、SFT / RL / OPD の比較がまとまっています。

https://nrehiew.github.io/blog/sft_rl_opd/

## 共通の記法

この先は、模範応答の尤度、応答への報酬、応答ペアの選好、教師分布との距離を式で扱います。どの式でも入力、応答、方策の記号を使うため、先に対応をまとめます。

| 記号                                | 意味                             |
| ----------------------------------- | -------------------------------- |
| $x$                                 | 入力、質問、問題文               |
| $y$                                 | モデルの応答                     |
| $y = (y_1, y_2, \dots, y_T)$        | 応答をトークンに分けて並べたもの |
| $y_{\lt t} = (y_1, \dots, y_{t-1})$ | $t$ 番目より前までの出力         |
| $\pi_\theta(y \mid x)$              | 学習対象の方策                   |
| $\pi_{\mathrm{ref}}(y \mid x)$      | 基準モデル                       |
| $r(x, y)$                           | 応答 $y$ に対する報酬            |
| $y_w$                               | 選好ペアの勝ち応答               |
| $y_l$                               | 選好ペアの負け応答               |
| $\mathcal{D}$                       | 入力や比較データの分布           |

ここで $\pi_\theta$ は、入力 $x$ に対して応答 $y$ を出す確率分布です。強化学習の言葉では、この確率分布を方策と呼びます。LLM では、ここまでの文脈から次に出すトークンを選ぶ確率分布として扱います。応答全体の確率は、各時点の出力確率の積として分解できます。

$$
\pi_\theta(y \mid x) = \prod_{t=1}^{T} \pi_\theta(y_t \mid x, y_{\lt t})
$$

## 模範応答から学ぶ

回答形式、文体、基本的な解き方を入れるには、入力と模範応答の組を使います。応答を採点したり比較したりする前に、まず望ましい出力の形をまねさせる段階です。

教師ありファインチューニング (Supervised Fine-Tuning; SFT)[^instructgpt] は、入力 $x$ と模範応答 $y^\ast$ の組を使って、模範応答の尤度を上げます。目的関数は、次の負の対数尤度です。

<!-- textlint-disable -->

$$
\mathcal{L}_{\mathrm{SFT}}(\theta) = - \mathbb{E}_{(x, y^\ast) \sim \mathcal{D}_{\mathrm{SFT}}} \left[ \sum_{t=1}^{T} \log \pi_\theta(y_t^\ast \mid x, y_{\lt t}^\ast) \right]
$$

<!-- textlint-enable -->

この損失は、模範応答をどれだけ高い確率で再現できるかを評価します。学習では $\pi_\theta(y^\ast \mid x)$ を最大化します。

入力と模範応答の組があれば、指示形式、文体、出力フォーマット、基本的なタスク解法を SFT で学習できます。InstructGPT[^instructgpt] でも、人が書いた模範応答で教師ありファインチューニングした後に、人間の比較を使っています。

SFT の信号は、基本的に模範応答上の文脈に限られます。訓練時は、模範応答の途中まで $y^\ast_{\lt t}$ を条件に $y^\ast_t$ を予測します。モデル自身の生成が模範応答から外れた後の文脈には、この損失から直接の学習信号が入りません。テストログを読まずに成功扱いするような失敗は、ここが SFT の限界になります。

## 人間評価を報酬にする

応答に点数をつけ、その点が高くなるように方策を更新する系列です。人間のフィードバックからの強化学習 (Reinforcement Learning from Human Feedback; RLHF)[^christiano] は、人間の評価から報酬を作る枠組みです。近接方策最適化 (Proximal Policy Optimization; PPO)[^ppo] は、その報酬で方策を更新する方法として扱います。

強化学習では、モデルが自分で応答を生成し、その応答に点数をつけます。その点数が高くなるようにモデルを更新します。もっとも単純には、期待報酬 $J(\theta)$ を最大化します。

<!-- textlint-disable -->

$$
J(\theta) = \mathbb{E}_{x \sim \mathcal{D},\, y\sim\pi_\theta(\cdot \mid x)} \left[ r(x, y) \right]
$$

<!-- textlint-enable -->

強化学習で上げたいのは、モデルが自分で生成した応答の期待報酬です。ただし報酬だけを見ると、基準モデルから大きく外れた応答も選ばれやすくなります。期待報酬を上げつつ基準モデルからのずれを抑えるために、Kullback-Leibler (KL) 正則化を入れることが多いです。

<!-- textlint-disable -->

$$
\max_\theta \mathbb{E}_{x \sim \mathcal{D}} \left( \mathbb{E}_{y \sim \pi_\theta(\cdot \mid x)} \left[ r(x, y) \right] - \beta \mathrm{KL} \left( \pi_\theta(\cdot \mid x) \| \pi_{\mathrm{ref}}(\cdot \mid x) \right) \right)
$$

<!-- textlint-enable -->

後半の KL 項は、現在のモデルが基準モデルからどれくらい離れたかを表します。$\beta$ は、その離れ具合をどれくらい強く抑えるかを決める係数です。

InstructGPT[^instructgpt] で使われたような RLHF 構成では、この報酬 $r(x, y)$ を人間の好みから作ります[^ziegler][^stiennon]。代表的には、次の構成を取ります。

1. SFT で初期モデルを作る。
2. 人間の比較データから報酬モデルを作る。
3. PPO などの強化学習でモデルを更新する。

同じ問いに対する複数の応答を人間に比べてもらい、勝ち応答 $y_w$ と負け応答 $y_l$ の組を作ります。報酬モデル $r_\phi(x, y)$ は、勝ち応答に高い点をつけるように学習します。

<!-- textlint-disable -->

$$
P(y_w \succ y_l \mid x) = \sigma \left( r_\phi(x, y_w) - r_\phi(x, y_l) \right)
$$

<!-- textlint-enable -->

ここで $\sigma$ は、報酬差を勝ち応答の確率として読める値に写す活性化関数です。

報酬モデルの損失関数は、たとえば次のように書けます。

<!-- textlint-disable -->

$$
\mathcal{L}_{\mathrm{RM}}(\phi) = - \mathbb{E}_{(x, y_w, y_l) \sim \mathcal{D}_{\mathrm{pref}}} \left[ \log \sigma \left( r_\phi(x, y_w) - r_\phi(x, y_l) \right) \right]
$$

<!-- textlint-enable -->

この式は、$r_\phi(x, y_w) \gt r_\phi(x, y_l)$ となるように報酬モデルを学習している、と読めます。

PPO は、この方策更新を安定させるための代表的な手法です。古い方策 $\pi_{\mathrm{old}}$ と新しく更新したい方策 $\pi_\theta$ の確率比を、次のように定義します。

<!-- textlint-disable -->

$$
\rho_t(\theta) = \frac{\pi_\theta(y_t \mid x, y_{\lt t})} {\pi_{\mathrm{old}}(y_t \mid x, y_{\lt t})}
$$

<!-- textlint-enable -->

この比が大きいほど、新しい方策が古い方策から大きく離れたことを意味します。PPO では、確率比 $\rho_t(\theta)$ を $1-\epsilon$ から $1+\epsilon$ の範囲にクリップし、一度の更新で方策が動きすぎないようにします。ここで $\epsilon$ はクリップ幅、$A_t$ は時刻 $t$ の行動がどれだけ報酬に効いたかを表す利得です。PPO の目的関数は、このクリップ前の項とクリップ後の項の小さい方を使います。

<!-- textlint-disable -->

$$
\mathcal{L}_{\mathrm{PPO}}(\theta) = \mathbb{E}_t \left[ \min \left( \rho_t(\theta) A_t, \mathrm{clip}(\rho_t(\theta), 1 - \epsilon, 1 + \epsilon) A_t \right) \right]
$$

<!-- textlint-enable -->

この目的関数では、報酬に効いた出力の確率を上げ、そうでない出力の確率を下げます。ただし、確率比をクリップして一度の更新量を抑えます。

応答の評価をスカラー報酬にできるなら、RLHF / PPO は生成した応答を採点し、その報酬を最大化する方策更新として書けます。ただし、応答を生成する方策モデルのほかに、基準モデル、報酬モデル、価値推定器が必要になり、訓練構成は重くなります。この構成を軽くする選択肢として、比較データから直接方策を動かす DPO や、価値推定器を省く GRPO があります。

## 比較データから学ぶ

ここでは、同じ入力に対する応答同士の比較から学びます。

### DPO

DPO が捨てたのは、明示的な報酬モデルと PPO の更新ループです。直接選好最適化 (Direct Preference Optimization; DPO)[^dpo] は、勝ち応答と負け応答の比較データから、方策の目的関数を直接書きます。出発点は、RLHF でよく使う KL 正則化つきの目的関数です。

<!-- textlint-disable -->

$$
\max_\pi \mathbb{E}_{x \sim \mathcal{D},\, y\sim\pi(\cdot \mid x)} \left( r(x, y) - \beta \log \frac{\pi(y \mid x)}{\pi_{\mathrm{ref}}(y \mid x)} \right)
$$

<!-- textlint-enable -->

この最適解は、次の形になることが知られています。

<!-- textlint-disable -->

$$
\pi^\star(y \mid x) = \frac{1}{Z(x)} \pi_{\mathrm{ref}}(y \mid x) \exp \left( \frac{1}{\beta}r(x, y) \right)
$$

<!-- textlint-enable -->

ここで $Z(x)$ は正規化定数です。この式を変形すると、報酬は次のように書けます。

<!-- textlint-disable -->

$$
r(x, y) = \beta \log \frac{\pi^\star(y \mid x)}{\pi_{\mathrm{ref}}(y \mid x)} + \beta \log Z(x)
$$

<!-- textlint-enable -->

DPO は、この関係を使って、明示的な報酬モデル $r_\phi(x, y)$ を学習せずに済ませます。勝ち応答 $y_w$ と負け応答 $y_l$ があるとき、DPO の損失は次のように書けます。

<!-- textlint-disable -->

$$
\mathcal{L}_{\mathrm{DPO}}(\theta) = - \mathbb{E}_{(x, y_w, y_l) \sim \mathcal{D}_{\mathrm{pref}}} \left[ \log \sigma \left( \beta \log \frac{\pi_\theta(y_w \mid x)}{\pi_{\mathrm{ref}}(y_w \mid x)} - \beta \log \frac{\pi_\theta(y_l \mid x)}{\pi_{\mathrm{ref}}(y_l \mid x)} \right) \right]
$$

<!-- textlint-enable -->

DPO が上げたいのは、絶対的な報酬ではなく、基準モデルに対する勝ち応答と負け応答の差です。報酬モデルを別に持たず、訓練中のサンプリングも不要なので、PPO より訓練構成を減らせます。

より細かく見ると、勝ち応答 $y_w$ では次の量が大きくなるように更新します。

$$
\log \frac{\pi_\theta(y_w \mid x)}{\pi_{\mathrm{ref}}(y_w \mid x)}
$$

負け応答 $y_l$ では、対応する量が小さくなるように更新します。

$$
\log \frac{\pi_\theta(y_l \mid x)}{\pi_{\mathrm{ref}}(y_l \mid x)}
$$

DPO は、基準モデルに対して勝ち応答の相対対数確率を上げ、負け応答の相対対数確率を下げます。

DPO は、既存の比較データに強く依存します。比較ペアが粗い場合や、生成中のどこが悪かったのかを知りたい場合は、応答全体への信号だけでは足りません。長い推論では、途中の一手だけが原因で失敗することもあります。検索結果に反証があるのに最初の仮説で進む失敗も、勝ち負けの組だけでは「どこで戻るべきだったか」が残ります。

### DPO 以降の関連手法

DPO の後は、報酬モデル、基準モデル、ペア比較のどれを残すかで手法が分かれます。

Identity Preference Optimization (IPO)[^ipo] は、DPO の近似がどの条件で崩れやすいかを、より一般的な選好学習の枠組みから見直します。DPO では、次の差を大きくし続けやすいと解釈できます。

<!-- textlint-disable -->

$$
\Delta_\theta = \log \frac{\pi_\theta(y_w \mid x)}{\pi_{\mathrm{ref}}(y_w \mid x)} - \log \frac{\pi_\theta(y_l \mid x)}{\pi_{\mathrm{ref}}(y_l \mid x)}
$$

<!-- textlint-enable -->

IPO では、この差を無限に大きくするのではなく、有限の目標値に近づけます。代表的には、次のような二乗誤差として書けます。

<!-- textlint-disable -->

$$
\mathcal{L}_{\mathrm{IPO}} = \mathbb{E} \left[ \left( \Delta_\theta - \frac{1}{2\beta} \right)^2 \right]
$$

<!-- textlint-enable -->

オッズ比選好最適化 (Odds Ratio Preference Optimization; ORPO)[^orpo] は、SFT と選好最適化を分けません。好ましい応答を学びながら、好ましくない応答のオッズを下げます。記号を単純化して $\mathrm{odds}_\theta(y \mid x)=\pi_\theta(y \mid x)/(1-\pi_\theta(y \mid x))$ と置くと、ORPO の選好項はオッズ比の差を使います。

<!-- textlint-disable -->

$$
\mathcal{L}_{\mathrm{OR}} = - \mathbb{E} \log \sigma \left( \log \frac{\mathrm{odds}_\theta(y_w \mid x)} {\mathrm{odds}_\theta(y_l \mid x)} \right)
$$

<!-- textlint-enable -->

全体としては、SFT 的な負の対数尤度とこの選好項を足した形で書けます。

<!-- textlint-disable -->

$$
\mathcal{L}_{\mathrm{ORPO}} = \mathcal{L}_{\mathrm{NLL}} + \lambda \mathcal{L}_{\mathrm{OR}}
$$

<!-- textlint-enable -->

DPO は基準モデルを使いますが、ORPO はそれを省くのが特徴です。

単純選好最適化 (Simple Preference Optimization; SimPO)[^simpo] は、基準モデルを使いません。応答長で正規化した平均対数確率を暗黙の報酬として使います。好ましい応答の平均対数確率が、好ましくない応答を余白 $\gamma$ だけ上回るようにします。

<!-- textlint-disable -->

$$
\mathcal{L}_{\mathrm{SimPO}} = - \mathbb{E} \log \sigma \left( \beta \left( \frac{1}{|y_w|} \log \pi_\theta(y_w \mid x) - \frac{1}{|y_l|} \log \pi_\theta(y_l \mid x) \right) - \gamma \right)
$$

<!-- textlint-enable -->

Kahneman-Tversky 最適化 (Kahneman-Tversky Optimization; KTO)[^kto] は、ペア比較を作る負担を避けるために、望ましいかどうかの二値信号から学ぶ方向です。「この応答は望ましい」「この応答は望ましくない」という単独評価を扱うため、人間は損失に敏感で利益には鈍感、という行動経済学の考え方を目的関数に入れます。

### 区間単位の直接選好最適化

区間単位の直接選好最適化 (Segment-Level Direct Preference Optimization; SDPO)[^segment_sdpo] は、会話や推論の一部分に DPO をかける方法です。長い会話では、応答全体を 1 つの選好ラベルで扱っても、改善すべき区間は分かりにくいです。そこで、重要な区間だけを取り出します。なお、SDPO という略語は自己蒸留系の論文でも使われるため、この記事では後段の [自己蒸留型 SDPO](#自己蒸留による方策最適化) と分けます。

文脈を $c$、好ましい区間を $g_w$、好ましくない区間を $g_l$ とします。このとき、区間単位の DPO は次のように書けます。

<!-- textlint-disable -->

$$
\mathcal{L}_{\mathrm{SDPO\text{-}seg}} = - \mathbb{E} \log \sigma \left( \beta \left( \log \frac{\pi_\theta(g_w \mid c)}{\pi_{\mathrm{ref}}(g_w \mid c)} - \log \frac{\pi_\theta(g_l \mid c)}{\pi_{\mathrm{ref}}(g_l \mid c)} \right) \right)
$$

<!-- textlint-enable -->

標準 DPO と形はほぼ同じです。違いは、応答全体ではなく、会話や推論の一部分を単位にしている点です。長いやり取り、対話エージェント、複数手順の推論などで有効です。

## 検証可能な報酬から学ぶ

テストや実行結果で正誤が返るなら、人間評価を挟まずに報酬を作れます。比較データだけでは、応答のどの部分が失敗したのかまでは分かりません。数学やコードのように自動検証できるタスクでは、最終答えやテスト結果を報酬にして、モデルが生成した応答で方策を更新できます。

検証可能な報酬による強化学習 (Reinforcement Learning with Verifiable Rewards; RLVR)[^rlvr] は、数学、コード、ツール利用のように、最終結果を自動検証できるタスクを前提にした枠組みです。人間のランキングではなく、正解判定、単体テスト、実行結果などを報酬として使います。

RLVR は報酬の作り方を指します。一方で、その報酬を使って方策をどう更新するかは別の話です。Group Relative Policy Optimization (GRPO)[^deepseekmath] は、PPO で使う価値推定器を置かず、同じ入力から生成した複数応答の報酬をグループ内で比べて利得を作ります。DeepSeekMath では、GRPO を PPO の変種として導入し、価値推定器を使わずに数学推論を改善しています。DeepSeek-R1 でも、この価値推定器を省く方策更新が使われています。

具体的には、古い方策 $\pi_{\mathrm{old}}$ から、入力 $x$ に対する $G$ 個の応答をサンプリングします。

$$
y_1, y_2, \dots, y_G \sim \pi_{\mathrm{old}}(\cdot \mid x)
$$

各応答を検証器や報酬関数で採点します。

$$
r_1, r_2, \dots, r_G
$$

得られた報酬は、入力 $x$ ごとのグループ内で平均と標準偏差を使って正規化します。

<!-- textlint-disable -->

$$
A_i = \frac{r_i - \mathrm{mean}(r_1, \dots, r_G)} {\mathrm{std}(r_1, \dots, r_G) + \epsilon}
$$

<!-- textlint-enable -->

この $A_i$ は、その応答の報酬が同じ問いの中で平均よりどれだけ上かを表します。目的関数は PPO に近い形です。

<!-- textlint-disable -->

$$
\mathcal{L}_{\mathrm{GRPO}} = \mathbb{E} \left[ \frac{1}{G} \sum_{i=1}^{G} \frac{1}{|y_i|} \sum_{t=1}^{|y_i|} \min \left( \rho_{i,t} A_i, \mathrm{clip}(\rho_{i,t}, 1-\epsilon, 1+\epsilon) A_i \right) - \beta D_{\mathrm{KL}} \left( \pi_\theta \| \pi_{\mathrm{ref}} \right) \right]
$$

<!-- textlint-enable -->

ここで、$\rho_{i,t}$ は新旧方策の確率比です。

<!-- textlint-disable -->

$$
\rho_{i,t} = \frac{\pi_\theta(y_{i,t} \mid x, y_{i,\lt t})} {\pi_{\mathrm{old}}(y_{i,t} \mid x, y_{i,\lt t})}
$$

<!-- textlint-enable -->

PPO は価値推定器で利得を見積もります。GRPO は価値推定器を使わず、同じ問いに対する複数応答の相対比較から利得を作ります。

数学の最終答えが一致するか、コードがテストを通るか、という課題では、GRPO に渡す報酬を自動で作れます。ただし、この報酬は疎な信号です。最終結果に点はつけられても、出力のどの位置やどの推論ステップが効いたのかまでは分かりません。テストが落ちた事実は報酬にできますが、ログをどう読んで方針を戻すかは別に入れる必要があります。

エージェント実装では、報酬を作るだけでなく、ロールアウト中の失敗検出や補正ループも論点になります。ABEJA の記事では、ロールアウト補正まで含めた実装寄りの話を読めます。

https://tech-blog.abeja.asia/entry/llm-rl-rollout-correction-202606

## 生成中の文脈で蒸留する

検証可能な報酬は応答全体への点になり、出力中のどの位置を直すかまでは直接示しません。生成中の文脈ごとに教師分布を与える蒸留系の手法は、その隙間を埋めます。外部の教師モデルを使う OPD から見ると、追加情報を条件にした同じモデルの分布を教師にする OPSD や SDPO も同じ流れで読めます。

### OPD

オンポリシー蒸留 (On-Policy Distillation; OPD)[^opd_gkd] は、知識蒸留を現在のモデルが実際に生成した文脈上で行う方法です。知識蒸留[^distillation] では、教師モデルの出力分布を生徒モデルにまねさせます。LLM では、教師モデルが作った固定データを生徒モデルに学ばせる形もよく使われます。この場合、生徒自身が今生成する文脈からは外れるため、オフポリシー蒸留と読めます。この対比でいうオンポリシーは、「現在のモデルが実際に生成する分布に沿う」という意味です。

$$
y \sim \pi_\theta(\cdot \mid x)
$$

生徒が自分で応答 $y$ を生成したあと、その途中文脈 $x, y_{\lt t}$ に対して教師が次のトークン分布を与えます。学習では、教師分布と生徒分布の KL 距離を最小化します。

<!-- textlint-disable -->

$$
\mathcal{L}_{\mathrm{OPD}}(\theta) = \mathbb{E}_{x \sim \mathcal{D},\, y \sim \pi_\theta(\cdot \mid x)} \left[ \sum_t D_{\mathrm{KL}} \left( \pi_T(\cdot \mid x, y_{\lt t}) \| \pi_\theta(\cdot \mid x, y_{\lt t}) \right) \right]
$$

<!-- textlint-enable -->

ここで $\pi_T$ は教師モデルです。OPD は生徒自身の文脈上で教えるため、訓練時と生成時のずれを減らす方向に働きます。2026 年には OPD のサーベイも出ており、長い推論やモデル圧縮の文脈で整理されています[^opd_survey]。

SFT / RL / OPD は、使う文脈と教師信号が違います。この表の RL は、報酬で方策を更新する強化学習を指します。

| 手法              | 使う文脈                             | 教師信号         |
| ----------------- | ------------------------------------ | ---------------- |
| SFT[^instructgpt] | 人間や教師が書いた応答の途中文脈     | 各位置の正解     |
| RL                | 現在のモデルが生成した応答           | 応答全体への点数 |
| OPD[^opd_gkd]     | 現在のモデルが生成した応答の途中文脈 | 各位置の教師分布 |

SFT は細かい信号を与えますが、文脈は固定されています。強化学習は現在のモデルに沿いますが、報酬は粗いことが多いです。OPD は、現在のモデルが実際に通った文脈上で、各位置の教師分布を見る方法です。

### OPSD

オンポリシー自己蒸留 (On-Policy Self-Distillation; OPSD)[^opsd] は、OPD の教師を外部モデルではなく、追加情報を条件にした同じモデルの分布に置き換える方法です。ただし、完全に同じ条件の分布をまねても意味が薄いため、教師側には追加情報を与えます。たとえば、正解、検証結果、推論の手がかり、途中証明のような情報です。

教師分布は追加情報 $z$ を条件にしますが、生徒分布は $z$ を条件にしません。そのうえで、生徒が実際に生成した文脈上の出力分布を近づけます。訓練時だけ使える追加情報を条件にした分布を教師にし、推論時と同じく $z$ を使わない分布へ蒸留します。

<!-- textlint-disable -->

$$
\mathcal{L}_{\mathrm{OPSD}}(\theta) = \mathbb{E}_{(x, z) \sim \mathcal{D},\, y \sim \pi_\theta(\cdot \mid x)} \left[ \sum_t D_{\mathrm{KL}} \left( \mathrm{sg} \left[ \pi_{\bar{\theta}}(\cdot \mid x, z, y_{\lt t}) \right] \| \pi_\theta(\cdot \mid x, y_{\lt t}) \right) \right]
$$

<!-- textlint-enable -->

ここで $\mathrm{sg}$ は勾配を止める操作です。教師側は更新せず、生徒側だけを教師に近づけます。数学やコードでは、解いた後の検証結果や正解を教師側だけに渡せます。

OPSD のデータの流れでは、教師側と生徒側の条件づけを分ける必要があります。以下の解説では、OPSD を self-distillation と on-policy distillation に分け、追加情報を条件にした教師側と、通常の生成文脈に沿う生徒側の関係として説明しています。

https://note.com/kei_disign/n/nd60818508c1a

### 自己蒸留による方策最適化

コード実行後のエラーや評価文まで残せるなら、それをただの成功/失敗で捨てるのはもったいないです。自己蒸留による方策最適化 (Self-Distillation Policy Optimization; SDPO)[^self_distillation_sdpo] は、実行結果、判定理由、評価文などを追加情報として使い、自己蒸留で密な学習信号へ変換する方法です。たとえばコード生成では、生成モデルがコードを出力します。そのコードを実行すると、実行エラーやテスト結果が返ってきます。この実行結果は、どの部分を直すべきかを推定する手がかりになります。しかし通常の強化学習では、最終的に成功なら 1、失敗なら 0 のような粗い報酬しか使わないことがあります。

SDPO は、実行結果や判定結果を使って、より細かい教師信号を作ります。応答を $y \sim \pi_\theta(\cdot \mid x)$、実行結果や評価文を $f$ とします。教師側は $f$ を条件にした分布、生徒側は $f$ を条件にしない通常の分布です。

<!-- textlint-disable -->

$$
\mathcal{L}_{\mathrm{SDPO\text{-}self}} = \mathbb{E}_{x \sim \mathcal{D},\, y \sim \pi_\theta(\cdot \mid x),\, f} \left[ \sum_t w_t D_{\mathrm{KL}} \left( \mathrm{sg} \left[ \pi_{\bar{\theta}}(\cdot \mid x, f, y_{\lt t}) \right] \| \pi_\theta(\cdot \mid x, y_{\lt t}) \right) \right]
$$

<!-- textlint-enable -->

ここで $w_t$ は、どの位置を強く学ばせるかを決める重みです。実行結果や評価文を条件にした分布を教師にするため、単なる成功・失敗の報酬よりも、修正対象を位置ごとの信号として渡せます。テストログや評価文を残せるなら、成功/失敗へ潰す前に、生成途中の文脈へ戻せる形で使いたいところです。

## 使い分けの目安

入力と模範応答の組を作れるなら、まず SFT で期待する応答をまねさせるのが素直です。そこで足りない振る舞いが残るなら、人間評価や検証器から報酬を作り、RL でその報酬を上げる更新を書けます。応答同士の比較があるなら DPO、同じ問いに対する複数応答を採点できるなら GRPO のように相対利得で方策を更新できます。

| 手法                                     | 現在のモデルが生成した応答を使うか | 教師信号                         |       報酬モデル | 基準モデル | 用意できるもの / 直したい失敗              | 残りやすい問題                           |
| ---------------------------------------- | ---------------------------------: | -------------------------------- | ---------------: | ---------: | ------------------------------------------ | ---------------------------------------- |
| SFT[^instructgpt]                        |                           使わない | 模範応答の各位置                 |             不要 |       不要 | 入力と期待する応答の組を作れる             | 模範応答から外れた後の文脈は残る         |
| RLHF[^christiano] + PPO[^ppo]            |                               使う | 応答全体の報酬                   |             必要 |   よく使う | 人間評価を継続的に集められる               | 報酬モデル、価値推定器、更新ループが重い |
| DPO[^dpo]                                |                   基本的に使わない | 勝ち応答と負け応答の組           |             不要 |       必要 | 望ましい応答と避けたい応答を比べられる     | 比較ペアが粗いと失敗位置は残る           |
| RLVR[^rlvr]                              |                               使う | 検証可能な報酬                   | 不要な場合が多い |       任意 | 最終答えやコード実行を自動判定できる       | 最終結果への点なので途中の原因は残る     |
| GRPO[^deepseekmath]                      |                               使う | 同じ問い内の相対利得             | 不要な場合が多い |   よく使う | 同じ問題に複数回解かせて点で並べられる     | 報酬関数とは別に探索ログの作り方が残る   |
| OPD[^opd_gkd]                            |                               使う | 教師モデルの出力分布             |             不要 |       任意 | 教師モデルを生成途中の各文脈で呼べる       | 教師モデルを各文脈で呼ぶ計算量が残る     |
| OPSD[^opsd]                              |                               使う | 追加情報を条件にした自己分布     |             不要 |       任意 | 正解、検証結果、ヒントを教師側だけに渡せる | 何を追加情報にするかが残る               |
| 区間型 SDPO[^segment_sdpo]               |                         場合による | 区間ごとの選好                   |             不要 | 多くは必要 | 長い会話の悪い区間を切り出せる             | どの区間を切り出すかが残る               |
| 自己蒸留型 SDPO[^self_distillation_sdpo] |                               使う | 実行結果や評価文を条件にした分布 |             不要 |       任意 | 実行結果や評価文を保存できる               | 評価文や実行結果の質がそのまま効く       |

入力と模範応答の組なら尤度最大化、応答同士の比較なら選好損失、検証器の点数なら報酬として使えます。実行結果や評価文まで残せるなら、自己蒸留の追加情報にもできます。

| 用意できるデータ                   | 対応する手法                             | 理由                             |
| ---------------------------------- | ---------------------------------------- | -------------------------------- |
| 入力と模範応答                     | SFT[^instructgpt]                        | 形式や基本動作を直接教えられる   |
| 応答同士の比較                     | DPO 系[^dpo]                             | 報酬モデルなしで選好を入れられる |
| 人間評価を継続的に集められる       | RLHF[^christiano] / PPO[^ppo]            | 報酬モデルを経由して探索できる   |
| 正誤を自動検証できる               | RLVR[^rlvr]                              | 検証可能な報酬を作れる           |
| 同じ問いに複数応答を生成できる     | GRPO[^deepseekmath]                      | 応答間の相対利得を作れる         |
| 教師モデルの分布を使える           | OPD[^opd_gkd]                            | 生成中の文脈で教師分布を渡せる   |
| 正解や手がかりなどの追加情報がある | OPSD[^opsd]                              | 追加情報つき分布を通常時へ移せる |
| 実行結果や評価文を作れる           | 自己蒸留型 SDPO[^self_distillation_sdpo] | 評価後の情報を密な信号に変換する |
| 複数ターンのどこが悪いか分かる     | 区間型 SDPO[^segment_sdpo]               | 応答全体ではなく重要区間を直せる |

実際の訓練では、1 つの手法だけで済まないこともあります。形式崩れには入力と修正版応答の組、望ましくない応答には比較データ、最終答えの誤りには検証器の報酬を作る。さらに、ツール実行後の修正や推論途中の脱線まで扱うなら、OPD / OPSD / 自己蒸留型 SDPO のように、生成途中の文脈ごとに教師分布を合わせる構成も必要になります。

## まとめ

LLM の事後学習は、教師信号の形から見ると整理しやすいです。模範応答を使う SFT、選好ペアを使う DPO 系、報酬を使う RLHF、検証可能な正誤を使う RLVR / GRPO、生成途中の分布を合わせる OPD / OPSD / 自己蒸留系では、学習に戻せる情報の粒度が違います。

こうして並べると、重要なのは手法名を覚えることではなく、自分のタスクで観測できる失敗をどんな教師信号として残せるかだと分かります。特にエージェント的なタスクでは、最終的な成功/失敗だけでなく、途中の判断、ツール利用、修正の過程を記録し、学習へ戻せる形にすることが効いてきます。事後学習を設計するときは、まず直したい失敗の単位を見極め、その失敗に合う教師信号を選ぶところから始めたいですね。

<!-- textlint-disable ja-technical-writing/sentence-length -->

[^api_wrapper]: GPT や Claude の API を叩いて「すごい」と驚けるタスクだけを相手にしているなら、それはそれで幸せです。わたしがやりたいのは、OpenAI や Anthropic が勝手に学習してくれていない、もう少し面倒なタスクです。便利な API を使うにしても、API の外側で驚いて終わりたくはありません。中身の見通しを持ったうえで、振る舞いをどう変えられるのかまで踏み込みたい、という話です。

[^chatgpt]:
    OpenAI. "Introducing ChatGPT."
    OpenAI Blog, 2022. [https://openai.com/index/chatgpt/](https://openai.com/index/chatgpt/)

[^instructgpt]:
    Long Ouyang et al. "Training language models to follow instructions with human feedback."
    arXiv:2203.02155. DOI: 10.48550/arXiv.2203.02155. [https://arxiv.org/abs/2203.02155](https://arxiv.org/abs/2203.02155)

[^christiano]:
    Paul F. Christiano et al. "Deep reinforcement learning from human preferences."
    arXiv:1706.03741. DOI: 10.48550/arXiv.1706.03741. [https://arxiv.org/abs/1706.03741](https://arxiv.org/abs/1706.03741)

[^ppo]:
    John Schulman et al. "Proximal Policy Optimization Algorithms."
    arXiv:1707.06347. DOI: 10.48550/arXiv.1707.06347. [https://arxiv.org/abs/1707.06347](https://arxiv.org/abs/1707.06347)

[^ziegler]:
    Daniel M. Ziegler et al. "Fine-Tuning Language Models from Human Preferences."
    arXiv:1909.08593. DOI: 10.48550/arXiv.1909.08593. [https://arxiv.org/abs/1909.08593](https://arxiv.org/abs/1909.08593)

[^stiennon]:
    Nisan Stiennon et al. "Learning to summarize from human feedback."
    arXiv:2009.01325. DOI: 10.48550/arXiv.2009.01325. [https://arxiv.org/abs/2009.01325](https://arxiv.org/abs/2009.01325)

[^dpo]:
    Rafael Rafailov et al. "Direct Preference Optimization: Your Language Model is Secretly a Reward Model."
    arXiv:2305.18290. DOI: 10.48550/arXiv.2305.18290. [https://arxiv.org/abs/2305.18290](https://arxiv.org/abs/2305.18290)

[^ipo]:
    Mohammad Gheshlaghi Azar et al. "A General Theoretical Paradigm to Understand Learning from Human Preferences."
    arXiv:2310.12036. DOI: 10.48550/arXiv.2310.12036. [https://arxiv.org/abs/2310.12036](https://arxiv.org/abs/2310.12036)

[^orpo]:
    Jiwoo Hong et al. "ORPO: Monolithic Preference Optimization without Reference Model."
    arXiv:2403.07691. DOI: 10.48550/arXiv.2403.07691. [https://arxiv.org/abs/2403.07691](https://arxiv.org/abs/2403.07691)

[^simpo]:
    Yu Meng et al. "SimPO: Simple Preference Optimization with a Reference-Free Reward."
    arXiv:2405.14734. DOI: 10.48550/arXiv.2405.14734. [https://arxiv.org/abs/2405.14734](https://arxiv.org/abs/2405.14734)

[^kto]:
    Kawin Ethayarajh et al. "KTO: Model Alignment as Prospect Theoretic Optimization."
    arXiv:2402.01306. DOI: 10.48550/arXiv.2402.01306. [https://arxiv.org/abs/2402.01306](https://arxiv.org/abs/2402.01306)

[^deepseekmath]:
    Zhihong Shao et al. "DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models."
    arXiv:2402.03300. DOI: 10.48550/arXiv.2402.03300. [https://arxiv.org/abs/2402.03300](https://arxiv.org/abs/2402.03300)

[^deepseek_r1]:
    DeepSeek-AI et al. "DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning."
    arXiv:2501.12948. DOI: 10.48550/arXiv.2501.12948. [https://arxiv.org/abs/2501.12948](https://arxiv.org/abs/2501.12948)

[^qwen3]:
    An Yang et al. "Qwen3 Technical Report."
    arXiv:2505.09388. DOI: 10.48550/arXiv.2505.09388. [https://arxiv.org/abs/2505.09388](https://arxiv.org/abs/2505.09388)

[^qwen35_omni]:
    Qwen Team. "Qwen3.5-Omni Technical Report."
    arXiv:2604.15804. DOI: 10.48550/arXiv.2604.15804. [https://arxiv.org/abs/2604.15804](https://arxiv.org/abs/2604.15804)

[^gemma4]:
    Google DeepMind and Hugging Face. "Introducing Gemma 4."
    Hugging Face Blog, 2026. [https://huggingface.co/blog/gemma4](https://huggingface.co/blog/gemma4)

[^glm52]:
    Z.ai. "GLM-5.2: A High-Performance Open Model with 100K Context."
    Hugging Face Blog, 2026. [https://huggingface.co/blog/zai-org/glm-52-blog](https://huggingface.co/blog/zai-org/glm-52-blog)

[^agentic_rl_survey]:
    Guibin Zhang et al. "The Landscape of Agentic Reinforcement Learning for LLMs: A Survey."
    arXiv:2509.02547. DOI: 10.48550/arXiv.2509.02547. [https://arxiv.org/abs/2509.02547](https://arxiv.org/abs/2509.02547)

[^rlvr]:
    Xumeng Wen et al. "Reinforcement Learning with Verifiable Rewards Implicitly Incentivizes Correct Reasoning in Base LLMs."
    arXiv:2506.14245. DOI: 10.48550/arXiv.2506.14245. [https://arxiv.org/abs/2506.14245](https://arxiv.org/abs/2506.14245)

[^opd_geometry]:
    Zhennan Shen et al. "On the Geometry of On-Policy Distillation."
    arXiv:2606.07082. DOI: 10.48550/arXiv.2606.07082. [https://arxiv.org/abs/2606.07082](https://arxiv.org/abs/2606.07082)

[^distillation]:
    Geoffrey Hinton, Oriol Vinyals, and Jeff Dean. "Distilling the Knowledge in a Neural Network."
    arXiv:1503.02531. DOI: 10.48550/arXiv.1503.02531. [https://arxiv.org/abs/1503.02531](https://arxiv.org/abs/1503.02531)

[^opd_gkd]:
    Rishabh Agarwal et al. "On-Policy Distillation of Language Models: Learning from Self-Generated Mistakes."
    arXiv:2306.13649. DOI: 10.48550/arXiv.2306.13649. [https://arxiv.org/abs/2306.13649](https://arxiv.org/abs/2306.13649)

[^opd_survey]:
    Mingyang Song and Mao Zheng. "A Survey of On-Policy Distillation for Large Language Models."
    arXiv:2604.00626. DOI: 10.48550/arXiv.2604.00626. [https://arxiv.org/abs/2604.00626](https://arxiv.org/abs/2604.00626)

[^opsd]:
    Siyan Zhao et al. "Self-Distilled Reasoner: On-Policy Self-Distillation for Large Language Models."
    arXiv:2601.18734. DOI: 10.48550/arXiv.2601.18734. [https://arxiv.org/abs/2601.18734](https://arxiv.org/abs/2601.18734)

[^segment_sdpo]:
    Aobo Kong et al. "SDPO: Segment-Level Direct Preference Optimization for Social Agents."
    arXiv:2501.01821. DOI: 10.48550/arXiv.2501.01821. [https://arxiv.org/abs/2501.01821](https://arxiv.org/abs/2501.01821)

[^self_distillation_sdpo]:
    Jonas Hübotter et al. "Reinforcement Learning via Self-Distillation."
    arXiv:2601.20802. DOI: 10.48550/arXiv.2601.20802. [https://arxiv.org/abs/2601.20802](https://arxiv.org/abs/2601.20802)

<!-- textlint-enable ja-technical-writing/sentence-length -->
