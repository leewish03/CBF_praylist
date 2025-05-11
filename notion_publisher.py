from notion_client import Client
from dotenv import load_dotenv
import os
from datetime import datetime
from google.oauth2 import service_account
from googleapiclient.discovery import build
import csv

load_dotenv()

NOTION_TOKEN = os.getenv('NOTION_TOKEN')
PAGE_ID = os.getenv('NOTION_PAGE_ID')
CALENDAR_DATABASE_ID = os.getenv('NOTION_CALENDAR_DATABASE_ID')  # .env 파일에서 캘린더 데이터베이스 ID를 가져옵니다
SPREADSHEET_ID = os.getenv('SPREADSHEET_ID')
SHEET_RANGE = 'Prayer_Requests!A:Z'  # Prayer_Requests 시트의 A부터 Z열까지 읽기

# 담당자별 기도제목 제출자 매핑
PRAYER_ASSIGNMENTS = {
    "손승아": ["김세진", "이효연"],
    "김세진": ["한사라", "김나경"],
    "한사라": ["김가온", "정예은"],
    "조용훈": ["박민성", "강성오"],
    "이소원": ["위수빈", "손승우"],
    "허성훈": ["이소원", "최예찬"],
    "박민성": ["박지민", "신정우", "박시온"]
}

# 공통 기도제목
COMMON_PRAYERS = """1. 서울CBF의 모든 행사를 하나님께서 주관하여 주시고 하나님의 뜻에 청종함으로 하나님께 쓰임 받는 모임이 되게 하여주소서

2. 마음을 다하고 뜻을 다하고 힘을 다하여 여호와 하나님을 경외하고 예수그리스도를 사랑하는 모임이 되게 하여주소서 
 - 공과 공부, 그룹 교제, 복음 전도 훈련 등을 통해 하나님 말씀 사모하기에 힘쓰도록
 
3. 그리스도의 머리 되심 아래 하나되어 서로 사랑하고 섬기고 격려하여 모이기에 힘쓰는 모임이 되게 하소서
 - 성도들이 서로를 잘 돌아보고 격려할 수 있도록
 - 신입생 및 새로 방문하는 사람들의 적응과 연결을 위하여

4. 모든 민족과 땅 끝까지 이르러 복음을 전하라 하신 사명에 순종하여 복음을 깊이 묵상하고 전하기에 힘쓰는 모임이 되게 하소서 
 - 1학기 전도활동 가스펠데이를 위한 준비팀이 잘 결성될 수 있도록. 진행 방식과 내용 등 준비하는 모든 과정에서 사탄이 틈타지 않고 복음을 위하여 하나님이 기뻐하시는 대로 진행되도록
- 가스펠데이를 진행할 장소와 날짜를 보여주시길
 - 성도들이 서울cbf 내외부적으로 복음 전도를 위해 힘쓸 수 있도록 

5. 각자의 삶 가운데서 세상의 빛과 소금으로서의 역할을 잘 감당하고 하나님 나라와 그 의를 구하는 모임이 되게 하소서"""

def get_google_sheets_service():
    """Google Sheets API 서비스를 초기화합니다."""
    credentials = service_account.Credentials.from_service_account_file(
        'cbf-praylist-11bbf27f1baa.json',
        scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
    )
    return build('sheets', 'v4', credentials=credentials)

def get_prayer_requests():
    """Google Sheets에서 기도제목 데이터를 가져옵니다."""
    service = get_google_sheets_service()
    result = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=SHEET_RANGE
    ).execute()
    
    values = result.get('values', [])
    if not values:
        return []
    
    # 헤더 행 가져오기
    headers = values[0]
    
    # 데이터 행 처리
    prayer_requests = []
    for row in values[1:]:  # 헤더 제외
        if len(row) >= 9 and row[8].strip():  # 날짜 필드(9번째 열)가 있는 경우만 처리
            prayer_requests.append({
                'name': row[1] if len(row) > 1 else '',  # 이름
                'church': row[2] if len(row) > 2 else '',  # 교회
                'target_name': row[3] if len(row) > 3 else '',  # 이름(구도자)
                'gender': row[4] if len(row) > 4 else '',  # 성별
                'age': row[5] if len(row) > 5 else '',  # 나이
                'relationship': row[6] if len(row) > 6 else '',  # 관계
                'prayer_content': row[7] if len(row) > 7 else '',  # 기도제목
                'date': row[8] if len(row) > 8 else ''  # 날짜
            })
    
    return prayer_requests

def create_notion_client():
    return Client(auth=NOTION_TOKEN)

def create_prayer_content(prayer):
    return f"👤 제출자: {prayer['name']}\n" \
           f"🙏 구도자: {prayer['target_name']} ({prayer['gender']}, {prayer['age']})\n" \
           f"👥 관계: {prayer['relationship']}\n" \
           f"📝 기도제목:\n{prayer['prayer_content']}"

def get_database_schema(notion, database_id):
    """Notion 데이터베이스의 스키마(속성 구조)를 가져옵니다."""
    try:
        response = notion.databases.retrieve(database_id=database_id)
        print(f"데이터베이스 속성 확인: {response['properties'].keys()}")
        return response['properties']
    except Exception as e:
        print(f"데이터베이스 스키마 가져오기 오류: {str(e)}")
        return None

def create_calendar_event(notion, prayer):
    """Notion 캘린더에 기도제목 초청 날짜를 추가합니다."""
    print(f"캘린더 이벤트 생성 시도: {prayer}")
    
    # 날짜 필드가 없거나 비어있는 경우 캘린더에 추가하지 않음
    if not prayer.get('date') or not prayer['date'].strip():
        print("날짜 정보가 없어 캘린더에 추가하지 않습니다.")
        return
    
    try:
        # 데이터베이스 스키마 확인
        schema = get_database_schema(notion, CALENDAR_DATABASE_ID)
        if not schema:
            print("데이터베이스 스키마를 가져올 수 없어 캘린더 이벤트를 생성할 수 없습니다.")
            return
            
        # 제목 필드의 속성 이름 찾기
        title_property_name = None
        date_property_name = None
        
        for prop_name, prop_info in schema.items():
            if prop_info['type'] == 'title':
                title_property_name = prop_name
            elif prop_info['type'] == 'date' and '날짜' in prop_name:
                date_property_name = prop_name
                
        if not title_property_name:
            print("제목 속성을 찾을 수 없어 캘린더 이벤트를 생성할 수 없습니다.")
            return
            
        if not date_property_name:
            date_property_name = "날짜"  # 기본값
            
        # 날짜 형식 변환
        date_str = prayer['date'].strip()
        
        if '.' in date_str:  # "2025. 5. 14" 형식 처리
            parts = date_str.replace(' ', '').rstrip('.').split('.')
            if len(parts) >= 3:
                year, month, day = map(int, parts[:3])
                event_date = f"{year}-{month:02d}-{day:02d}"
        else:
            # 이미 YYYY-MM-DD 형식인 경우
            event_date = date_str
            
        print(f"변환된 날짜: {event_date}")
        print(f"사용할 속성 이름 - 제목: {title_property_name}, 날짜: {date_property_name}")
        
        # 이벤트 제목 생성
        event_title = f"{prayer['name']}님이 {prayer['target_name']}님을 초청하기로 한 날"
        
        # 캘린더 이벤트 생성
        event_data = {
            "parent": {"database_id": CALENDAR_DATABASE_ID},
            "properties": {
                title_property_name: {
                    "title": [
                        {
                            "text": {
                                "content": event_title
                            }
                        }
                    ]
                }
            },
            "children": [
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [
                            {
                                "type": "text",
                                "text": {
                                    "content": create_prayer_content(prayer)
                                }
                            }
                        ]
                    }
                }
            ]
        }
        
        # 날짜 속성 추가
        event_data["properties"][date_property_name] = {
            "date": {
                "start": event_date
            }
        }
        
        response = notion.pages.create(**event_data)
        print(f"캘린더 이벤트 생성 성공: {response['id']}")
        
    except Exception as e:
        print(f"캘린더 이벤트 생성 중 오류 발생: {str(e)}")
        print(f"오류 발생한 기도제목 데이터: {prayer}")

def create_calendar_events_with_filter(notion, prayer_requests):
    """고유 식별자를 사용하여 중복 없이 캘린더 이벤트를 생성합니다."""
    try:
        print("새 캘린더 이벤트 생성 시작...")
        
        # 스키마 정보 가져오기
        schema = get_database_schema(notion, CALENDAR_DATABASE_ID)
        if not schema:
            print("스키마 정보를 가져올 수 없습니다.")
            return
        
        # 필드 속성 이름 찾기
        title_property_name = None
        date_property_name = None
        tag_property_name = None
        
        for prop_name, prop_info in schema.items():
            if prop_info['type'] == 'title':
                title_property_name = prop_name
            elif prop_info['type'] == 'date' and '날짜' in prop_name:
                date_property_name = prop_name
            elif prop_info['type'] == 'multi_select' or prop_info['type'] == 'select':
                tag_property_name = prop_name
        
        if not title_property_name:
            print("제목 속성을 찾을 수 없습니다.")
            return
        
        if not date_property_name:
            date_property_name = "날짜"  # 기본값
            
        # 현재 실행 시간을 배치 ID로 사용
        batch_id = datetime.now().strftime('%Y%m%d%H%M%S')
        print(f"현재 배치 ID: {batch_id}")
        
        # 먼저 기존 항목들 아카이브
        try:
            print("기존 이벤트 아카이브 시작...")
            response = notion.databases.query(
                database_id=CALENDAR_DATABASE_ID
            )
            
            old_pages = response.get('results', [])
            
            # 추가 페이지가 있으면 계속 조회
            while response.get('has_more', False):
                response = notion.databases.query(
                    database_id=CALENDAR_DATABASE_ID,
                    start_cursor=response.get('next_cursor')
                )
                old_pages.extend(response.get('results', []))
            
            # 기존 페이지 아카이브
            if old_pages:
                print(f"{len(old_pages)}개의 기존 이벤트 아카이브 예정")
                archived_count = 0
                for page in old_pages:
                    try:
                        notion.pages.update(page_id=page['id'], archived=True)
                        archived_count += 1
                    except Exception as e:
                        print(f"이벤트 아카이브 중 오류: {str(e)}")
                
                print(f"{archived_count}개의 기존 이벤트 아카이브 완료")
        except Exception as e:
            print(f"기존 이벤트 아카이브 중 오류: {str(e)}")
        
        # 날짜가 있는 기도제목만 필터링
        calendar_prayers = [prayer for prayer in prayer_requests if prayer.get('date') and prayer['date'].strip()]
        print(f"캘린더에 추가할 기도제목 수: {len(calendar_prayers)}")
        
        # 기도제목을 캘린더에 추가
        created_count = 0
        for prayer in calendar_prayers:
            try:
                # 날짜 형식 변환
                date_str = prayer['date'].strip()
                
                if '.' in date_str:
                    parts = date_str.replace(' ', '').rstrip('.').split('.')
                    if len(parts) >= 3:
                        year, month, day = map(int, parts[:3])
                        event_date = f"{year}-{month:02d}-{day:02d}"
                else:
                    event_date = date_str
                
                # 이벤트 제목 생성 (배치 ID 없음)
                event_title = f"{prayer['name']}님이 {prayer['target_name']}님을 초청하기로 한 날"
                
                # 캘린더 이벤트 생성
                event_data = {
                    "parent": {"database_id": CALENDAR_DATABASE_ID},
                    "properties": {
                        title_property_name: {
                            "title": [
                                {
                                    "text": {
                                        "content": event_title
                                    }
                                }
                            ]
                        },
                        date_property_name: {
                            "date": {
                                "start": event_date
                            }
                        }
                    },
                    "children": [
                        {
                            "object": "block",
                            "type": "paragraph",
                            "paragraph": {
                                "rich_text": [
                                    {
                                        "type": "text",
                                        "text": {
                                            "content": create_prayer_content(prayer)
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }
                
                # 태그 속성이 있으면 현재 배치 ID 태그 추가
                if tag_property_name and schema[tag_property_name]['type'] == 'multi_select':
                    event_data["properties"][tag_property_name] = {
                        "multi_select": [
                            {
                                "name": f"batch_{batch_id}"
                            }
                        ]
                    }
                elif tag_property_name and schema[tag_property_name]['type'] == 'select':
                    event_data["properties"][tag_property_name] = {
                        "select": {
                            "name": f"batch_{batch_id}"
                        }
                    }
                
                response = notion.pages.create(**event_data)
                created_count += 1
                
            except Exception as e:
                print(f"캘린더 이벤트 생성 중 오류: {str(e)}")
                continue
        
        print(f"캘린더에 {created_count}개의 새 이벤트 생성 완료")
        
    except Exception as e:
        print(f"캘린더 이벤트 생성 중 오류: {str(e)}")

def publish_to_notion(processed_data):
    notion = create_notion_client()
    
    # 기존 블록 가져오기
    blocks = notion.blocks.children.list(block_id=PAGE_ID)
    
    # 마지막 업데이트 블록 찾아서 업데이트
    for block in blocks.get('results', []):
        if (block['type'] == 'callout' and 
            any('마지막 업데이트' in text.get('text', {}).get('content', '') 
                for text in block['callout']['rich_text'])):
            notion.blocks.update(
                block_id=block['id'],
                callout={
                    "rich_text": [
                        {
                            "type": "text",
                            "text": {
                                "content": f"마지막 업데이트: {processed_data['last_updated']}"
                            }
                        }
                    ],
                    "icon": block['callout']['icon'],
                    "color": block['callout']['color']
                }
            )
            break
    
    # 담당자별 기도제목 제목 블록의 ID 찾기
    prayer_section_id = None
    for block in blocks.get('results', []):
        if (block['type'] == 'heading_1' and 
            any(text.get('text', {}).get('content') == "📖 담당자별 기도제목" 
                for text in block['heading_1']['rich_text'])):
            prayer_section_id = block['id']
            break
    
    # 담당자별 기도제목 제목 이후의 블록만 삭제
    if prayer_section_id:
        section_found = False
        for block in blocks.get('results', []):
            if section_found:
                notion.blocks.delete(block_id=block['id'])
            elif block['id'] == prayer_section_id:
                section_found = True
    
    # 새로운 블록 추가 (담당자별 기도제목만)
    new_blocks = []
    
    # 각 담당자별 섹션 생성
    for manager, assignees in PRAYER_ASSIGNMENTS.items():
        manager_blocks = {
            "object": "block",
            "type": "toggle",
            "toggle": {
                "rich_text": [
                    {
                        "type": "text",
                        "text": {
                            "content": f"📌 {manager}"
                        },
                        "annotations": {
                            "bold": True
                        }
                    }
                ],
                "children": []
            }
        }
        
        for assignee in assignees:
            if assignee in processed_data['prayers_by_requester']:
                assignee_prayers = processed_data['prayers_by_requester'][assignee]
                
                assignee_toggle = {
                    "object": "block",
                    "type": "toggle",
                    "toggle": {
                        "rich_text": [
                            {
                                "type": "text",
                                "text": {
                                    "content": f"🙏 {assignee}님의 기도제목"
                                },
                                "annotations": {
                                    "bold": True,
                                    "color": "green"
                                }
                            }
                        ],
                        "children": []
                    }
                }
                
                for prayer in assignee_prayers:
                    # 날짜가 있는 경우에만 캘린더에 이벤트 추가 - 주석 처리하여 중복 생성 방지
                    # if prayer.get('date') and prayer['date'].strip():
                    #     create_calendar_event(notion, prayer)
                    
                    assignee_toggle["toggle"]["children"].append({
                        "object": "block",
                        "type": "callout",
                        "callout": {
                            "rich_text": [
                                {
                                    "type": "text",
                                    "text": {
                                        "content": create_prayer_content(prayer)
                                    }
                                }
                            ],
                            "icon": {
                                "type": "emoji",
                                "emoji": "✨"
                            },
                            "color": "gray_background"
                        }
                    })
                
                manager_blocks["toggle"]["children"].append(assignee_toggle)
        
        new_blocks.append(manager_blocks)
    
    # 블록 추가
    if new_blocks:
        notion.blocks.children.append(
            block_id=PAGE_ID,
            children=new_blocks
        )

def delete_all_calendar_events(notion, database_id):
    """캘린더 데이터베이스의 모든 항목을 아카이브합니다."""
    try:
        print(f"캘린더 데이터베이스({database_id})의 모든 항목 아카이브 시작...")
        
        # 데이터베이스에서 아카이브되지 않은 페이지만 조회
        response = notion.databases.query(
            database_id=database_id,
            filter={
                "property": "archived",
                "checkbox": {
                    "equals": False
                }
            }
        )
        pages = response.get('results', [])
        
        # 추가 페이지가 있으면 계속 조회
        while response.get('has_more', False):
            response = notion.databases.query(
                database_id=database_id,
                start_cursor=response.get('next_cursor'),
                filter={
                    "property": "archived",
                    "checkbox": {
                        "equals": False
                    }
                }
            )
            pages.extend(response.get('results', []))
        
        print(f"총 {len(pages)}개의 항목을 아카이브합니다.")
        
        # 모든 페이지 아카이브
        for page in pages:
            page_id = page['id']
            try:
                notion.pages.update(page_id=page_id, archived=True)
                print(f"페이지 아카이브 완료: {page_id}")
            except Exception as e:
                print(f"페이지 아카이브 중 오류 발생: {str(e)} - 페이지 ID: {page_id}")
        
        # 아카이브 후 아카이브되지 않은 항목 수 확인
        response = notion.databases.query(
            database_id=database_id,
            filter={
                "property": "archived",
                "checkbox": {
                    "equals": False
                }
            }
        )
        remaining = len(response.get('results', []))
        print(f"아카이브 후 남은 항목 수: {remaining}")
        
        print("캘린더 데이터베이스 아카이브 완료")
        return len(pages)
        
    except Exception as e:
        print(f"캘린더 데이터베이스 아카이브 중 오류 발생: {str(e)}")
        return 0

def process_prayer_requests(notion, prayer_requests):
    """기도제목을 Notion 데이터베이스에 추가하고 캘린더에 이벤트를 생성합니다."""
    print(f"처리할 기도제목 수: {len(prayer_requests)}")
    
    # 기존 방식의 아카이브 삭제하고 새 방식으로 대체
    # deleted_count = delete_all_calendar_events(notion, CALENDAR_DATABASE_ID)
    # print(f"{deleted_count}개의 기존 캘린더 항목을 삭제했습니다.")
    
    # 날짜가 있는 기도제목만 필터링
    calendar_prayers = [prayer for prayer in prayer_requests if prayer.get('date') and prayer['date'].strip()]
    print(f"캘린더에 추가할 기도제목 수: {len(calendar_prayers)}")
    
    # 개별 이벤트 추가 대신 배치 ID를 사용하는 새 함수 사용
    create_calendar_events_with_filter(notion, prayer_requests)
    
    # 이전 방식의 기도제목 추가 코드 주석 처리
    # for prayer in calendar_prayers:
    #     try:
    #         create_calendar_event(notion, prayer)
    #     except Exception as e:
    #         print(f"기도제목 처리 중 오류 발생: {str(e)}")
    #         print(f"오류 발생한 기도제목: {prayer}")
    #         continue

def main():
    """메인 실행 함수"""
    try:
        # Notion 클라이언트 초기화
        notion = Client(auth=NOTION_TOKEN)
        
        # 데이터베이스 스키마 확인 및 로깅
        print("캘린더 데이터베이스 스키마 확인 중...")
        calendar_schema = get_database_schema(notion, CALENDAR_DATABASE_ID)
        if calendar_schema:
            print(f"캘린더 데이터베이스 속성: {list(calendar_schema.keys())}")
            title_props = [name for name, prop in calendar_schema.items() if prop['type'] == 'title']
            date_props = [name for name, prop in calendar_schema.items() if prop['type'] == 'date']
            print(f"제목 속성: {title_props}")
            print(f"날짜 속성: {date_props}")
        
        # Google Sheets에서 기도제목 데이터 가져오기
        prayer_requests = get_prayer_requests()
        
        # 기도제목 처리
        process_prayer_requests(notion, prayer_requests)
        
        # 데이터 처리 및 노션 페이지 업데이트
        processed_data = {
            'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M'),
            'prayers_by_requester': {}
        }
        
        # 작성자(이름)별로 그룹화
        for prayer in prayer_requests:
            name = prayer['name']
            if name not in processed_data['prayers_by_requester']:
                processed_data['prayers_by_requester'][name] = []
            processed_data['prayers_by_requester'][name].append(prayer)
        
        # 노션 페이지 업데이트
        publish_to_notion(processed_data)
        
        print("모든 작업이 성공적으로 완료되었습니다.")
        
    except Exception as e:
        print(f"오류 발생: {str(e)}")

if __name__ == "__main__":
    main()