/*
 * 라면 종류 정의 — 이름, 난이도 별, 3D 색상과 토핑
 * 난이도 수치는 config.js 의 NG.CONFIG.difficulty 에서 관리합니다.
 */
window.NG = window.NG || {};

NG.RAMEN = [
  {
    id: 'basic', name: '기본라면', stars: 1, desc: '가장 안정적인 면발',
    soup: true,
    broth: '#E9893F', brothDeep: '#D9712B',
    noodle: '#F4CB57',
    bowl: { body: '#FBF3E3', band: '#C9452F', inner: '#FFF9EF' },
    toppings: ['egg', 'onion'],
  },
  {
    id: 'sagol', name: '사골라면', stars: 2, desc: '비교적 안정적인 면발',
    soup: true,
    broth: '#F4EBDB', brothDeep: '#E8DCC6',
    noodle: '#F3DF98',
    bowl: { body: '#E7D4B4', band: '#B79A72', inner: '#F6ECDA' },
    toppings: ['onion'],
  },
  {
    id: 'spicy', name: '매운라면', stars: 3, desc: '속도 변화에 민감한 면발',
    soup: true,
    broth: '#C93A22', brothDeep: '#A82A17',
    noodle: '#F2A447',
    bowl: { body: '#FBF3E3', band: '#C9452F', inner: '#FFF9EF' },
    toppings: ['onion', 'chili'],
  },
  {
    id: 'jjajang', name: '짜장라면', stars: 4, desc: '일정한 속도를 유지하기 어려운 면발',
    soup: false,
    broth: '#4E2C14', brothDeep: '#3E220F',
    noodle: '#8C5A2C',
    bowl: { body: '#FBF3E3', band: '#C9452F', inner: '#FFF9EF' },
    toppings: ['veggie'],
  },
  {
    id: 'bulldak', name: '불닭볶음면', stars: 5, desc: '조금만 빠르게 당겨도 심하게 떨리는 면발',
    soup: false,
    broth: '#D4401D', brothDeep: '#B9310F',
    noodle: '#E8702A',
    bowl: { body: '#FBF3E3', band: '#C9452F', inner: '#FFF9EF' },
    toppings: ['seaweed', 'sesame'],
  },
];

NG.ramenById = function (id) {
  return NG.RAMEN.find(r => r.id === id) || NG.RAMEN[0];
};
