# 면발 끊지 마! (Don't Break the Noodle!)

라면 면발을 젓가락으로 천천히 당겨, 끊어지지 않게 최대한 길게 뽑아내는 기록 경쟁형 모바일 미니게임입니다.
Three.js(WebGL) 기반의 모바일 웹앱(PWA)이며, 설치 없이 브라우저에서 바로 플레이하거나 홈 화면에 앱처럼 설치할 수 있습니다.

## 바로 플레이하기
- **claude.ai 링크**: 스레드에 전달된 Artifact 링크를 스마트폰에서 열면 바로 플레이할 수 있습니다.
- **단일 파일**: `dist/noodle-game.html` 하나만으로도 동작합니다(three.js 포함, 서버 불필요). 단, 글꼴은 첫 실행 시 Google Fonts에서 받아옵니다.

## 홈 화면 설치(PWA)로 배포하기
PWA 설치와 오프라인 플레이는 HTTPS 호스팅이 필요합니다. 이 폴더 전체(`dist/`, `node_modules/` 제외해도 됨)를 그대로 올리면 됩니다.

1. **GitHub Pages**: 저장소에 폴더 내용을 올리고 Settings → Pages에서 배포
2. **Netlify Drop**: https://app.netlify.com/drop 에 폴더를 끌어다 놓기
3. 스마트폰에서 주소 열기
   - iPhone(Safari): 공유 버튼 → **홈 화면에 추가**
   - Android(Chrome): 메뉴 → **앱 설치** 또는 **홈 화면에 추가**

한 번 접속하면 서비스 워커(`sw.js`)가 모든 파일을 저장해 이후 인터넷 없이도 플레이와 기록 저장이 됩니다.

### 로컬에서 실행
```bash
cd noodle-game
python3 -m http.server 8080     # 또는 npx serve .
# 같은 Wi-Fi의 휴대폰에서 http://<PC의 IP>:8080 접속
```

### 단일 파일 다시 빌드
```bash
node build.mjs     # dist/noodle-game.html, dist/artifact.html 생성
```

## 네이티브 앱(Android APK / iOS)으로 만들기
이 프로젝트는 그대로 [Capacitor](https://capacitorjs.com)로 감쌀 수 있습니다.
```bash
npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init "면발 끊지 마" com.example.noodle --web-dir www
mkdir www && cp -r index.html manifest.webmanifest sw.js css js vendor icons www/
npx cap add android && npx cap open android   # Android Studio에서 Build → Build APK
npx cap add ios && npx cap open ios           # macOS + Xcode에서 실행/배포
```
네이티브로 감싸면 iOS에서도 `@capacitor/haptics` 플러그인으로 진동을 완전히 지원할 수 있습니다(`js/fx.js`의 `Haptics.pulse`만 교체).

## 폴더 구조
| 경로 | 내용 |
|---|---|
| `index.html` | 네 화면의 UI 컴포넌트(HTML) |
| `css/style.css` | 색상·타이포그래피·버튼·카드 스타일 |
| `js/config.js` | **난이도·밸런스 설정값(여기만 고치면 조정 가능)** |
| `js/ramen.js` | 라면 5종의 이름·별·국물/면/그릇 색상·토핑 |
| `js/models.js` | 그릇, 국물, 그릇 속 면, 토핑, 젓가락, 김 3D 모델(코드로 생성) |
| `js/noodle.js` | 실시간으로 길어지고 떨리는 면발 메시, 끊김(로프 시뮬레이션), 국물 튐 |
| `js/stage.js` | 렌더러·조명·그림자·카메라 자동 구도, 카드용 3D 썸네일 |
| `js/game.js` | 드래그 입력, 길이 계산, 긴장도, 제한 시간, 종료 판정 |
| `js/fx.js` | 효과음(Web Audio 합성), 진동, 최고 기록 저장(localStorage) |
| `js/main.js` | 화면 흐름(온보딩 → 선택 → 플레이 → 결과), 백그라운드 처리 |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA(오프라인·설치) |
| `vendor/three.min.js` | Three.js r160 (MIT) |

3D 에셋은 외부 모델 파일 없이 모두 코드로 절차적으로 생성됩니다. 모양·색을 바꾸려면 `js/models.js`, `js/ramen.js`를 수정하세요.

## 게임 시스템 요약
- **길이**: 위쪽 드래그 거리 ÷ 화면 높이 × `cmPerScreen`(기본 8). 화면 크기와 무관하게 동일 조건. 아래로 움직이거나 손을 떼면 증가 없음. 손을 떼고 다시 아래에서 당겨도 길이 유지.
- **속도**: 터치 이동량과 프레임 시간으로 "화면 높이/초" 단위 속도를 측정(스무딩 적용).
- **긴장도(0~100, 비표시)**: 안전 속도 초과 시 증가, 이하일 때 감소. 0~29 안정 / 30~59 주의(미세 떨림·약한 진동) / 60~99 위험(빠른 떨림·강한 진동·떨림음) / 100 끊김.
- **라면별 차이**: 안전 속도·위험 누적·회복 속도에 더해 매운라면은 속도 변화(가속)에 민감, 짜장라면은 안전 속도가 시간에 따라 흔들려 일정 속도 유지가 어려움, 불닭볶음면은 가장 좁은 허용 범위와 가장 큰 떨림.
- **제한 시간**: 첫 위쪽 드래그 순간부터 20초. 화면에 표시하지 않음. 앱이 백그라운드로 가면 시간이 멈추고 돌아오면 이어서 진행.
- **프레임레이트 무관**: 긴장도는 1/120초 고정 간격으로 적분.

### 난이도 조정 예
`js/config.js`의 `difficulty.bulldak.safeSpeed`를 0.55 → 0.6으로 올리면 불닭볶음면이 쉬워집니다. 참고로 기본값에서 일정한 속도로 당길 때의 시뮬레이션 결과는 다음과 같습니다(획 0.65화면 + 다시 잡는 시간 0.25초 반복).

| 라면 | 안전하게 끝까지 가능한 속도 | 대략의 기록 |
|---|---|---|
| 기본라면 | ~1.1 화면/초 | 약 120cm |
| 사골라면 | ~0.9 | 약 105cm |
| 매운라면 | ~0.7 | 약 85cm |
| 짜장라면 | ~0.55 | 약 70cm |
| 불닭볶음면 | ~0.5 | 약 65cm |

실제 손가락 플레이는 속도가 일정하지 않아서 기록이 이보다 낮게 나오는 편입니다.

## 알려진 제한
- iPhone Safari는 웹 진동 API를 지원하지 않습니다. iOS 18 이상에서는 시스템 햅틱을 보조로 시도하지만 기기에 따라 동작하지 않을 수 있으며, 진동이 없어도 면발 떨림과 떨림음으로 위험 상태를 알 수 있게 만들었습니다.
- claude.ai 링크로 플레이할 때는 홈 화면 설치와 오프라인 캐시가 동작하지 않습니다(위 호스팅 방법 사용). 기록 저장은 링크에서도 동작합니다.
