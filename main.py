from google_sheets import get_prayer_requests, get_common_prayers, get_assignments_from_sheet
from data_processor import process_prayer_requests
from notion_publisher import publish_to_notion
from utils import retry_on_failure, PipelineError, APIConnectionError
from config import config, PrayerAssignments
import logging
import logging.handlers
import os
import traceback
import sys
from datetime import datetime
from filelock import FileLock, Timeout

# ============================================================
# 파이프라인 전역 상태 (API 서버에서 접근 가능)
# ============================================================
pipeline_state = {
    'status': 'IDLE',              # IDLE, RUNNING, ERROR, SUCCESS
    'last_run': None,              # 마지막 실행 시각 (ISO 형식 문자열)
    'unmapped_requesters': [],     # 담당자 미지정 제출자 목록
    'config_source': 'unknown'    # 설정 데이터 소스 (google_sheets / fallback_default)
}

# 파이프라인 Lock 파일 경로
LOCK_FILE = 'prayer_pipeline.lock'

def setup_logging():
    """향상된 로깅 설정"""
    # 로그 디렉토리 생성
    log_dir = os.path.dirname(config.logging.file_path)
    if log_dir and not os.path.exists(log_dir):
        os.makedirs(log_dir)
    
    # 루트 로거 설정
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, config.logging.level))
    
    # 기존 핸들러 제거
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # 콘솔 핸들러
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)
    
    # 파일 핸들러 (로테이션)
    file_handler = logging.handlers.RotatingFileHandler(
        config.logging.file_path,
        maxBytes=config.logging.max_file_size * 1024 * 1024,  # MB to bytes
        backupCount=config.logging.backup_count,
        encoding='utf-8'
    )
    file_handler.setLevel(getattr(logging, config.logging.level))
    file_formatter = logging.Formatter(config.logging.format)
    file_handler.setFormatter(file_formatter)
    root_logger.addHandler(file_handler)

@retry_on_failure(max_retries=3, delay=2.0)
def fetch_data_with_retry():
    """재시도 로직이 적용된 데이터 수집"""
    logger = logging.getLogger(__name__)
    logger.info("구글 스프레드시트에서 데이터 수집 시작")
    
    try:
        df = get_prayer_requests()
        if df is None:
            raise APIConnectionError("구글 스프레드시트에서 데이터를 가져올 수 없습니다")
        
        logger.info(f"데이터 수집 완료: {len(df)}개 행")
        return df
        
    except Exception as e:
        logger.error(f"데이터 수집 실패: {str(e)}")
        raise APIConnectionError(f"데이터 수집 실패: {str(e)}")

@retry_on_failure(max_retries=2, delay=3.0)  
def publish_with_retry(processed_data, common_prayers=None, assignments=None):
    """재시도 로직이 적용된 Notion 게시"""
    logger = logging.getLogger(__name__)
    logger.info("Notion에 데이터 게시 시작")
    
    try:
        publish_to_notion(processed_data, common_prayers=common_prayers, assignments=assignments)
        logger.info("Notion 게시 완료")
        
    except Exception as e:
        logger.error(f"Notion 게시 실패: {str(e)}")
        raise APIConnectionError(f"Notion 게시 실패: {str(e)}")

def generate_pipeline_report(processed_data, execution_time, assignments):
    """파이프라인 실행 보고서 생성"""
    logger = logging.getLogger(__name__)
    
    total_prayers = sum(len(prayers) for prayers in processed_data['prayers_by_requester'].values())
    total_requesters = len(processed_data['prayers_by_requester'])
    
    report = f"""
📊 CBF 기도제목 파이프라인 실행 보고서
{'='*50}
🕐 실행 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
⏱️  처리 소요시간: {execution_time:.2f}초
📝 총 기도제목 수: {total_prayers}개
👥 제출자 수: {total_requesters}명
📋 담당자별 분배:
"""
    
    for manager, assignees in assignments.items():
        manager_total = sum(
            len(processed_data['prayers_by_requester'].get(assignee, []))
            for assignee in assignees
        )
        report += f"   📌 {manager}: {manager_total}개\n"
    
    # 디버깅: 실제 데이터와 매핑 비교
    all_assignees = []
    for assignees in assignments.values():
        all_assignees.extend(assignees)
    all_assignees = list(set(all_assignees))
    
    actual_names = list(processed_data['prayers_by_requester'].keys())
    
    logger.info("🔍 디버깅 정보:")
    logger.info(f"   실제 데이터 이름들: {actual_names}")
    logger.info(f"   매핑된 assignees: {all_assignees}")
    
    # 각 이름에 대해 상세 비교
    for name in actual_names:
        if name not in all_assignees:
            logger.warning(f"   ❌ '{name}' (길이: {len(name)}, repr: {repr(name)}) - 매핑에 없음")
        else:
            logger.info(f"   ✅ '{name}' - 매핑에 있음")
    
    # 매핑되지 않은 제출자 확인
    unmapped = [name for name in actual_names if name not in all_assignees]
    
    if unmapped:
        report += f"\n⚠️  담당자 미지정: {', '.join(unmapped)}"
    
    report += f"\n✅ 파이프라인 실행 완료"
    
    return report, unmapped

def validate_environment_for_pipeline(require_notion=False):
    """파이프라인 실행을 위한 환경 변수 검증 (Notion 선택 사항화)"""
    import os
    
    required_vars = ['SPREADSHEET_ID']
    if require_notion:
        required_vars.extend(['NOTION_TOKEN', 'NOTION_PAGE_ID'])
        
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        raise ValueError(f"필수 환경변수가 누락되었습니다: {', '.join(missing_vars)}")
    
    logger = logging.getLogger(__name__)
    logger.info("환경변수 검증 완료")

import json

def save_prayers_to_local_cache(processed_data):
    """로컬 json 파일로 기도제목 데이터를 저장합니다."""
    logger = logging.getLogger(__name__)
    cache_file = 'prayers_data.json'
    try:
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(processed_data, f, ensure_ascii=False, indent=2)
        logger.info(f"로컬 JSON 캐시 저장 성공: {cache_file}")
    except Exception as e:
        logger.error(f"로컬 JSON 캐시 저장 실패: {str(e)}")
        
def save_prayers_to_db(processed_data, common_prayers, assignments):
    """PostgreSQL 데이터베이스가 설정되어 있을 때 데이터를 저장하고 캐싱합니다."""
    logger = logging.getLogger(__name__)
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        logger.info("DATABASE_URL이 설정되지 않아 데이터베이스 저장을 생략합니다.")
        return
    
    # Render postgresql scheme 대응
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
        
    try:
        import psycopg2
        from psycopg2.extras import Json
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # 1. 테이블 DDL 자동 생성
        cur.execute("""
            CREATE TABLE IF NOT EXISTS prayers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100),
                target_name VARCHAR(100),
                gender VARCHAR(20),
                age VARCHAR(50),
                relationship VARCHAR(100),
                prayer_content TEXT,
                church VARCHAR(100),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS prayer_metadata (
                key VARCHAR(50) PRIMARY KEY,
                value JSONB,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()
        
        # 2. 기존 개별 기도제목 데이터 제거 및 신규 삽입
        cur.execute("TRUNCATE TABLE prayers;")
        
        count = 0
        for requester, items in processed_data.get('prayers_by_requester', {}).items():
            for item in items:
                cur.execute("""
                    INSERT INTO prayers (name, target_name, gender, age, relationship, prayer_content, church)
                    VALUES (%s, %s, %s, %s, %s, %s, %s);
                """, (
                    item.get('name', ''),
                    item.get('target_name', ''),
                    item.get('gender', ''),
                    item.get('age', ''),
                    item.get('relationship', ''),
                    item.get('prayer_content', ''),
                    item.get('church', '')
                ))
                count += 1
                
        # 3. 메타데이터 저장 (공통기도제목, 담당자 매핑, 마지막 동기화 등)
        metadata = {
            'last_updated': processed_data.get('last_updated'),
            'common_prayers': common_prayers,
            'assignments': assignments
        }
        cur.execute("""
            INSERT INTO prayer_metadata (key, value, updated_at)
            VALUES ('sync_info', %s, CURRENT_TIMESTAMP)
            ON CONFLICT (key) DO UPDATE 
            SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;
        """, (Json(metadata),))
        
        conn.commit()
        cur.close()
        conn.close()
        logger.info(f"데이터베이스 저장 완료: 총 {count}개 기도제목 삽입됨.")
    except Exception as e:
        logger.error(f"데이터베이스 저장 중 오류 발생: {str(e)}")

def run_pipeline():
    """
    메인 파이프라인 실행 함수
    전역 pipeline_state를 업데이트하며 중복 실행 방지를 위해 FileLock 사용
    """
    global pipeline_state
    logger = logging.getLogger(__name__)
    start_time = datetime.now()
    
    # ── 파이프라인 상태: RUNNING 설정 ──
    pipeline_state['status'] = 'RUNNING'
    pipeline_state['last_run'] = start_time.isoformat()
    
    try:
        logger.info("="*50)
        logger.info("CBF 기도제목 자동화 파이프라인 시작")
        logger.info("="*50)
        
        # 1. 설정 검증 (Notion 필수 해제)
        logger.info("1️⃣ 설정 및 환경변수 검증")
        has_notion = config.notion.is_configured
        config.validate(require_notion=False)
        validate_environment_for_pipeline(require_notion=False)
        
        # 2. 동적 설정 로드 (구글 시트에서)
        logger.info("2️⃣ 구글 시트에서 설정 데이터 로드")
        
        common_prayers_result = get_common_prayers()
        common_prayers = common_prayers_result['data']
        common_prayers_source = common_prayers_result['source']
        logger.info(f"   공통 기도제목: {len(common_prayers)}개 ({common_prayers_source})")
        
        assignments_result = get_assignments_from_sheet()
        assignments = assignments_result['data']
        assignments_source = assignments_result['source']
        logger.info(f"   담당자 배정: {len(assignments)}명 ({assignments_source})")
        
        # 설정 소스 기록 (두 소스가 다르면 혼합으로 표시)
        if common_prayers_source == assignments_source:
            pipeline_state['config_source'] = common_prayers_source
        else:
            pipeline_state['config_source'] = f"mixed ({common_prayers_source}/{assignments_source})"
        
        # 3. 데이터 수집
        logger.info("3️⃣ 구글 스프레드시트 데이터 수집")
        df = fetch_data_with_retry()
        
        # 4. 데이터 처리
        logger.info("4️⃣ 데이터 처리 및 변환")
        processed_data = process_prayer_requests(df)
        if processed_data is None:
            raise PipelineError("데이터 처리 중 오류가 발생했습니다")
        
        # 5. Notion 게시 (설정된 경우에만 진행)
        if has_notion:
            logger.info("5️⃣ Notion 페이지 업데이트")
            try:
                publish_with_retry(processed_data, common_prayers=common_prayers, assignments=assignments)
            except Exception as notion_err:
                logger.warning(f"Notion 업데이트 실패 (진행은 계속됩니다): {str(notion_err)}")
        else:
            logger.info("5️⃣ Notion 설정이 없어 Notion 업데이트 단계를 건너뜁니다.")
            
        # 5-2. 로컬 캐시 및 데이터베이스 저장
        logger.info("5️⃣-2 로컬 캐시 및 데이터베이스 동기화 저장")
        save_prayers_to_local_cache(processed_data)
        save_prayers_to_db(processed_data, common_prayers, assignments)
        
        # 6. 실행 보고서
        execution_time = (datetime.now() - start_time).total_seconds()
        report, unmapped = generate_pipeline_report(processed_data, execution_time, assignments)
        
        logger.info("6️⃣ 실행 완료")
        logger.info(report)
        
        # ── 파이프라인 상태: SUCCESS 설정 ──
        pipeline_state['status'] = 'SUCCESS'
        pipeline_state['unmapped_requesters'] = unmapped
        
        return True
        
    except ValueError as e:
        logger.error(f"설정 오류: {str(e)}")
        pipeline_state['status'] = 'ERROR'
        return False
    except APIConnectionError as e:
        logger.error(f"API 연결 오류: {str(e)}")
        pipeline_state['status'] = 'ERROR'
        return False
    except PipelineError as e:
        logger.error(f"파이프라인 오류: {str(e)}")
        pipeline_state['status'] = 'ERROR'
        return False
    except Exception as e:
        logger.error(f"예상치 못한 오류 발생: {str(e)}")
        logger.error(f"상세 오류:\n{traceback.format_exc()}")
        pipeline_state['status'] = 'ERROR'
        return False
    finally:
        execution_time = (datetime.now() - start_time).total_seconds()
        logger.info(f"파이프라인 종료 (실행시간: {execution_time:.2f}초)")


def main():
    """메인 함수 (CLI 직접 실행용)"""
    # 로깅 설정
    setup_logging()
    logger = logging.getLogger(__name__)
    
    try:
        # FileLock으로 중복 실행 방지
        lock = FileLock(LOCK_FILE, timeout=0)
        
        with lock:
            logger.info("파이프라인 Lock 획득 성공")
            success = run_pipeline()
            sys.exit(0 if success else 1)
        
    except Timeout:
        logger.error("파이프라인이 이미 실행 중입니다. (Lock 획득 실패)")
        sys.exit(1)
    except KeyboardInterrupt:
        logger.info("사용자에 의해 중단되었습니다")
        sys.exit(0)
    except Exception as e:
        logger.critical(f"치명적 오류: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()