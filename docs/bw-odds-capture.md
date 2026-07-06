# BW 赛前盘口采集

这个能力用于把 BW / 沙盟体育页面里的赛前盘口保存为系统 `odds_snapshots`，减少用户逐场截图的负担。

## 推荐路线：多源赛前盘口同步

日常使用优先跑总入口：

```bash
pnpm sync:match-odds -- --date 2026-07-01 --scope common
```

确认 dry-run 结果里每场都是 `覆盖正常` 后写入：

```bash
pnpm sync:match-odds -- --date 2026-07-01 --scope common --write
```

这个命令会先调用 SABA visitor API，再检查每场的盘口覆盖度。若某场只抓到单一盘口、行数过少，或者 SABA 自身 `MarketCount=1`，结果会标记为 `盘口不完整`，不能当成“全盘口已同步”。

如果当前登录态页面能看到完整盘口，但 visitor API 只返回主让球，优先让 Codex 从当前 Chrome 比赛详情页复制页面文本到 fallback 目录：

```bash
pnpm capture:chrome-odds-text -- --match-id 78
pnpm sync:match-odds -- --date 2026-07-01 --scope common --fallback-text-dir tmp/bw-odds/2026-07-01
pnpm sync:match-odds -- --date 2026-07-01 --scope common --fallback-text-dir tmp/bw-odds/2026-07-01 --write
```

`capture:chrome-odds-text` 会：

- 激活 Chrome 当前页；
- 只执行全选/复制页面文本或只读 AppleScript，不点击任何投注按钮；
- 校验文本是否包含目标比赛双方和足够盘口分类；
- 默认写入 `tmp/bw-odds/<本地比赛日期>/<matchNumber>.txt`。

如果 Chrome 复制的是错误区域，命令会拒绝写入。此时请点进目标比赛详情页，并在盘口内容区域内点一下后重试。

注意：世界杯列表页也可能通过校验，因为它包含目标球队和部分盘口标题；但列表页通常不是完整盘口，且复制文本是逐 token 排列。采集后必须先跑 `sync:match-odds --fallback-text-dir` dry-run，由完整性检查决定是否可写库。若 dry-run 仍显示 `needsFallback=true`，需要点进该比赛详情页再采集。

也可以手动把比赛详情页文本保存到 fallback 目录，再重跑：

```bash
mkdir -p tmp/bw-odds/2026-07-01
pbpaste > tmp/bw-odds/2026-07-01/78.txt
pnpm sync:match-odds -- --date 2026-07-01 --scope common --fallback-text-dir tmp/bw-odds/2026-07-01
pnpm sync:match-odds -- --date 2026-07-01 --scope common --fallback-text-dir tmp/bw-odds/2026-07-01 --write
```

fallback 文件名支持：

- `<matchNumber>.txt`，例如 `78.txt`
- `match-<matchNumber>.txt`
- `<matchId>.txt`
- `<home>-vs-<away>.txt`

## 底层路线：SABA API 自动采集

SABA API 是只读链路，但它可能随登录态、赛事阶段或盘口入口变化而只返回部分盘口。它适合做快速采集和诊断，不再单独作为“全盘口同步已完成”的唯一依据。

```bash
pnpm capture:saba-odds -- --date 2026-06-15 --scope common
```

确认 dry-run 结果中的比赛、盘口和数量正常后写入系统：

```bash
pnpm capture:saba-odds -- --date 2026-06-15 --scope common --write
```

参数说明：

| 参数 | 说明 |
|---|---|
| `--date` | 本地日期，按 Asia/Taipei 口径匹配本地 `matches`。 |
| `--scope common` | 只采集系统已能稳定识别的常用盘口，适合日常决策。 |
| `--scope all` | 采集 SABA 返回的所有可见 selection；未知盘口会用 `saba:<betTypeId>` 作为 market key，主要用于原始归档。 |
| `--bookmaker` | 默认 `bw-shameng-saba`。 |
| `--request-delay-ms` | 全量采集时的请求间隔，默认 `250`；遇到 429 可调到 `750` 或更高。 |
| `--write` | 写入 `odds_snapshots`；不传则只 dry-run。 |

`capture:saba-odds` 输出里会包含 `completeness` 和 `sabaMarketCount`。若状态不是 `complete`，应改用 `sync:match-odds` 的 fallback 路线补盘口。

API 采集会自动完成：

- visitor token 和 odds token 获取，token 只在内存中使用，不打印、不入库；
- SABA 队名到本地中文队名的别名匹配，例如 `象牙海岸 -> 科特迪瓦`、`突尼西亚 -> 突尼斯`；
- SABA 服务器时间转成本地比赛匹配；
- SABA `Price` 折算为系统 `decimalOdds`，并在 `sourceNote` 保留原始 `betTypeId`、`marketId`、`selId`、raw price 和推断格式。

## 文本兜底路线

如果 SABA API 临时不可用，保留复制页面文本解析的兜底方式。优先使用 Chrome 当前页复制命令：

```bash
pnpm capture:chrome-odds-text -- --match-id 10
pnpm capture:chrome-odds-text -- --match-id 10 --method clipboard
pnpm capture:chrome-odds-text -- --match-id 10 --method applescript
```

参数说明：

| 参数 | 说明 |
|---|---|
| `--match-id` | 系统 match id 或比赛编号。 |
| `--date` | fallback 目录日期；不传时按比赛开球时间的 Asia/Taipei 日期生成。 |
| `--output-dir` | 自定义 fallback 目录。 |
| `--method clipboard` | 激活 Chrome 后全选/复制当前页面，适合跨域 SABA iframe。 |
| `--method applescript` | 用 Chrome AppleScript 执行只读 JS，需开启 Chrome `查看 > 开发者 > 允许 Apple 事件中的 JavaScript`。 |
| `--allow-unmatched` | 强制保存校验失败文本，仅用于排查，不用于日常写入。 |
| `--keep-clipboard` | 不恢复原剪贴板内容，方便手工检查复制结果。 |

Chrome 采集失败常见原因：

- Chrome 当前页不是目标比赛详情页；
- 没有在 SABA 盘口内容区域内点一下，复制到的是外层 Betway 页面；
- macOS 没给 Terminal/Codex 辅助功能权限，导致键盘复制被拦截；
- `--method applescript` 未启用 Chrome Apple Events JavaScript。

## 系统 UI 入口

赛事页右上角 `同步` 抽屉里有 `沙巴盘口抓取` 面板：

- `先检查`：调用 `/api/odds/saba-capture` 做 dry-run，只返回比赛匹配和解析数量，不写数据库。
- `写入快照`：dry-run 逻辑相同，但会把解析结果写入 `odds_snapshots`。
- `抓取范围` 默认使用 `常用盘口`；全量归档时再切到 `全量盘口`，并保留较高请求间隔。

UI 和 CLI 共用同一套 SABA provider，写入前都必须先确认比赛匹配、主客顺序、解析数量和 skipped reason。

## 当前版本边界

当前所有采集方式都是只读采集：

- 不点击下注按钮。
- 不创建 `bet_intent`。
- 不创建 `bet_slip`。
- 只把页面盘口解析为赔率快照。

`--scope common` 优先支持这些盘口：

- 全场让球：`full_time:handicap`
- 全场大小：`full_time:total`
- 全场独赢 / 1X2：`full_time:moneyline`
- 全场波胆：`full_time:correct_score`
- 上半场让球：`half_time:handicap`
- 上半场大小：`half_time:total`
- 上半场独赢 / 1X2：`half_time:moneyline`
- 上半场波胆：`half_time:correct_score`

特殊投注、时段、角球、净胜球等如果需要完整原始归档，使用 `--scope all`；日常决策默认仍用 `--scope common`，避免 UI 和分析被未知盘口噪声淹没。

全量归档示例：

```bash
pnpm capture:saba-odds -- --date 2026-06-15 --scope all --request-delay-ms 750
```

`--scope all` 已验证会明显慢于 `common`，并可能触发 SABA 429 限流；日常下注决策不要默认使用全量归档。

## 使用方式

### 1. 准备页面文本

当 API 不可用时，Codex 可以通过 Chrome 只读读取当前 BW 页面文本。优先方式：

```bash
pnpm capture:chrome-odds-text -- --match-id 10
pnpm sync:match-odds -- --date 2026-06-15 --scope common --fallback-text-dir tmp/bw-odds/2026-06-15
```

若 Chrome 当前页复制仍失败，再使用手工兜底：

1. 在 BW 比赛详情页全选或复制页面可见文字。
2. 保存到本地文本文件，例如：

```bash
mkdir -p tmp/bw-odds
pbpaste > tmp/bw-odds/germany-curacao.txt
```

这条路线不再作为首选；只用于 API 失效、页面出现新盘口但接口暂未识别、或需要人工核对某个详情页时。

### 2. Dry-run 检查

`--match-id` 可以传系统 match id，也可以传比赛编号。

```bash
pnpm capture:bw-odds -- --match-id 10 --text-file tmp/bw-odds/germany-curacao.txt --dry-run
```

也可以不落文件，直接从剪贴板走 stdin：

```bash
pbpaste | pnpm capture:bw-odds -- --match-id 10 --stdin --dry-run
```

dry-run 会输出：

- 匹配到的比赛。
- 解析出的 market / selection / line / decimalOdds。
- 被跳过的不稳定盘口段。
- 每条赔率的原始 raw odds 和推断格式。

### 3. 写入系统

确认 dry-run 没问题后：

```bash
pnpm capture:bw-odds -- --match-id 10 --text-file tmp/bw-odds/germany-curacao.txt --write
```

或：

```bash
pbpaste | pnpm capture:bw-odds -- --match-id 10 --stdin --write
```

写入后可在比赛详情页和比赛列表看到 odds snapshot 数量。

## 赔率格式处理

BW 页面可能混合显示：

- 独赢、波胆通常是欧盘，例如 `1.03`、`20.00`、`30.00`。
- 让球和大小球常见香港盘，例如 `0.96` 表示欧盘 `1.96`。
- 若出现负数赔率，采集器按马来盘负数折算。

当前表结构只存 `decimalOdds`，所以采集器会在 `sourceNote` 里保留：

- 页面原始文本。
- rawOdds。
- inferredFormat。

## 后续增强

- 定时采集：赛前 24 小时、6 小时、2 小时、30 分钟。
- 新增采集批次表，保存 API 原始摘要、页面 screenshot 和 raw text。
- 增加盘口变化曲线页面。
