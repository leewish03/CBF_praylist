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
        "notion_page_id": os.getenv('NOTION_PAGE_ID', '1c50f7e0cd5f8025bb78c5c839f205f0'),
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
    
    def _run_and_release():
        """파이프라인 실행 후 Lock 해제"""
        try:
            logger.info("백그라운드 파이프라인 실행 시작")
            run_pipeline()
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
# 엔드포인트: GET /api/config
# ============================================================
@app.get("/api/config")
async def get_config():
    """
    구글 시트에서 공통 기도제목과 담당자 배정 설정을 로드하여 반환합니다.
    로드 실패 시 fallback 데이터를 반환합니다.
    
    Returns:
        common_prayers: {data: list[str], source: str}
        assignments: {data: dict[str, list[str]], source: str}
    """
    try:
        from google_sheets import get_common_prayers, get_assignments_from_sheet
        
        logger.info("구글 시트에서 설정 데이터 로드 중...")
        
        common_prayers_result = get_common_prayers()
        assignments_result = get_assignments_from_sheet()
        
        return {
            "common_prayers": {
                "data": common_prayers_result["data"],
                "source": common_prayers_result["source"],
                "count": len(common_prayers_result["data"])
            },
            "assignments": {
                "data": assignments_result["data"],
                "source": assignments_result["source"],
                "count": len(assignments_result["data"])
            },
            "loaded_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"설정 데이터 로드 실패: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"설정 데이터 로드 중 오류가 발생했습니다: {str(e)}"
        )


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
# 루트 헬스체크 (Render.com 서비스 생존 확인용)
# ============================================================
@app.get("/")
async def health_check():
    """서비스 헬스체크 엔드포인트"""
    return {
        "service": "CBF 기도제목 자동화 API",
        "version": "2.0.0",
        "status": "running",
        "timestamp": datetime.now().isoformat()
    }


# ============================================================
# Render.com용 포트 바인딩
# ============================================================
if __name__ == '__main__':
    import uvicorn
    port = int(os.getenv('PORT', 8000))
    logger.info(f"API 서버 시작 (포트: {port})")
    uvicorn.run(app, host='0.0.0.0', port=port)
