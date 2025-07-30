import pandas as pd
from datetime import datetime
from utils import sanitize_name, sanitize_prayer_content, sanitize_text

def process_prayer_requests(df):
    if df is None:
        return None
    
    # 타임스탬프 문자열을 datetime으로 변환
    def parse_korean_timestamp(ts):
        try:
            # "2025. 3. 28 오후 11:24:19" 형식의 문자열을 처리
            date_part, time_part = ts.split(' 오')
            year, month, day = map(int, date_part.replace(' ', '').rstrip('.').split('.'))
            
            if '후' in time_part:
                time_str = time_part.replace('후 ', '')
                hour, minute, second = map(int, time_str.split(':'))
                hour = hour + 12 if hour != 12 else hour
            else:  # '오전'
                time_str = time_part.replace('전 ', '')
                hour, minute, second = map(int, time_str.split(':'))
                hour = hour if hour != 12 else 0
                
            return pd.Timestamp(year, month, day, hour, minute, second)
        except Exception as e:
            print(f"타임스탬프 파싱 오류: {e} - 입력값: {ts}")
            return pd.NaT
    
    # 타임스탬프 변환
    df['타임스탬프'] = df['타임스탬프'].apply(parse_korean_timestamp)
    
    # 이름 정제 (공백 제거)
    df['이름'] = df['이름'].apply(lambda x: sanitize_name(str(x)) if pd.notna(x) else '')
    
    # 작성자(이름)별로 그룹화
    grouped_prayers = df.groupby('이름')
    
    # 노션 페이지에 맞는 형식으로 데이터 변환
    processed_data = {
        'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M'),
        'prayers_by_requester': {}
    }
    
    for requester, group in grouped_prayers:
        prayers = []
        for _, row in group.iterrows():
            # 기본 데이터 구성 - 필드별로 적절한 정제 함수 사용
            prayer = {
                'name': sanitize_name(str(requester)),  # 제출자 이름 정제
                'target_name': sanitize_name(str(row['이름(구도자)'])) if pd.notna(row['이름(구도자)']) else '',
                'gender': sanitize_text(str(row['성별'])) if pd.notna(row['성별']) else '',
                'age': sanitize_text(str(row['나이 (출생연도로 기입 부탁드립니다 ex. 98년생)'])) if pd.notna(row['나이 (출생연도로 기입 부탁드립니다 ex. 98년생)']) else '',
                'relationship': sanitize_text(str(row['관계 (ex 사촌동생, 학교 친구, 직장 동료, 본인)'])) if pd.notna(row['관계 (ex 사촌동생, 학교 친구, 직장 동료, 본인)']) else '',
                'prayer_content': sanitize_prayer_content(str(row['구체적인 기도제목 (가능한 경우 1. 2. 등 번호로 기입)'])) if pd.notna(row['구체적인 기도제목 (가능한 경우 1. 2. 등 번호로 기입)']) else '',
                'church': sanitize_text(str(row['교회'])) if pd.notna(row['교회']) else ''
            }
            
            prayers.append(prayer)
        
        # 정제된 이름으로 저장
        clean_requester = sanitize_name(str(requester))
        processed_data['prayers_by_requester'][clean_requester] = prayers
    
    return processed_data 