import os
import re
from google.oauth2 import service_account
from googleapiclient.discovery import build
from dotenv import load_dotenv

load_dotenv()

# 설정
SPREADSHEET_ID = os.getenv('SPREADSHEET_ID', '1Bvl8bKvXQezJA3diKZM3sd_WauWSEG7jjjh7w3e74VI')
SERVICE_ACCOUNT_FILE = os.getenv('SERVICE_ACCOUNT_FILE', 'cbf-praylist-11bbf27f1baa.json')
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

# 담당자 목록
MANAGERS = ["박민성", "한사라", "김가온", "김나경", "손승아", "신민석", "이소원", "조용훈"]

def get_sheets_service():
    if not os.path.exists(SERVICE_ACCOUNT_FILE):
        raise FileNotFoundError(f"서비스 계정 파일을 찾을 수 없습니다: {SERVICE_ACCOUNT_FILE}")
    credentials = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE,
        scopes=SCOPES
    )
    return build('sheets', 'v4', credentials=credentials)

def parse_notion_text(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = [line.strip() for line in f.readlines()]
        
    common_prayers = []
    assignments = {m: [] for m in MANAGERS}
    
    # ── 1. 공통 기도제목 파싱 ──
    print("📋 공통 기도제목 파싱 중...")
    in_common_section = False
    current_num = 0
    current_lines = []
    
    for line in lines:
        if "공통 기도제목" in line:
            in_common_section = True
            continue
        if "담당자별 기도제목" in line:
            # 공통 기도제목 섹션 종료
            if current_lines:
                common_prayers.append("\n".join(current_lines).strip())
            break
            
        if in_common_section:
            # 새 번호(숫자. ) 매칭
            match = re.match(r'^(\d+)\.\s*(.*)', line)
            if match:
                if current_lines:
                    common_prayers.append("\n".join(current_lines).strip())
                current_num = int(match.group(1))
                current_lines = [match.group(2)]
            else:
                if current_num > 0 and line:  # 빈 줄이 아닌 경우 내용 추가
                    current_lines.append(line)
                    
    print(f"   추출된 공통 기도제목 수: {len(common_prayers)}")
    for i, p in enumerate(common_prayers):
        print(f"   [{i+1}] {p[:60]}...")
        
    # ── 2. 담당자 배정 파싱 ──
    print("\n👥 담당자 배정 파싱 중...")
    in_assignment_section = False
    current_manager = None
    
    for line in lines:
        if "담당자별 기도제목" in line:
            in_assignment_section = True
            continue
            
        if in_assignment_section:
            # 담당자 이름 매칭
            cleaned_line = line.strip()
            if cleaned_line in MANAGERS:
                current_manager = cleaned_line
                continue
                
            # 제출자 파싱 (예: "제출자: 김선양")
            if "제출자:" in cleaned_line and current_manager:
                assignee = cleaned_line.split("제출자:")[1].strip()
                # 괄호나 공백 제거
                assignee = re.sub(r'[\(\[\{\s].*', '', assignee)  # 이름 뒤 부가정보 제거
                if assignee and assignee not in assignments[current_manager]:
                    assignments[current_manager].append(assignee)
                    
    print("   추출된 담당자별 배정 현황:")
    total_assignments = 0
    for manager, assignees in assignments.items():
        print(f"   - {manager}: {assignees}")
        total_assignments += len(assignees)
    print(f"   총 배정 건수: {total_assignments}")
    
    return common_prayers, assignments

def update_sheets(common_prayers, assignments):
    service = get_sheets_service()
    
    # ── 1. 설정_공통기도제목 업데이트 ──
    print("\n✍️  '설정_공통기도제목' 업데이트 중...")
    sheet_name = '설정_공통기도제목'
    
    # 기존 데이터 클리어
    service.spreadsheets().values().clear(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{sheet_name}'!A:D"
    ).execute()
    
    # 데이터 구성
    common_values = [["순번", "기도제목", "활성화여부", "비고"]]
    for i, prayer in enumerate(common_prayers):
        common_values.append([str(i+1), prayer, "Y", ""])
        
    service.spreadsheets().values().update(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{sheet_name}'!A1",
        valueInputOption="RAW",
        body={"values": common_values}
    ).execute()
    print("   ✅ '설정_공통기도제목' 완료")
    
    # ── 2. 설정_담당자배정 업데이트 ──
    print("\n✍️  '설정_담당자배정' 업데이트 중...")
    sheet_name = '설정_담당자배정'
    
    # 기존 데이터 클리어
    service.spreadsheets().values().clear(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{sheet_name}'!A:B"
    ).execute()
    
    # 데이터 구성
    assignment_values = [["담당자", "제출자이름"]]
    for manager, assignees in assignments.items():
        assignees_str = ", ".join(assignees)
        assignment_values.append([manager, assignees_str])
            
    service.spreadsheets().values().update(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{sheet_name}'!A1",
        valueInputOption="RAW",
        body={"values": assignment_values}
    ).execute()
    print("   ✅ '설정_담당자배정' 완료")

def main():
    notion_file = "extracted_notion_content.txt"
    if not os.path.exists(notion_file):
        print(f"❌ 텍스트 추출 파일을 찾을 수 없습니다: {notion_file}")
        return
        
    common_prayers, assignments = parse_notion_text(notion_file)
    
    if not common_prayers:
        print("❌ 공통 기도제목 파싱 결과가 비어있습니다. 업데이트를 중단합니다.")
        return
        
    update_sheets(common_prayers, assignments)
    print("\n🎉 노션 최신 버전 데이터를 성공적으로 구글 시트에 업데이트 완료했습니다!")

if __name__ == "__main__":
    main()
