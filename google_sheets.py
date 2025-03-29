from google.oauth2 import service_account
from googleapiclient.discovery import build
import pandas as pd
from dotenv import load_dotenv
import os

load_dotenv()

SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
SPREADSHEET_ID = os.getenv('SPREADSHEET_ID')
RANGE_NAME = 'Prayer_Requests!A:Z'  # 시트 이름을 Prayer_Requests로 수정

def get_google_sheets_service():
    # 서비스 계정 인증 정보 파일 사용
    credentials = service_account.Credentials.from_service_account_file(
        'cbf-praylist-dbaa1d1a9cd4.json',  # 서비스 계정 키 파일 경로
        scopes=SCOPES
    )
    
    service = build('sheets', 'v4', credentials=credentials)
    return service

def get_prayer_requests():
    service = get_google_sheets_service()
    sheet = service.spreadsheets()
    result = sheet.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=RANGE_NAME
    ).execute()
    
    values = result.get('values', [])
    if not values:
        print('데이터가 없습니다.')
        return None
    
    # 첫 번째 행을 헤더로 사용
    df = pd.DataFrame(values[1:], columns=values[0])
    return df 