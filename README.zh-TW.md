# ThinkRail

[English](README.md) | **繁體中文**

[![JetBrains incubator project](https://jb.gg/badges/incubator-plastic.svg)](https://confluence.jetbrains.com/display/ALL/JetBrains+on+GitHub)
[![GitHub stars](https://img.shields.io/github/stars/JetBrains/thinkrail?style=social)](https://star-history.com/#JetBrains/thinkrail&Date)
[![Discord](https://img.shields.io/badge/Discord-Join%20the%20chat-5865F2?logo=discord&logoColor=white)](https://thinkrail.ai/discord)

ThinkRail 是一套每次使用都更進步的 agentic IDE——今天透過活的規格（living specs）認識你的專案，
明天則為自己打造新的能力。

我們以 [`pi`](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) coding agent 為核心打造了
豐富的介面，把工作隔離到一個個獨立的工作區，並透過活的規格與可重複使用的技能，讓代理程式擁有跨對話
持久的專案知識。接下來，我們正在加入完整的擴充支援，讓 ThinkRail 能依你實際的工作方式，打造它需要的
工具。

**官網：** [thinkrail.ai](https://thinkrail.ai/) · **部落格：** [thinkrail.ai/blog](https://thinkrail.ai/blog/) ·
**Discord：** [thinkrail.ai/discord](https://thinkrail.ai/discord)

⭐ 如果 ThinkRail 對你有幫助，記得給它一顆星——這能讓更多人發現它。

<p align="center">
 <a href="https://www.star-history.com/jetbrains/thinkrail">
  <picture><source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/badge?repo=JetBrains/thinkrail&type=rank&theme=dark" /><source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/badge?repo=JetBrains/thinkrail&type=rank" /><img alt="Star History 排名" src="https://api.star-history.com/badge?repo=JetBrains/thinkrail&type=rank" /></picture> <picture><source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/badge?repo=JetBrains/thinkrail&type=trending&theme=dark" /><source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/badge?repo=JetBrains/thinkrail&type=trending" /><img alt="GitHub 每日趨勢儲存庫" src="https://api.star-history.com/badge?repo=JetBrains/thinkrail&type=trending" /></picture>
 </a>
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/readme-assets/workbench-dark.png">
  <img src=".github/readme-assets/workbench-light.png" alt="ThinkRail 工作台：專案面板旁是左側工具欄，列出工作樹工作區及其歸檔架；中央是一場已完成工具步驟的 pi 對話，旁邊是它產生的差異；右側是變更清單上方的規格樹，工具位於邊緣欄" width="900">
</picture>

*一場 `pi` 對話與它所做的變更，範圍限定在隔離的 git 工作樹工作區。*

## 功能特色

- **隔離的工作區。** 把任何 git 儲存庫開啟為專案，並從中切出工作區——每個工作區都是一個
  `git worktree`，擁有自己的分支與工作目錄。多個代理程式可以並行工作，不會碰到你原本的 checkout；
  好的分支就合併，其餘的刪掉即可。你也可以附加既有的工作樹，或明確指定直接在專案資料夾裡工作。完成或
  閒置的工作區會自動歸檔到每個專案專屬的歸檔架——在其 PR（拉取請求）合併或關閉時，或閒置一週後——
  而當你再度在其中工作時，它會立刻回到眼前。頂欄會顯示作用中分支相對於 `origin` 及其 PR 的狀態，
  下一步只要一下點擊：發布、推送，或依據計畫、提交紀錄、你的 PR 範本或代理程式撰寫的草稿，開啟一份
  有完整描述的 PR。GitHub PR 開啟後會顯示 CI 檢查與審查決定，並可將它標記為就緒、把失敗的檢查或
  已分岔的分支交給代理程式處理、以儲存庫上次使用的方式合併、重新開啟，或刪除遠端分支。
- **圍繞代理程式的真正 IDE。** 可分割的工作台，包含 Monaco 編輯器分頁、帶有即時 git 變更標記與
  「已變更」檢視的檔案樹、終端機與文件——全部都限定在作用中的工作區內。你可以在檔案與差異上留下
  錨定的審查留言，並以結構化上下文的形式送進聊天；也可以用你安裝的 IDE 開啟該工作樹。
- **像引擎思考般串流的聊天。** 每個工作區可同時開多場 `pi` 對話，各自使用自己的模型，並即時顯示
  權杖用量與費用。你可以引導正在進行的回合，或排入後續訊息、委派給子代理程式，並共同維護一份由
  代理程式更新、由你編輯的共用計畫——每個完成的步驟都可以獨立提交與審查。
- **在一個輸入框裡找聊天、跑命令。** `⌘K`（或連按兩下 Shift）會開啟命令面板，跨所有開啟的專案
  尋找聊天、工作區與專案，執行應用程式的命令並顯示其快速鍵，也能直接跳到某個設定區段。什麼都不打時，
  它會列出正在等你的聊天。
- **規格即事實依據。** 一張由 `SPEC.md` 檔案構成的連結圖譜就放在程式碼旁邊；代理程式透過專用的
  `spec_*` 工具讀取、搜尋並維護它，讓意圖跨對話留存。唯讀的「規格」工具會把這張圖譜以樹狀結構
  呈現在工作台中。
- **技能與工作流程。** 你為其他 coding agent 準備的可攜式 Agent Skills 會就地讀取；內建的工作流程
  則引導專案設置、設計腦力激盪，以及把 PR 送出去——透過你自己的 `gh` 推送工作區分支並開啟或更新
  其 GitHub PR。
- **殼層之外的代理程式工具。** 網路研究；由代理程式在聊天中直接問你的結構化選擇題，而不是自行
  猜測——題目裡可直接附上 mockup、圖表與差異，你能附上自己的答案與筆記，問題不清楚時可一鍵
  「討論」（Discuss），整張問題卡片完全可用鍵盤操作；還有直接呈現在聊天中的內嵌圖表、選項比較與
  檔案預覽——當代理程式提出 UI 變更時，會展示變更前後的 mockup 對照，你可以像審閱差異一樣在上面
  留言。「設定 → 擴充功能」列出代理程式取得的 ThinkRail 擴充功能，讓你逐一停用（問題工具的豐富
  預覽也可單獨停用）；並能依來源（npm、git 或本機資料夾）安裝任何 `pi` 套件——為你自己或為某個
  儲存庫安裝——顯示每個套件新增了什麼，讓你開關套件、其中個別的擴充功能與技能，以及 pi 的內建
  功能；已開啟的聊天會在其回合結束時套用變更。問題與視覺化工具也各自以純 `pi` 套件的形式發布——
  問題工具是
  `pi install npm:@thinkrail/pi-ask-user-question`
  ([`@thinkrail/pi-ask-user-question`](https://www.npmjs.com/package/@thinkrail/pi-ask-user-question))，
  圖表與預覽是
  `pi install npm:@thinkrail/pi-visualize`
  ([`@thinkrail/pi-visualize`](https://www.npmjs.com/package/@thinkrail/pi-visualize))——終端機裡的
  原生 `pi` 也能取得同樣的工具。
- **MCP 伺服器。** 連接你 `pi` `mcp.json` 裡的 MCP 伺服器（或在設定中新增，另有幾個預設集）：
  凡是伺服器未標記為唯讀的呼叫，ThinkRail 會先在聊天中徵得你同意（或在專案中固定允許你信任的
  工具）；儲存庫定義的伺服器會保持停用，直到你核准；OAuth 伺服器可直接從設定中登入；每場聊天的
  伺服器會與其背景命令、子代理程式一併顯示。
- **你的供應商、你的憑證。** 用 [JetBrains AI](https://www.jetbrains.com/ai/) 登入，或透過
  `pi` 自己的驗證連接任何供應商。ThinkRail 本身沒有帳戶系統。
- **你現有的 pi 設定。** ThinkRail 會讀取你既有的 `pi` 設定（`~/.pi/agent`）。想改用另一份——
  例如個人的 `~/.pi/agent-personal`——或想傳遞額外的環境變數給代理程式、終端機與 MCP 伺服器，
  都在「設定 → 環境」裡設定；下次啟動時生效。啟動時指定的環境變數
  （`PI_CODING_AGENT_DIR=… thinkrail`）仍然優先。
- **你自己的模型伺服器。** 「設定 → 供應商 → **自訂伺服器**」可以連接公司的 LLM 閘道，或跑在
  你自己機器上的模型——任何 OpenAI 相容的伺服器，例如 LiteLLM、sglang、vLLM、Ollama、
  LM Studio 或 llama.cpp。「尋找模型」會列出該伺服器提供的模型，包含它回報的上下文長度與能力。
  伺服器會存進 `pi` 的 `models.json`，因此它的模型會同時出現在聊天模型選擇器與 `pi` CLI 中。
- **桌面應用程式或瀏覽器。** 原生桌面應用程式，或用 `thinkrail` CLI 在瀏覽器中開啟同一套
  應用程式。兩者內嵌相同的引擎宿主；應用程式狀態存放在 `~/.thinkrail`。
- **你的語言。** 「設定 → 語言」會跟隨系統語言或你指定的語言；內建英文、日文、俄文、簡體中文、
  西班牙文與繁體中文。把翻譯好的 `en.json` 放進 `~/.thinkrail/locales`，就能新增 ThinkRail
  尚未內建的語言——儲存後立即生效。代理程式的回覆與工具輸出維持代理程式原始撰寫的語言。
- **你的佈景主題。** 「設定 → 外觀」內建深色、淺色、極簡與高對比主題。複製一份內建的
  `*.theme.json`、改掉它的 id 與顏色，存到 `~/.thinkrail/themes`，就能做出自己的主題。
- **你的字型。** 「設定 → 外觀」可為介面與程式碼挑選字型：內建的 Geist 與 JetBrains Mono、
  電腦上已安裝的任何字型，或你自己放入的字型檔（保存在 `~/.thinkrail/fonts`）；另可設定圖示
  字形的後備字型、程式碼字級、連字，以及文字粗細滑桿。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/readme-assets/specs-dark.png">
  <img src=".github/readme-assets/specs-light.png" alt="「規格」工具從右側邊緣欄開啟，列出專案的規格樹，編輯器中同步呈現產品目標規格" width="900">
</picture>

*專案的規格圖譜以樹狀呈現，旁邊同步渲染規格內容。*

## 安裝

ThinkRail 以兩種可並存的形式發布：原生桌面安裝程式，以及自包含的 `thinkrail` CLI。
兩者都在[發布頁面](https://github.com/JetBrains/thinkrail/releases)上發布，並附有 `SHA256SUMS`。

### 桌面版

下載你的平台對應的 `thinkrail-desktop-*` 安裝檔：

- **macOS 14+（Apple Silicon 或 Intel）**——開啟對應你架構的 DMG：
  `thinkrail-desktop-darwin-arm64.dmg` 或 `thinkrail-desktop-darwin-x64.dmg`。
- **Windows x64**——解壓完整的安裝 ZIP，然後在承載檔（payload）旁邊就地執行其中的安裝執行檔。
- **Linux x64 / ARM64**——解壓安裝 tarball 並執行 `installer`。桌面版需要 glibc 2.38+，以及
  GTK 3、WebKitGTK 4.1、Ayatana AppIndicator 3 與 librsvg 2——Ubuntu 24.04 或更新版本：

  ```bash
  sudo apt install libgtk-3-0 libwebkit2gtk-4.1-0 libayatana-appindicator3-1 librsvg2-2
  ```

打包版的穩定與 nightly 桌面組建會在背景檢查更新，並在**設定 → 更新**中提供：
**下載** → **準備更新** → **安裝並重新啟動**。在你選擇**安裝並重新啟動**之前，不會套用任何變更。
ThinkRail 接著會顯示安裝進度與記錄檔，關閉後以新版本重新開啟。重新啟動後會告訴你更新是否安裝成功；
若失敗，會說明原因並提供重試。只有當安裝包帶有有效的 HTTPS 更新來源識別時，才會出現更新程式；
早於該識別的安裝需要先手動安裝一次。

### 命令列

安裝腳本會下載對應的二進位檔、驗證 SHA-256 檢查碼，並把 `thinkrail` 加進你的 PATH。

**macOS / Linux**（Windows 的 Git Bash 下也適用）：

```bash
curl -fsSL https://raw.githubusercontent.com/JetBrains/thinkrail/main/install.sh | bash
```

**Windows**——cmd 與 PowerShell 都可用同一組命令：

```powershell
powershell -c "irm https://raw.githubusercontent.com/JetBrains/thinkrail/main/install.ps1 | iex"
```

接著執行 `thinkrail`，可選擇帶上一個要開啟為專案的 git 儲存庫：

```bash
thinkrail ~/code/my-repo
```

`thinkrail` 需要 PATH 上有 `git`，以及一個模型供應商——從應用程式內以 JetBrains AI 登入，
或使用你自己的供應商憑證。首次啟動會引導你連接供應商並挑選專案；**開始新專案**會建立一個空的
git 儲存庫（預設在 `~/thinkrail` 下），所以不需要事先準備。**新增專案 → 複製儲存庫…** 會把
Git URL 複製到執行 ThinkRail 的電腦上的新資料夾，並開啟為專案。可選擇上層資料夾與資料夾名稱，
選擇性限制歷史深度，或取消進行中的複製。GitHub 與其他 Git 主機會使用主機上既有的 Git 憑證與
SSH 金鑰；既有目標資料夾絕不會被覆寫。`thinkrail --help` 列出所有旗標；`thinkrail --version`
顯示組建版本。

<details>
<summary><strong>Nightly 組建、釘選版本、更新與解除安裝</strong></summary>

安裝腳本接受 `--channel stable|nightly` 與 `--version`；釘選的版本必須屬於所選的頻道：

```bash
curl -fsSL https://raw.githubusercontent.com/JetBrains/thinkrail/main/install.sh | bash -s -- --channel nightly
curl -fsSL https://raw.githubusercontent.com/JetBrains/thinkrail/main/install.sh | bash -s -- --channel stable --version 0.1.2
curl -fsSL https://raw.githubusercontent.com/JetBrains/thinkrail/main/install.sh | bash -s -- --channel nightly --version 0.2.0-nightly.10
```

Windows 上這些選項是環境變數（`THINKRAIL_CHANNEL`、`THINKRAIL_VERSION`、`THINKRAIL_PREFIX`、
`THINKRAIL_NO_MODIFY_PATH`）：

```powershell
$env:THINKRAIL_CHANNEL='nightly'; irm https://raw.githubusercontent.com/JetBrains/thinkrail/main/install.ps1 | iex   # PowerShell
set "THINKRAIL_CHANNEL=stable" && set "THINKRAIL_VERSION=0.1.2" && powershell -c "irm https://raw.githubusercontent.com/JetBrains/thinkrail/main/install.ps1 | iex"   # cmd
```

已安裝的穩定與 nightly CLI 宿主會在**設定 → 更新**中定期提供**執行更新**。它會在背景執行主機上的
`thinkrail update`——即使 UI 是在另一台機器的瀏覽器中開啟也一樣——更新成功後會請你手動重新啟動
宿主。你也可以在任何平台直接執行 `thinkrail update`：它會以已安裝的頻道重新執行安裝腳本，並替換
`<prefix>/bin/thinkrail[.exe]`；只有在要明確覆寫時才需要傳 `--channel` 或 `--version`。

`thinkrail uninstall` 會移除執行檔、安裝腳本加入的 PATH 項目與安裝中繼資料，並詢問是否一併刪除
`~/.thinkrail` 的應用程式狀態（預設保留——`--remove-data` 會刪除，`-y` 跳過詢問）。

想手動安裝？從發布頁面下載二進位檔與 `SHA256SUMS` 並驗證檢查碼。若要讓自動更新正常運作，請將它
重新命名為 `thinkrail`（Windows 上為 `thinkrail.exe`）並放到 `<prefix>/bin/thinkrail[.exe]`；
以發布檔名保存或放在其他位置的二進位檔，必須手動替換或用腳本重新安裝。

</details>

### 平台備註

| 平台 | 桌面版 | CLI |
| --- | --- | --- |
| macOS Apple Silicon / Intel | DMG | 已簽署的二進位檔 |
| Windows x64 | 已簽署的安裝執行檔與應用程式二進位檔 | 已簽署的 `.exe` |
| Linux x64 / ARM64 | 安裝 tarball，未簽署 | 未簽署 |

JetBrains 會簽署 Windows CLI、桌面安裝執行檔，以及桌面應用程式安裝的每個執行檔與 DLL。
macOS CLI 已簽署，但尚未公證（notarize）。已簽署且公證的桌面 DMG 需要由 JetBrains 協調的
服務管線產出；較早發布的 DMG 與本機打包的版本可能仍未簽署，並被 Gatekeeper 擋下。
Linux 產物未簽署。

## 分析與隱私

ThinkRail 應用程式會收集基本使用事件——啟動、建立聊天、送出訊息、連接供應商——並綁定一組隨機的
安裝 ID。使用分析絕不包含提示詞、程式碼、檔案、憑證或帳戶身分。錯誤報告也一律會送出，綁定同一組
安裝 ID，好讓我們修復當機問題：內容僅限錯誤類型與代碼，以及發生在 ThinkRail 自家程式碼的哪個
位置。錯誤報告絕不包含錯誤訊息文字、檔案路徑、名稱、URL，或來自你的專案與擴充功能的任何內容。
額外的產品使用情形與你如何發現 ThinkRail，只有在開啟**分享額外使用資料**時才會分享；該開關會在
首次執行設定時提供（或在你跳過後緊接著提供），並位於**設定 → 隱私**。從命令列啟動時，
`thinkrail --no-analytics`（或 `THINKRAIL_NO_ANALYTICS=1`）可在該次執行關閉額外分享。開啟額外
分享時，打包版可能在你的瀏覽器中開啟一次 ThinkRail 部落格，把你的安裝與將你帶到這裡的網站造訪
連結起來——僅限你在網站上接受行銷 Cookie、或當地無須同意的情況——該連結會在 30 天後失效。

意見調查與使用分析彼此獨立。ThinkRail 可能邀請你填寫一份簡短調查，你也可以從
**設定 → 意見回饋**開啟。你的答案（包含你輸入的任何內容）只在你按下**傳送**時才會送給
ThinkRail 團隊，無論你的分析設定為何，並綁定同一組隨機安裝 ID——不會綁到你的姓名或帳戶。
請不要在答案中包含機密、程式碼或個人資料；想刪除你送出的答案，請來信 info@thinkrail.ai。

ThinkRail 應用程式與 ThinkRail 網站（[thinkrail.ai](https://thinkrail.ai)）使用 PostHog Inc. 的
服務進行分析。網站也使用 PostHog Surveys 在桌面版下載後收集意見，並且只有在你選擇填寫時才會收集
你的電子郵件地址，用於徵詢進一步回饋與寄送產品更新。PostHog 的隱私權政策見
[posthog.com/privacy](https://posthog.com/privacy)。

## 底層原理

ThinkRail 是一個輕量的宿主，以處理程序內（in-process）的方式執行 `pi`，並將它橋接到豐富的
網頁 UI。`pi` 掌管模型、技能、壓縮、費用與 session 狀態；應用程式掌管工作區、編輯器與傳輸層——
絕不會在你背後自行拼裝提示詞。三個環：

- **引擎宿主**——`packages/server`（加上 `packages/shared`）：以 `Bun.serve` 實現的 HTTP+WS
  宿主，每場聊天一個處理程序內的 `pi` session，由 `apps/cli` 或 `apps/desktop` 啟動。
- **傳輸層**——`packages/contracts`：宿主與 UI 之間有型別、有版本的協定。
- **UI 用戶端**——`apps/web`：React 19 + Zustand + Tailwind v4，獨立發布；透過傳輸層撥接宿主，
  且只依賴 contracts。

[`goal-and-requirements.md`](goal-and-requirements.md) 與 [`architecture.md`](architecture.md)
是正典的產品與設計規格。ThinkRail 以規格先行的方式開發：每個模組旁都有一份 `SPEC.md`，
凡移動邊界、合約或決策的變更，都會在同一個變更中同步更新規格。

## 開發 ThinkRail

你需要 **Bun** 1.4.4（鎖定版本的套件管理器與執行環境）、**Node.js** ≥ 22.19（處理程序內
`pi` 引擎的要求），以及一個已完成驗證的 `pi` 供應商，才能進行代理程式相關工作。

```bash
git clone https://github.com/JetBrains/thinkrail.git
cd thinkrail
bun install
bun run dev                          # 同時啟動 host 與網頁用戶端；Ctrl+C 一併停止
```

```bash
bun run --filter @thinkrail/cli dev  # 瀏覽器啟動器
bun run build:binary                 # 獨立 CLI 產物
bun run desktop:dev                  # 打包並開啟 Electrobun 應用程式
bun run desktop:build                # 僅打包，不開啟
```

[`CONTRIBUTING.md`](CONTRIBUTING.md) 涵蓋各項檢查、端對端測試套件、桌面打包與儲存庫結構。

## 參與貢獻

歡迎貢獻——請見 [`CONTRIBUTING.md`](CONTRIBUTING.md)。本專案與社群受
[行為準則](CODE_OF_CONDUCT.md)規範。

## 社群

到 [Discord](https://thinkrail.ai/discord) 與我們一起提問、分享你正在打造的東西，並與團隊聊聊。
錯誤回報與功能請求請到 [GitHub issues](https://github.com/JetBrains/thinkrail/issues)。

## 授權

以 [Apache License 2.0](LICENSE) 授權發布。
