from google_sheets import get_prayer_requests
from data_processor import process_prayer_requests
from notion_publisher import publish_to_notion
import logging
import os
from dotenv import load_dotenv
import traceback
import sys

# 환경 변수 로드
load_dotenv()

# 로깅 설정
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

def run_pipeline():
    try:
        logger.info("파이프라인 실행 시작")
        
        # 구글 스프레드시트에서 데이터 가져오기
        logger.info("구글 스프레드시트에서 데이터 가져오기 시작")
        df = get_prayer_requests()
        if df is None:
            logger.error("구글 스프레드시트에서 데이터를 가져오지 못했습니다.")
            return
        
        logger.info(f"스프레드시트에서 {len(df)}개의 행을 가져왔습니다.")
        
        # 데이터 처리
        logger.info("데이터 처리 시작")
        processed_data = process_prayer_requests(df)
        if processed_data is None:
            logger.error("데이터 처리 중 오류가 발생했습니다.")
            return
        
        logger.info(f"총 {sum(len(prayers) for prayers in processed_data['prayers_by_requester'].values())}개의 기도제목을 처리했습니다.")
        
        # 노션에 게시
        logger.info("노션에 데이터 게시 시작")
        publish_to_notion(processed_data)
        logger.info("파이프라인 실행 완료")
        
    except Exception as e:
        logger.error(f"파이프라인 실행 중 오류 발생: {str(e)}")
        logger.error(traceback.format_exc())
        sys.exit(1)

if __name__ == "__main__":
    run_pipeline()