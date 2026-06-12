"""
CBF 기도제목 자동화 V2 - FastAPI API 서버 (v2.1)
Render.com에 배포하여 파이프라인 트리거 및 상태 조회를 제공합니다.

변경 이력 (v2.1):
  - HMAC-SHA256 기반 자체 토큰 인증 시스템 추가 (내장 라이브러리만 사용)
  - POST /api/auth/login 엔드포인트 신규 구현
  - FastAPI Depends 기반 역할(ROLE_USER / ROLE_ADMIN) 권한 제어 적용

모든 엔드포인트는 /api 접두사를 사용합니다.
"""

# ── 표준 라이브러리 ──
import os
import sys
import logging
import hmac
import hashlib
import base64
import json
import time
from datetime import datetime
from typing import Optional, Dict, Any

# ── 서드파티 라이브러리 ──
from fastapi import FastAPI, BackgroundTasks, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from filelock import FileLock, Timeout
from dotenv import load_dotenv
from pydantic import BaseModel

# 환경변수 로드
load_dotenv()


# ══════════════════════════════════════════════════════════
#  HMAC-SHA256 자체 토큰 시스템
#  ※ 외부 의존성(PyJWT 등) 없이 Python 내장 라이브러리만 사용
#    → Render.com 빌드 오류 원천 차단
# ══════════════════════════════════════════════════════════

_SECRET_KEY   = os.getenv('JWT_SECRET_KEY', 'cbf_prayer_secret_key_2026')
_TOKEN_EXPIRY = 43200  # 12시간(초)

ROLE_USER  = 'ROLE_USER'
ROLE_ADMIN = 'ROLE_ADMIN'

# 패스워드 → 역할 매핑 (환경변수로 오버라이드 가능하도록 함수화)
def _get_password_map() -> Dict[str, str]:
    user_pw  = os.getenv('USER_PASSWORD',  '0691')
    admin_pw = os.getenv('ADMIN_PASSWORD', '1217')
    return {user_pw: ROLE_USER, admin_pw: ROLE_ADMIN}


def _create_token(role: str) -> str:
    """
    HMAC-SHA256 기반 자체 토큰 생성.
    포맷: base64url(JSON_payload).base64url(HMAC_서명)
    """
    now = int(time.time())
    payload: Dict[str, Any] = {
        'role': role,
        'iat': now,                   # 발급 시각 (issued at)
        'exp': now + _TOKEN_EXPIRY,   # 만료 시각 (expiry)
    }
    # ① payload → base64url 인코딩 (패딩 '=' 제거)
    payload_b64: str = (
        base64.urlsafe_b64encode(
            json.dumps(payload, separators=(',', ':')).encode('utf-8')
        )
        .rstrip(b'=')
        .decode('utf-8')
    )
    # ② HMAC-SHA256 서명 생성
    sig_bytes: bytes = hmac.new(
        _SECRET_KEY.encode('utf-8'),
        payload_b64.encode('utf-8'),
        digestmod=hashlib.sha256
    ).digest()
    sig_b64: str = (
        base64.urlsafe_b64encode(sig_bytes)
        .rstrip(b'=')
        .decode('utf-8')
    )
    return f"{payload_b64}.{sig_b64}"


def _verify_token(token: str) -> Optional[Dict[str, Any]]:
    """
    토큰 검증.
    - 서명 유효 + 미만료 → payload dict 반환
    - 형식 오류 / 서명 불일치 / 만료 → None 반환

    ※ hmac.compare_digest 사용으로 타이밍 공격(timing attack) 방지
    """
    try:
        # ① 포맷 검사: payload_b64.sig_b64 두 부분이어야 함
        parts = token.split('.', 1)
        if len(parts) != 2:
            return None
        payload_b64, sig_b64 = parts

        # ② 서명 재계산 후 비교
        expected_bytes: bytes = hmac.new(
            _SECRET_KEY.encode('utf-8'),
            payload_b64.encode('utf-8'),
            digestmod=hashlib.sha256
        ).digest()
        expected_b64: str = (
            base64.urlsafe_b64encode(expected_bytes)
            .rstrip(b'=')
            .decode('utf-8')
        )
        if not hmac.compare_digest(sig_b64, expected_b64):
            return None  # 서명 불일치

        # ③ base64 패딩 복원 후 payload 파싱
        pad = (4 - len(payload_b64) % 4) % 4
        payload: Dict[str, Any] = json.loads(
            base64.urlsafe_b64decode((payload_b64 + '=' * pad).encode('utf-8'))
        )

        # ④ 만료 시각 확인
        if payload.get('exp', 0) < int(time.time()):
            return None  # 토큰 만료

        return payload

    except Exception:
        return None  # 파싱 오류 등 모든 예외 → 무효 처리


# ══════════════════════════════════════════════════════════
#  FastAPI 의존성 주입 – 역할(Role) 기반 권한 검사
# ══════════════════════════════════════════════════════════

async def get_current_user(
    authorization: Optional[str] = Header(None, alias='Authorization')
) -> Dict[str, Any]:
    """
    ROLE_USER 이상 권한 검사 의존성 함수.
    요청 헤더의 'Authorization: Bearer <token>'을 추출·검증합니다.
    검증 실패 시 401 Unauthorized 반환.
    """
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(
            status_code=401,
            detail="인증이 필요합니다. 로그인 후 다시 시도하세요."
        )
    # 'Bearer ' 이후 토큰 문자열 추출
    token = authorization[len('Bearer '):]
    payload = _verify_token(token)
    if payload is None:
        raise HTTPException(
            status_code=401,
            detail="유효하지 않거나 만료된 토큰입니다. 다시 로그인해주세요."
        )
    return payload


async def get_admin_user(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    ROLE_ADMIN 전용 권한 검사 의존성 함수.
    ROLE_USER 토큰으로 접근 시 403 Forbidden 반환.
    """
    if current_user.get('role') != ROLE_ADMIN:
        raise HTTPException(
            status_code=403,
            detail="관리자 권한이 필요합니다."
        )
    return current_user


# ── 로깅 초기화 ──
logging.basicConfig(
    level=getattr(logging, os.getenv('LOG_LEVEL', 'INFO')),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# main.py에서 파이프라인 모듈 임포트 (로그 파일 핸들러도 함께 초기화)
from main import pipeline_state, run_pipeline, setup_logging
setup_logging()

# ── FastAPI 앱 생성 ──
app = FastAPI(
    title='CBF 기도제목 자동화 API',
    description='CBF 기도제목 Notion 동기화 파이프라인 제어 API (v2.1 - HMAC 인증)',
    version='2.1.0'
)

# ── 비동기 스케줄러 & 스레드 풀 ──
import asyncio
from concurrent.futures import ThreadPoolExecutor

# 전역 메모리 캐시 초기값 (기도제목 + 담당자배정 + 공통기도제목 통합)
prayers_cache: Dict[str, Any] = {
    "source":                 "empty",
    "last_updated":           None,
    "prayers_by_requester":   {},
    "assignments":            {},
    "assignments_source":     "empty",
    "common_prayers":         [],
    "common_prayers_source":  "empty",
}

# 스레드 풀: max_workers=2 (Render 무료 플랜 메모리 한도 최소화)
executor = ThreadPoolExecutor(max_workers=2)


async def load_prayers_to_cache() -> None:
    """
    구글 시트에서 기도제목 + 담당자배정 + 공통기도제목을 순차 로드하여 캐시 갱신.
    ※ 순차 실행(병렬 ❌) → 메모리 최대 사용량 최소화
    ※ google_sheets.py 싱글톤 서비스 재사용 → 중복 초기화 없음
    """
    global prayers_cache

    # ─ 1. 빠른 부팅: 로컬 파일 캐시로 선(先)로드 ─
    cache_file = 'prayers_data.json'
    if os.path.exists(cache_file) and prayers_cache["source"] == "empty":
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            prayers_cache = {
                "source":                "local_cache",
                "assignments":           {},
                "assignments_source":    "empty",
                "common_prayers":        [],
                "common_prayers_source": "empty",
                **data
            }
            logger.info("✅ 전역 메모리 캐시 선로드 성공 (로컬 파일 기준)")
        except Exception as e:
            logger.warning(f"로컬 파일 캐시 선로드 실패: {e}")

    # ─ 2. 구글 시트에서 3종 데이터 순차 로드 ─
    try:
        from google_sheets import get_prayer_requests, get_assignments_from_sheet, get_common_prayers
        from data_processor import process_prayer_requests

        loop = asyncio.get_running_loop()

        # 순차 ①: 기도제목 응답
        try:
            df = await loop.run_in_executor(executor, get_prayer_requests)
            processed_data: Dict[str, Any] = {}
            if df is not None:
                processed_data = await loop.run_in_executor(executor, process_prayer_requests, df) or {}
        except Exception as e:
            logger.error(f"기도제목 로드 오류: {e}")
            processed_data = {}

        # 순차 ②: 담당자 배정
        try:
            assignments_result = await loop.run_in_executor(executor, get_assignments_from_sheet)
        except Exception as e:
            logger.error(f"담당자 배정 로드 오류: {e}")
            assignments_result = {"data": prayers_cache.get("assignments", {}), "source": "cache_fallback"}

        # 순차 ③: 공통 기도제목
        try:
            common_prayers_result = await loop.run_in_executor(executor, get_common_prayers)
        except Exception as e:
            logger.error(f"공통기도제목 로드 오류: {e}")
            common_prayers_result = {"data": prayers_cache.get("common_prayers", []), "source": "cache_fallback"}

        prayers_cache = {
            "source":                "memory_sync",
            "last_updated":          processed_data.get("last_updated"),
            "prayers_by_requester":  processed_data.get("prayers_by_requester", {}),
            "assignments":           assignments_result.get("data", {}),
            "assignments_source":    assignments_result.get("source", "unknown"),
            "common_prayers":        common_prayers_result.get("data", []),
            "common_prayers_source": common_prayers_result.get("source", "unknown"),
        }

        logger.info(
            f"✅ 전역 캐시 동기화 완료 — "
            f"기도제목: {len(prayers_cache['prayers_by_requester'])}명, "
            f"담당자: {len(prayers_cache['assignments'])}명, "
            f"공통기도제목: {len(prayers_cache['common_prayers'])}개"
        )
    except Exception as e:
        logger.error(f"구글 시트 캐시 동기화 실패: {e}")


async def refresh_cache_periodically() -> None:
    """15분마다 캐시를 자동 갱신하는 백그라운드 태스크"""
    while True:
        await asyncio.sleep(900)  # 15분 (Render 무료 플랜 부하 최소화)
        try:
            logger.info("⏰ 백그라운드 캐시 동기화 루프 시작")
            await load_prayers_to_cache()
        except Exception as e:
            logger.error(f"백그라운드 캐시 동기화 실패: {e}")


@app.on_event("startup")
async def startup_event() -> None:
    """서버 기동 시 캐시 초기 로드 + 주기적 갱신 루프 시작"""
    asyncio.create_task(load_prayers_to_cache())
    asyncio.create_task(refresh_cache_periodically())


# ── CORS 설정 (프론트엔드 연동) ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],     # 필요 시 도메인 한정 가능
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

LOCK_FILE = 'prayer_pipeline.lock'
LOG_FILE  = os.getenv('LOG_FILE', 'prayer_pipeline.log')


# ══════════════════════════════════════════════════════════
#  Pydantic 모델 정의
# ══════════════════════════════════════════════════════════

class LoginRequest(BaseModel):
    """로그인 요청 모델"""
    password: str


class AssignmentsUpdate(BaseModel):
    """담당자 배정 업데이트 요청 모델"""
    assignments: Dict[str, list]


# ══════════════════════════════════════════════════════════
#  엔드포인트: POST /api/auth/login  ← 공개 (인증 불필요)
# ══════════════════════════════════════════════════════════
@app.post("/api/auth/login")
async def login(req: LoginRequest):
    """
    비밀번호를 검증하고 HMAC-SHA256 토큰을 발급합니다.

    패스워드 → 역할 매핑:
      - '0691' (환경변수 USER_PASSWORD)  → ROLE_USER  토큰 발급
      - '1217' (환경변수 ADMIN_PASSWORD) → ROLE_ADMIN 토큰 발급
      - 그 외 → 401 Unauthorized

    Returns:
        token:      발급된 토큰 문자열
        role:       부여된 역할 (ROLE_USER / ROLE_ADMIN)
        expires_in: 토큰 유효 시간(초)
    """
    role = _get_password_map().get(req.password)
    if not role:
        logger.warning("로그인 실패: 잘못된 비밀번호 입력")
        raise HTTPException(status_code=401, detail="비밀번호가 올바르지 않습니다.")

    token = _create_token(role)
    logger.info(f"로그인 성공: 역할={role}")
    return {
        "token":      token,
        "role":       role,
        "expires_in": _TOKEN_EXPIRY
    }


# ══════════════════════════════════════════════════════════
#  엔드포인트: GET /api/status  ← 공개 (인증 불필요)
# ══════════════════════════════════════════════════════════
@app.get("/api/status")
async def get_status():
    """
    파이프라인 현재 상태를 반환합니다. (공개 엔드포인트)

    Returns:
        status:              IDLE | RUNNING | SUCCESS | ERROR
        last_run:            마지막 실행 시각 (ISO 형식)
        unmapped_requesters: 담당자 미지정 제출자 목록
        config_source:       설정 데이터 소스
        notion_page_id:      노션 페이지 ID
        timestamp:           현재 시각
    """
    return {
        "status":              pipeline_state.get("status", "IDLE"),
        "last_run":            pipeline_state.get("last_run"),
        "unmapped_requesters": pipeline_state.get("unmapped_requesters", []),
        "config_source":       pipeline_state.get("config_source", "unknown"),
        "notion_page_id":      os.getenv('NOTION_PAGE_ID', '1c50f7e0cd5f8025bb78c5c839f205f0'),
        "timestamp":           datetime.now().isoformat()
    }


# ══════════════════════════════════════════════════════════
#  엔드포인트: POST /api/trigger  ← ROLE_ADMIN 필요
# ══════════════════════════════════════════════════════════
@app.post("/api/trigger", status_code=202)
async def trigger_pipeline(
    background_tasks: BackgroundTasks,
    _current_admin: Dict[str, Any] = Depends(get_admin_user)
):
    """
    파이프라인을 백그라운드에서 실행합니다. (관리자 전용)
    이미 실행 중이면 409 Conflict를 반환합니다.

    Returns:
        message:      실행 시작 메시지
        triggered_at: 트리거 시각
    """
    lock = FileLock(LOCK_FILE, timeout=0)
    try:
        lock.acquire()
    except Timeout:
        logger.warning("파이프라인 트리거 요청 거부: 이미 실행 중")
        raise HTTPException(
            status_code=409,
            detail="파이프라인이 이미 실행 중입니다. 잠시 후 다시 시도해주세요."
        )

    loop = asyncio.get_running_loop()

    def _run_and_release():
        """파이프라인 실행 후 Lock 해제 및 캐시 갱신"""
        try:
            logger.info("백그라운드 파이프라인 실행 시작")
            success = run_pipeline()
            if success:
                asyncio.run_coroutine_threadsafe(load_prayers_to_cache(), loop)
        except Exception as e:
            logger.error(f"백그라운드 파이프라인 실행 오류: {e}")
        finally:
            lock.release()
            logger.info("파이프라인 Lock 해제")

    background_tasks.add_task(_run_and_release)
    logger.info("파이프라인 백그라운드 실행 예약 완료")
    return {
        "message":      "파이프라인 실행이 시작되었습니다.",
        "triggered_at": datetime.now().isoformat()
    }


# ══════════════════════════════════════════════════════════
#  엔드포인트: GET /api/prayers  ← ROLE_USER 이상 필요
# ══════════════════════════════════════════════════════════
@app.get("/api/prayers")
async def get_prayers(
    _current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    메모리 캐시에서 기도제목 + 담당자배정 + 공통기도제목을 통합하여 반환합니다.
    캐시는 서버 시작 시 및 15분마다 자동 갱신됩니다.
    /api/refresh 호출로 즉시 갱신할 수 있습니다. (관리자 전용)
    """
    return prayers_cache


# ══════════════════════════════════════════════════════════
#  엔드포인트: POST /api/refresh  ← ROLE_ADMIN 필요
# ══════════════════════════════════════════════════════════
@app.post("/api/refresh")
async def force_refresh_cache(
    _current_admin: Dict[str, Any] = Depends(get_admin_user)
):
    """
    구글 시트에서 모든 데이터(기도제목, 담당자, 공통기도제목)를 즉시 다시 로드합니다.
    담당자 추가/변경 후 즉시 반영할 때 사용하세요. (관리자 전용)
    """
    logger.info("🔄 캐시 강제 갱신 요청 수신")
    await load_prayers_to_cache()
    return {
        "message":              "캐시가 구글 시트 최신 데이터로 갱신되었습니다.",
        "assignments_count":    len(prayers_cache.get("assignments", {})),
        "common_prayers_count": len(prayers_cache.get("common_prayers", [])),
        "prayers_count":        len(prayers_cache.get("prayers_by_requester", {})),
        "refreshed_at":         datetime.now().isoformat()
    }


# ══════════════════════════════════════════════════════════
#  엔드포인트: GET /api/config  ← ROLE_USER 이상 필요
# ══════════════════════════════════════════════════════════
@app.get("/api/config")
async def get_config(
    _current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    메모리 캐시에서 공통 기도제목과 담당자 배정 설정을 반환합니다.
    /api/refresh 로 즉시 갱신할 수 있습니다. (관리자 전용)
    """
    return {
        "common_prayers": {
            "data":   prayers_cache.get("common_prayers", []),
            "source": prayers_cache.get("common_prayers_source", "unknown"),
            "count":  len(prayers_cache.get("common_prayers", []))
        },
        "assignments": {
            "data":   prayers_cache.get("assignments", {}),
            "source": prayers_cache.get("assignments_source", "unknown"),
            "count":  len(prayers_cache.get("assignments", {}))
        },
        "loaded_at": datetime.now().isoformat()
    }


# ══════════════════════════════════════════════════════════
#  엔드포인트: POST /api/config/assignments  ← ROLE_ADMIN 필요
# ══════════════════════════════════════════════════════════
@app.post("/api/config/assignments")
async def update_assignments(
    data: AssignmentsUpdate,
    _current_admin: Dict[str, Any] = Depends(get_admin_user)
):
    """
    담당자 배정 설정을 구글 시트에 업데이트하고 메모리 캐시도 즉시 갱신합니다.
    (관리자 전용)
    """
    global prayers_cache
    logger.info("담당자 배정 설정 업데이트 요청 수신")
    from google_sheets import update_assignments_in_sheet

    success = update_assignments_in_sheet(data.assignments)
    if not success:
        raise HTTPException(
            status_code=500,
            detail="구글 시트 담당자 배정 정보 업데이트에 실패했습니다."
        )

    # 저장 즉시 메모리 캐시도 갱신
    prayers_cache["assignments"]        = data.assignments
    prayers_cache["assignments_source"] = "google_sheets"
    logger.info(f"메모리 캐시 담당자 배정 즉시 갱신 완료 ({len(data.assignments)}명)")

    return {
        "message":     "담당자 배정 정보가 구글 스프레드시트에 성공적으로 저장되었습니다.",
        "assignments": data.assignments
    }


# ══════════════════════════════════════════════════════════
#  엔드포인트: GET /api/logs  ← ROLE_ADMIN 필요
# ══════════════════════════════════════════════════════════
@app.get("/api/logs")
async def get_logs(
    limit: int = 50,
    _current_admin: Dict[str, Any] = Depends(get_admin_user)
):
    """
    파이프라인 로그 파일의 마지막 N줄을 반환합니다. (관리자 전용)

    Args:
        limit: 반환할 최대 줄 수 (기본값: 50)

    Returns:
        lines:       로그 줄 목록
        total_lines: 반환된 줄 수
        log_file:    로그 파일 경로
    """
    try:
        if not os.path.exists(LOG_FILE):
            return {"lines": ["로그 파일이 없습니다."], "total_lines": 0, "log_file": LOG_FILE}

        with open(LOG_FILE, 'r', encoding='utf-8', errors='replace') as f:
            all_lines = f.readlines()

        last_lines = [line.rstrip('\n') for line in all_lines[-limit:] if line.strip()]

        return {
            "lines":       last_lines,
            "total_lines": len(last_lines),
            "log_file":    LOG_FILE,
            "fetched_at":  datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"로그 파일 읽기 실패: {e}")
        raise HTTPException(status_code=500, detail=f"로그 파일 읽기 중 오류: {e}")


# ══════════════════════════════════════════════════════════
#  엔드포인트: GET /api/health  ← 공개 (인증 불필요)
# ══════════════════════════════════════════════════════════
@app.get("/api/health")
async def health_check():
    """서비스 헬스체크 엔드포인트 (Render.com 생존 확인용, 공개)"""
    return {
        "service":   "CBF 기도제목 자동화 API",
        "version":   "2.1.0",
        "status":    "running",
        "timestamp": datetime.now().isoformat()
    }


# ── 프론트엔드 정적 파일 마운트 및 SPA 라우팅 지원 ──
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
ASSETS_DIR = os.path.join(STATIC_DIR, "assets")

if os.path.exists(ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")


@app.get("/{catchall:path}")
async def read_index(catchall: str):
    """SPA Catch-all 라우팅 (공개). API 경로는 제외."""
    if catchall.startswith("api"):
        raise HTTPException(status_code=404, detail="API route not found")

    static_file = os.path.join(STATIC_DIR, catchall)
    if catchall and os.path.exists(static_file) and os.path.isfile(static_file):
        return FileResponse(static_file)

    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)

    raise HTTPException(status_code=404, detail="Not found")


# ══════════════════════════════════════════════════════════
#  Render.com 포트 바인딩
# ══════════════════════════════════════════════════════════
if __name__ == '__main__':
    import uvicorn
    port = int(os.getenv('PORT', 8000))
    logger.info(f"API 서버 시작 (포트: {port})")
    uvicorn.run(app, host='0.0.0.0', port=port)
