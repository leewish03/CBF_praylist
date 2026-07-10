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
            
    # ── 컬럼 매핑 표준화 (KeyError 원천 차단) ──
    col_mapping = {}
    for col in df.columns:
        col_str = str(col).strip()
        if '타임스탬프' in col_str:
            col_mapping['timestamp'] = col
        elif col_str == '이름':
            col_mapping['name'] = col
        elif '구도자' in col_str:
            col_mapping['target_name'] = col
        elif '성별' in col_str:
            col_mapping['gender'] = col
        elif '나이' in col_str:
            col_mapping['age'] = col
        elif '관계' in col_str:
            col_mapping['relationship'] = col
        elif '기도제목' in col_str:
            col_mapping['prayer_content'] = col
        elif '교회' in col_str:
            col_mapping['church'] = col

    # 타임스탬프 변환
    ts_col = col_mapping.get('timestamp', '타임스탬프')
    if ts_col in df.columns:
        df[ts_col] = df[ts_col].apply(parse_korean_timestamp)
    
    # 이름 정제 (공백 제거)
    name_col = col_mapping.get('name', '이름')
    if name_col in df.columns:
        df[name_col] = df[name_col].apply(lambda x: sanitize_name(str(x)) if pd.notna(x) else '')
    else:
        # 방어 코드: '이름' 컬럼이 없으면 빈 구조체 반환
        return {
            'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M'),
            'prayers_by_requester': {}
        }
    
    # 작성자(이름)별로 그룹화
    grouped_prayers = df.groupby(name_col)
    
    # 노션 페이지에 맞는 형식으로 데이터 변환
    processed_data = {
        'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M'),
        'prayers_by_requester': {}
    }
    
    # 안전하게 행 값을 꺼내오는 헬퍼 함수
    def get_val(row, key, default=''):
        col_name = col_mapping.get(key)
        if col_name and col_name in row:
            val = row[col_name]
            return str(val) if pd.notna(val) else default
        return default
    
    for requester, group in grouped_prayers:
        prayers = []
        for _, row in group.iterrows():
            # 기본 데이터 구성 - 필드별로 적절한 정제 함수 사용
            prayer = {
                'name': sanitize_name(str(requester)),  # 제출자 이름 정제
                'target_name': sanitize_name(get_val(row, 'target_name')),
                'gender': sanitize_text(get_val(row, 'gender')),
                'age': sanitize_text(get_val(row, 'age')),
                'relationship': sanitize_text(get_val(row, 'relationship')),
                'prayer_content': sanitize_prayer_content(get_val(row, 'prayer_content')),
                'church': sanitize_text(get_val(row, 'church'))
            }
            
            prayers.append(prayer)
        
        # 정제된 이름으로 저장
        clean_requester = sanitize_name(str(requester))
        processed_data['prayers_by_requester'][clean_requester] = prayers
    
    return processed_data 