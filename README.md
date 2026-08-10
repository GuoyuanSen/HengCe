# 衡策 HengCe

衡策是一款面向普通投资者的 macOS 与 Windows A 股量化研究工具。它把行情、技术因子、持仓风险和策略回测放在一个安静、可执行的界面中，不连接券商账户，也不会自动下单。

![衡策应用图标](Resources/AppIcon.png)

## 功能

- A 股实时报价与前复权历史日线，双公开数据源自动切换
- 趋势、动量、量能、波动率综合评分
- 动态/静态/TTM PE、机构一致EPS预期与三情景合理估值区间
- 公司业绩预告、行业估值分位和近3日资金景气代理
- 独立每日热点榜，综合板块涨幅、资金连续性与涨跌家数
- 热点板块可原地展开成分股，并从领涨股或成分股直接进入分析
- 股票代码与中文名称模糊搜索，候选结果可一键分析
- 分析页支持今日分时与日 K 切换，并展示买入观察、持有和卖出风控条件
- A 股优选观察池，按趋势、动量、量能、流动性与波动风险综合筛选
- 优选信号 5/10/20 日历史验证、六因子评分拆解与行业分散约束
- 尾盘观察在 14:30–14:40 严格筛选隔夜候选，允许当天无信号并保持空仓
- 市场、行业、风险等级和最低评分筛选
- 本地观察列表，跟踪压力突破、风险线失守和模型评分变化
- 持仓组合波动率、相关性、集中度、分散评分与行业暴露
- 数据来源、完整度、降级状态和 30 分钟过期保护
- MA、RSI、MACD、ATR、支撑、压力和风险线
- 本地持仓管理、浮盈亏与回本距离
- 均线趋势、通道突破、RSI 反转三类回测
- 下一交易日成交，计入佣金、印花税、滑点和 100 股交易单位
- Apple Silicon 与 Windows x64 安装包，数据只保存在本机
- 应用内自动检查 GitHub Release，下载进度可见并通过 SHA-256 校验后打开安装包

## 项目取舍

本项目调研并借鉴了以下成熟开源项目的设计思想，但没有复制它们的源码：

- [Hikyuu](https://github.com/fasiondog/hikyuu)：A 股策略组件、资金管理和风险模型
- [Qlib](https://github.com/microsoft/qlib)：数据、因子、模型和回测流水线
- [VeighNa](https://github.com/vnpy/vnpy)：交易应用、组合管理与网关分层

衡策第一阶段只做研究和模拟。后续若接入券商，应仅使用券商提供的 QMT、XTP、TORA 等合规接口，并增加独立风控和人工确认。

## 系统要求

- macOS 12 或更高版本、Apple Silicon Mac
- Windows 10/11 x64
- 网络连接，用于读取公开行情

## 开发

需要 Node.js 22.12 或更高版本。

```bash
pnpm install
pnpm start
```

运行测试：

```bash
pnpm test
```

生成 `.app` 和 `.dmg`：

```bash
./scripts/build_app.sh
```

Windows x64 版本需在 Windows 环境构建：

```powershell
pnpm run build:win
```

构建产物：

```text
dist/衡策.app
dist/HengCe-Apple-Silicon.dmg
dist/HengCe-Apple-Silicon.dmg.sha256
dist/HengCe-Windows-x64-Setup.exe
dist/HengCe-Windows-x64-Setup.exe.sha256
dist/HengCe-Windows-x64-Portable.zip
dist/HengCe-Windows-x64-Portable.zip.sha256
```

公开测试安装包目前没有购买商业代码签名证书。Windows 首次运行可能显示 SmartScreen 未知发布者提示；请从本仓库 Release 下载并使用同目录的 SHA-256 文件核对完整性。

## 回测说明

回测信号和止损使用当日收盘后能够确认的数据，并统一在下一交易日开盘成交，避免未来函数。回测区间结束时仍持有的仓位按最后收盘价计算未实现盈亏，不虚构卖出成交。默认计入：

- 买卖佣金，最低 5 元
- 卖出印花税
- 单边滑点
- A 股 100 股整数交易单位

历史回测不代表未来收益。任何策略在实盘前都应完成样本外验证、纸面交易和小仓测试。

## 数据与隐私

当前版本通过主进程读取腾讯和东方财富的公开网络行情接口，短暂失败时会重试并自动切换。接口仍可能发生延迟、中断或字段变化，不应作为唯一交易依据。正式商业使用前应更换为具有授权的数据源。

持仓、观察列表和回测参数存储在应用本地 `localStorage` 中，不随源码提交，也不会上传到项目服务器。

## 安全

Electron 渲染进程启用了 `contextIsolation` 和沙箱，关闭 Node.js 直接访问，只通过最小化的预加载接口请求行情。外部链接交给系统浏览器打开。

## 许可证

[MIT License](LICENSE)
