"""
CBF 기도제목 자동화 V2 - FastAPI API 서버
Render.com에 배포하여 파이프라인 트리거 및 상태 조회를 제공합니다.
모든 엔드포인트는 /api 접두사를 사용합니다.
"""

import os
import sys
import logging
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from filelock import FileLock, Timeout
from dotenv import load_dotenv

# 환경변수 로드
load_dotenv()

# ── 로깅 초기화 (api_server 자체 로거) ──
logging.basicConfig(
    level=getattr(logging, os.getenv('LOG_LEVEL', 'INFO')),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# ── main.py에서 파이프라인 모듈 임포트 ──
# main.py의 setup_logging()을 먼저 실행하여 로그 파일 핸들러도 등록
from main import pipeline_state, run_pipeline, setup_logging

# API 서버 시작 시 로깅 초기화
setup_logging()

# ── FastAPI 앱 생성 ──
app = FastAPI(
    title="CBF 기도제목 자동화 API",
    description="CBF 기도제목 Notion 동기화 파이프라인 제어 API",
    version="2.0.0"
)

# ── 인메모리 캐시 및 비동기 스케줄러 ──
import asyncio
from concurrent.futures import ThreadPoolExecutor

# 전역 메모리 캐시 초기값 (기도제목 + 담당자배정 + 공통기도제목 통합)
prayers_cache = {
    "source": "empty",
    "last_updated": None,
    "prayers_by_requester": {},
    "assignments": {},
    "assignments_source": "empty",
    "common_prayers": [],
    "common_prayers_source": "empty",
}

# 비동기 실행용 스레드 풀
executor = ThreadPoolExecutor(max_workers=4)

async def load_prayers_to_cache():
    """구글 시트에서 기도제목 + 담당자배정 + 공통기도제목을 통합하여 전역 캐시 갱신"""
    global prayers_cache
    import json

    # 1. 빠른 부팅: 로컬 파일에 저장된 이전 캐시로 선(先)로드
    cache_file = 'prayers_data.json'
    if os.path.exists(cache_file) and prayers_cache["source"] == "empty":
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            prayers_cache = {
                "source": "local_cache",
                "assignments": {},
                "assignments_source": "empty",
                "common_prayers": [],
                "common_prayers_source": "empty",
                **data
            }
            logger.info("✅ 전역 메모리 캐시 선로드 성공 (로컬 파일 기준)")
        except Exception as e:
            logger.warning(f"로컬 파일 캐시 선로드 실패: {str(e)}")

    # 2. 구글 시트에서 3종 데이터 동시 로드 (기도제목 / 담당자배정 / 공통기도제목)
    try:
        from google_sheets import get_prayer_requests, get_assignments_from_sheet, get_common_prayers
        from data_processor import process_prayer_requests

        loop = asyncio.get_running_loop()

        # 세 작업을 병렬로 실행
        df_future = loop.run_in_executor(executor, get_prayer_requests)
        assign_future = loop.run_in_executor(executor, get_assignments_from_sheet)
        common_future = loop.run_in_executor(executor, get_common_prayers)

        df, assignments_result, common_prayers_result = await asyncio.gather(
            df_future, assign_future, common_future,
            return_exceptions=True
        )

        # 기도제목 처리
        processed_data = {}
        if not isinstance(df, Exception) and df is not None:
            processed_data = await loop.run_in_executor(executor, process_prayer_requests, df) or {}
        elif isinstance(df, Exception):
            logger.error(f"기도제목 로드 오류: {df}")

        # 담당자 배정 처리
        if isinstance(assignments_result, Exception):
            logger.error(f"담당자 배정 로드 오류: {assignments_result}")
            assignments_result = {"data": prayers_cache.get("assignments", {}), "source": "cache_fallback"}

        # 공통 기도제목 처리
        if isinstance(common_prayers_result, Exception):
            logger.error(f"공통기도제목 로드 오류: {common_prayers_result}")
            common_prayers_result = {"data": prayers_cache.get("common_prayers", []), "source": "cache_fallback"}

        prayers_cache = {
            "source": "memory_sync",
            "last_updated": processed_data.get("last_updated"),
            "prayers_by_requester": processed_data.get("prayers_by_requester", {}),
            # ─ 담당자 배정: 구글 시트에서 항상 최신으로 읽음 ─
            "assignments": assignments_result.get("data", {}),
            "assignments_source": assignments_result.get("source", "unknown"),
            # ─ 공통 기도제목: 구글 시트에서 항상 최신으로 읽음 ─
            "common_prayers": common_prayers_result.get("data", []),
            "common_prayers_source": common_prayers_result.get("source", "unknown"),
        }

        logger.info(
            f"✅ 전역 캐시 동기화 완료 — "
            f"기도제목: {len(prayers_cache['prayers_by_requester'])}명, "
            f"담당자: {len(prayers_cache['assignments'])}명, "
            f"공통기도제목: {len(prayers_cache['common_prayers'])}개"
        )

    except Exception as e:
        logger.error(f"구글 시트 캐시 동기화 실패: {str(e)}")


async def refresh_cache_periodically():
    """주기적으로 (15분마다) 캐시를 갱신하는 백그라운드 태스크"""
    while True:
        await asyncio.sleep(900)  # 15분 대기
        try:
            logger.info("⏰ 백그라운드 캐시 동기화 루프 시작")
            await load_prayers_to_cache()
        except Exception as e:
            logger.error(f"백그라운드 캐시 동기화 실패: {str(e)}")

@app.on_event("startup")
async def startup_event():
    # 기동 시 즉시 캐시 로드 시작 (비차단 백그라운드 실행)
    asyncio.create_task(load_prayers_to_cache())
    # 주기적 동기화 루프 실행
    asyncio.create_task(refresh_cache_periodically())

# ── CORS 설정 (프론트엔드 연동) ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],    # 필요 시 도메인 한정 가능
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 파일 Lock 경로 및 로그 파일 경로
LOCK_FILE = 'prayer_pipeline.lock'
LOG_FILE = os.getenv('LOG_FILE', 'prayer_pipeline.log')


# ============================================================
# 엔드포인트: GET /api/status
# ============================================================
@app.get("/api/status")
async def get_status():
    """
    파이프라인 현재 상태를 반환합니다.
    
    Returns:
        status: IDLE | RUNNING | SUCCESS | ERROR
        last_run: 마지막 실행 시각 (ISO 형식)
        unmapped_requesters: 담당자 미지정 제출자 목록
        config_source: 설정 데이터 소스
        notion_page_id: 노션 페이지 ID
    """
    return {
        "status": pipeline_state.get("status", "IDLE"),
        "last_run": pipeline_state.get("last_run"),
        "unmapped_requesters": pipeline_state.get("unmapped_requesters", []),
        "config_source": pipeline_state.get("config_source", "unknown"),
        "notion_page_id": os.getenv('NOTION_PAGE_ID', '') if os.getenv('NOTION_TOKEN') else '',
        "timestamp": datetime.now().isoformat()
    }


# ============================================================
# 엔드포인트: POST /api/trigger
# ============================================================
@app.post("/api/trigger", status_code=202)
async def trigger_pipeline(background_tasks: BackgroundTasks):
    """
    파이프라인을 백그라운드에서 실행합니다.
    이미 실행 중이면 409 Conflict를 반환합니다.
    
    Returns:
        message: 실행 시작 메시지 또는 오류 메시지
    """
    # FileLock timeout=0 → 이미 잠금 중이면 즉시 Timeout 예외
    lock = FileLock(LOCK_FILE, timeout=0)
    
    try:
        # 잠금 획득 시도 (비차단)
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
                # 동기화가 끝났으므로 전역 메모리 캐시 갱신
                asyncio.run_coroutine_threadsafe(load_prayers_to_cache(), loop)
        except Exception as e:
            logger.error(f"백그라운드 파이프라인 실행 오류: {str(e)}")
        finally:
            lock.release()
            logger.info("파이프라인 Lock 해제")
    
    # 백그라운드 작업으로 파이프라인 등록
    background_tasks.add_task(_run_and_release)
    
    logger.info("파이프라인 백그라운드 실행 예약 완료")
    return {
        "message": "파이프라인 실행이 시작되었습니다.",
        "triggered_at": datetime.now().isoformat()
    }


# ============================================================
# 엔드포인트: GET /api/prayers
# ============================================================
@app.get("/api/prayers")
async def get_prayers():
    """
    메모리 캐시에서 기도제목 + 담당자배정 + 공통기도제목을 통합하여 반환합니다.
    캐시는 서버 시작 시 및 5분마다 자동 갱신됩니다.
    /api/refresh 호출로 즉시 갱신할 수 있습니다.
    """
    global prayers_cache
    return prayers_cache


# ============================================================
# 엔드포인트: POST /api/refresh  ← 캐시 즉시 강제 갱신
# ============================================================
@app.post("/api/refresh")
async def force_refresh_cache():
    """
    구글 시트에서 모든 데이터(기도제목, 담당자, 공통기도제목)를 즉시 다시 로드합니다.
    담당자 추가/변경 후 즉시 반영할 때 사용하세요.
    """
    logger.info("🔄 캐시 강제 갱신 요청 수신")
    await load_prayers_to_cache()
    return {
        "message": "캐시가 구글 시트 최신 데이터로 갱신되었습니다.",
        "assignments_count": len(prayers_cache.get("assignments", {})),
        "common_prayers_count": len(prayers_cache.get("common_prayers", [])),
        "prayers_count": len(prayers_cache.get("prayers_by_requester", {})),
        "refreshed_at": datetime.now().isoformat()
    }


# ============================================================
# 엔드포인트: GET /api/config  (메모리 캐시 기반 → 빠른 응답)
# ============================================================
@app.get("/api/config")
async def get_config():
    """
    메모리 캐시에서 공통 기도제목과 담당자 배정 설정을 반환합니다.
    캐시는 /api/prayers와 동일하게 5분마다 자동 갱신되며,
    /api/refresh 로 즉시 갱신할 수 있습니다.
    """
    global prayers_cache
    return {
        "common_prayers": {
            "data": prayers_cache.get("common_prayers", []),
            "source": prayers_cache.get("common_prayers_source", "unknown"),
            "count": len(prayers_cache.get("common_prayers", []))
        },
        "assignments": {
            "data": prayers_cache.get("assignments", {}),
            "source": prayers_cache.get("assignments_source", "unknown"),
            "count": len(prayers_cache.get("assignments", {}))
        },
        "loaded_at": datetime.now().isoformat()
    }


# ============================================================
# 엔드포인트: POST /api/config/assignments
# ============================================================
from pydantic import BaseModel

class AssignmentsUpdate(BaseModel):
    assignments: dict[str, list[str]]

@app.post("/api/config/assignments")
async def update_assignments(data: AssignmentsUpdate):
    """
    담당자 배정 설정을 구글 시트에 업데이트하고 메모리 캐시도 즉시 갱신합니다.
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

    # 저장 즉시 메모리 캐시도 갱신 (다음 폴링 전에 반영)
    prayers_cache["assignments"] = data.assignments
    prayers_cache["assignments_source"] = "google_sheets"
    logger.info(f"메모리 캐시 담당자 배정 즉시 갱신 완료 ({len(data.assignments)}명)")

    return {
        "message": "담당자 배정 정보가 구글 스프레드시트에 성공적으로 저장되었습니다.",
        "assignments": data.assignments
    }


# ============================================================
# 엔드포인트: GET /api/logs
# ============================================================
@app.get("/api/logs")
async def get_logs(limit: int = 50):
    """
    파이프라인 로그 파일의 마지막 N줄을 반환합니다.
    
    Args:
        limit: 반환할 최대 줄 수 (기본값: 50)
    
    Returns:
        lines: 로그 줄 목록
        total_lines: 반환된 줄 수
        log_file: 로그 파일 경로
    """
    try:
        if not os.path.exists(LOG_FILE):
            return {
                "lines": ["로그 파일이 없습니다."],
                "total_lines": 0,
                "log_file": LOG_FILE
            }
        
        # 로그 파일 마지막 N줄 읽기
        with open(LOG_FILE, 'r', encoding='utf-8', errors='replace') as f:
            all_lines = f.readlines()
        
        # 마지막 limit줄 추출 (빈 줄 제거)
        last_lines = [line.rstrip('\n') for line in all_lines[-limit:] if line.strip()]
        
        return {
            "lines": last_lines,
            "total_lines": len(last_lines),
            "log_file": LOG_FILE,
            "fetched_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"로그 파일 읽기 실패: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"로그 파일 읽기 중 오류가 발생했습니다: {str(e)}"
        )


# ============================================================
# API 헬스체크 (Render.com 서비스 생존 확인용)
# ============================================================
@app.get("/api/health")
async def health_check():
    """서비스 헬스체크 엔드포인트"""
    return {
        "service": "CBF 기도제목 자동화 API",
        "version": "2.0.0",
        "status": "running",
        "timestamp": datetime.now().isoformat()
    }


# ── 프론트엔드 정적 파일 마운트 및 SPA 라우팅 지원 ──
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# assets 디렉토리 개별 마운트
if os.path.exists("static/assets"):
    app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")

# SPA 라우팅을 위한 Catch-all GET 핸들러 (API 요청 제외한 모든 경로 대응)
@app.get("/{catchall:path}")
async def read_index(catchall: str):
    # API 요청 오류 처리
    if catchall.startswith("api"):
        raise HTTPException(status_code=404, detail="API route not found")
    
    # index.html 반환
    index_path = os.path.join("static", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
        
    raise HTTPException(status_code=404, detail="Static index.html not found")



# ============================================================
# Render.com용 포트 바인딩
# ============================================================
if __name__ == '__main__':
    import uvicorn
    port = int(os.getenv('PORT', 8000))
    logger.info(f"API 서버 시작 (포트: {port})")
    uvicorn.run(app, host='0.0.0.0', port=port)
