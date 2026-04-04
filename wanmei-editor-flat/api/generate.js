// Vercel Serverless Function — Claude API proxy
// API key is stored in Vercel env vars, never exposed to the browser

const EDITOR_PROFILES = {
  "絡絡": "對自己有高標準要求。強項：幾乎全類型影片都能穩定輸出。弱項：太多影片風格相似，較少針對不同業主的特性去放大差異化。",
  "李恩": "需要多鼓勵，容易拖延進度。強項：有靈感時能做出特別出色的效果。弱項：不擅長處理毛片長、架構雜亂的影片類型。",
  "大B": "比較隨性，需要提醒才會主動做。強項：直男思考角度獨特，會活用AI影片製作效果。弱項：內容梳理能力弱，剪輯細節不夠精細，例如音量調節、軌道對齊等。",
  "阿融": "主動學習，有進步意願。強項：影片品質穩定平均。弱項：內容梳理能力需加強。",
  "大泓": "比較隨性，以完成可交付為目標。強項：有跳脫公司常規框架的剪輯效果創意。弱項：不擅長處理毛片長、架構雜亂的影片類型。",
  "小劉": "注重細節但剪輯速度偏慢。強項：細節處理豐富，影片理解力強。弱項：時間緊迫時品質下滑明顯。",
  "萍媽": "對自己有高標準要求。強項：全能型剪輯師，輸出影片幾乎都流暢自然。弱項：素材過多時容易影響情緒與工作效率。",
  "丸子": "可以直接溝通，積極求進步。強項：梗圖、迷因、網路感很強，想法豐富。弱項：細節調整的完整度還不夠到位。",
  "昭昭": "可以直接溝通，問題解決能力強。強項：創作者思維，自媒體與網感高。弱項：對公司商業短影音的架構邏輯還不夠熟悉。",
  "邱郁茜": "可以直接溝通。強項：影片品質穩定，能理解企劃目的。弱項：代替業主進行審片反饋的能力。",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  const { editor, summary, feedback, qualityNotes, projectList } = req.body;
  if (!editor || !summary) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const profile = EDITOR_PROFILES[editor] || "";
  const projectSummary = (projectList || [])
    .filter(p => p.name)
    .map(p => `${p.name}（${p.status || "未記錄"}）${p.notes ? `：${p.notes}` : ""}`)
    .join("；");

  const prompt = `你是一位剪輯團隊的主管助理，負責幫每位剪輯師撰寫本月績效評語。

【剪輯師特質（僅供參考，請勿直接提及）】
${profile}

【本月數據摘要】
${summary}

【本月案子】
${projectSummary || "無案子紀錄"}

【品質紀錄】
${qualityNotes || "無"}

【原始建議方向】
${feedback}

請用溫和但明確的語氣，針對這位剪輯師的個性與特質，寫出個人化的評語。
- 該讚美就真誠讚美，不要浮誇
- 該提醒就明確提醒，不要模糊帶過
- 語氣自然，不要像制式公文
- 每段 2-3 句
- 全程繁體中文

格式（不要 markdown 符號）：
【總結】（本月整體表現總結）
【建議】（給這位剪輯師的個人化建議）`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Claude API error:", err);
      return res.status(502).json({ error: "Claude API error" });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    return res.status(200).json({ text });
  } catch (e) {
    console.error("Fetch error:", e);
    return res.status(500).json({ error: "Internal error" });
  }
}
