# 學習能量軌跡 AI 助教

> 把「**學習軌跡 AI 助教 2.0**」與「**AI 藝術能量掃描儀 2.0**」整合成一套**全新的獨立系統**。
> 原有的 `ai-system/` 與 `art-scanner-2.0/` 完全不變動；本系統使用獨立的 Google Apps Script 專案、獨立的 Google Drive 資料夾與獨立的試算表。

---

## 核心特色

1. **單一免登入收件入口**：學生填班級、座號、姓名即可上傳 JPG、PNG 或 PDF（10 MB 內），支援二進位檔頭防偽、UUID 防重複送出與每日上限。
2. **Gemini 自動判斷作品類型**：
   - **探究筆記**：萃取主題、3–5 個關鍵詞、150 字內摘要、對應 SDGs，並依五維探究素養（主題聚焦、探究深度、資料條理、反思洞見、視覺呈現）評分。
   - **藝術創作**：可選 13 種創作主題或自訂主題，依五維美感規準（主題語意 35%、結構重心 20%、色彩豐富 15%、光影明暗 15%、筆觸質感 15%）評分，提供**三分構圖線、視覺重心熱區、主調色票**三種疊圖診斷。
   - **無法辨識／文不對題**：給予 10–30 分並說明原因，請學生重新挑戰。
3. **個人能量軌跡（合併後的新功能）**：學生憑本人任一張收據編號，即可查看自己整學期每一次繳交串成的能量折線、最近三次雷達疊圖、老師正式評語與胸章收集。
4. **58mm 創客胸章與 A4 證書**：能量達 85 分即可裁切照片或使用自動產生的能量徽記，匯出 **300 DPI 三規同心圓（70mm 出血／58mm 包邊／50mm 安全線）印刷檔**與 **A4 橫式認證證書**。
5. **老師在環（Human-in-the-loop）**：
   - AI 評語預設標示為「草稿」，老師在後台確認或改寫後才成為正式評語。
   - 胸章支援兩種模式：**AI 達 85 分自動發放**（預設）或**老師核准後才發放**。
6. **一鍵匯出成果冊（Google Docs）**：依學生分頁，收錄個人能量軌跡摘要、每次作品評語與已發放的胸章圖。
7. **試算表「系統設定」直接管理 API Key**：試算表內建 `系統設定` 工作表，老師可直接在試算表 `B2` 儲存格貼上 `GEMINI_API_KEY` 或修改作業清單與管理密碼，無須進程式碼編輯器。

---

## 線上入口與部署資訊

- **GitHub Pages 展示與收件入口**：https://coolokey.github.io/learning-energy-tracker/
- **Google Apps Script Web App (`/exec`)**：https://script.google.com/macros/s/AKfycbyaGok5hmsET-nITUopgK1W97JTMf0czfVc2KUOA7D2Xrmr24vIPBGLpiNY0L0grspO/exec
- **Google Apps Script 專案編輯器**：https://script.google.com/d/1_WmPgM1oIK3oXSz3PA0EvMG-GVQIZ1NSo-SR-AY7hDhhOBXwKbti0kAb/edit

### 如何在試算表內設定 `GEMINI_API_KEY`
1. 首次進入系統後，系統會自動在您的 Google Drive 建立「**學習能量軌跡AI收件空間**」資料夾與「**學習能量軌跡AI彙整總表**」試算表（也可點右上角「教師後台」（預設密碼 `admin888`）→「系統設定」→「**開啟試算表『系統設定』分頁**」直接打開）。
2. 在試算表下方切換至「**系統設定**」工作表。
3. 在 `GEMINI_API_KEY` 右側的 **`B2` 儲存格**直接貼上您的 Gemini API Key，貼上後立即生效！

---

## 獨立部署步驟（約 5 分鐘）

### 步驟 1：建立新的 Google Drive 收件資料夾
1. 到 [Google Drive](https://drive.google.com/) 新增一個資料夾（例如 `學習能量軌跡收件空間`），共用保持「**限制**」（私人）。
2. 點進資料夾，複製網址 `/folders/` 後面的那串英數字，這就是 `FOLDER_ID`。

### 步驟 2：建立新的 Google Apps Script 專案
1. 到 [Google Apps Script](https://script.google.com/) 點「**新專案**」，命名為 `學習能量軌跡AI助教`。
2. 將本資料夾的 [`Code.gs`](./Code.gs) 貼入編輯器的 `Code.gs`。
3. 點左側「檔案 ＋ → HTML」，命名為 `index`（全小寫），將 [`index.html`](./index.html) 的內容貼入。
4. 點左側「專案設定 ⚙」，勾選「在編輯器中顯示 `appsscript.json` 資訊清單檔案」，回到編輯器把 [`appsscript.json`](./appsscript.json) 貼入儲存。

### 步驟 3：設定指令碼屬性（Script Properties）
在「專案設定 ⚙ → 指令碼屬性」新增以下屬性：

| 屬性名稱 | 必填 | 範例值 | 說明 |
| :--- | :---: | :--- | :--- |
| `FOLDER_ID` | 是 | `1AbC...` | 步驟 1 複製的新資料夾 ID |
| `ADMIN_PASSWORD` | 是 | 請自訂 4 碼以上密碼 | 教師後台登入密碼（未設定時後台會拒絕登入） |
| `GEMINI_API_KEY` | 選填 | `AIzaSy...` | Google AI Studio 申請之 API Key；也可登入網頁後台再填 |
| `ASSIGNMENTS` | 選填 | `自主學習探究,藝術創作挑戰` | 作業下拉選單，逗點分隔（可在後台隨時改） |
| `BADGE_APPROVAL` | 選填 | `auto` 或 `teacher` | `auto`＝85 分自動發胸章；`teacher`＝老師核准才發 |
| `GALLERY_PUBLIC` | 選填 | `on` 或 `off` | 是否開放「班級成果星空」 |
| `DAILY_LIMIT` | 選填 | `200` | 全系統每日收件上限 |

### 步驟 4：部署為網頁應用程式
1. 點右上角「**部署 → 新增部署作業**」，種類選「**網頁應用程式**」。
2. 執行身分選「**我**」，誰可以存取選「**所有人**」。
3. 完成授權後，複製 `/exec` 結尾的網址即可給學生使用。

---

## 本機單元測試

```bash
node --test learning-energy-tracker/tests/backend.test.cjs
```
