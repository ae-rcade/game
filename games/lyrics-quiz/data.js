// 문제 불러오기. config.json의 sheetUrl이 비어 있으면 예시 문제(sample.csv)를 써요.
import { parseCSV, toQuestions } from './quiz.js';

const fail = (userMessage) => Object.assign(new Error(userMessage), { userMessage });

async function get(url) {
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`응답 ${res.status}`);
    return await res.text();
  } catch (error) {
    console.error(url, error);
    throw fail('문제를 불러오지 못했어요. 인터넷 연결과 시트의 "웹에 게시" 설정을 확인해 주세요.');
  }
}

export async function loadQuestions() {
  let config;
  try {
    config = JSON.parse(await get('config.json'));
  } catch (error) {
    throw error.userMessage ? error : fail('config.json의 형식이 잘못됐어요.');
  }
  const url = String(config.sheetUrl || '').trim();
  if (/docs\.google\.com\/spreadsheets\/.*\/(edit|view)/.test(url)) {
    throw fail('sheetUrl에는 편집 주소가 아니라 "웹에 게시"에서 만든 CSV 주소를 넣어 주세요.');
  }
  const text = await get(url || 'sample.csv');
  if (/^\s*</.test(text)) throw fail('표 대신 웹페이지가 왔어요. 게시 형식을 CSV로 선택해 주세요.');
  let questions;
  try {
    questions = toQuestions(parseCSV(text));
  } catch (error) {
    throw fail(error.message);
  }
  if (!questions.length) throw fail('시트에 문제가 없어요. 제목과 가사를 한 줄 이상 입력해 주세요.');
  return { questions, sample: !url };
}
