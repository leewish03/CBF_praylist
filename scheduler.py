import schedule
import time
import logging
from main import run_pipeline

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('prayer_pipeline.log'),
        logging.StreamHandler()
    ]
)

def setup_scheduler():
    """스케줄러를 설정합니다."""
    # 매일 오전 9시에 실행
    schedule.every().day.at("09:00").do(run_pipeline)
    
    logging.info("스케줄러가 설정되었습니다. 매일 오전 9시에 실행됩니다.")
    
    while True:
        schedule.run_pending()
        time.sleep(60)  # 1분마다 스케줄 체크

if __name__ == "__main__":
    setup_scheduler() 