# 成語填填看

一個用 Next.js 16 + React 19 製作的成語填字遊戲。玩法是從交錯的成語格中補上缺字，依提示完成整張盤面。

## 目前玩法

- 8x8 棋盤，自動生成可交叉的成語配置
- 點選格子後，依下方字池填入答案
- 答對會加分並自動前往下一個未完成格
- 答錯會顯示即時回饋並扣分
- 可使用提示直接揭露一格
- 關卡完成後可進入下一關，難度會逐步提高

## 開發

```bash
npm install
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000)。

## 一鍵部署到 Raspberry Pi

已內建 `pi-home` 的部署腳本。

```bash
npm run deploy:pi
```

預設會：

- 同步專案到 `ben@pi-home:/home/ben/apps/idiom`
- 在遠端執行 `npm ci`
- 在遠端執行 `npm run build`
- 用 PM2 重新啟動 `idiom`
- 讓服務跑在 `3001`

如果你要改目標主機或埠號，可以覆蓋環境變數：

```bash
REMOTE_HOST=ben@pi-home REMOTE_DIR=/home/ben/apps/idiom APP_PORT=3001 npm run deploy:pi
```

## 技術

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Framer Motion
- TypeScript

## 後續可加強

- 音效與震動回饋
- 每日挑戰與排行榜
- 手機鍵盤輸入模式
- 成語收藏與題庫分類
