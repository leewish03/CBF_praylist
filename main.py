from google_sheets import get_prayer_requests
from data_processor import process_prayer_requests
from notion_publisher import publish_to_notion
from utils import retry_on_failure, validate_environment_variables, PipelineError, APIConnectionError
from config import config
import logging
import logging.handlers
import os
import traceback
import sys
from datetime import datetime

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
def publish_with_retry(processed_data):
    """재시도 로직이 적용된 Notion 게시"""
    logger = logging.getLogger(__name__)
    logger.info("Notion에 데이터 게시 시작")
    
    try:
        publish_to_notion(processed_data)
        logger.info("Notion 게시 완료")
        
    except Exception as e:
        logger.error(f"Notion 게시 실패: {str(e)}")
        raise APIConnectionError(f"Notion 게시 실패: {str(e)}")

def generate_pipeline_report(processed_data, execution_time):
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
    
    from config import PrayerAssignments
    assignments = PrayerAssignments.get_assignments()
    
    for manager, assignees in assignments.items():
        manager_total = sum(
            len(processed_data['prayers_by_requester'].get(assignee, []))
            for assignee in assignees
        )
        report += f"   📌 {manager}: {manager_total}개\n"
    
    # 디버깅: 실제 데이터와 매핑 비교
    all_assignees = PrayerAssignments.get_all_assignees()
    actual_names = list(processed_data['prayers_by_requester'].keys())
    
    logger.info(f"🔍 디버깅 정보:")
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
    
    return report

def run_pipeline():
    """개선된 메인 파이프라인"""
    logger = logging.getLogger(__name__)
    start_time = datetime.now()
    
    try:
        logger.info("="*50)
        logger.info("CBF 기도제목 자동화 파이프라인 시작")
        logger.info("="*50)
        
        # 1. 설정 검증
        logger.info("1️⃣ 설정 및 환경변수 검증")
        config.validate()
        validate_environment_variables()
        
        # 2. 데이터 수집
        logger.info("2️⃣ 구글 스프레드시트 데이터 수집")
        df = fetch_data_with_retry()
        
        # 3. 데이터 처리
        logger.info("3️⃣ 데이터 처리 및 변환")
        processed_data = process_prayer_requests(df)
        if processed_data is None:
            raise PipelineError("데이터 처리 중 오류가 발생했습니다")
        
        # 4. Notion 게시
        logger.info("4️⃣ Notion 페이지 업데이트")
        publish_with_retry(processed_data)
        
        # 5. 실행 보고서
        execution_time = (datetime.now() - start_time).total_seconds()
        report = generate_pipeline_report(processed_data, execution_time)
        
        logger.info("5️⃣ 실행 완료")
        logger.info(report)
        
        return True
        
    except ValueError as e:
        logger.error(f"설정 오류: {str(e)}")
        return False
    except APIConnectionError as e:
        logger.error(f"API 연결 오류: {str(e)}")
        return False
    except PipelineError as e:
        logger.error(f"파이프라인 오류: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"예상치 못한 오류 발생: {str(e)}")
        logger.error(f"상세 오류:\n{traceback.format_exc()}")
        return False
    finally:
        execution_time = (datetime.now() - start_time).total_seconds()
        logger.info(f"파이프라인 종료 (실행시간: {execution_time:.2f}초)")

def main():
    """메인 함수"""
    # 로깅 설정
    setup_logging()
    logger = logging.getLogger(__name__)
    
    try:
        success = run_pipeline()
        sys.exit(0 if success else 1)
        
    except KeyboardInterrupt:
        logger.info("사용자에 의해 중단되었습니다")
        sys.exit(0)
    except Exception as e:
        logger.critical(f"치명적 오류: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()