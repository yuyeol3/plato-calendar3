# Plato Calendar 3

부산대학교 PLATO(학습관리시스템)에 직관적인 캘린더와 일정 관리 기능을 추가하는 Chrome 확장 프로그램입니다. 과제/퀴즈/영상 시청/Zoom/프로그래밍 과제 일정을 한 화면에서 모아 보고, 진행 상태를 빠르게 확인할 수 있습니다.

## 주요 기능
- `Plato Calendar` 패널을 PLATO 대시보드 최상단에 주입하여 월간 달력과 일정 모달을 동시에 제공합니다.
- 과제(HW), 퀴즈(QUIZ), 동영상(VID), 줌(ZOOM), 프로그래밍 과제(PA)까지 한 번에 수집하고 유형별 색상으로 표시합니다.
- 일정 완료 여부(완료, orphaned 데이터, 미완료)를 시각적으로 구분하고 날짜별 미해결 건수를 배지로 보여줍니다.
- 일정 카드 클릭 시 원본 PLATO 페이지로 바로 이동할 수 있어 세부 정보를 빠르게 확인할 수 있습니다.
- `업데이트` 버튼 또는 1시간 주기의 자동 트리거로 백그라운드에서 일정을 새로고침하고, 저장소(`chrome.storage`)와 커스텀 캘린더 스토리지 간 동기화를 유지합니다.

## 프로젝트 구조
```
plato_calendar/
├── src/
│   ├── background/
│   │   ├── background.ts          # 메시지 라우팅 및 chrome.storage 관리
│   │   ├── scheduleStorageManager.ts
│   │   └── updateSchedule.ts      # PLATO 페이지 파싱 및 일정 수집
│   └── content_scripts/
│       ├── content.ts             # PLATO DOM에 달력/모달 삽입
│       ├── calender.ts            # 달력 UI 및 일정 렌더링
│       ├── modal.ts               # 일정 상세 모달
│       ├── CalendarStorageManager.ts
│       └── utils.ts
├── manifest.json                  # Chrome Extension MV3 설정
├── build.js                       # esbuild 번들 스크립트
├── package.json
└── tsconfig.json
```

## 기술 스택
- **TypeScript** + **Chrome Extension Manifest V3**
- **esbuild**: 번들 및 소스맵 생성
- **node-html-parser**: 백그라운드 서비스 워커에서 PLATO HTML을 파싱
- **chrome.storage.local**: 백그라운드/콘텐츠 스크립트 간 일정 데이터 동기화

## 시작하기
### 1. 환경 준비
- Node.js 18 이상
- npm 9 이상

### 2. 의존성 설치
```bash
npm install
```

### 3. 빌드
```bash
npm run build
```
`dist/` 폴더에 `background.js`, `content.js` 등 번들 파일이 생성됩니다.

### 4. Chrome 에서 확장 프로그램 로드
1. `chrome://extensions` 이동 후 **개발자 모드** 활성화  
2. **압축해제된 확장 프로그램을 로드합니다** 클릭  
3. 이 저장소 루트(`manifest.json`이 위치한 경로)를 선택  
4. PLATO 페이지에 접속하면 상단에 `Plato Calendar3` 패널이 나타납니다.

## 동작 흐름
1. **백그라운드 서비스 워커**(`src/background/updateSchedule.ts`)가 PLATO 각 모듈 페이지를 순회하며 일정을 스크랩합니다.  
2. 새로 수집된 일정은 `ScheduleStorageManager`를 통해 `chrome.storage.local`에 저장되고, 기존 일정과 비교하여 orphaned 여부를 판별합니다.  
3. **콘텐츠 스크립트**(`src/content_scripts/content.ts`)가 PLATO 대시보드에 달력/모달 DOM을 주입합니다.  
4. `CalendarStorageManager`는 백그라운드 일정 데이터를 날짜 단위로 변환하여 로컬 스토리지(확장용)에 캐시하고, UI는 이를 기반으로 렌더링합니다.  
5. 사용자가 `업데이트` 버튼을 클릭하거나 1시간이 지나면 `updateSchedules()`가 다시 실행되어 최신 일정이 반영됩니다.

## 개발 팁
- `src/content_scripts/content.css` 등 스타일을 수정할 경우 `npm run build`로 다시 번들해야 합니다.
- PLATO HTML 구조가 바뀌면 `updateSchedule.ts`의 파싱 셀렉터를 먼저 확인해 주세요.
- 새 일정 유형을 추가하려면 `ScheduleType` enum과 `ScheduleStyles`/`ScheduleIcons` 매핑을 확장해야 합니다.


