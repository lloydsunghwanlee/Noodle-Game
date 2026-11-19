/*
 * 면발 끊지 마! — 게임 밸런스 설정값
 * ------------------------------------------------------------
 * 이 파일만 수정하면 난이도와 게임 감각을 조정할 수 있습니다.
 *
 * 속도 단위: "화면 높이 / 초" (sh/s)
 *   - 화면 맨 아래에서 맨 위까지 1초에 드래그 = 1.0 sh/s
 *   - 기기 픽셀 크기와 무관하게 동일한 조건이 되도록 화면 높이로 정규화합니다.
 *
 * 긴장도: 0~100 (화면에 표시하지 않음)
 *   0~29 안정 / 30~59 주의 / 60~99 위험 / 100 끊김
 */
window.NG = window.NG || {};

NG.CONFIG = {
  // 한 판 제한 시간(초). 첫 위쪽 드래그 순간부터 계산.
  timeLimit: 20,

  // 화면 높이 1개만큼 위로 드래그했을 때 늘어나는 면발 길이(cm, 게임 내 단위)
  cmPerScreen: 8,

  // 드래그 속도 측정 스무딩 시간(초). 작을수록 즉각적, 클수록 부드러움
  speedSmoothing: 0.09,

  // 긴장도 단계 경계
  stages: { caution: 30, danger: 60, snap: 100 },

  // 속도가 0인 상태(손을 뗐거나 멈춤)에서 회복 속도 배율
  idleRecoverBonus: 1.15,

  // 3D 표현: 1cm 당 월드 높이
  worldPerCm: 0.06,

  // 라면별 난이도
  //  safeSpeed     : 안전 속도 허용도 (이 속도 이하면 긴장도 회복) — 클수록 쉬움
  //  riseRate      : 위험 누적 속도 (안전 속도 초과 시 초당 긴장도 증가량 기준)
  //  recoverRate   : 안정 회복 속도 (안전 속도 이하일 때 초당 긴장도 감소량)
  //  maxRise       : 초당 긴장도 증가량 상한 (한 번의 순간 동작으로 즉시 끊기지 않도록)
  //  accelSense    : 속도 변화(가속)에 대한 민감도. 급격한 속도 변화 시 긴장도 추가
  //  safeWobble    : 안전 속도가 시간에 따라 흔들리는 정도(비율). 일정 속도 유지를 어렵게 함
  //  wobbleHz      : 안전 속도 흔들림 주기(Hz)
  //  shakeScale    : 떨림 시각 효과 배율
  difficulty: {
    basic:   { safeSpeed: 0.95, riseRate: 60,  recoverRate: 50, maxRise: 90,  accelSense: 0.0,  safeWobble: 0.0,  wobbleHz: 0.0,  shakeScale: 1.0 },
    sagol:   { safeSpeed: 0.82, riseRate: 70,  recoverRate: 42, maxRise: 100, accelSense: 0.0,  safeWobble: 0.0,  wobbleHz: 0.0,  shakeScale: 1.05 },
    spicy:   { safeSpeed: 0.70, riseRate: 80,  recoverRate: 36, maxRise: 110, accelSense: 5.0,  safeWobble: 0.0,  wobbleHz: 0.0,  shakeScale: 1.15 },
    jjajang: { safeSpeed: 0.60, riseRate: 95,  recoverRate: 30, maxRise: 120, accelSense: 3.0,  safeWobble: 0.22, wobbleHz: 0.55, shakeScale: 1.2 },
    bulldak: { safeSpeed: 0.55, riseRate: 100, recoverRate: 26, maxRise: 120, accelSense: 6.0,  safeWobble: 0.08, wobbleHz: 0.8,  shakeScale: 1.45 },
  },

  // 햅틱(진동) — 지원 기기에서만 동작
  haptics: {
    cautionPulseMs: 8,     // 주의 단계 진동 길이
    cautionInterval: 420,  // 주의 단계 진동 간격(ms)
    dangerPulseMs: [18, 34], // 위험 단계 진동 길이 (약 → 강)
    dangerInterval: [200, 80], // 위험 단계 진동 간격 (느림 → 빠름)
    snapPattern: [70],     // 끊김 진동
  },

  // 결과 화면으로 넘어가기 전 연출 시간(ms)
  snapToResultDelay: 1500,
  timeUpToResultDelay: 1000,
};
