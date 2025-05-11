import pandas as pd
from datetime import datetime

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
            # 기본 데이터 구성
            prayer = {
                'name': requester,  # 제출자 이름
                'target_name': row['이름(구도자)'] if not pd.isna(row['이름(구도자)']) else '',
                'gender': row['성별'] if not pd.isna(row['성별']) else '',
                'age': row['나이 (출생연도로 기입 부탁드립니다. EX. 98년생)'] if not pd.isna(row['나이 (출생연도로 기입 부탁드립니다. EX. 98년생)']) else '',
                'relationship': row['관계 (ex. 사촌동생, 학교 친구, 직장 동료, 본인)'] if not pd.isna(row['관계 (ex. 사촌동생, 학교 친구, 직장 동료, 본인)']) else '',
                'prayer_content': row['구체적인 기도제목 (가능한 경우 1. 2. 등 번호 기입)'] if not pd.isna(row['구체적인 기도제목 (가능한 경우 1. 2. 등 번호 기입)']) else '',
                'church': row['교회'] if not pd.isna(row['교회']) else ''
            }
            
            # 날짜 필드 처리 - 맨 오른쪽 날짜 열
            if '날짜' in row and not pd.isna(row['날짜']) and row['날짜'].strip():
                # 날짜 형식 변환 시도
                try:
                    date_str = row['날짜'].strip()
                    if '.' in date_str:  # "2025. 5. 14" 형식 처리
                        parts = date_str.replace(' ', '').rstrip('.').split('.')
                        if len(parts) >= 3:
                            year, month, day = map(int, parts[:3])
                            prayer['date'] = f"{year}. {month}. {day}"
                    else:
                        prayer['date'] = date_str
                except Exception as e:
                    print(f"날짜 변환 오류: {e} - 입력값: {row['날짜']}")
                    prayer['date'] = ''
            else:
                prayer['date'] = ''
            
            prayers.append(prayer)
        
        processed_data['prayers_by_requester'][requester] = prayers
    
    return processed_data 