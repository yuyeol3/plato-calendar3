# Plato Calendar 3

부산대학교 PLATO(학습관리시스템)에 캘린더와 일정 관리 기능을 추가하는 Chrome 확장 프로그램입니다. 새 PLATO의 과제/퀴즈/영상/Zoom 일정을 모아 보고, 확인된 완료 상태를 표시합니다. VPL 자동 수집은 보류하며 기존 데이터는 보존합니다.

## 주요 기능
<img width="2052" height="1211" alt="image" src="https://github.com/user-attachments/assets/76613e72-797a-4537-bf5f-3b8bc3edb46d" />


- `Plato Calendar` 패널을 PLATO 대시보드 최상단에 주입하여 월간 달력과 일정 모달을 동시에 제공합니다.
- 접힌 패널 버튼도 대시보드 전체 너비를 채우며, 최소 높이 64px와 열림·닫힘 화살표로 쉽게 펼칠 수 있습니다.
- 과제(HW), 퀴즈(QUIZ), 동영상(VID), 줌(ZOOM)을 활동 모아보기의 링크로 수집합니다. 화면에 없는 활동의 주소를 추측해 요청하지 않습니다.
- 메인 강좌 카드에서 사라진 강좌도 저장된 일정을 계속 표시합니다. 새로 수집하는 대상은 현재 카드 목록의 강좌이며, 빠진 강좌는 마지막 저장 내용을 유지합니다.
- 완료, 미완료, 완료 여부 확인 불가, 사라진 활동을 구분합니다. 미완료 개수에는 확인 불가·지각 인정·사라진 활동을 포함하지 않습니다.
- 완료 여부 확인 불가는 달력칸에서 `⚠️`로 간략히 표시하고, 날짜 호버 창과 일정 상세에서 전체 문구를 표시합니다. 해당 날짜에 일정이 하나만 있어도 확인 불가 설명을 제공합니다.
- 일정 카드 클릭 시 원본 PLATO 페이지로 바로 이동할 수 있어 세부 정보를 빠르게 확인할 수 있습니다.
- 과제·퀴즈·영상·Zoom 아이콘은 새 PLATO의 `coursemos` 이미지 주소를 사용합니다. 이미지 로딩 실패와 VPL은 유형 이름을 표시합니다.
- 갱신 오류·경고는 달력 아래의 기본으로 접힌 `갱신 안내`를 클릭하면 표시합니다.
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
- Node.js 22.13 이상 (또는 Node.js 24 이상)
- npm 9 이상

### 2. 의존성 설치
```bash
npm ci
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
- 스타일은 `content_scripts/content.css`에 있습니다. TypeScript 수정 후 `npm run build`로 번들하고 Chrome 확장 관리 화면에서 재로드한 뒤 PLATO 홈도 새로고침합니다.
- PLATO HTML 구조가 바뀌면 `updateSchedule.ts`의 파싱 셀렉터를 먼저 확인해 주세요.
- 새 일정 유형을 추가하려면 `ScheduleType` enum과 `ScheduleStyles`/`ScheduleIcons` 매핑을 확장해야 합니다.

## 수집 판정과 데이터 보존

- 영상은 활동 ID에 연결된 PLATO 출석 결과를 우선합니다. 출석/지각 인정은 완료, 명시적인 결석/미충족은 미완료입니다. 지각은 별도 표시합니다.
- 출석 결과가 없으면 **학습 시간 준수 조건이 확인된** 활동 완료 결과를 사용합니다. 열람만으로 완료되는 표시를 시청 완료로 해석하지 않습니다.
- 위 판정이 없으면 사용자가 요청한 **진도율 100%**를 완료 기준으로 사용합니다. `시청 기준 100%` 문구는 달력칸과 호버 창에서 생략하고 클릭해서 여는 일정 상세에만 표시합니다. 이는 학교 출석 판정과 별도의 시청 기준입니다. 진도율도 없거나 해석할 수 없으면 기존 확정값을 보존하고 새 일정은 `completed: null`로 저장합니다.
- 새 출석 결과가 없을 때 진도율은 저장된 확정 출석을 덮지 않습니다. 새 공식 판정이 확인되면 진도율 기준 표시를 제거합니다.
- 배속 버튼은 완료 판정으로 사용하지 않습니다. [학습자 안내서 24쪽](https://plato.pusan.ac.kr/local/ubmanual/files/LXP_UserGuide_Plato_Learner.pdf#page=24)에 따르면 진도체크 없는 영상이나 진도 기간 밖 학습에서도 배속을 사용할 수 있습니다. 실제 0% 영상에도 숨겨진 배속 버튼 요소가 있어 요소 존재만으로 판정할 수도 없습니다.
- `due`는 한국 시간으로 해석한 ISO 문자열입니다. 마감 없는 일정은 `null`로 저장하며 달력에 배치하지 않습니다. 날짜 해석 실패 시 기존 값을 유지합니다. 기존 월별 캐시와 날짜 배치 시 1초 차감 동작은 유지합니다.
- 목록 수집 성공 여부와 발견한 ID를 상세 수집 성공 여부와 따로 저장 병합에 전달합니다. 상세 실패한 활동은 보존하며, 정상 목록에서 사라진 지원 활동만 `orphaned` 처리합니다. VPL은 이 판별에서 제외합니다.
- 갱신 응답은 `{ result, errors, warnings }`입니다. 일부 실패에도 확인된 일정은 저장하며 오류 없는 갱신만 마지막 성공 시간을 기록합니다. 경고만 있는 갱신은 성공으로 처리합니다.

## 검증

```bash
npm test
npm run typecheck
npm run build
```

Vitest에서 네트워크·확장 저장소를 대체해 날짜, 새 HTML 수집, 데이터 보존과 DOM 표시를 검사합니다. 자료 출처와 실제 화면 검증 제한은 `tests/fixtures/README.md`에 기록합니다.

2026-09-30 비공개 검증 강좌에서 퀴즈 종료 기록과 영상의 새 제목·출석 인정 기간·상태 영역을 확인했습니다. 이후 실제 학생 강좌인 네트워크보안의 `5-1. Tunneling and VPN`에서 진도율 100%를 확인했으며 시청 기준으로 완료 수집합니다. 테스트 강좌 운영자의 학생 화면 보기에서는 진도율이 0%였으므로 같은 기준으로 미완료입니다. 영상별 출석/지각과 학습 시간 조건이 표시된 완료 결과는 확보하지 못했습니다. Zoom 활동 생성은 계정의 Zoom 등록 요구로 제한되었습니다. 실제 Chrome 확장 재로드는 연결된 내장 브라우저에서 지원하지 않아 동일한 빌드 파일을 로컬 검증 화면에 연결해 검사했습니다.
