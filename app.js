const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  const summary = {
    totalRecords: 18,
    totalHours: 52,
    activeSubjects: 6,
    learningGoal: '英語・プログラミング・資格勉強を継続する',
  };

  const recentStudies = [
    { subject: '英語', topic: 'TOEIC単語暗記', duration: '30分', date: '2026-05-20' },
    { subject: '数学', topic: '微分の復習', duration: '45分', date: '2026-05-19' },
    { subject: 'Web開発', topic: 'Expressルーティング', duration: '60分', date: '2026-05-18' },
  ];

  const features = [
    '学習ログの追加・編集・管理',
    '日ごとの学習時間を可視化',
    '科目ごとの学習進捗確認',
    '学習目標の記録とレビュー',
  ];

  res.render('index', { summary, recentStudies, features });
});

app.listen(port, () => {
  console.log(`Study App is running: http://localhost:${port}`);
});
