from google.oauth2 import service_account
from googleapiclient.discovery import build
import pandas as pd
from dotenv import load_dotenv
import os
import logging

load_dotenv()

SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
SPREADSHEET_ID = os.getenv('SPREADSHEET_ID')
RANGE_NAME = os.getenv('RANGE_NAME', 'sheet1!A:Z')  # 새로운 시트명으로 변경

# 로거 설정
logger = logging.getLogger(__name__)

def get_google_sheets_service():
    """Google Sheets API 서비스를 초기화합니다."""
    try:
        # 서비스 계정 키 파일 경로 가져오기
        service_account_file = os.getenv('SERVICE_ACCOUNT_FILE', 'cbf-praylist-11bbf27f1baa.json')
        
        # 서비스 계정 인증 정보 파일 사용
        credentials = service_account.Credentials.from_service_account_file(
            service_account_file,
            scopes=SCOPES
        )
        
        service = build('sheets', 'v4', credentials=credentials)
        logger.info("Google Sheets 서비스 초기화 성공")
        return service
    except Exception as e:
        logger.error(f"Google Sheets 서비스 초기화 실패: {str(e)}")
        raise

def get_prayer_requests():
    """Google Sheets에서 기도제목 데이터를 가져옵니다."""
    try:
        service = get_google_sheets_service()
        sheet = service.spreadsheets()
        result = sheet.values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=RANGE_NAME
        ).execute()
        
        values = result.get('values', [])
        if not values:
            logger.warning('스프레드시트에서 데이터를 찾을 수 없습니다.')
            return None
        
        logger.info(f"스프레드시트에서 {len(values)-1}개의 행을 가져왔습니다.")
        
        # 첫 번째 행을 헤더로 사용하여 DataFrame 생성
        headers = values[0]
        
        # 빈 셀을 처리하기 위해 모든 행을 같은 길이로 맞춤
        max_len = len(headers)
        padded_values = []
        for row in values[1:]:
            padded_row = row + [''] * (max_len - len(row))
            padded_values.append(padded_row)
        
        # DataFrame 생성
        df = pd.DataFrame(padded_values, columns=headers)
        
        # 기본 필수 컬럼들 확인 (날짜 관련 제거)
        required_columns = ['타임스탬프', '이름', '이름(구도자)']
        for col in required_columns:
            if col not in df.columns:
                logger.warning(f"필수 열 '{col}'이(가) 스프레드시트에 존재하지 않습니다.")
        
        return df
        
    except Exception as e:
        logger.error(f"기도제목 데이터 가져오기 실패: {str(e)}")
        return None 