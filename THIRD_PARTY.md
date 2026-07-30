# Open-source research notes

衡策调研了以下开源项目，用于理解成熟量化系统的模块边界和工程实践。

| Project | License | What we learned |
| --- | --- | --- |
| [fasiondog/hikyuu](https://github.com/fasiondog/hikyuu) | Apache-2.0 | Strategy components, money management, slippage and A-share research workflows |
| [microsoft/qlib](https://github.com/microsoft/qlib) | MIT | Data, factor, model, portfolio and backtest pipeline separation |
| [vnpy/vnpy](https://github.com/vnpy/vnpy) | MIT | Application modules, portfolio management and gateway boundaries |

No source code from these projects is included in HengCe. The links are retained for attribution and continued study.

## Bundled installer translation

The Windows installer includes the official `ChineseSimplified.isl` language
file from [jrsoftware/issrc](https://github.com/jrsoftware/issrc), pinned to
commit `683ee7eabfbce807f901c5da83fc5ff1a3ecb693`. It is redistributed under the
[Inno Setup License](https://github.com/jrsoftware/issrc/blob/main/license.txt)
with its upstream notices retained.
