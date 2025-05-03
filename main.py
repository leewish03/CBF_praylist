import schedule
import time
from google_sheets import get_prayer_requests
from data_processor import process_prayer_requests
from notion_publisher import publish_to_notion
import logging

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)

def run_pipeline():
    try:
        logging.info("파이프라인 실행 시작")
        
        # 구글 스프레드시트에서 데이터 가져오기
        df = get_prayer_requests()
        if df is None:
            logging.error("구글 스프레드시트에서 데이터를 가져오지 못했습니다.")
            return
        
        # 데이터 처리
        processed_data = process_prayer_requests(df)
        if processed_data is None:
            logging.error("데이터 처리 중 오류가 발생했습니다.")
            return
        
        # 노션에 게시
        publish_to_notion(processed_data)
        logging.info("파이프라인 실행 완료")
        
    except Exception as e:
        logging.error(f"파이프라인 실행 중 오류 발생: {str(e)}")

def main():
    # 매일 오후 10시에 실행
    schedule.every().day.at("21:58").do(run_pipeline)
    
    # 프로그램 시작 시 한 번 실행
    run_pipeline()
    
    # 스케줄러 실행
    logging.info("스케줄러가 실행되었습니다. 매일 오후 10시에 자동으로 실행됩니다.")
    while True:
        schedule.run_pending()
        time.sleep(60)

if __name__ == "__main__":
    main()
