import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const API_URL = 'https://wtxmd52.tele68.com/v1/txmd5/lite-sessions?cp=R&cl=R&pf=web&at=3959701241b686f12e01bfe9c3a319b8';

// Lưu lịch sử để theo dõi cầu
let history = [];

// Các loại cầu và logic
const analyzePattern = (results) => {  // results: mảng ['TAI', 'XIU', ...] mới nhất ở cuối
  if (results.length < 5) return { type: 'UNKNOWN', prediction: 'TAI', confidence: 50, reason: 'Dữ liệu ít' };

  const last10 = results.slice(-10);
  const last5 = results.slice(-5);

  // Đếm TAI/XIU gần đây
  const taiCount = last10.filter(r => r === 'TAI').length;
  const xiuCount = last10.length - taiCount;

  // 1. Cầu Bệt (BET)
  const streak = getStreak(last10);
  if (streak.length >= 4) {
    return {
      type: 'BET',
      prediction: streak[0],
      confidence: Math.min(85, 60 + streak.length * 5),
      reason: `Bệt ${streak.length} tay - Theo cầu`
    };
  }

  // 2. Cầu 1-1 (Đan xen)
  if (isAlternating(last5)) {
    return {
      type: '1-1',
      prediction: last5[last5.length-1] === 'TAI' ? 'XIU' : 'TAI',
      confidence: 75,
      reason: 'Đan xen - Đảo ngược'
    };
  }

  // 3. Cầu 3 nhịp
  const nhip = detect3Nhip(last10);
  if (nhip) {
    return {
      type: '3N',
      prediction: nhip.pred,
      confidence: 68,
      reason: `3 nhịp ${nhip.pattern}`
    };
  }

  // 4. Cầu Bẻ (sau bệt dài)
  if (streak.length >= 3 && last10.length >= 6) {
    const prevStreak = getStreak(last10.slice(0, -streak.length));
    if (prevStreak.length >= 3) {
      return {
        type: 'BECAU',
        prediction: streak[0] === 'TAI' ? 'XIU' : 'TAI',
        confidence: 72,
        reason: 'Bẻ cầu sau bệt'
      };
    }
  }

  // Cân bằng / Trung bình
  const bias = taiCount > xiuCount ? 'TAI' : 'XIU';
  const confidence = 52 + Math.abs(taiCount - xiuCount) * 3;

  return {
    type: 'CTONGHOP',
    prediction: bias,
    confidence: Math.min(68, confidence),
    reason: `Cân bằng - Bias ${bias} (${taiCount}-${xiuCount})`
  };
};

const getStreak = (arr) => {
  if (!arr.length) return [];
  let streak = [arr[arr.length-1]];
  for (let i = arr.length-2; i >= 0; i--) {
    if (arr[i] === streak[0]) streak.push(arr[i]);
    else break;
  }
  return streak;
};

const isAlternating = (arr) => {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] === arr[i-1]) return false;
  }
  return arr.length >= 3;
};

const detect3Nhip = (arr) => {
  // Logic đơn giản phát hiện nhịp lặp
  if (arr.length < 6) return null;
  // Có thể mở rộng sau
  return null;
};

// Fetch dữ liệu mới
const fetchData = async () => {
  try {
    const res = await axios.get(API_URL);
    const list = res.data.list || [];
    const newHistory = list.map(item => item.resultTruyenThong).reverse(); // cũ -> mới
    history = newHistory;
    return newHistory;
  } catch (e) {
    console.error('Lỗi fetch API:', e.message);
    return history;
  }
};

// API chính
// ... (phần import và analyzePattern giữ nguyên)

app.get('/S2KINGLC79', async (req, res) => {
  const results = await fetchData();
  
  if (results.length === 0) {
    return res.json({ error: 'Không lấy được dữ liệu từ API' });
  }

  const latestSession = /* Lấy từ API đầy đủ hơn */ await getLatestSession();
  
  const analysis = analyzePattern(results);
  
  const response = {
    Id: "S2KING",
    Phien: latestSession ? latestSession.id + 1 : results.length + 1,  // Phiên tiếp theo
    Ket_qua_last: results[results.length - 1],
    Du_doan: analysis.prediction,
    Do_tin_cay: analysis.confidence + "%",
    Loai_cau: analysis.type,
    Reason: analysis.reason,
    Thong_ke_du_doan: "Đang cập nhật realtime...",
    Lich_su_gan_nhat: results.slice(-12).map((kq, i) => ({
      Phien: latestSession ? latestSession.id - (results.length - i - 1) : i,
      KQ: kq
    }))
  };

  res.json(response);
});

// Helper mới để lấy info phiên mới nhất
const getLatestSession = async () => {
  try {
    const res = await axios.get(API_URL);
    return res.data.list[0]; // Phiên mới nhất (API trả về mới nhất đầu tiên)
  } catch (e) {
    return null;
  }
};

// Endpoint health
app.get('/', (req, res) => {
  res.send('🚀 S2KING Tài Xỉu Predictor đang chạy - /predict để xem dự đoán');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`✅ Server S2KING chạy tại http://localhost:${PORT}`);
  await fetchData();
  console.log(`📊 Lịch sử: ${history.length} ván`);
});