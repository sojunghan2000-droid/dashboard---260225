// version.ts의 버전 번호를 +1 증가시키는 스크립트
// 사용법: node scripts/bump-version.js
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'version.ts');
const content = fs.readFileSync(filePath, 'utf8');
const match = content.match(/APP_VERSION = "v\.(\d+)"/);

if (!match) {
  console.error('version.ts 파싱 실패: APP_VERSION = "v.N" 형식을 찾을 수 없습니다.');
  process.exit(1);
}

const current = parseInt(match[1]);
const next = current + 1;
const newContent = content.replace(/APP_VERSION = "v\.\d+"/, `APP_VERSION = "v.${next}"`);
fs.writeFileSync(filePath, newContent, 'utf8');
console.log(`버전 업: v.${current} → v.${next}`);
