from notion_client import Client
from dotenv import load_dotenv
import os

load_dotenv()

NOTION_TOKEN = os.getenv('NOTION_TOKEN')
PAGE_ID = os.getenv('NOTION_PAGE_ID')

def create_notion_client():
    return Client(auth=NOTION_TOKEN)

def create_prayer_block(prayer):
    return {
        "object": "block",
        "type": "paragraph",
        "paragraph": {
            "rich_text": [
                {
                    "type": "text",
                    "text": {
                        "content": f"📅 {prayer['date']}\n"
                                 f"🏛️ {prayer['church']}\n"
                                 f"👤 구도자: {prayer['name']} ({prayer['gender']}, {prayer['age']})\n"
                                 f"👥 관계: {prayer['relation']}\n"
                                 f"📝 기도제목:\n{prayer['prayer_requests']}\n"
                    }
                }
            ]
        }
    }

def publish_to_notion(processed_data):
    notion = create_notion_client()
    
    # 페이지 제목 업데이트
    notion.pages.update(
        page_id=PAGE_ID,
        properties={
            "title": {
                "title": [
                    {
                        "text": {
                            "content": f"기도제목 목록 (마지막 업데이트: {processed_data['last_updated']})"
                        }
                    }
                ]
            }
        }
    )
    
    # 기존 블록 삭제
    blocks = notion.blocks.children.list(block_id=PAGE_ID)
    for block in blocks.get('results', []):
        notion.blocks.delete(block_id=block['id'])
    
    # 새로운 블록 추가
    new_blocks = []
    
    # 목차 추가
    new_blocks.append({
        "object": "block",
        "type": "heading_2",
        "heading_2": {
            "rich_text": [
                {
                    "type": "text",
                    "text": {
                        "content": "📑 목차"
                    }
                }
            ]
        }
    })
    
    # 목차 항목 추가
    for requester in processed_data['prayers_by_requester'].keys():
        new_blocks.append({
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [
                    {
                        "type": "text",
                        "text": {
                            "content": f"• {requester}"
                        }
                    }
                ]
            }
        })
    
    # 구분선
    new_blocks.append({
        "object": "block",
        "type": "divider",
        "divider": {}
    })
    
    # 각 작성자의 기도제목
    for requester, prayers in processed_data['prayers_by_requester'].items():
        # 작성자 섹션 제목
        new_blocks.append({
            "object": "block",
            "type": "heading_2",
            "heading_2": {
                "rich_text": [
                    {
                        "type": "text",
                        "text": {
                            "content": f"# {requester}의 기도제목"
                        }
                    }
                ]
            }
        })
        
        # 기도제목들
        for prayer in prayers:
            new_blocks.append(create_prayer_block(prayer))
        
        # 구분선
        new_blocks.append({
            "object": "block",
            "type": "divider",
            "divider": {}
        })
    
    # 블록 추가
    notion.blocks.children.append(
        block_id=PAGE_ID,
        children=new_blocks
    ) 