import os
import re
from google.oauth2 import service_account
from googleapiclient.discovery import build
from dotenv import load_dotenv

load_dotenv()

# 설정
SPREADSHEET_ID = os.getenv('SPREADSHEET_ID', '1gYaj_juZ2TBU-aXOOwiHkl5N0vrF1CeaNLE29aftvlg')
SERVICE_ACCOUNT_FILE = os.getenv('SERVICE_ACCOUNT_FILE', 'cbf-praylist-11bbf27f1baa.json')
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

# 담당자 목록
MANAGERS = ["박민성", "이윤희", "김가온", "김나경", "박찬서", "이소원", "조용훈"]

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
    prayer_requests = [] # 개별 기도제목 데이터 목록
    
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
        
    # ── 2. 담당자 배정 및 개별 기도제목 파싱 ──
    print("\n👥 담당자 배정 및 개별 기도제목 파싱 중...")
    current_manager = None
    i = 0
    
    while i < len(lines):
        line = lines[i].strip()
        
        # 담당자 감지
        if line in MANAGERS:
            current_manager = line
            i += 1
            continue
            
        # 제출자 파싱 시작
        if "제출자:" in line:
            requester = line.split("제출자:")[1].strip()
            requester = re.sub(r'[\(\[\{\s].*', '', requester) # 이름 뒤 부가정보 제거
            
            target_name = ""
            gender = ""
            age = ""
            relationship = ""
            prayer_content_lines = []
            church = ""
            
            i += 1
            # 다음 제출자 혹은 다음 담당자가 나오기 전까지 파싱 진행
            while i < len(lines) and "제출자:" not in lines[i] and lines[i].strip() not in MANAGERS:
                sub_line = lines[i].strip()
                if "구도자:" in sub_line:
                    raw_target = sub_line.split("구도자:")[1].strip()
                    # 괄호 매치 (예: "조은서 (여, 2002)" 또는 "박종현 (남, 2005)")
                    match_meta = re.search(r'(.*?)\((.*?)\)', raw_target)
                    if match_meta:
                        target_name = match_meta.group(1).strip()
                        meta_parts = [p.strip() for p in match_meta.group(2).split(',')]
                        if len(meta_parts) >= 1:
                            gender = meta_parts[0]
                        if len(meta_parts) >= 2:
                            age = meta_parts[1]
                    else:
                        target_name = raw_target
                elif "관계:" in sub_line:
                    relationship = sub_line.split("관계:")[1].strip()
                elif "교회:" in sub_line:
                    church = sub_line.split("교회:")[1].strip()
                elif "기도제목:" in sub_line:
                    # 그 다음 줄부터 본문 수집 시작
                    i += 1
                    while i < len(lines) and "제출자:" not in lines[i] and lines[i].strip() not in MANAGERS and "구도자:" not in lines[i] and "관계:" not in lines[i]:
                        content_line = lines[i].strip()
                        # "OO님의 기도제목" 같은 안내 라인은 필터링
                        if "님의 기도제목" not in content_line and content_line:
                            prayer_content_lines.append(content_line)
                        i += 1
                    continue
                i += 1
            
            prayer_content = "\n".join(prayer_content_lines).strip()
            timestamp = "2026. 5. 28 오전 10:00:00"
            
            prayer_requests.append([
                timestamp,
                requester,
                church,
                target_name,
                gender,
                age,
                relationship,
                prayer_content
            ])
            
            # 담당자 맵에 추가
            if current_manager and requester not in assignments[current_manager]:
                assignments[current_manager].append(requester)
            continue
            
        i += 1
        
    print(f"   추출된 개별 기도제목 수: {len(prayer_requests)}")
    print("   추출된 담당자별 배정 현황:")
    total_assignments = 0
    for manager, assignees in assignments.items():
        print(f"   - {manager}: {assignees}")
        total_assignments += len(assignees)
    print(f"   총 배정 건수: {total_assignments}")
    
    return common_prayers, assignments, prayer_requests

def update_sheets(common_prayers, assignments, prayer_requests):
    service = get_sheets_service()
    
    # ── 1. 설정_공통기도제목 업데이트 ──
    print("\n✍️  '설정_공통기도제목' 업데이트 중...")
    sheet_name = '설정_공통기도제목'
    service.spreadsheets().values().clear(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{sheet_name}'!A:D"
    ).execute()
    
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
    service.spreadsheets().values().clear(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{sheet_name}'!A:B"
    ).execute()
    
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

    # ── 3. 설문지 응답 시트1 업데이트 (개별 기도제목 마이그레이션) ──
    print("\n✍️  '설문지 응답 시트1' 업데이트 중...")
    sheet_name = '설문지 응답 시트1'
    service.spreadsheets().values().clear(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{sheet_name}'!A:H"
    ).execute()
    
    headers = [
        "타임스탬프", 
        "이름", 
        "교회", 
        "이름(구도자)", 
        "성별", 
        "나이 (출생연도로 기입 부탁드립니다 ex. 98년생)", 
        "관계 (ex 사촌동생, 학교 친구, 직장 동료, 본인)", 
        "구체적인 기도제목 (가능한 경우 1. 2. 등 번호로 기입)"
    ]
    response_values = [headers] + prayer_requests
    
    service.spreadsheets().values().update(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{sheet_name}'!A1",
        valueInputOption="RAW",
        body={"values": response_values}
    ).execute()
    print("   ✅ '설문지 응답 시트1' 마이그레이션 완료")

def main():
    notion_file = "extracted_notion_content.txt"
    if not os.path.exists(notion_file):
        print(f"❌ 텍스트 추출 파일을 찾을 수 없습니다: {notion_file}")
        return
        
    common_prayers, _, prayer_requests = parse_notion_text(notion_file)
    
    # 이미지 기준 최종 확정된 담당자 배정표
    assignments = {
        "박민성": ["김선양", "최은", "이윤희", "정윤정"],
        "이윤희": ["조용훈", "김가온"],
        "김가온": ["박찬서", "손승아"],
        "김나경": ["주현서", "박지훈", "박민성"],
        "박찬서": ["한사라"],
        "이소원": ["신민석", "김나경", "안소영"],
        "조용훈": ["이소원", "박찬서"]
    }
    
    if not common_prayers:
        print("❌ 공통 기도제목 파싱 결과가 비어있습니다. 업데이트를 중단합니다.")
        return
        
    update_sheets(common_prayers, assignments, prayer_requests)
    print("\n🎉 노션의 기존 기도제목 데이터와 이미지에 정의된 확정 담당자 배정표를 구글 시트에 이관 완료했습니다!")

if __name__ == "__main__":
    main()
