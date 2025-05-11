from notion_client import Client
from dotenv import load_dotenv
import os

load_dotenv()

NOTION_TOKEN = os.getenv('NOTION_TOKEN')
CALENDAR_DATABASE_ID = os.getenv('NOTION_CALENDAR_DATABASE_ID')

def main():
    print(f"Notion 캘린더 디버깅")
    print(f"캘린더 DB ID: {CALENDAR_DATABASE_ID}")
    
    try:
        # Notion 클라이언트 초기화
        notion = Client(auth=NOTION_TOKEN)
        
        # 데이터베이스 정보 가져오기
        db = notion.databases.retrieve(database_id=CALENDAR_DATABASE_ID)
        print(f"데이터베이스 이름: {db.get('title', [{}])[0].get('plain_text', 'No title')}")
        print(f"데이터베이스 속성: {list(db['properties'].keys())}")
        
        # 데이터베이스 내용 가져오기
        response = notion.databases.query(database_id=CALENDAR_DATABASE_ID)
        pages = response.get('results', [])
        print(f"총 항목 수: {len(pages)}")
        
        # 각 페이지의 정보 출력
        if pages:
            for i, page in enumerate(pages[:5]): # 처음 5개만 출력
                page_id = page['id']
                title_key = [k for k, v in db['properties'].items() if v['type'] == 'title'][0]
                titles = page['properties'].get(title_key, {}).get('title', [])
                title = titles[0].get('plain_text', 'No title') if titles else 'No title'
                print(f"페이지 {i+1}: ID={page_id}, 제목={title}")
                
                # 페이지 삭제 테스트
                print(f"페이지 {i+1} 삭제 시도...")
                try:
                    # 먼저 아카이브 시도
                    notion.pages.update(page_id=page_id, archived=True)
                    print(f"  아카이브 완료")
                    
                    # 완전 삭제 시도 (참고: Notion API에서는 실제로 완전 삭제 기능이 없음)
                    print(f"  참고: Notion API는 페이지의 완전 삭제를 지원하지 않고 archived=True로만 처리 가능")
                except Exception as e:
                    print(f"  삭제 중 오류: {str(e)}")
                
            print("\n삭제 후 데이터베이스 조회...")
            response = notion.databases.query(database_id=CALENDAR_DATABASE_ID)
            pages_after = response.get('results', [])
            
            # 아카이브되지 않은 페이지만 필터링
            active_pages = [p for p in pages_after if not p.get('archived', False)]
            
            print(f"아카이브 후 총 항목 수: {len(pages_after)}")
            print(f"아카이브되지 않은 항목 수: {len(active_pages)}")
        
    except Exception as e:
        print(f"오류 발생: {str(e)}")

if __name__ == "__main__":
    main() 