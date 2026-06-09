# 资金数据

这里记录资金和持仓。真实平台账户可以只有一个，但系统内部要区分 User 和 Codex 两套决策/额度。

默认账本：

| 账本 | 归属 | 说明 |
|---|---|---|
| `user` | 用户 | 你的判断和投入。 |
| `codex` | Codex | Codex 自主决策额度，可是真实资金，也可以是模拟记录。 |

实际下单人默认都是 `user`。如果 Codex 决策使用真实资金，记录为 `decision_by=codex`、`placed_by=user`、`is_real_money=true`。
