import os
from dataclasses import dataclass
from typing import Dict, List
from dotenv import load_dotenv

# 환경변수 로드
load_dotenv()

@dataclass
class GoogleSheetsConfig:
    """Google Sheets 관련 설정"""
    spreadsheet_id: str
    range_name: str
    service_account_file: str
    
    @classmethod
    def from_env(cls):
        return cls(
            spreadsheet_id=os.getenv('SPREADSHEET_ID', ''),
            range_name=os.getenv('RANGE_NAME', 'sheet1!A:Z'),
            service_account_file=os.getenv('SERVICE_ACCOUNT_FILE', 'cbf-praylist-11bbf27f1baa.json')
        )

@dataclass  
class NotionConfig:
    """Notion 관련 설정"""
    token: str
    page_id: str
    
    @classmethod
    def from_env(cls):
        return cls(
            token=os.getenv('NOTION_TOKEN', ''),
            page_id=os.getenv('NOTION_PAGE_ID', '')
        )

@dataclass
class LoggingConfig:
    """로깅 관련 설정"""
    level: str
    format: str
    file_path: str
    max_file_size: int  # MB
    backup_count: int
    
    @classmethod
    def from_env(cls):
        return cls(
            level=os.getenv('LOG_LEVEL', 'INFO'),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            file_path=os.getenv('LOG_FILE', 'prayer_pipeline.log'),
            max_file_size=int(os.getenv('LOG_MAX_SIZE_MB', '10')),
            backup_count=int(os.getenv('LOG_BACKUP_COUNT', '5'))
        )

class PrayerAssignments:
    """담당자별 기도제목 제출자 매핑"""
    
    # 올바른 1:1 매핑 구조 (담당자가 인도자를 담당)
    DEFAULT_ASSIGNMENTS = {
        "박지민": ["손승아"],      # 지민 -> 승아
        "한사라": ["김가온"],      # 사라 -> 가온  
        "김가온": ["한사라"],      # 가온 -> 사라
        "손승아": ["김지수"],      # 승아 -> 지수
        "허성훈": ["이소원"],      # 성훈 -> 소원
        "박민성": ["박지민"],      # 민성 -> 지민
        "조용훈": ["박민성"],      # 용훈 -> 민성
        "이소원": ["김나경"]       # 소원 -> 나경
    }
    
    @classmethod
    def get_assignments(cls) -> Dict[str, List[str]]:
        """담당자 매핑을 가져옵니다 (향후 외부 파일에서 로드 가능)"""
        # TODO: assignments.json 파일에서 로드하도록 개선
        return cls.DEFAULT_ASSIGNMENTS
    
    @classmethod
    def get_all_assignees(cls) -> List[str]:
        """모든 기도제목 제출자 목록을 반환합니다"""
        assignments = cls.get_assignments()
        all_assignees = []
        for assignees in assignments.values():
            all_assignees.extend(assignees)
        return list(set(all_assignees))
    
    @classmethod
    def get_manager_for_assignee(cls, assignee: str) -> str:
        """특정 제출자의 담당자를 찾습니다"""
        assignments = cls.get_assignments()
        for manager, assignees in assignments.items():
            if assignee in assignees:
                return manager
        return "기타"  # 매핑되지 않은 경우

@dataclass
class AppConfig:
    """애플리케이션 전체 설정"""
    google_sheets: GoogleSheetsConfig
    notion: NotionConfig
    logging: LoggingConfig
    
    # 컬럼 매핑 설정
    COLUMN_MAPPING = {
        'timestamp': '타임스탬프',
        'name': '이름',
        'church': '교회', 
        'target_name': '이름(구도자)',
        'gender': '성별',
        'age': '나이 (출생연도로 기입 부탁드립니다 ex. 98년생)',
        'relationship': '관계 (ex 사촌동생, 학교 친구, 직장 동료, 본인)',
        'prayer_content': '구체적인 기도제목 (가능한 경우 1. 2. 등 번호로 기입)'
    }
    
    # 데이터 검증 규칙
    REQUIRED_COLUMNS = ['타임스탬프', '이름', '이름(구도자)']
    MIN_PRAYER_CONTENT_LENGTH = 10  # 최소 기도제목 길이
    MAX_PRAYER_CONTENT_LENGTH = 2000  # 최대 기도제목 길이
    
    @classmethod
    def load(cls):
        """환경변수에서 설정을 로드합니다"""
        return cls(
            google_sheets=GoogleSheetsConfig.from_env(),
            notion=NotionConfig.from_env(),
            logging=LoggingConfig.from_env()
        )
    
    def validate(self):
        """설정 유효성을 검증합니다"""
        errors = []
        
        if not self.google_sheets.spreadsheet_id:
            errors.append("SPREADSHEET_ID가 설정되지 않았습니다")
            
        if not self.notion.token:
            errors.append("NOTION_TOKEN이 설정되지 않았습니다")
            
        if not self.notion.page_id:
            errors.append("NOTION_PAGE_ID가 설정되지 않았습니다")
            
        if not os.path.exists(self.google_sheets.service_account_file):
            errors.append(f"서비스 계정 파일을 찾을 수 없습니다: {self.google_sheets.service_account_file}")
        
        if errors:
            raise ValueError("설정 오류:\n" + "\n".join(f"- {error}" for error in errors))

# 전역 설정 인스턴스
config = AppConfig.load() 