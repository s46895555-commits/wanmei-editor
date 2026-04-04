import { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { storage } from "./firebase";

const EDITORS = ["邱郁茜","李恩","大B","阿融","大泓","小劉","萍媽","絡絡","丸子","昭昭"];
const RANK_EDS = EDITORS.filter(e => e !== "邱郁茜");
const MONTHS = ["2026-01","2026-02","2026-03","2026-04","2026-05","2026-06"];
const ML = {"2026-01":"2026/01","2026-02":"2026/02","2026-03":"2026/03","2026-04":"2026/04","2026-05":"2026/05","2026-06":"2026/06"};
const QUARTERS = ["Q1","Q2","Q3","Q4"];
const GRADES = [{grade:"A",pts:0.5,color:"#B8860B"},{grade:"B",pts:0.3,color:"#7A8B6F"},{grade:"C",pts:0.2,color:"#C07850"},{grade:"D",pts:0.0,color:"#A0522D"}];
const STATUS_OPTIONS = ["達公司標準","延遲3-4天","延遲5-6天","延遲7天以上"];
const STATUS_SCORE = {"達公司標準":100,"延遲3-4天":60,"延遲5-6天":30,"延遲7天以上":0};
const STATUS_COLOR = {"達公司標準":"#7A8B6F","延遲3-4天":"#C07850","延遲5-6天":"#A0522D","延遲7天以上":"#8B0000"};
const PRIZES = [
  {name:"金獎",amount:"$500",color:"#B8860B",prob:0.05,emoji:"🏆"},
  {name:"銀獎",amount:"$300",color:"#8B8B8B",prob:0.15,emoji:"🥈"},
  {name:"銅獎",amount:"$100",color:"#CD7F32",prob:0.50,emoji:"🥉"},
  {name:"安慰獎",amount:"$10",color:"#7A8B6F",prob:0.20,emoji:"🎁"},
  {name:"再接再厲獎",amount:"摃龜",color:"#A09080",prob:0.10,emoji:"💪"},
];

function cD(d,v){ return d > 0 ? Math.round((v/d)*100)/100 : 0; }
function cC(d,v){ return d > 0 ? Math.round((v/(d*3))*10000)/100 : 0; }
function drawPrize(){ const r=Math.random(); let c=0; for(const p of PRIZES){c+=p.prob;if(r<c)return p;} return PRIZES[4]; }

function punctScore(pl) {
  if (!pl || pl.length === 0) return null;
  const scored = pl.filter(p => p.status);
  if (scored.length === 0) return null;
  return Math.round(scored.reduce((s,p) => s + (STATUS_SCORE[p.status]||0), 0) / scored.length);
}

function overallScore(r) {
  if (!r || !r.editingDays) return 0;
  const dp = cD(r.editingDays, r.totalVideos);
  const cr = Math.min(cC(r.editingDays, r.totalVideos), 100);
  const q = r.qualityScore || 0;
  const ps = punctScore(r.projectList);
  const dpScore = dp >= 2.4 ? 100 : Math.round((dp/2.4)*100);
  const pScore = ps !== null ? ps : 50;
  return Math.round(pScore * 0.4 + dpScore * 0.25 + cr * 0.2 + q * 0.15);
}

function genRuleSummary(r) {
  if (!r) return { summary: "", feedback: "" };
  const dp = cD(r.editingDays, r.totalVideos);
  const cr = cC(r.editingDays, r.totalVideos);
  const q = r.qualityScore || 0;
  const pl = r.projectList || [];
  const onTime = pl.filter(p => p.status === "達公司標準").length;
  const late = pl.filter(p => p.status && p.status !== "達公司標準").length;
  const total = pl.filter(p => p.status).length;
  let parts = [], fbParts = [];

  if (total > 0) {
    if (onTime === total) { parts.push("本月所有案子均在時限內完成交審，進度掌控良好"); fbParts.push("交審紀律很棒，繼續保持這樣的節奏"); }
    else if (onTime >= total * 0.7) { parts.push("本月多數案子按時交審，整體進度尚可但仍有改善空間"); fbParts.push("大部分案子都有按時完成，試著把剩下的也拉到標準內"); }
    else { parts.push("本月交審進度需要關注，有" + late + "個案子出現延遲"); fbParts.push("交審時效是目前最需要加強的部分，建議提前規劃時間分配"); }
  }
  if (r.editingDays > 0) {
    if (dp >= 3.0) { parts.push("日績效" + dp + "，表現優異"); fbParts.push("產量出色，效率值得學習"); }
    else if (dp >= 2.4) { parts.push("日績效" + dp + "，達到公司標準"); }
    else { parts.push("日績效" + dp + "，低於目標2.4"); fbParts.push("日績效離目標還有距離，可以檢視剪輯流程哪個環節能優化"); }
  }
  if (q >= 90) parts.push("影片品質優秀");
  else if (q >= 80) parts.push("影片品質良好");
  else if (q >= 70) { parts.push("影片品質普通"); fbParts.push("品質上有些細節可以再注意"); }
  else if (q > 0) { parts.push("影片品質有待加強"); fbParts.push("品質部分需要多花心思"); }

  if (r.qualityNotes) {
    if (/不錯|很好|成熟|剛好/.test(r.qualityNotes)) parts.push("部分作品表現亮眼");
    if (/待改善|略低|太小聲|拖|弱化|生疏/.test(r.qualityNotes)) fbParts.push("部分案子品質反饋需調整，建議交片前多做一次自我審核");
  }
  if (fbParts.length === 0 && parts.length > 0) fbParts.push("整體表現穩定，持續保持，期待下個月更好的表現");

  return { summary: parts.join("。") + (parts.length ? "。" : ""), feedback: fbParts.join("。") + (fbParts.length ? "。" : "") };
}

const INIT = {"2026-03":{
  "邱郁茜":{editingDays:0,totalVideos:0,qualityScore:0,projectList:[{name:"教官",status:"",notes:""},{name:"永齡",status:"",notes:""}],qualityNotes:"",aiSummary:"",aiFeedback:""},
  "李恩":{editingDays:0,totalVideos:0,qualityScore:0,projectList:[{name:"弋果",status:"延遲7天以上",notes:"延遲至3/5才交審完畢"},{name:"艾軒",status:"延遲5-6天",notes:"延遲至3/17交審完畢"},{name:"旭呈",status:"延遲3-4天",notes:"未在原訂日下班前交審"}],qualityNotes:"艾軒：跟男友的互動剪得不錯",aiSummary:"",aiFeedback:""},
  "大B":{editingDays:0,totalVideos:0,qualityScore:0,projectList:[{name:"好家來",status:"達公司標準",notes:"於3/12全部交審完畢"},{name:"洪偉源",status:"達公司標準",notes:"於3/19全數完畢"},{name:"蘇昭龍",status:"延遲3-4天",notes:"未在原訂3/21日下班前交審"}],qualityNotes:"好家來：內容段落不太精準\n洪偉源：節奏不錯，短劇待改善\n蘇昭龍：聲音處理待改善",aiSummary:"",aiFeedback:""},
  "阿融":{editingDays:0,totalVideos:0,qualityScore:0,projectList:[{name:"基隆甜點1",status:"達公司標準",notes:""},{name:"邱柏偉",status:"達公司標準",notes:""},{name:"基隆甜點2",status:"達公司標準",notes:""}],qualityNotes:"基隆甜點：題材不錯但假感需調整\n邱柏偉：節奏處理很好",aiSummary:"",aiFeedback:""},
  "大泓":{editingDays:0,totalVideos:0,qualityScore:0,projectList:[{name:"嘉恩",status:"達公司標準",notes:"3/23-24分批交審"}],qualityNotes:"嘉恩：音樂略小，環境音保留較多",aiSummary:"",aiFeedback:""},
  "小劉":{editingDays:0,totalVideos:0,qualityScore:0,projectList:[{name:"erica",status:"延遲3-4天",notes:""},{name:"潘潘",status:"延遲5-6天",notes:"延至3/15"},{name:"SPA",status:"達公司標準",notes:""},{name:"Ladyme",status:"延遲3-4天",notes:""}],qualityNotes:"erica：節奏尚可\n潘潘：品質略低\nSPA：品質終於拉回來\nLadyme：做得很好",aiSummary:"",aiFeedback:""},
  "萍媽":{editingDays:0,totalVideos:0,qualityScore:0,projectList:[{name:"雞蛋",status:"達公司標準",notes:""},{name:"孫小盈",status:"達公司標準",notes:""},{name:"館長",status:"達公司標準",notes:""}],qualityNotes:"雞蛋：遊戲系列剪輯成熟\n孫小盈：人聲細節可再精進",aiSummary:"",aiFeedback:""},
  "絡絡":{editingDays:0,totalVideos:0,qualityScore:0,projectList:[{name:"蘇聖鈞",status:"達公司標準",notes:""},{name:"彩妍",status:"延遲3-4天",notes:""}],qualityNotes:"蘇聖鈞：背景音樂太小聲、節奏拖\n彩妍：短劇節奏符合短影音",aiSummary:"",aiFeedback:""},
  "丸子":{editingDays:0,totalVideos:0,qualityScore:0,projectList:[{name:"江子朋",status:"達公司標準",notes:""}],qualityNotes:"江子朋：音效較大聲，擺脫框架不錯",aiSummary:"",aiFeedback:""},
  "昭昭":{editingDays:0,totalVideos:0,qualityScore:0,projectList:[{name:"大奶張",status:"達公司標準",notes:""}],qualityNotes:"大奶張：幀數感覺少，色調有點曚",aiSummary:"",aiFeedback:""},
}};

// AI polish via Vercel serverless function (Claude API, key stored server-side)
async function callAI(editor, summary, feedback, qualityNotes, projectList) {
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editor, summary, feedback, qualityNotes, projectList }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.text || null;
  } catch {
    return null;
  }
}

// Fixed storage keys - won't change between updates
const SK = "wanmei-editor-data";
const PW_KEY = "wanmei-editor-pw";
const DRAW_KEY = "wanmei-editor-draws";
const EDPW_KEY = "wanmei-editor-edpws";
const PHOTOS_KEY = "wanmei-editor-photos";
const DEFAULT_EDPWS = {"邱郁茜":"1111","李恩":"2222","大B":"3333","阿融":"4444","大泓":"5555","小劉":"6666","萍媽":"7777","絡絡":"8888","丸子":"9999","昭昭":"0000"};

export default function App() {
  const [pg, setPg] = useState("dashboard");
  const [rec, setRec] = useState({});
  const [qg, setQg] = useState({});
  const [sm, setSm] = useState("2026-03");
  const [se, setSe] = useState(EDITORS[0]);
  const [ef, setEf] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [pwIn, setPwIn] = useState("");
  const [pwErr, setPwErr] = useState(false);
  const [storedPw, setStoredPw] = useState("93377992");
  const [showChangePw, setShowChangePw] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [drawResult, setDrawResult] = useState(null);
  const [drawAnim, setDrawAnim] = useState(false);
  const [drawEditor, setDrawEditor] = useState("");
  const [draws, setDraws] = useState({}); // {month-type: {editor,result}}
  const [genStatus, setGenStatus] = useState({});
  const [editorPws, setEditorPws] = useState({});
  const [analysisEd, setAnalysisEd] = useState(null);
  const [showEdPw, setShowEdPw] = useState(null);
  const [edPwIn, setEdPwIn] = useState("");
  const [edPwErr, setEdPwErr] = useState(false);
  const [photos, setPhotos] = useState({});
  const [showPhotoEdit, setShowPhotoEdit] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get(SK);
        if (res?.value) { const p = JSON.parse(res.value); setRec(p.records || INIT); setQg(p.grades || {}); }
        else setRec(INIT);
      } catch { setRec(INIT); }
      try { const pw = await storage.get(PW_KEY); if (pw?.value) setStoredPw(pw.value); } catch {}
      try { const dr = await storage.get(DRAW_KEY); if (dr?.value) setDraws(JSON.parse(dr.value)); } catch {}
      try { const ep = await storage.get(EDPW_KEY); if (ep?.value) setEditorPws(JSON.parse(ep.value)); else setEditorPws(DEFAULT_EDPWS); } catch { setEditorPws(DEFAULT_EDPWS); }
      try { const ph = await storage.get(PHOTOS_KEY); if (ph?.value) setPhotos(JSON.parse(ph.value)); } catch {}
      setLoading(false);
    })();
  }, []);

  const save = useCallback(async (records, grades) => {
    try { await storage.set(SK, JSON.stringify({records,grades})); setToast("已儲存 ✓"); setTimeout(() => setToast(null), 2000); }
    catch { setToast("儲存失敗"); setTimeout(() => setToast(null), 3000); }
  }, []);

  const saveDraws = useCallback(async (d) => {
    try { await storage.set(DRAW_KEY, JSON.stringify(d)); } catch {}
  }, []);

  const saveEdPws = useCallback(async (pws) => {
    try { await storage.set(EDPW_KEY, JSON.stringify(pws)); } catch {}
  }, []);

  const savePhotos = useCallback(async (ph) => {
    try { await storage.set(PHOTOS_KEY, JSON.stringify(ph)); } catch {}
  }, []);

  const tryEdLogin = () => {
    if (!showEdPw) return;
    const correct = editorPws[showEdPw] || DEFAULT_EDPWS[showEdPw] || "0000";
    if (edPwIn === correct) {
      setAnalysisEd(showEdPw); setSe(showEdPw);
      setShowEdPw(null); setEdPwIn(""); setEdPwErr(false);
    } else { setEdPwErr(true); }
  };

  const tryLogin = () => { if (pwIn === storedPw) { setAdmin(true); setShowPw(false); setPwIn(""); setPwErr(false); } else setPwErr(true); };

  const changePw = async () => {
    if (newPw.length < 4) return;
    setStoredPw(newPw);
    try { await storage.set(PW_KEY, newPw); } catch {}
    setShowChangePw(false); setNewPw("");
    setToast("密碼已更新"); setTimeout(() => setToast(null), 2000);
  };

  const openEdit = (ed, mo) => {
    if (!admin) return;
    const ex = rec[mo]?.[ed] || {};
    setEf({
      editingDays: ex.editingDays || "",
      totalVideos: ex.totalVideos || "",
      qualityScore: ex.qualityScore || "",
      projectList: ex.projectList ? JSON.parse(JSON.stringify(ex.projectList)) : [{name:"",status:"",notes:""}],
      qualityNotes: ex.qualityNotes || ""
    });
    setSe(ed); setSm(mo); setPg("edit");
  };

  const saveRec = async () => {
    const nr = JSON.parse(JSON.stringify(rec));
    if (!nr[sm]) nr[sm] = {};
    const d = parseFloat(ef.editingDays) || 0, v = parseFloat(ef.totalVideos) || 0;
    const existing = nr[sm][se] || {};
    const pl = ef.projectList.filter(p => p.name.trim());
    nr[sm][se] = {...existing, editingDays: d, totalVideos: v, qualityScore: parseFloat(ef.qualityScore) || 0, projectList: pl, qualityNotes: ef.qualityNotes};
    setRec(nr); await save(nr, qg); setPg("records");
  };

  const hf = (f, v) => setEf(prev => ({...prev, [f]: v}));
  const updateProject = (idx, field, val) => {
    setEf(prev => { const pl = [...prev.projectList]; pl[idx] = {...pl[idx], [field]: val}; return {...prev, projectList: pl}; });
  };
  const addProject = () => setEf(prev => ({...prev, projectList: [...prev.projectList, {name:"",status:"",notes:"",videos:""}]}));
  const removeProject = (idx) => setEf(prev => ({...prev, projectList: prev.projectList.filter((_,i) => i !== idx)}));

  const setGrade = async (e, q, g) => { const ng = JSON.parse(JSON.stringify(qg)); if(!ng[e]) ng[e]={}; ng[e][q]=g; setQg(ng); await save(rec,ng); };
  const getBonus = (e) => { const eg=qg[e]||{}; let t=0,c=0; QUARTERS.forEach(q=>{if(eg[q]){const g=GRADES.find(x=>x.grade===eg[q]);if(g){t+=g.pts;c++;}}}); return {est:c>0?Math.round((t/c)*4*10)/10:null}; };

  const genSummary = async (editor, month) => {
    const r = rec[month]?.[editor]; if (!r) return;
    const key = `${editor}-${month}`;
    setGenStatus(prev => ({...prev, [key]: "loading"}));
    const rule = genRuleSummary(r);

    const aiText = await callAI(editor, rule.summary, rule.feedback, r.qualityNotes, r.projectList);

    let finalS = rule.summary, finalF = rule.feedback;
    if (aiText) {
      const m1 = aiText.match(/【總結】\s*([\s\S]*?)(?=【建議】|$)/);
      const m2 = aiText.match(/【建議】\s*([\s\S]*?)$/);
      if (m1) finalS = m1[1].trim();
      if (m2) finalF = m2[1].trim();
    }

    const nr = JSON.parse(JSON.stringify(rec));
    if (!nr[month]) nr[month] = {};
    if (!nr[month][editor]) nr[month][editor] = {...r};
    nr[month][editor].aiSummary = finalS;
    nr[month][editor].aiFeedback = finalF;
    setRec(nr); await save(nr, qg);
    setGenStatus(prev => ({...prev, [key]: "done"}));
  };

  const genAll = async (month) => {
    const eds = EDITORS.filter(e => rec[month]?.[e]);
    for (const e of eds) { await genSummary(e, month); }
  };

  // Draw with one-time limit per month per type
  const doDraw = (editor, type) => {
    const drawKey = `${sm}-${type}`;
    if (draws[drawKey]) return; // already drawn
    setDrawEditor(editor); setDrawAnim(true); setDrawResult(null);
    setTimeout(() => {
      const prize = drawPrize();
      setDrawResult(prize); setDrawAnim(false);
      const nd = {...draws, [drawKey]: {editor, result: prize.name}};
      setDraws(nd); saveDraws(nd);
    }, 2000);
  };

  const hasDrawn = (type) => !!draws[`${sm}-${type}`];

  if (loading) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",background:"#F5F0E8"}}>
      <style>{CSS}</style>
      <div style={{fontSize:40,animation:"breathe 2s ease infinite"}}>🎬</div>
      <p style={{color:"#8B7355",fontFamily:"'Noto Serif TC',serif",fontSize:16,marginTop:16,letterSpacing:4}}>載入中</p>
    </div>
  );

  const mr = rec[sm] || {};
  const act = EDITORS.filter(e => mr[e]);
  const actNum = act.filter(e => mr[e]?.editingDays > 0);
  const rankNum = RANK_EDS.filter(e => mr[e]?.editingDays > 0);
  const nav = [{id:"dashboard",icon:"◈",label:"總覽"},{id:"records",icon:"◇",label:"月度記錄"},{id:"analysis",icon:"○",label:"個人分析"},{id:"rating",icon:"◆",label:"考績評鑑"},{id:"leaderboard",icon:"△",label:"排行榜"}];

  return (
    <div style={S.app}>
      <style>{CSS}</style>
      <div style={S.grain} />

      {/* Modals */}
      {showPw && <div style={S.modal} onClick={() => {setShowPw(false);setPwIn("");setPwErr(false);}}>
        <div style={S.mBox} onClick={e => e.stopPropagation()}>
          <h3 style={{color:"#3D3229",fontSize:16,fontWeight:700,marginBottom:12}}>管理員驗證</h3>
          <input type="password" value={pwIn} onChange={e => {setPwIn(e.target.value);setPwErr(false);}} onKeyDown={e => e.key==="Enter"&&tryLogin()} style={{...S.inp,marginBottom:8}} placeholder="請輸入密碼" autoFocus />
          {pwErr && <p style={{color:"#C07850",fontSize:12,marginBottom:8}}>密碼錯誤</p>}
          <button className="primary-btn" onClick={tryLogin} style={{width:"100%",padding:10}}>解鎖</button>
        </div>
      </div>}

      {showPhotoEdit && <div style={S.modal} onClick={() => setShowPhotoEdit(null)}>
        <div style={S.mBox} onClick={e => e.stopPropagation()}>
          <h3 style={{color:"#3D3229",fontSize:16,fontWeight:700,marginBottom:16}}>{showPhotoEdit} 的照片</h3>
          {photos[showPhotoEdit] && <img src={photos[showPhotoEdit]} alt="" style={{width:90,height:90,borderRadius:"50%",objectFit:"cover",display:"block",margin:"0 auto 16px",border:"3px solid #EAE3D8"}} />}
          <label style={{display:"block",background:"#3D3229",color:"#F5F0E8",padding:"11px 0",borderRadius:6,textAlign:"center",cursor:"pointer",fontSize:15,fontWeight:600,letterSpacing:1,marginBottom:12}}>
            選擇照片
            <input type="file" accept="image/*" style={{display:"none"}} onChange={ev => {
              const file = ev.target.files?.[0]; if (!file) return;
              const reader = new FileReader();
              reader.onload = e2 => {
                const img = new Image();
                img.onload = () => {
                  const size = 300;
                  const canvas = document.createElement("canvas");
                  canvas.width = size; canvas.height = size;
                  const ctx = canvas.getContext("2d");
                  const min = Math.min(img.width, img.height);
                  const sx = (img.width - min) / 2, sy = (img.height - min) / 2;
                  ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
                  const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
                  const np = {...photos,[showPhotoEdit]:dataUrl}; setPhotos(np); savePhotos(np);
                  setShowPhotoEdit(null);
                };
                img.src = e2.target.result;
              };
              reader.readAsDataURL(file);
            }} />
          </label>
          {photos[showPhotoEdit] && <button className="ghost-btn" style={{width:"100%",padding:10}} onClick={() => {
            const np = {...photos}; delete np[showPhotoEdit]; setPhotos(np); savePhotos(np);
            setShowPhotoEdit(null);
          }}>移除照片</button>}
        </div>
        </div>
      </div>}

      {showEdPw && <div style={S.modal} onClick={() => {setShowEdPw(null);setEdPwIn("");setEdPwErr(false);}}>
        <div style={S.mBox} onClick={e => e.stopPropagation()}>
          <h3 style={{color:"#3D3229",fontSize:16,fontWeight:700,marginBottom:4}}>個人分析</h3>
          <p style={{color:"#A09080",fontSize:13,marginBottom:16}}>請輸入 {showEdPw} 的個人密碼</p>
          <input type="password" maxLength={4} value={edPwIn} onChange={e => {setEdPwIn(e.target.value);setEdPwErr(false);}} onKeyDown={e => e.key==="Enter"&&tryEdLogin()} style={{...S.inp,marginBottom:8,letterSpacing:8,textAlign:"center",fontSize:20}} placeholder="••••" autoFocus />
          {edPwErr && <p style={{color:"#C07850",fontSize:12,marginBottom:8}}>密碼錯誤，請重試</p>}
          <button className="primary-btn" onClick={tryEdLogin} style={{width:"100%",padding:10}}>進入</button>
        </div>
      </div>}

      {showChangePw && <div style={S.modal} onClick={() => setShowChangePw(false)}>
        <div style={S.mBox} onClick={e => e.stopPropagation()}>
          <h3 style={{color:"#3D3229",fontSize:16,fontWeight:700,marginBottom:12}}>更改密碼</h3>
          <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} onKeyDown={e => e.key==="Enter"&&changePw()} style={{...S.inp,marginBottom:8}} placeholder="新密碼（至少4字元）" autoFocus />
          <button className="primary-btn" onClick={changePw} style={{width:"100%",padding:10}}>確認更改</button>
        </div>
      </div>}

      {(drawAnim||drawResult) && <div style={S.modal} onClick={() => {if(!drawAnim)setDrawResult(null);}}>
        <div style={S.mBox} onClick={e => e.stopPropagation()}>
          {drawAnim ? <div style={{textAlign:"center",padding:20}}>
            <div style={{fontSize:48,animation:"spin 0.3s linear infinite"}}>🎰</div>
            <p style={{color:"#8B7355",marginTop:12}}>抽獎中...</p>
          </div> : drawResult && <div style={{textAlign:"center",padding:20}}>
            <div style={{fontSize:48,marginBottom:8}}>{drawResult.emoji}</div>
            <h3 style={{color:drawResult.color,fontSize:22,fontWeight:700}}>{drawResult.name}</h3>
            <p style={{fontSize:28,fontWeight:700,color:"#3D3229",fontFamily:"'Cormorant Garamond',serif"}}>{drawResult.amount}</p>
            <p style={{color:"#A09080",fontSize:13,marginTop:8}}>恭喜 {drawEditor}！</p>
            <button className="primary-btn" onClick={() => setDrawResult(null)} style={{marginTop:16,padding:"8px 24px"}}>收下</button>
          </div>}
        </div>
      </div>}

      {/* Header */}
      <header style={S.hdr}>
        <div style={S.hdrIn}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={S.logo}>剪</div>
            <div><h1 style={S.ttl}>玩美趨勢</h1><p style={S.sub}>EDITOR PERFORMANCE SYSTEM</p></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <nav className="desktop-nav">{nav.map(n => <button key={n.id} onClick={() => {setPg(n.id);setMenuOpen(false);}} className={`nav-btn ${pg===n.id||(pg==="edit"&&n.id==="records")?"active":""}`}><span style={{fontSize:10}}>{n.icon}</span> {n.label}</button>)}</nav>
            <button onClick={() => admin?setAdmin(false):setShowPw(true)} style={S.lockBtn}>{admin?"🔓":"🔒"}</button>
            <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen?"✕":"≡"}</button>
          </div>
        </div>
        {admin && <div style={S.admBar}>
          <span>🔓 管理員模式</span>
          <div style={{display:"flex",gap:12}}>
            <button className="link-btn" onClick={() => setShowChangePw(true)} style={{fontSize:11,color:"#F5F0E8"}}>更改密碼</button>
            <button className="link-btn" onClick={() => setAdmin(false)} style={{fontSize:11,color:"#F5F0E8"}}>鎖定</button>
          </div>
        </div>}
        {menuOpen && <nav style={{borderTop:"1px solid #EAE3D8",background:"#FFFDF8"}}>{nav.map(n => <button key={n.id} onClick={() => {setPg(n.id);setMenuOpen(false);}} className={`mobile-nav-btn ${pg===n.id?"active":""}`}>{n.icon}　{n.label}</button>)}</nav>}
      </header>

      {toast && <div style={S.toast}>{toast}</div>}

      <main className="main-content">
        {["records","leaderboard"].includes(pg) && <div style={S.mBar}>{MONTHS.map(m => <button key={m} onClick={() => setSm(m)} className={`month-btn ${sm===m?"active":""}`}>{ML[m]}</button>)}</div>}

        {/* DASHBOARD — org chart */}
        {pg === "dashboard" && <div className="fade-in">
          <h2 className="sec-title"><span className="sec-line" />剪輯團隊<span className="sec-line" /></h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:16,maxWidth:860,margin:"0 auto"}}>
            {EDITORS.map((e,i) => (
              <div key={e} className="card-hover" style={{background:"#FFFDF8",borderRadius:14,padding:"24px 12px 18px",border:"1px solid #EAE3D8",textAlign:"center",animationDelay:`${i*0.04}s`,animation:"fadeIn .5s ease both",position:"relative",cursor:"pointer"}}
                onClick={() => {setSe(e);setPg("analysis");}}>
                {admin && <button onClick={ev => {ev.stopPropagation();setShowPhotoEdit(e);}} style={{position:"absolute",top:8,right:8,background:"transparent",border:"none",cursor:"pointer",fontSize:14,color:"#C4B8A8",lineHeight:1}} title="設定照片">✎</button>}
                <div style={{width:72,height:72,borderRadius:"50%",margin:"0 auto 12px",overflow:"hidden",border:"2px solid #EAE3D8",background:"#3D3229",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {photos[e]
                    ? <img src={photos[e]} alt={e} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={ev => {ev.target.style.display="none";}} />
                    : <span style={{color:"#F5F0E8",fontSize:26,fontFamily:"'Noto Serif TC',serif",fontWeight:700}}>{e[0]}</span>}
                </div>
                <p style={{color:"#3D3229",fontWeight:600,fontSize:15,marginBottom:4}}>{e}</p>
                <p style={{color:"#C4B8A8",fontSize:11,letterSpacing:1}}>剪輯師</p>
              </div>
            ))}
          </div>
        </div>}

        {/* RECORDS */}
        {pg === "records" && <div className="fade-in">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:8}}>
            <h2 className="sec-title" style={{marginBottom:0}}><span className="sec-line" />{ML[sm]}<span className="sec-line" /></h2>
            {admin && <button onClick={() => genAll(sm)} style={S.aiBtn}>🤖 批次產生評語</button>}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>{EDITORS.map(e => {
            const r = mr[e], key = `${e}-${sm}`, st = genStatus[key];
            if (!r) return (
              <div key={e} style={S.rC}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <h3 style={{color:"#3D3229",fontSize:16,fontWeight:600}}>{e}</h3>
                  {admin && <button className="edit-btn" onClick={() => openEdit(e,sm)}>＋新增</button>}
                </div>
                <p style={{color:"#C4B8A8",fontSize:13,marginTop:4}}>尚無記錄</p>
              </div>
            );
            const dp = cD(r.editingDays,r.totalVideos), cr = cC(r.editingDays,r.totalVideos), ps = punctScore(r.projectList);
            return (
              <div key={e} style={S.rC}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <h3 style={{color:"#3D3229",fontSize:16,fontWeight:600}}>{e}</h3>
                  <div style={{display:"flex",gap:6}}>
                    {admin && <button onClick={() => genSummary(e,sm)} disabled={st==="loading"} style={{...S.aiBtn,fontSize:11,padding:"3px 10px",opacity:st==="loading"?0.5:1}}>{st==="loading"?"⏳":"🤖"}</button>}
                    {admin && <button className="edit-btn" onClick={() => openEdit(e,sm)}>編輯</button>}
                  </div>
                </div>
                {r.editingDays > 0 && <div style={S.rSt}>
                  {[{l:"天數",v:r.editingDays},{l:"總支數",v:r.totalVideos},{l:"日績效",v:dp,c:dp>=2.4?"#7A8B6F":"#C07850"}].map((s,j) =>
                    <div key={j} style={S.rSI}><span style={S.rSL}>{s.l}</span><span style={{...S.rSV,color:s.c}}>{s.v}</span></div>
                  )}
                </div>}
                {!r.editingDays && <p style={{fontSize:12,color:"#B8960C",marginBottom:8}}>⏳ 數字待月底結算</p>}
                {r.projectList?.length > 0 && <div style={{marginTop:8}}>
                  {r.projectList.map((p,i) => (
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",borderBottom:i<r.projectList.length-1?"1px solid #EAE3D8":"none",flexWrap:"wrap"}}>
                      <span style={{fontSize:13,color:"#3D3229",fontWeight:500,minWidth:60}}>{p.name}</span>
                      {p.videos ? <span style={{fontSize:12,color:"#B8960C",fontWeight:600,minWidth:32}}>{p.videos}支</span> : null}
                      {p.status && <span style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:(STATUS_COLOR[p.status]||"#888")+"15",color:STATUS_COLOR[p.status],fontWeight:500,border:`1px solid ${STATUS_COLOR[p.status]||"#888"}33`}}>{p.status}</span>}
                      {admin && p.notes && <span style={{fontSize:11,color:"#A09080",fontStyle:"italic"}}>{p.notes}</span>}
                    </div>
                  ))}
                </div>}
                {!admin && r.aiSummary && <p style={{fontSize:12,color:"#7A8B6F",marginTop:8,fontStyle:"italic"}}>✦ 已有本月評語，請至「個人分析」查看</p>}
                {admin && <>
                  {r.qualityNotes && <div style={S.rawBox}><p style={S.rawL}>📋 品質紀錄（僅你可見）</p><p style={{...S.nt,whiteSpace:"pre-wrap",marginTop:2}}>{r.qualityNotes}</p></div>}
                  {r.aiSummary && <div style={S.aiBox}>
                    <p style={{fontSize:12,color:"#7A8B6F",fontWeight:600,marginBottom:4}}>✦ 員工看到的版本</p>
                    <p style={{fontSize:13,color:"#3D3229",lineHeight:1.8}}>{r.aiSummary}</p>
                    {r.aiFeedback && <p style={{fontSize:13,color:"#5C4B3A",lineHeight:1.8,marginTop:8,borderTop:"1px solid #D0DEC8",paddingTop:8}}>💬 {r.aiFeedback}</p>}
                  </div>}
                </>}
              </div>
            );
          })}</div>
        </div>}

        {/* EDIT */}
        {pg === "edit" && admin && <div className="fade-in" style={{maxWidth:600}}>
          <button className="link-btn" onClick={() => setPg("records")} style={{marginBottom:16}}>← 返回</button>
          <h2 className="sec-title" style={{justifyContent:"flex-start"}}>{se}　<span style={{fontWeight:400,fontSize:14,color:"#A09080"}}>{ML[sm]}</span></h2>
          <div style={{marginBottom:20}}>
            <label style={S.fL}>當月案子</label>
            {ef.projectList?.map((p,i) => (
              <div key={i} style={{background:"#FFFDF8",border:"1px solid #EAE3D8",borderRadius:8,padding:12,marginBottom:8}}>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,flexWrap:"wrap"}}>
                  <input type="text" value={p.name} onChange={e => updateProject(i,"name",e.target.value)} style={{...S.inp,flex:2,minWidth:100}} placeholder="案子名稱" />
                  <input type="number" value={p.videos||""} onChange={e => updateProject(i,"videos",e.target.value)} style={{...S.inp,width:70,flex:"none"}} placeholder="支數" min="0" />
                  <select value={p.status} onChange={e => updateProject(i,"status",e.target.value)} style={{...S.inp,width:"auto",minWidth:130,flex:"none",color:p.status?STATUS_COLOR[p.status]||"#3D3229":"#A09080"}}>
                    <option value="">交審狀態</option>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => removeProject(i)} style={{background:"transparent",border:"none",color:"#C07850",cursor:"pointer",fontSize:18}}>✕</button>
                </div>
                <input type="text" value={p.notes} onChange={e => updateProject(i,"notes",e.target.value)} style={{...S.inp,fontSize:12}} placeholder="備註（選填）" />
              </div>
            ))}
            <button onClick={addProject} className="link-btn">＋ 新增案子</button>
          </div>
          <p style={{fontSize:12,color:"#A09080",marginBottom:16,background:"#F9F4EC",padding:"8px 12px",borderRadius:6}}>💡 日績效=支數÷天數 ｜ 完成率=支數÷(天數×3)×100</p>
          <div style={S.fG}>
            {[{f:"editingDays",l:"剪輯天數",p:"12.5",st:"0.125"},{f:"totalVideos",l:"剪輯支數",p:"30"},{f:"qualityScore",l:"品質(0-100)",p:"90"}].map(({f,l,p,st}) =>
              <div key={f} style={S.fGr}><label style={S.fL}>{l}</label><input type="number" step={st} value={ef[f]} onChange={e => hf(f,e.target.value)} style={S.inp} placeholder={p} /></div>)}
            <div style={S.fGr}><label style={S.fL}>日績效（自動）</label><div style={{...S.inp,background:"#F0EBE3",color:"#B8960C",fontWeight:600}}>{ef.editingDays&&ef.totalVideos&&parseFloat(ef.editingDays)>0?cD(parseFloat(ef.editingDays),parseFloat(ef.totalVideos)):"—"}</div></div>
            <div style={S.fGr}><label style={S.fL}>完成率（自動）</label><div style={{...S.inp,background:"#F0EBE3",color:"#B8960C",fontWeight:600}}>{ef.editingDays&&ef.totalVideos&&parseFloat(ef.editingDays)>0?`${cC(parseFloat(ef.editingDays),parseFloat(ef.totalVideos))}%`:"—"}</div></div>
          </div>
          <div style={{...S.fGr,marginTop:12}}><label style={S.fL}>品質紀錄（僅你可見）</label><textarea value={ef.qualityNotes} onChange={e => hf("qualityNotes",e.target.value)} style={{...S.inp,minHeight:80,resize:"vertical"}} /></div>
          <div style={{display:"flex",gap:12,marginTop:28}}>
            <button className="primary-btn" onClick={saveRec}>儲存</button>
            <button className="ghost-btn" onClick={() => setPg("records")}>取消</button>
          </div>
        </div>}

        {/* RATING */}
        {pg === "rating" && <div className="fade-in">
          <h2 className="sec-title"><span className="sec-line" />每季考績評鑑<span className="sec-line" /></h2>
          <div style={{background:"#FFFDF8",border:"1px solid #EAE3D8",borderRadius:10,padding:16,marginBottom:24}}>
            <p style={{color:"#5C4B3A",fontSize:13,lineHeight:2,textAlign:"center"}}>
              系統自動分析 → 管理員確認/修正<br />
              <span style={{color:"#B8860B",fontWeight:600}}>A 0.5</span>　<span style={{color:"#7A8B6F",fontWeight:600}}>B 0.3</span>　<span style={{color:"#C07850",fontWeight:600}}>C 0.2</span>　<span style={{color:"#A0522D",fontWeight:600}}>D 0</span>
              <br /><span style={{fontSize:11,color:"#A09080"}}>Q1=1-3月 Q2=4-6月 Q3=7-9月 Q4=10-12月</span>
            </p>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>{EDITORS.map(e => {
            const eg = qg[e] || {}, bn = getBonus(e), r = mr[e], sc = r ? overallScore(r) : 0;
            const autoGrade = sc >= 85 ? "A" : sc >= 70 ? "B" : sc >= 50 ? "C" : "D";
            return (
              <div key={e} style={S.rtC}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <h3 style={{color:"#3D3229",fontSize:16,fontWeight:600}}>{e}</h3>
                  {bn.est !== null && <span style={{fontSize:13,color:"#B8960C",fontWeight:600}}>年終 {bn.est} 月</span>}
                </div>
                {admin && sc > 0 && <div style={{...S.aiBox,marginBottom:12}}>
                  <p style={{fontSize:13,color:"#5C4B3A"}}>系統評分：<b>{sc}</b> → 建議：<span style={{fontWeight:700,color:GRADES.find(g => g.grade===autoGrade)?.color}}>{autoGrade}級</span>
                    {!eg.Q1 && <button className="link-btn" onClick={() => setGrade(e,"Q1",autoGrade)} style={{fontSize:11,marginLeft:8}}>套用Q1</button>}
                  </p>
                </div>}
                <div className="quarter-grid">{QUARTERS.map(q => (
                  <div key={q} style={S.qC}>
                    <span style={{fontSize:11,color:"#A09080",fontWeight:500}}>{q}</span>
                    <div style={{display:"flex",gap:4,marginTop:6,flexWrap:"wrap",justifyContent:"center"}}>
                      {GRADES.map(g => <button key={g.grade} onClick={() => admin&&setGrade(e,q,g.grade)} style={{...S.gB,...(eg[q]===g.grade?{background:g.color,color:"#fff",borderColor:g.color}:{}),
                        ...(!admin?{opacity:0.5,cursor:"default"}:{})}}>{g.grade}</button>)}
                    </div>
                  </div>
                ))}</div>
                {bn.est !== null && <div style={{marginTop:14}}><div style={S.bnT}><div style={{...S.bnF,width:`${Math.min((bn.est/2)*100,100)}%`}} /><div style={S.bnM} /></div><div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#C4B8A8",marginTop:2}}><span>0</span><span>1.0</span><span>2.0</span></div></div>}
              </div>
            );
          })}</div>
        </div>}

        {/* ANALYSIS */}
        {pg === "analysis" && <div className="fade-in">
          <h2 className="sec-title"><span className="sec-line" />個人分析<span className="sec-line" /></h2>
          {admin ? (<>
            {/* Admin: full editor selector + month selector */}
            <div style={S.eP}>{EDITORS.map(e => <button key={e} onClick={() => setSe(e)} className={`month-btn ${se===e?"active":""}`}>{e}</button>)}</div>
            <div style={{...S.mBar,marginBottom:20}}>{MONTHS.map(m => <button key={m} onClick={() => setSm(m)} className={`month-btn ${sm===m?"active":""}`}>{ML[m]}</button>)}</div>
            {(() => {
              const r = rec[sm]?.[se], bn = getBonus(se);
              const hn = r && r.editingDays > 0, dp = hn ? cD(r.editingDays,r.totalVideos) : 0, cr = hn ? cC(r.editingDays,r.totalVideos) : 0;
              const ps = r ? punctScore(r.projectList) : null;
              const rd = hn ? [{m:"準時度",v:ps||0},{m:"日績效",v:Math.min((dp/3.5)*100,100)},{m:"完成率",v:Math.min(cr,100)},{m:"品質",v:r.qualityScore||0}] : [];
              return <div>
                <div style={S.pC}><div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                  <div style={S.av}><span style={{fontSize:22}}>{se[0]}</span></div>
                  <div><h2 style={{color:"#3D3229",fontSize:22,fontWeight:700}}>{se}</h2>{bn.est!==null&&<span style={{fontSize:13,color:"#B8960C"}}>年終預估 {bn.est} 個月</span>}</div>
                </div></div>
                {!r && <p style={{color:"#C4B8A8",textAlign:"center",padding:"20px 0"}}>{ML[sm]} 尚無數據</p>}
                {hn && <div className="analysis-grid">{[{l:"日績效",v:dp},{l:"完成率",v:`${cr}%`},{l:"準時度",v:ps!==null?`${ps}%`:"—"},{l:"品質",v:r.qualityScore||"—"},{l:"支數",v:r.totalVideos}].map((s,i)=>
                  <div key={i} style={S.aI}><span style={{fontSize:10,color:"#A09080",letterSpacing:1}}>{s.l}</span><span style={{fontSize:22,fontWeight:700,color:"#3D3229",fontFamily:"'Cormorant Garamond',serif"}}>{s.v}</span></div>
                )}</div>}
                {rd.length>0 && <div style={S.cC}><h3 style={S.cL}>能力雷達圖</h3><ResponsiveContainer width="100%" height={280}><RadarChart data={rd}><PolarGrid stroke="#E0D8CC"/><PolarAngleAxis dataKey="m" tick={{fill:"#8B7355",fontSize:12}}/><PolarRadiusAxis tick={{fill:"#C4B8A8",fontSize:10}} domain={[0,100]}/><Radar dataKey="v" stroke="#B8960C" fill="#B8960C" fillOpacity={0.15} strokeWidth={2}/></RadarChart></ResponsiveContainer></div>}
                {r?.projectList?.length>0 && <div style={{...S.cC,marginTop:16}}><h3 style={S.cL}>案子交審狀態</h3>
                  {r.projectList.map((p,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<r.projectList.length-1?"1px solid #EAE3D8":"none"}}>
                    <span style={{fontSize:14,color:"#3D3229",fontWeight:500,minWidth:70}}>{p.name}</span>
                    {p.status&&<span style={{fontSize:12,padding:"3px 10px",borderRadius:12,background:(STATUS_COLOR[p.status]||"#888")+"15",color:STATUS_COLOR[p.status],fontWeight:500}}>{p.status}</span>}
                  </div>)}
                </div>}
                {r&&(r.aiSummary||r.aiFeedback)&&<div style={{...S.cC,marginTop:16}}><h3 style={S.cL}>本月評語</h3>
                  {r.aiSummary&&<p style={{fontSize:14,color:"#3D3229",lineHeight:1.8}}>{r.aiSummary}</p>}
                  {r.aiFeedback&&<div style={{marginTop:12,padding:"12px 16px",background:"#F9F4EC",borderRadius:8}}><p style={{fontSize:13,fontWeight:600,color:"#8B7355",marginBottom:4}}>💬 給你的建議</p><p style={{fontSize:14,color:"#5C4B3A",lineHeight:1.8}}>{r.aiFeedback}</p></div>}
                </div>}
                {r?.qualityNotes&&<div style={{...S.cC,marginTop:16}}><h3 style={{...S.cL,color:"#C07850"}}>🔒 原始紀錄</h3><p style={{...S.nt,whiteSpace:"pre-wrap"}}>{r.qualityNotes}</p></div>}
              </div>;
            })()}
            {/* Admin: password management */}
            <div style={{...S.cC,marginTop:24}}>
              <h3 style={{...S.cL,color:"#C07850"}}>🔒 個人密碼管理</h3>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:8}}>
                {EDITORS.map(e => {
                  const pw = editorPws[e] || DEFAULT_EDPWS[e] || "0000";
                  return <div key={e} style={{display:"flex",alignItems:"center",gap:8,background:"#F9F4EC",padding:"8px 12px",borderRadius:6}}>
                    <span style={{fontSize:13,color:"#3D3229",flex:1}}>{e}</span>
                    <input type="text" maxLength={4} defaultValue={pw} onBlur={ev => {
                      const np={...editorPws,[e]:ev.target.value}; setEditorPws(np); saveEdPws(np);
                    }} style={{width:52,textAlign:"center",background:"#FFFDF8",border:"1px solid #DDD5C8",borderRadius:4,padding:"4px 6px",fontSize:14,color:"#8B7355"}} />
                  </div>;
                })}
              </div>
              <p style={{fontSize:11,color:"#C4B8A8",marginTop:10}}>點擊密碼欄位修改，離開欄位後自動儲存</p>
            </div>
          </>) : analysisEd ? (<>
            {/* Logged-in editor view */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,background:"#F9F4EC",padding:"10px 16px",borderRadius:8}}>
              <span style={{fontSize:14,color:"#5C4B3A",fontWeight:500}}>👤 {analysisEd} 的個人分析</span>
              <button className="link-btn" onClick={() => setAnalysisEd(null)} style={{fontSize:12}}>切換帳號</button>
            </div>
            <div style={{...S.mBar,marginBottom:20}}>{MONTHS.map(m => <button key={m} onClick={() => setSm(m)} className={`month-btn ${sm===m?"active":""}`}>{ML[m]}</button>)}</div>
            {(() => {
              const r = rec[sm]?.[analysisEd], bn = getBonus(analysisEd);
              const hn = r && r.editingDays > 0, dp = hn ? cD(r.editingDays,r.totalVideos) : 0, cr = hn ? cC(r.editingDays,r.totalVideos) : 0;
              const ps = r ? punctScore(r.projectList) : null;
              const rd = hn ? [{m:"準時度",v:ps||0},{m:"日績效",v:Math.min((dp/3.5)*100,100)},{m:"完成率",v:Math.min(cr,100)},{m:"品質",v:r.qualityScore||0}] : [];
              return <div>
                <div style={S.pC}><div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                  <div style={S.av}><span style={{fontSize:22}}>{analysisEd[0]}</span></div>
                  <div><h2 style={{color:"#3D3229",fontSize:22,fontWeight:700}}>{analysisEd}</h2>{bn.est!==null&&<span style={{fontSize:13,color:"#B8960C"}}>年終預估 {bn.est} 個月</span>}</div>
                </div></div>
                {!r && <p style={{color:"#C4B8A8",textAlign:"center",padding:"20px 0"}}>{ML[sm]} 尚無數據</p>}
                {hn && <div className="analysis-grid">{[{l:"日績效",v:dp},{l:"完成率",v:`${cr}%`},{l:"準時度",v:ps!==null?`${ps}%`:"—"},{l:"品質",v:r.qualityScore||"—"},{l:"支數",v:r.totalVideos}].map((s,i)=>
                  <div key={i} style={S.aI}><span style={{fontSize:10,color:"#A09080",letterSpacing:1}}>{s.l}</span><span style={{fontSize:22,fontWeight:700,color:"#3D3229",fontFamily:"'Cormorant Garamond',serif"}}>{s.v}</span></div>
                )}</div>}
                {rd.length>0 && <div style={S.cC}><h3 style={S.cL}>能力雷達圖</h3><ResponsiveContainer width="100%" height={280}><RadarChart data={rd}><PolarGrid stroke="#E0D8CC"/><PolarAngleAxis dataKey="m" tick={{fill:"#8B7355",fontSize:12}}/><PolarRadiusAxis tick={{fill:"#C4B8A8",fontSize:10}} domain={[0,100]}/><Radar dataKey="v" stroke="#B8960C" fill="#B8960C" fillOpacity={0.15} strokeWidth={2}/></RadarChart></ResponsiveContainer></div>}
                {r?.projectList?.length>0 && <div style={{...S.cC,marginTop:16}}><h3 style={S.cL}>案子交審狀態</h3>
                  {r.projectList.map((p,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<r.projectList.length-1?"1px solid #EAE3D8":"none"}}>
                    <span style={{fontSize:14,color:"#3D3229",fontWeight:500,minWidth:70}}>{p.name}</span>
                    {p.status&&<span style={{fontSize:12,padding:"3px 10px",borderRadius:12,background:(STATUS_COLOR[p.status]||"#888")+"15",color:STATUS_COLOR[p.status],fontWeight:500}}>{p.status}</span>}
                  </div>)}
                </div>}
                {r&&(r.aiSummary||r.aiFeedback)&&<div style={{...S.cC,marginTop:16}}><h3 style={S.cL}>本月評語</h3>
                  {r.aiSummary&&<p style={{fontSize:14,color:"#3D3229",lineHeight:1.8}}>{r.aiSummary}</p>}
                  {r.aiFeedback&&<div style={{marginTop:12,padding:"12px 16px",background:"#F9F4EC",borderRadius:8}}><p style={{fontSize:13,fontWeight:600,color:"#8B7355",marginBottom:4}}>💬 給你的建議</p><p style={{fontSize:14,color:"#5C4B3A",lineHeight:1.8}}>{r.aiFeedback}</p></div>}
                </div>}
                {!r?.aiSummary && r?.projectList?.length>0 && <p style={{fontSize:12,color:"#C4B8A8",fontStyle:"italic",marginTop:16,textAlign:"center"}}>評語整理中...</p>}
              </div>;
            })()}
          </>) : (
            /* Not logged in: show editor selection */
            <div>
              <p style={{textAlign:"center",color:"#A09080",fontSize:14,marginBottom:24}}>選擇你的名字，輸入個人密碼查看你的分析</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:10,maxWidth:600,margin:"0 auto"}}>
                {EDITORS.map(e => <button key={e} onClick={() => {setShowEdPw(e);setEdPwIn("");setEdPwErr(false);}} className="card-hover" style={{background:"#FFFDF8",border:"1px solid #EAE3D8",borderRadius:10,padding:"16px 8px",cursor:"pointer",textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
                  <div style={{...S.av,width:40,height:40,fontSize:16}}><span>{e[0]}</span></div>
                  <span style={{fontSize:13,color:"#3D3229",fontWeight:500}}>{e}</span>
                </button>)}
              </div>
            </div>
          )}
        </div>}

        {/* LEADERBOARD */}
        {pg === "leaderboard" && <div className="fade-in">
          <h2 className="sec-title"><span className="sec-line" />{ML[sm]} 排行榜<span className="sec-line" /></h2>
          {rankNum.length > 0 ? <>
            {/* Overall */}
            <div style={S.cC}>
              <h3 style={S.cL}>📊 綜合排名</h3>
              {[...rankNum].sort((a,b) => overallScore(mr[b])-overallScore(mr[a])).map((e,i) => {
                const sc = overallScore(mr[e]), mx = Math.max(...rankNum.map(x => overallScore(mr[x])),1);
                const isFirst = i === 0;
                const drawn = hasDrawn("overall");
                const drawnData = draws[`${sm}-overall`];
                return (
                  <div key={e} style={S.lR}>
                    <div style={S.rk}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                        <span style={{color:"#3D3229",fontWeight:500,fontSize:14}}>{e}</span>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{color:"#B8960C",fontWeight:700}}>{sc}分</span>
                          {isFirst && !drawn && <button onClick={() => doDraw(e,"overall")} style={S.drawBtn}>🎰 抽獎</button>}
                          {isFirst && drawn && <span style={{fontSize:11,color:"#A09080"}}>已抽：{drawnData?.result}</span>}
                        </div>
                      </div>
                      <div style={S.bT}><div style={{...S.bF,width:`${(sc/mx)*100}%`,background:i===0?"#B8960C":i<3?"#8B7355":"#C4B8A8"}} /></div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Daily Performance */}
            <div style={{...S.cC,marginTop:16}}>
              <h3 style={S.cL}>⚡ 日績效排名</h3>
              {[...rankNum].sort((a,b) => cD(mr[b].editingDays,mr[b].totalVideos)-cD(mr[a].editingDays,mr[a].totalVideos)).map((e,i) => {
                const dp = cD(mr[e].editingDays,mr[e].totalVideos);
                const isFirst = i === 0;
                const drawn = hasDrawn("daily");
                const drawnData = draws[`${sm}-daily`];
                return (
                  <div key={e} style={S.lR}>
                    <div style={S.rk}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                        <span style={{color:"#3D3229",fontWeight:500,fontSize:14}}>{e}</span>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{color:dp>=2.4?"#7A8B6F":"#C07850",fontWeight:700}}>{dp}</span>
                          {isFirst && !drawn && <button onClick={() => doDraw(e,"daily")} style={S.drawBtn}>🎰 抽獎</button>}
                          {isFirst && drawn && <span style={{fontSize:11,color:"#A09080"}}>已抽：{drawnData?.result}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {admin && <div style={{...S.cC,marginTop:16}}>
              <h3 style={{...S.cL,color:"#C07850"}}>🔒 抽獎機率</h3>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>{PRIZES.map(p => <div key={p.name} style={{background:"#F9F4EC",borderRadius:6,padding:"6px 12px",fontSize:12,color:"#5C4B3A"}}>{p.emoji} {p.name}（{p.amount}）：{Math.round(p.prob*100)}%</div>)}</div>
            </div>}
          </> : <p style={{color:"#C4B8A8",textAlign:"center",marginTop:40}}>待月底結算後顯示排行</p>}
        </div>}

        {admin && <div style={{textAlign:"center",marginTop:48,paddingBottom:24}}>
          <button className="ghost-btn" onClick={async () => {if(confirm("確定重置所有數據？")){setRec(INIT);setQg({});setDraws({});await save(INIT,{});await saveDraws({});}}} style={{fontSize:11,opacity:0.35,padding:"6px 14px"}}>重置所有數據</button>
        </div>}
      </main>
    </div>
  );
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;600;700&family=Noto+Serif+TC:wght@400;700;900&family=Cormorant+Garamond:wght@400;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}body{background:#F5F0E8}
  input,textarea,select{font-family:'Noto Sans TC',sans-serif}
  input:focus,textarea:focus,select:focus{border-color:#B8960C!important;outline:none}
  ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#D6CBBB;border-radius:3px}
  @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes breathe{0%,100%{opacity:.6}50%{opacity:1}}
  @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  .fade-in{animation:fadeIn .5s ease both}
  .desktop-nav{display:flex;gap:2px}
  .menu-toggle{display:none;background:transparent;border:1px solid #D6CBBB;color:#8B7355;font-size:18px;padding:6px 12px;border-radius:6px;cursor:pointer;font-family:serif}
  @media(max-width:768px){.desktop-nav{display:none!important}.menu-toggle{display:block!important}}
  .nav-btn{background:transparent;border:none;color:#A09080;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;display:flex;align-items:center;gap:6px;transition:all .2s;font-family:'Noto Sans TC',sans-serif;border-bottom:2px solid transparent}.nav-btn:hover{color:#5C4B3A}.nav-btn.active{color:#3D3229;border-bottom-color:#B8960C}
  .mobile-nav-btn{background:transparent;border:none;color:#A09080;padding:12px 16px;cursor:pointer;font-size:15px;text-align:left;font-family:'Noto Sans TC',sans-serif;border-bottom:1px solid #EAE3D8;display:block;width:100%}.mobile-nav-btn.active{color:#3D3229;background:#EDE7DC}
  .month-btn{background:transparent;border:1px solid #DDD5C8;color:#A09080;padding:6px 14px;border-radius:20px;cursor:pointer;font-size:12px;white-space:nowrap;transition:all .2s;font-family:'Noto Sans TC',sans-serif}.month-btn:hover{border-color:#B8960C;color:#8B7355}.month-btn.active{background:#3D3229;border-color:#3D3229;color:#F5F0E8}
  .card-hover{transition:transform .2s,box-shadow .2s;cursor:pointer}.card-hover:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(139,115,85,.08)}
  .link-btn{background:transparent;border:none;color:#B8960C;cursor:pointer;font-size:13px;font-weight:500;text-decoration:underline;text-underline-offset:3px;font-family:'Noto Sans TC',sans-serif}
  .edit-btn{background:transparent;border:1px solid #D6CBBB;color:#8B7355;padding:4px 14px;border-radius:4px;font-size:12px;cursor:pointer;font-family:'Noto Sans TC',sans-serif;transition:all .2s}.edit-btn:hover{border-color:#B8960C;color:#B8960C}
  .primary-btn{background:#3D3229;border:none;color:#F5F0E8;padding:12px 32px;border-radius:6px;font-size:15px;font-weight:600;cursor:pointer;font-family:'Noto Sans TC',sans-serif;transition:all .2s;letter-spacing:1px}.primary-btn:hover{background:#5C4B3A}
  .ghost-btn{background:transparent;border:1px solid #D6CBBB;color:#8B7355;padding:12px 20px;border-radius:6px;font-size:14px;cursor:pointer;font-family:'Noto Sans TC',sans-serif}
  .quarter-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  .sec-title{font-size:16px;font-weight:700;color:#3D3229;margin-bottom:20px;display:flex;align-items:center;justify-content:center;gap:16px;font-family:'Noto Serif TC',serif;letter-spacing:2px}
  .sec-line{flex:1;max-width:60px;height:1px;background:#D6CBBB;display:inline-block}
  .analysis-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:10px;margin-bottom:20px}
  .main-content{max-width:1000px;margin:0 auto;padding:24px 20px 40px;position:relative;z-index:1}
  @media(max-width:600px){
    .quarter-grid{grid-template-columns:repeat(2,1fr)}
    .sec-title{font-size:14px;letter-spacing:1px;gap:10px}
    .sec-line{max-width:30px}
    .analysis-grid{grid-template-columns:repeat(3,1fr)}
    .main-content{padding:16px 14px 40px}
    .month-btn{padding:5px 10px;font-size:11px}
  }
`;

const S = {
  app:{fontFamily:"'Noto Sans TC',sans-serif",background:"#F5F0E8",minHeight:"100vh",color:"#5C4B3A",position:"relative"},
  grain:{position:"fixed",top:0,left:0,right:0,bottom:0,opacity:.025,pointerEvents:"none",zIndex:0,backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"},
  hdr:{background:"rgba(255,253,248,0.95)",borderBottom:"1px solid #EAE3D8",position:"sticky",top:0,zIndex:100,backdropFilter:"blur(12px)"},
  hdrIn:{maxWidth:1000,margin:"0 auto",padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"},
  logo:{width:36,height:36,borderRadius:8,background:"#3D3229",display:"flex",alignItems:"center",justifyContent:"center",color:"#F5F0E8",fontSize:16,fontFamily:"'Noto Serif TC',serif",fontWeight:700},
  ttl:{fontFamily:"'Noto Serif TC',serif",fontSize:18,color:"#3D3229",fontWeight:700,letterSpacing:2,lineHeight:1.2},
  sub:{fontSize:9,color:"#B5A48B",letterSpacing:3,marginTop:1},
  lockBtn:{background:"transparent",border:"1px solid #DDD5C8",borderRadius:6,padding:"6px 10px",cursor:"pointer",fontSize:16,lineHeight:1},
  admBar:{background:"#3D3229",color:"#F5F0E8",padding:"6px 20px",fontSize:11,display:"flex",justifyContent:"space-between",alignItems:"center",letterSpacing:1},
  main:{maxWidth:1000,margin:"0 auto",padding:"24px 20px 40px",position:"relative",zIndex:1},/* use .main-content class instead */
  mBar:{display:"flex",gap:6,marginBottom:28,overflowX:"auto",paddingBottom:4},
  sec:{fontSize:16,fontWeight:700,color:"#3D3229",marginBottom:20,display:"flex",alignItems:"center",justifyContent:"center",gap:16,fontFamily:"'Noto Serif TC',serif",letterSpacing:2},
  tl:{flex:1,maxWidth:60,height:1,background:"#D6CBBB",display:"inline-block"},
  grid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",gap:12},
  card:{background:"#FFFDF8",borderRadius:10,padding:18,border:"1px solid #EAE3D8",animation:"fadeIn .5s ease both"},
  eN:{color:"#3D3229",fontSize:16,fontWeight:600,marginBottom:10},
  sR:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8},
  sI:{flex:1,textAlign:"center"},sN:{display:"block",fontSize:18,fontWeight:700,color:"#3D3229",fontFamily:"'Cormorant Garamond',serif"},
  sLb:{fontSize:10,color:"#A09080",letterSpacing:1},dot:{width:6,height:6,borderRadius:"50%",margin:"4px auto 0"},sDv:{width:1,height:28,background:"#EAE3D8"},
  bT:{height:3,background:"#EAE3D8",borderRadius:2,overflow:"hidden",marginTop:4},bF:{height:"100%",borderRadius:2,transition:"width .8s ease"},
  rC:{background:"#FFFDF8",borderRadius:10,padding:18,border:"1px solid #EAE3D8"},
  rSt:{display:"flex",gap:14,flexWrap:"wrap",padding:"10px 14px",background:"#F9F4EC",borderRadius:8,marginBottom:10},
  rSI:{display:"flex",flexDirection:"column",gap:2},rSL:{fontSize:10,color:"#A09080",letterSpacing:1},rSV:{fontSize:16,fontWeight:600,color:"#3D3229"},
  nt:{fontSize:13,color:"#7A6E5E",lineHeight:1.8,marginTop:6},
  rawBox:{background:"#FFF8F0",border:"1px dashed #E0D0C0",borderRadius:8,padding:12,marginTop:8},
  rawL:{fontSize:11,color:"#C07850",fontWeight:600},
  aiBox:{background:"#F4F8F2",borderRadius:8,padding:14,marginTop:10,border:"1px solid #D0DEC8"},
  aiBtn:{background:"#F9F4EC",border:"1px solid #E0D8CC",borderRadius:6,padding:"8px 16px",fontSize:13,color:"#8B7355",cursor:"pointer",fontFamily:"'Noto Sans TC',sans-serif",fontWeight:500},
  drawBtn:{background:"linear-gradient(135deg,#B8960C,#D4B44C)",border:"none",borderRadius:6,padding:"4px 12px",fontSize:12,color:"#fff",cursor:"pointer",fontWeight:600},
  fG:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12},
  fGr:{display:"flex",flexDirection:"column"},fL:{fontSize:12,color:"#8B7355",fontWeight:500,marginBottom:4},
  inp:{background:"#FFFDF8",border:"1px solid #DDD5C8",borderRadius:6,padding:"10px 12px",color:"#3D3229",fontSize:14,outline:"none",width:"100%",fontFamily:"'Noto Sans TC',sans-serif"},
  rtC:{background:"#FFFDF8",borderRadius:10,padding:20,border:"1px solid #EAE3D8"},
  qR:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12},qC:{textAlign:"center"},
  gB:{width:32,height:32,borderRadius:6,border:"1px solid #DDD5C8",background:"transparent",color:"#8B7355",cursor:"pointer",fontSize:13,fontWeight:600,transition:"all .2s",fontFamily:"'Noto Sans TC',sans-serif"},
  bnT:{height:6,background:"#EAE3D8",borderRadius:3,overflow:"visible",position:"relative"},
  bnF:{height:"100%",background:"linear-gradient(90deg,#B8960C,#D4B44C)",borderRadius:3,transition:"width .6s ease"},
  bnM:{position:"absolute",top:-3,left:"50%",width:2,height:12,background:"#C07850",transform:"translateX(-50%)"},
  pC:{background:"#FFFDF8",borderRadius:12,padding:24,border:"1px solid #EAE3D8",marginBottom:20},
  av:{width:56,height:56,borderRadius:12,background:"#3D3229",display:"flex",alignItems:"center",justifyContent:"center",color:"#F5F0E8",fontFamily:"'Noto Serif TC',serif",fontWeight:700},
  aG:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:10,marginBottom:20},
  aI:{background:"#FFFDF8",borderRadius:8,padding:"12px 14px",border:"1px solid #EAE3D8",display:"flex",flexDirection:"column",gap:2},
  cC:{background:"#FFFDF8",borderRadius:10,padding:20,border:"1px solid #EAE3D8"},
  cL:{fontSize:13,color:"#A09080",marginBottom:16,letterSpacing:1},
  eP:{display:"flex",gap:6,flexWrap:"wrap",marginBottom:24},
  lR:{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:"1px solid #EAE3D8"},
  rk:{width:28,textAlign:"center",fontSize:16,color:"#8B7355",fontWeight:600},
  toast:{position:"fixed",top:76,right:20,background:"#3D3229",color:"#F5F0E8",padding:"10px 20px",borderRadius:6,fontSize:13,zIndex:999,animation:"fadeIn .3s ease",letterSpacing:1},
  modal:{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(61,50,41,0.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(4px)"},
  mBox:{background:"#FFFDF8",borderRadius:12,padding:28,maxWidth:360,width:"100%",border:"1px solid #EAE3D8"},
};
