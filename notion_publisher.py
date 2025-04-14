from notion_client import Client
from dotenv import load_dotenv
import os

load_dotenv()

NOTION_TOKEN = os.getenv('NOTION_TOKEN')
PAGE_ID = os.getenv('NOTION_PAGE_ID')

# 담당자별 기도제목 제출자 매핑
PRAYER_ASSIGNMENTS = {
    "손승아": ["김세진"],
    "김세진": ["한사라"],
    "한사라": ["김가온"],
    "조용훈": ["박민성"],
    "이소원": ["위수빈", "손승우"],
    "허성훈": ["이소원"],
    "박민성": ["박지민"]
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

def create_notion_client():
    return Client(auth=NOTION_TOKEN)

def create_prayer_content(prayer):
    return f"👤 제출자: {prayer['name']}\n" \
           f"🙏 구도자: {prayer['name']} ({prayer['gender']}, {prayer['age']})\n" \
           f"👥 관계: {prayer['relation']}\n" \
           f"📝 기도제목:\n{prayer['prayer_requests']}"

def publish_to_notion(processed_data):
    notion = create_notion_client()
    
    # 기존 블록 가져오기
    blocks = notion.blocks.children.list(block_id=PAGE_ID)
    
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
    else:
        # 제목 블록이 없는 경우 모든 블록 삭제
        for block in blocks.get('results', []):
            notion.blocks.delete(block_id=block['id'])
    
    # 새로운 블록 추가
    new_blocks = []
    
    # 마지막 업데이트 시간 추가 (callout 블록 사용)
    new_blocks.append({
        "object": "block",
        "type": "callout",
        "callout": {
            "rich_text": [
                {
                    "type": "text",
                    "text": {
                        "content": f"마지막 업데이트: {processed_data['last_updated']}"
                    }
                }
            ],
            "icon": {
                "type": "emoji",
                "emoji": "🔄"
            },
            "color": "gray_background"
        }
    })
    
    # 구분선
    new_blocks.append({
        "object": "block",
        "type": "divider",
        "divider": {}
    })
    
    # 공통 기도제목 추가
    new_blocks.append({
        "object": "block",
        "type": "heading_1",
        "heading_1": {
            "rich_text": [
                {
                    "type": "text",
                    "text": {
                        "content": "✝️ 공통 기도제목"
                    },
                    "annotations": {
                        "bold": True,
                        "color": "purple"
                    }
                }
            ]
        }
    })
    
    new_blocks.append({
        "object": "block",
        "type": "callout",
        "callout": {
            "rich_text": [
                {
                    "type": "text",
                    "text": {
                        "content": COMMON_PRAYERS
                    }
                }
            ],
            "icon": {
                "type": "emoji",
                "emoji": "🕊️"
            },
            "color": "blue_background"
        }
    })
    
    # 구분선
    new_blocks.append({
        "object": "block",
        "type": "divider",
        "divider": {}
    })
    
    # 담당자별 기도제목 제목이 없는 경우에만 추가
    if not prayer_section_id:
        new_blocks.append({
            "object": "block",
            "type": "heading_1",
            "heading_1": {
                "rich_text": [
                    {
                        "type": "text",
                        "text": {
                            "content": "📖 담당자별 기도제목"
                        },
                        "annotations": {
                            "bold": True,
                            "color": "blue"
                        }
                    }
                ]
            }
        })
    
    # 각 담당자별 섹션 생성
    for manager, assignees in PRAYER_ASSIGNMENTS.items():
        # 담당자 토글
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
        
        # 각 담당자에게 배정된 제출자별 섹션 생성
        for assignee in assignees:
            if assignee in processed_data['prayers_by_requester']:
                assignee_prayers = processed_data['prayers_by_requester'][assignee]
                
                # 제출자 토글
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
                
                # 제출자의 기도제목들 추가
                for prayer in assignee_prayers:
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
    notion.blocks.children.append(
        block_id=PAGE_ID,
        children=new_blocks
    )