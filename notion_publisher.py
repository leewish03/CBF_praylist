from notion_client import Client
from dotenv import load_dotenv
import os
from datetime import datetime
from google.oauth2 import service_account
from googleapiclient.discovery import build
from config import config, PrayerAssignments

load_dotenv()

NOTION_TOKEN = os.getenv('NOTION_TOKEN')
PAGE_ID = os.getenv('NOTION_PAGE_ID')
SPREADSHEET_ID = os.getenv('SPREADSHEET_ID')
SHEET_RANGE = 'sheet1!A:Z'  # 새로운 시트명으로 변경

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
    
    # 데이터 행 처리 - 날짜 필터링 제거
    prayer_requests = []
    for row in values[1:]:  # 헤더 제외
        if len(row) >= 2:  # 최소한 이름 컬럼이 있으면 처리
            prayer_requests.append({
                'name': row[1] if len(row) > 1 else '',  # 이름
                'church': row[2] if len(row) > 2 else '',  # 교회
                'target_name': row[3] if len(row) > 3 else '',  # 이름(구도자)
                'gender': row[4] if len(row) > 4 else '',  # 성별
                'age': row[5] if len(row) > 5 else '',  # 나이
                'relationship': row[6] if len(row) > 6 else '',  # 관계
                'prayer_content': row[7] if len(row) > 7 else ''  # 기도제목
            })
    
    return prayer_requests

def create_notion_client():
    return Client(auth=NOTION_TOKEN)

def create_prayer_content_rich_text(prayer):
    """기도제목 내용을 Notion rich_text 형식으로 변환 (줄바꿈 보존)"""
    content_parts = []
    
    # 기본 정보 추가
    content_parts.append({"type": "text", "text": {"content": f"👤 제출자: {prayer['name']}\n"}})
    content_parts.append({"type": "text", "text": {"content": f"🙏 구도자: {prayer['target_name']} ({prayer['gender']}, {prayer['age']})\n"}})
    content_parts.append({"type": "text", "text": {"content": f"👥 관계: {prayer['relationship']}\n"}})
    content_parts.append({"type": "text", "text": {"content": "📝 기도제목:\n"}, "annotations": {"bold": True}})
    
    # 기도제목 내용 처리 (줄바꿈 보존)
    prayer_content = prayer['prayer_content']
    if prayer_content:
        # 줄바꿈을 기준으로 나누어서 각각을 별도 텍스트로 처리
        lines = prayer_content.split('\n')
        for i, line in enumerate(lines):
            if line.strip():  # 빈 줄이 아닌 경우
                content_parts.append({"type": "text", "text": {"content": line}})
            if i < len(lines) - 1:  # 마지막 줄이 아니면 줄바꿈 추가
                content_parts.append({"type": "text", "text": {"content": "\n"}})
    
    return content_parts

def create_prayer_content(prayer):
    """기본 기도제목 텍스트 생성 (백업용)"""
    return f"👤 제출자: {prayer['name']}\n" \
           f"🙏 구도자: {prayer['target_name']} ({prayer['gender']}, {prayer['age']})\n" \
           f"👥 관계: {prayer['relationship']}\n" \
           f"📝 기도제목:\n{prayer['prayer_content']}"

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
    
    # config.py에서 담당자 매핑 가져오기
    prayer_assignments = PrayerAssignments.get_assignments()
    
    # 각 담당자별 섹션 생성
    for manager, assignees in prayer_assignments.items():
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
                
                # 기도제목 분할 로직 (SPLIT_ASSIGNMENTS 확인)
                if hasattr(PrayerAssignments, 'SPLIT_ASSIGNMENTS') and assignee in PrayerAssignments.SPLIT_ASSIGNMENTS:
                    split_managers = PrayerAssignments.SPLIT_ASSIGNMENTS[assignee]
                    if manager in split_managers:
                        total_items = len(assignee_prayers)
                        num_splits = len(split_managers)
                        split_index = split_managers.index(manager)
                        
                        # 균등 분할 (나머지는 앞쪽 담당자가 가져감)
                        base_chunk = total_items // num_splits
                        remainder = total_items % num_splits
                        
                        start_idx = split_index * base_chunk + min(split_index, remainder)
                        end_idx = start_idx + base_chunk + (1 if split_index < remainder else 0)
                        
                        assignee_prayers = assignee_prayers[start_idx:end_idx]

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
                    assignee_toggle["toggle"]["children"].append({
                        "object": "block",
                        "type": "callout",
                        "callout": {
                            "rich_text": create_prayer_content_rich_text(prayer),
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

def main():
    """메인 실행 함수"""
    try:
        # Notion 클라이언트 초기화
        notion = Client(auth=NOTION_TOKEN)
        
        # Google Sheets에서 기도제목 데이터 가져오기
        prayer_requests = get_prayer_requests()
        
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