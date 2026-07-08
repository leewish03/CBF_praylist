from google.oauth2 import service_account
from googleapiclient.discovery import build
import pandas as pd
from dotenv import load_dotenv
import os
import logging
from typing import Dict, List

load_dotenv()

# Google Sheets API 권한 범위 (읽기/쓰기 모두 포함)
# 설정용 스프레드시트(1Bvl...) 및 설문 응답용 스프레드시트(1pfn...)
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = os.getenv('SPREADSHEET_ID', '1gYaj_juZ2TBU-aXOOwiHkl5N0vrF1CeaNLE29aftvlg')
RESPONSES_SPREADSHEET_ID = os.getenv('RESPONSES_SPREADSHEET_ID', '1gYaj_juZ2TBU-aXOOwiHkl5N0vrF1CeaNLE29aftvlg')
RANGE_NAME = os.getenv('RANGE_NAME', "'설문지 응답 시트1'!A:Z")

# 설정 시트명 상수 (config.py와 동기화)
COMMON_PRAYERS_SHEET = '설정_공통기도제목'
ASSIGNMENTS_SHEET = '설정_담당자배정'

# 로거 설정
logger = logging.getLogger(__name__)

# ── 싱글톤 서비스 캐시 (메모리 절약 핵심) ──
_service_instance = None

def get_google_sheets_service():
    """
    Google Sheets API 서비스를 싱글톤으로 반환합니다.
    최초 1회만 초기화하고 이후 재사용하여 메모리를 절약합니다.
    cache_discovery=False 로 discovery JSON 캐시 파일 생성을 방지합니다.
    """
    global _service_instance
    if _service_instance is not None:
        return _service_instance

    try:
        # 서비스 계정 키 파일 경로 가져오기
        service_account_file = os.getenv('SERVICE_ACCOUNT_FILE', 'cbf-praylist-11bbf27f1baa.json')
        
        # 서비스 계정 인증 정보 파일 사용
        credentials = service_account.Credentials.from_service_account_file(
            service_account_file,
            scopes=SCOPES
        )
        
        # cache_discovery=False: 디스크/메모리 discovery 캐시 비활성화 → 메모리 절약
        _service_instance = build('sheets', 'v4', credentials=credentials, cache_discovery=False)
        logger.info("Google Sheets 서비스 초기화 성공 (싱글톤)")
        return _service_instance
    except Exception as e:
        logger.error(f"Google Sheets 서비스 초기화 실패: {str(e)}")
        raise

def get_prayer_requests():
    """Google Sheets에서 기도제목 데이터를 가져옵니다."""
    try:
        service = get_google_sheets_service()
        sheet = service.spreadsheets()
        result = sheet.values().get(
            spreadsheetId=RESPONSES_SPREADSHEET_ID,
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
        
        # 기본 필수 컬럼들 확인
        required_columns = ['타임스탬프', '이름', '이름(구도자)']
        for col in required_columns:
            if col not in df.columns:
                logger.warning(f"필수 열 '{col}'이(가) 스프레드시트에 존재하지 않습니다.")
        
        return df
        
    except Exception as e:
        logger.error(f"기도제목 데이터 가져오기 실패: {str(e)}")
        return None

def get_common_prayers() -> dict:
    """
    '설정_공통기도제목' 시트에서 활성화된 기도제목을 가져옵니다.
    
    Returns:
        dict: {
            'data': list[str],  # 기도제목 목록 (활성화여부=Y, 순번 순서)
            'source': 'google_sheets' | 'fallback_default'
        }
    """
    try:
        service = get_google_sheets_service()
        sheet = service.spreadsheets()
        
        # 설정_공통기도제목 시트 전체 읽기
        result = sheet.values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=f"'{COMMON_PRAYERS_SHEET}'!A:D"
        ).execute()
        
        values = result.get('values', [])
        if not values or len(values) < 2:
            logger.warning("설정_공통기도제목 시트가 비어 있습니다. fallback을 사용합니다.")
            return _get_common_prayers_fallback()
        
        headers = values[0]  # [순번, 기도제목, 활성화여부, 비고]
        
        # 헤더 인덱스 찾기
        try:
            idx_num = headers.index('순번')
            idx_prayer = headers.index('기도제목')
            idx_active = headers.index('활성화여부')
        except ValueError as e:
            logger.warning(f"설정_공통기도제목 시트 헤더 오류: {e}. fallback을 사용합니다.")
            return _get_common_prayers_fallback()
        
        prayers = []
        for row in values[1:]:
            # 행 길이 패딩
            padded = row + [''] * (len(headers) - len(row))
            
            active = padded[idx_active].strip().upper() if idx_active < len(padded) else ''
            prayer_text = padded[idx_prayer].strip() if idx_prayer < len(padded) else ''
            
            # 활성화여부가 'Y'이고 기도제목이 있는 경우만 추가
            if active == 'Y' and prayer_text:
                prayers.append(prayer_text)
        
        if not prayers:
            logger.warning("활성화된 공통 기도제목이 없습니다. fallback을 사용합니다.")
            return _get_common_prayers_fallback()
        
        logger.info(f"구글 시트에서 {len(prayers)}개의 공통 기도제목을 로드했습니다.")
        return {
            'data': prayers,
            'source': 'google_sheets'
        }
        
    except Exception as e:
        logger.warning(f"공통 기도제목 로드 실패 (fallback 사용): {str(e)}")
        return _get_common_prayers_fallback()

def _get_common_prayers_fallback() -> dict:
    """notion_publisher.py의 COMMON_PRAYERS 상수를 fallback으로 반환합니다."""
    try:
        from notion_publisher import COMMON_PRAYERS
        # 문자열을 번호 기준으로 분리
        prayers = []
        lines = COMMON_PRAYERS.strip().split('\n')
        current_prayer = []
        
        for line in lines:
            # 새 기도제목 시작 (숫자. 로 시작)
            stripped = line.strip()
            if stripped and stripped[0].isdigit() and '. ' in stripped[:5]:
                if current_prayer:
                    prayers.append('\n'.join(current_prayer))
                current_prayer = [line]
            else:
                current_prayer.append(line)
        
        if current_prayer:
            prayers.append('\n'.join(current_prayer))
        
        logger.info(f"Fallback: COMMON_PRAYERS 상수에서 {len(prayers)}개의 기도제목을 로드했습니다.")
        return {
            'data': prayers,
            'source': 'fallback_default'
        }
    except Exception as e:
        logger.error(f"Fallback 공통 기도제목 로드 실패: {str(e)}")
        return {
            'data': [],
            'source': 'fallback_default'
        }

def get_assignments_from_sheet() -> dict:
    """
    '설정_담당자배정' 시트에서 담당자→제출자이름 딕셔너리를 가져옵니다.
    
    Returns:
        dict: {
            'data': dict[str, list[str]],  # {담당자: [제출자이름, ...]}
            'source': 'google_sheets' | 'fallback_default'
        }
    """
    try:
        service = get_google_sheets_service()
        sheet = service.spreadsheets()
        
        # 설정_담당자배정 시트 전체 읽기
        result = sheet.values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=f"'{ASSIGNMENTS_SHEET}'!A:B"
        ).execute()
        
        values = result.get('values', [])
        if not values or len(values) < 2:
            logger.warning("설정_담당자배정 시트가 비어 있습니다. fallback을 사용합니다.")
            return _get_assignments_fallback()
        
        headers = values[0]  # [담당자, 제출자이름]
        
        # 헤더 인덱스 찾기
        try:
            idx_manager = headers.index('담당자')
            idx_assignee = headers.index('제출자이름')
        except ValueError as e:
            logger.warning(f"설정_담당자배정 시트 헤더 오류: {e}. fallback을 사용합니다.")
            return _get_assignments_fallback()
        
        assignments: Dict[str, List[str]] = {}
        
        for row in values[1:]:
            padded = row + [''] * (len(headers) - len(row))
            
            manager = padded[idx_manager].strip() if idx_manager < len(padded) else ''
            assignee_str = padded[idx_assignee].strip() if idx_assignee < len(padded) else ''
            
            if manager:
                if manager not in assignments:
                    assignments[manager] = []
                if assignee_str:
                    # 쉼표로 분리 후 양끝 공백 제거 및 빈 값 필터링
                    names = [name.strip() for name in assignee_str.split(',') if name.strip()]
                    for name in names:
                        if name not in assignments[manager]:
                            assignments[manager].append(name)
        
        if not assignments:
            logger.warning("담당자 배정 데이터가 없습니다. fallback을 사용합니다.")
            return _get_assignments_fallback()
        
        logger.info(f"구글 시트에서 {len(assignments)}명의 담당자 매핑을 로드했습니다.")
        return {
            'data': assignments,
            'source': 'google_sheets'
        }
        
    except Exception as e:
        logger.warning(f"담당자 배정 로드 실패 (fallback 사용): {str(e)}")
        return _get_assignments_fallback()

def _get_assignments_fallback() -> dict:
    """config.py의 DEFAULT_ASSIGNMENTS를 fallback으로 반환합니다."""
    try:
        from config import PrayerAssignments
        assignments = PrayerAssignments.DEFAULT_ASSIGNMENTS
        logger.info(f"Fallback: DEFAULT_ASSIGNMENTS에서 {len(assignments)}명의 담당자 매핑을 로드했습니다.")
        return {
            'data': assignments,
            'source': 'fallback_default'
        }
    except Exception as e:
        logger.error(f"Fallback 담당자 배정 로드 실패: {str(e)}")
        return {
            'data': {},
            'source': 'fallback_default'
        }

def update_assignments_in_sheet(assignments: dict) -> bool:
    """
    구글 시트의 '설정_담당자배정' 시트 내용을 주어진 딕셔너리로 업데이트합니다.
    """
    try:
        service = get_google_sheets_service()
        
        # 1. 기존 데이터 초기화 (A:B 범위)
        service.spreadsheets().values().clear(
            spreadsheetId=SPREADSHEET_ID,
            range=f"'{ASSIGNMENTS_SHEET}'!A:B"
        ).execute()
        
        # 2. 업데이트할 행 데이터 만들기
        rows = [["담당자", "제출자이름"]]
        for manager, assignees in assignments.items():
            assignees_str = ", ".join(assignees)
            rows.append([manager, assignees_str])
            
        # 3. 데이터 쓰기
        service.spreadsheets().values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=f"'{ASSIGNMENTS_SHEET}'!A1",
            valueInputOption="RAW",
            body={"values": rows}
        ).execute()
        
        logger.info(f"구글 시트의 '설정_담당자배정' 시트 업데이트 완료 ({len(assignments)}개 담당자)")
        return True
    except Exception as e:
        logger.error(f"구글 시트 담당자 배정 시트 업데이트 실패: {str(e)}")
        return False