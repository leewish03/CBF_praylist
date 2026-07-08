"""
CBF 기도제목 자동화 V2 - 구글 시트 초기 설정 스크립트
신규 스프레드시트에 설정 시트를 생성하고 기본 데이터를 삽입합니다.

⚠️ 이 스크립트는 최초 1회만 실행하세요.
   이미 시트가 존재하면 건너뜁니다.

사용법:
    python setup_sheets.py
"""

import os
import sys
import time
from google.oauth2 import service_account
from googleapiclient.discovery import build
from dotenv import load_dotenv

load_dotenv()

# ============================================================
# 설정
# ============================================================
SPREADSHEET_ID = os.getenv('SPREADSHEET_ID', '1gYaj_juZ2TBU-aXOOwiHkl5N0vrF1CeaNLE29aftvlg')
SERVICE_ACCOUNT_FILE = os.getenv('SERVICE_ACCOUNT_FILE', 'cbf-praylist-11bbf27f1baa.json')

# Google Sheets API 권한 범위 (읽기 + 쓰기)
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

# ============================================================
# 초기 데이터 정의
# ============================================================

# 공통 기도제목 (순번, 기도제목, 활성화여부, 비고)
COMMON_PRAYERS_DATA = [
    ["순번", "기도제목", "활성화여부", "비고"],  # 헤더
    [
        "1",
        "서울CBF의 모든 행사를 하나님께서 주관하여 주시고 하나님의 뜻에 청종함으로 하나님께 쓰임 받는 모임이 되게 하여주소서",
        "Y",
        ""
    ],
    [
        "2",
        "마음을 다하고 뜻을 다하고 힘을 다하여 여호와 하나님을 경외하고 예수그리스도를 사랑하는 모임이 되게 하여주소서 \n - 공과 공부, 그룹 교제, 복음 전도 훈련 등을 통해 하나님 말씀 사모하기에 힘쓰도록",
        "Y",
        ""
    ],
    [
        "3",
        "그리스도의 머리 되심 아래 하나되어 서로 사랑하고 섬기고 격려하여 모이기에 힘쓰는 모임이 되게 하소서\n - 성도들이 서로를 잘 돌아보고 격려할 수 있도록\n - 신입생 및 새로 방문하는 사람들의 적응과 연결을 위하여",
        "Y",
        ""
    ],
    [
        "4",
        "모든 민족과 땅 끝까지 이르러 복음을 전하라 하신 사명에 순종하여 복음을 깊이 묵상하고 전하기에 힘쓰는 모임이 되게 하소서 \n - 1학기 전도활동 가스펠데이를 위한 준비팀이 잘 결성될 수 있도록. 진행 방식과 내용 등 준비하는 모든 과정에서 사탄이 틈타지 않고 복음을 위하여 하나님이 기뻐하시는 대로 진행되도록\n - 가스펠데이를 진행할 장소와 날짜를 보여주시길\n - 성도들이 서울cbf 내외부적으로 복음 전도를 위해 힘쓸 수 있도록",
        "Y",
        ""
    ],
    [
        "5",
        "각자의 삶 가운데서 세상의 빛과 소금으로서의 역할을 잘 감당하고 하나님 나라와 그 의를 구하는 모임이 되게 하소서",
        "Y",
        ""
    ],
]

# 담당자 배정 데이터 (담당자, 제출자이름)
ASSIGNMENTS_DATA = [
    ["담당자", "제출자이름"],  # 헤더
    ["박민성", "김선양"],
    ["한사라", "조용훈"],
    ["김가온", "박찬서, 손승아"],
    ["김나경", "박민성"],
    ["손승아", "정윤정, 한사라"],
    ["신민석", "김가온"],
    ["이소원", "신민석, 김나경"],
    ["조용훈", "이소원"],
]

# 설문지 응답 시트 헤더
SURVEY_SHEET_HEADERS = [
    [
        "타임스탬프",
        "이름",
        "교회",
        "이름(구도자)",
        "성별",
        "나이 (출생연도로 기입 부탁드립니다 ex. 98년생)",
        "관계 (ex 사촌동생, 학교 친구, 직장 동료, 본인)",
        "구체적인 기도제목 (가능한 경우 1. 2. 등 번호로 기입)"
    ]
]


def get_service():
    """Google Sheets API 서비스를 초기화합니다."""
    print(f"🔑 서비스 계정 파일 로드 중: {SERVICE_ACCOUNT_FILE}")
    
    if not os.path.exists(SERVICE_ACCOUNT_FILE):
        print(f"❌ 서비스 계정 파일을 찾을 수 없습니다: {SERVICE_ACCOUNT_FILE}")
        sys.exit(1)
    
    credentials = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE,
        scopes=SCOPES
    )
    service = build('sheets', 'v4', credentials=credentials)
    print("✅ Google Sheets 서비스 초기화 완료")
    return service


def get_existing_sheets(service) -> list:
    """스프레드시트의 기존 시트 목록을 반환합니다."""
    spreadsheet = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
    return [sheet['properties']['title'] for sheet in spreadsheet.get('sheets', [])]


def create_sheet(service, title: str) -> int:
    """새 시트를 생성하고 sheetId를 반환합니다."""
    request = {
        "addSheet": {
            "properties": {
                "title": title
            }
        }
    }
    response = service.spreadsheets().batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={"requests": [request]}
    ).execute()
    
    sheet_id = response['replies'][0]['addSheet']['properties']['sheetId']
    print(f"   📄 시트 생성 완료: '{title}' (ID: {sheet_id})")
    return sheet_id


def write_data(service, sheet_name: str, data: list):
    """지정된 시트에 데이터를 씁니다."""
    range_name = f"'{sheet_name}'!A1"
    
    body = {
        "values": data,
        "majorDimension": "ROWS"
    }
    
    service.spreadsheets().values().update(
        spreadsheetId=SPREADSHEET_ID,
        range=range_name,
        valueInputOption="RAW",
        body=body
    ).execute()
    
    print(f"   ✍️  데이터 입력 완료: {len(data)}행")


def format_header_row(service, sheet_id: int, num_columns: int):
    """헤더 행을 굵게 + 배경색 지정합니다."""
    requests = [
        {
            "repeatCell": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 0,
                    "endRowIndex": 1,
                    "startColumnIndex": 0,
                    "endColumnIndex": num_columns
                },
                "cell": {
                    "userEnteredFormat": {
                        "textFormat": {"bold": True},
                        "backgroundColor": {
                            "red": 0.85,
                            "green": 0.92,
                            "blue": 0.85
                        }
                    }
                },
                "fields": "userEnteredFormat(textFormat,backgroundColor)"
            }
        },
        {
            "autoResizeDimensions": {
                "dimensions": {
                    "sheetId": sheet_id,
                    "dimension": "COLUMNS",
                    "startIndex": 0,
                    "endIndex": num_columns
                }
            }
        }
    ]
    
    service.spreadsheets().batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={"requests": requests}
    ).execute()
    print(f"   🎨 헤더 서식 적용 완료")


def setup_common_prayers_sheet(service, existing_sheets: list):
    """설정_공통기도제목 시트를 생성하고 데이터를 입력합니다."""
    sheet_name = '설정_공통기도제목'
    print(f"\n{'='*50}")
    print(f"📋 [{sheet_name}] 시트 설정 시작")
    
    if sheet_name in existing_sheets:
        print(f"⏭️  '{sheet_name}' 시트가 이미 존재합니다. 건너뜁니다.")
        return
    
    # 시트 생성
    sheet_id = create_sheet(service, sheet_name)
    time.sleep(0.5)  # API 호출 간격
    
    # 데이터 입력
    write_data(service, sheet_name, COMMON_PRAYERS_DATA)
    time.sleep(0.5)
    
    # 헤더 서식 적용
    format_header_row(service, sheet_id, len(COMMON_PRAYERS_DATA[0]))
    
    print(f"✅ '{sheet_name}' 시트 설정 완료 ({len(COMMON_PRAYERS_DATA)-1}개 기도제목)")


def setup_assignments_sheet(service, existing_sheets: list):
    """설정_담당자배정 시트를 생성하고 데이터를 입력합니다."""
    sheet_name = '설정_담당자배정'
    print(f"\n{'='*50}")
    print(f"👥 [{sheet_name}] 시트 설정 시작")
    
    if sheet_name in existing_sheets:
        print(f"⏭️  '{sheet_name}' 시트가 이미 존재합니다. 건너뜁니다.")
        return
    
    # 시트 생성
    sheet_id = create_sheet(service, sheet_name)
    time.sleep(0.5)
    
    # 데이터 입력
    write_data(service, sheet_name, ASSIGNMENTS_DATA)
    time.sleep(0.5)
    
    # 헤더 서식 적용
    format_header_row(service, sheet_id, len(ASSIGNMENTS_DATA[0]))
    
    print(f"✅ '{sheet_name}' 시트 설정 완료 ({len(ASSIGNMENTS_DATA)-1}개 배정)")


def setup_survey_sheet(service, existing_sheets: list):
    """설문지 응답 시트1을 생성하고 헤더를 입력합니다."""
    sheet_name = '설문지 응답 시트1'
    print(f"\n{'='*50}")
    print(f"📝 [{sheet_name}] 시트 설정 시작")
    
    if sheet_name in existing_sheets:
        print(f"⏭️  '{sheet_name}' 시트가 이미 존재합니다. 건너뜁니다.")
        return
    
    # 시트 생성
    sheet_id = create_sheet(service, sheet_name)
    time.sleep(0.5)
    
    # 헤더만 입력 (데이터는 구글 폼에서 자동 추가됨)
    write_data(service, sheet_name, SURVEY_SHEET_HEADERS)
    time.sleep(0.5)
    
    # 헤더 서식 적용
    format_header_row(service, sheet_id, len(SURVEY_SHEET_HEADERS[0]))
    
    print(f"✅ '{sheet_name}' 시트 설정 완료 (헤더 {len(SURVEY_SHEET_HEADERS[0])}개 컬럼)")


def main():
    """메인 실행 함수"""
    print("🙏 CBF 기도제목 자동화 V2 - 구글 시트 초기 설정 스크립트")
    print(f"📊 대상 스프레드시트 ID: {SPREADSHEET_ID}")
    print()
    
    try:
        # Google Sheets 서비스 초기화
        service = get_service()
        
        # 기존 시트 목록 조회
        print("\n🔍 기존 시트 목록 확인 중...")
        existing_sheets = get_existing_sheets(service)
        print(f"   현재 시트: {existing_sheets}")
        
        # 각 시트 설정
        setup_common_prayers_sheet(service, existing_sheets)
        setup_assignments_sheet(service, existing_sheets)
        setup_survey_sheet(service, existing_sheets)
        
        print(f"\n{'='*50}")
        print("🎉 모든 시트 설정이 완료되었습니다!")
        print(f"📊 스프레드시트 URL: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}")
        print()
        print("⚠️  주의사항:")
        print("   1. 구글 폼을 '설문지 응답 시트1'에 연결하세요.")
        print(f"   2. 서비스 계정({os.getenv('SERVICE_ACCOUNT_FILE', 'cbf-praylist-11bbf27f1baa.json')})에")
        print("      스프레드시트 편집 권한을 부여했는지 확인하세요.")
        print("   3. NOTION_TOKEN을 .env 파일에 설정하세요.")
        
    except Exception as e:
        print(f"\n❌ 오류 발생: {str(e)}")
        import traceback
        print(traceback.format_exc())
        sys.exit(1)


if __name__ == "__main__":
    main()
