import pandas as pd
from datetime import datetime

def process_prayer_requests(df):
    if df is None:
        return None
    
    # 타임스탬프 문자열을 datetime으로 변환
    def parse_korean_timestamp(ts):
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
            prayer = {
                'name': row['이름(구도자)'],
                'gender': row['성별'],
                'age': row['나이 (출생연도로 기입 부탁드립니다. EX. 98년생)'],
                'relation': row['관계 (ex. 사촌동생, 학교 친구, 직장 동료, 본인)'],
                'prayer_requests': row['구체적인 기도제목 (가능한 경우 1. 2. 등 번호 기입)'],
                'church': row['교회'],
                'date': row['타임스탬프'].strftime('%Y-%m-%d')
            }
            prayers.append(prayer)
        
        processed_data['prayers_by_requester'][requester] = prayers
    
    return processed_data 