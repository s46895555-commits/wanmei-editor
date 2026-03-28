# 🎬 玩美趨勢剪輯師績效管理系統 - 部署教學

## 📋 你需要做的事（總共 4 步）

| 步驟 | 做什麼 | 需要時間 |
|------|--------|----------|
| 1 | 建立 Firebase（資料庫） | 10 分鐘 |
| 2 | 把設定填進程式碼 | 2 分鐘 |
| 3 | 上傳到 GitHub | 5 分鐘 |
| 4 | 用 Vercel 部署 | 5 分鐘 |

完成後你會得到一個網址，像是 `wanmei-editor.vercel.app`，全團隊都能打開。

---

## 步驟 1：建立 Firebase（免費資料庫）

### 1.1 註冊 / 登入
1. 打開 https://console.firebase.google.com/
2. 用你的 Google 帳號登入

### 1.2 建立新專案
1. 點「新增專案」（Add project）
2. 專案名稱打：`wanmei-editor`
3. Google Analytics 選「關閉」（不需要）
4. 點「建立專案」
5. 等它跑完，點「繼續」

### 1.3 建立資料庫
1. 左邊選單點「Firestore Database」
2. 點「建立資料庫」（Create database）
3. 選「以正式模式啟動」（Start in production mode）
4. 地區選 `asia-east1`（台灣）
5. 點「啟用」

### 1.4 設定資料庫權限
1. 在 Firestore 頁面上方，點「規則」（Rules）
2. 把裡面的內容全部刪掉，換成以下內容：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /appdata/{document=**} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

3. 點「發布」（Publish）

### 1.5 取得設定資訊
1. 點左上角的「⚙️ 齒輪」→「專案設定」（Project settings）
2. 往下滑到「您的應用程式」
3. 點「</>」（Web）圖示
4. 應用程式名稱打：`wanmei-editor`
5. 不用勾 Firebase Hosting
6. 點「註冊應用程式」
7. 你會看到一段程式碼，裡面有 `firebaseConfig = { ... }`
8. **把這段設定記下來，下一步要用！**

看起來會像這樣：
```
apiKey: "AIzaSyB1234567890abcdefg",
authDomain: "wanmei-editor.firebaseapp.com",
projectId: "wanmei-editor",
storageBucket: "wanmei-editor.appspot.com",
messagingSenderId: "123456789",
appId: "1:123456789:web:abcdef123456"
```

---

## 步驟 2：把設定填進程式碼

1. 打開 `src/firebase.js` 這個檔案
2. 找到 `YOUR_API_KEY`、`YOUR_PROJECT` 等字
3. 替換成你在步驟 1.5 得到的設定值
4. 儲存檔案

替換前：
```
apiKey: "YOUR_API_KEY",
authDomain: "YOUR_PROJECT.firebaseapp.com",
```

替換後（範例）：
```
apiKey: "AIzaSyB1234567890abcdefg",
authDomain: "wanmei-editor.firebaseapp.com",
```

---

## 步驟 3：上傳到 GitHub

### 3.1 註冊 GitHub
1. 打開 https://github.com/
2. 點「Sign up」註冊帳號（免費）

### 3.2 建立新倉庫
1. 登入後，點右上角「+」→「New repository」
2. Repository name 打：`wanmei-editor`
3. 選「Public」
4. 勾「Add a README file」
5. 點「Create repository」

### 3.3 上傳檔案
1. 在倉庫頁面，點「Add file」→「Upload files」
2. 把整個 `wanmei-editor` 資料夾裡的所有檔案拖進去：
   - `package.json`
   - `vite.config.js`
   - `index.html`
   - `src/` 資料夾（裡面有 3 個檔案）
3. 下面 Commit message 打：`初始上傳`
4. 點「Commit changes」

⚠️ 注意：要確保檔案結構正確，`src` 資料夾要是獨立的資料夾，不是把裡面的檔案散放出來。

---

## 步驟 4：用 Vercel 部署

### 4.1 註冊 Vercel
1. 打開 https://vercel.com/
2. 點「Sign Up」
3. 選「Continue with GitHub」（用 GitHub 帳號登入）

### 4.2 部署
1. 登入後，點「Add New...」→「Project」
2. 在列表中找到 `wanmei-editor`，點「Import」
3. Framework Preset 應該自動偵測到 `Vite`
4. 直接點「Deploy」
5. 等 1-2 分鐘，完成！

### 4.3 取得網址
部署完成後，Vercel 會給你一個網址，像是：
`https://wanmei-editor.vercel.app`

這就是你的 app 網址了！🎉

---

## 📱 加到手機桌面（變成 App）

### iPhone
1. 用 Safari 打開你的網址
2. 點底部的「分享」按鈕（方框加箭頭）
3. 選「加入主畫面」
4. 命名為「玩美剪輯」
5. 點「新增」

### Android
1. 用 Chrome 打開你的網址
2. 點右上角「⋮」選單
3. 選「新增至主畫面」

---

## 🔄 之後怎麼更新？

如果你跟我（Claude）討論後想修改功能：

1. 我會給你更新後的檔案
2. 到 GitHub 的 `wanmei-editor` 倉庫
3. 找到要更新的檔案，點它
4. 點右上角「✏️ 編輯」按鈕
5. 貼上新的內容
6. 點「Commit changes」
7. Vercel 會自動重新部署（約 1 分鐘）

---

## ❓ 常見問題

**Q: 資料會保存嗎？**
A: 會！資料存在 Firebase 雲端資料庫，不管從哪裡打開都能看到。

**Q: 團隊成員怎麼看？**
A: 把網址傳給他們就好。不需要登入，但只有知道管理員密碼的人才能編輯。

**Q: 每個月要付錢嗎？**
A: 以目前10個人的使用量，Firebase 和 Vercel 都在免費額度內，不用付錢。

**Q: 我可以用自己的網域嗎？**
A: 可以，在 Vercel 的 Settings → Domains 裡設定。需要另外購買網域（約 NT$300-500/年）。

**Q: 忘記密碼怎麼辦？**
A: 到 Firebase Console → Firestore → appdata 找到 `wanmei-editor-pw` 的文件，裡面就是密碼。
