# CBF 기도제목 자동화 V2 대시보드 (Prayer Auto-Pipeline V2)

구글 스프레드시트 설문지 응답 데이터를 파싱하여 Notion 페이지로 자동 업로드하고 관리하는 자동화 파이프라인 시스템 및 모듈화된 React 대시보드 웹 서비스입니다.

---

## 🚀 Render.com에 원클릭 배포하기

아래 버튼을 클릭하면 `render.yaml` 설정을 기반으로 Render.com에 즉시 배포 프로세스가 시작됩니다.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/leewish03/CBF_praylist)

### 🔑 배포 시 환경 변수 입력 가이드

배포 화면이 실행되면 다음 두 가지만 직접 채워 넣어 주시면 됩니다:
1. **`GOOGLE_SERVICE_ACCOUNT_JSON`**: 구글 스프레드시트 API 연동을 위한 로컬 인증 키 파일(`cbf-praylist-11bbf27f1baa.json`)의 **JSON 원본 텍스트 전체**를 그대로 복사하여 붙여넣습니다.
2. **`NOTION_TOKEN`**: 사용하시는 Notion 통합(Integration)의 API 토큰 비밀번호를 입력합니다.

*나머지 설정(스프레드시트 ID, 노션 페이지 ID, 로그 크기 제한 등)은 `render.yaml` 템플릿을 통해 자동으로 즉시 기입 및 연동됩니다.*

---

## 🛠️ 주요 프로젝트 구조

```
├── api_server.py (FastAPI 백엔드 서버)
├── main.py (파이프라인 실행 로직)
├── google_sheets.py (구글 스프레드시트 연동 및 쉼표 구분자 파싱)
├── notion_publisher.py (Notion API 문서 업로드)
├── setup_sheets.py (스프레드시트 초기 스키마 생성 및 마이그레이션 도구)
├── render.yaml (Render.com 배포용 Blueprint 템플릿)
├── requirements.txt (의존성 패키지 목록)
└── dashboard/ (React 프론트엔드 대시보드 소스)
    ├── PrayerDashboard.jsx (대시보드 메인 통합 컨테이너)
    ├── styles/
    │   └── colors.js (Forest Green 테마 디자인 토큰)
    ├── utils/
    │   └── helpers.js (유틸리티 함수)
    └── components/ (5개 독립 서브컴포넌트)
        ├── Header.jsx
        ├── StatusBar.jsx
        ├── AlertBanner.jsx
        ├── ConfigGrid.jsx
        └── ConsolePanel.jsx
```

---

## 💻 로컬에서 실행하기

### 1) 가상환경 및 패키지 설치
```bash
pip install -r requirements.txt
```

### 2) 설정 마이그레이션 (최초 1회)
구글 스프레드시트에 설정 테이블(`설정_공통기도제목`, `설정_담당자배정`) 및 응답 탭을 신설하고 기본값을 마이그레이션합니다.
```bash
python setup_sheets.py
```

### 3) API 서버 구동
```bash
python api_server.py
```
서버는 기본 포트 `8000`번에서 실행됩니다.
- API 규격 접두사: 모든 프론트엔드 통신은 `/api`를 경유합니다.
- 동기화 트리거: 중복 동기화를 차단하는 `FileLock` 뮤텍스가 적용되어 있어 안정적입니다.
