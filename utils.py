import time
import logging
from functools import wraps
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

def retry_on_failure(max_retries: int = 3, delay: float = 1.0, backoff: float = 2.0):
    """
    재시도 데코레이터
    
    Args:
        max_retries: 최대 재시도 횟수
        delay: 초기 대기 시간 (초)
        backoff: 대기 시간 증가율
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            current_delay = delay
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt == max_retries:
                        logger.error(f"{func.__name__} 최종 실패 (시도 {attempt + 1}/{max_retries + 1}): {str(e)}")
                        break
                    
                    logger.warning(f"{func.__name__} 실패 (시도 {attempt + 1}/{max_retries + 1}): {str(e)}. {current_delay}초 후 재시도...")
                    time.sleep(current_delay)
                    current_delay *= backoff
            
            raise last_exception
        return wrapper
    return decorator

def validate_environment_variables():
    """필수 환경변수 검증"""
    import os
    
    required_vars = [
        'SPREADSHEET_ID',
        'NOTION_TOKEN', 
        'NOTION_PAGE_ID'
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        raise ValueError(f"필수 환경변수가 누락되었습니다: {', '.join(missing_vars)}")
    
    logger.info("환경변수 검증 완료")

def validate_prayer_data(prayer_data: dict) -> bool:
    """기도제목 데이터 유효성 검사"""
    required_fields = ['name', 'target_name', 'prayer_content']
    
    for field in required_fields:
        if not prayer_data.get(field, '').strip():
            logger.warning(f"필수 필드 누락: {field} - 데이터: {prayer_data}")
            return False
    
    return True

def sanitize_text(text: str, preserve_line_breaks: bool = False) -> str:
    """
    텍스트 정제 (특수문자, 공백 처리)
    
    Args:
        text: 정제할 텍스트
        preserve_line_breaks: 줄바꿈 보존 여부
    """
    if not text:
        return ""
    
    # Notion에서 문제가 될 수 있는 문자 처리
    replacements = {
        '\u200b': '',  # Zero-width space
        '\ufeff': '',  # Byte order mark
        '\r\n': '\n',  # Windows 줄바꿈을 Unix 형식으로 통일
        '\r': '\n'     # Mac 줄바꿈을 Unix 형식으로 통일
    }
    
    cleaned = text
    for old, new in replacements.items():
        cleaned = cleaned.replace(old, new)
    
    if preserve_line_breaks:
        # 줄바꿈을 보존하면서 각 줄의 앞뒤 공백만 제거
        lines = cleaned.split('\n')
        cleaned_lines = [line.strip() for line in lines]
        # 빈 줄 여러 개를 하나로 줄이고, 맨 앞뒤 빈 줄 제거
        while cleaned_lines and not cleaned_lines[0]:
            cleaned_lines.pop(0)
        while cleaned_lines and not cleaned_lines[-1]:
            cleaned_lines.pop()
        
        # 연속된 빈 줄을 하나로 축소
        result_lines = []
        prev_empty = False
        for line in cleaned_lines:
            if not line:
                if not prev_empty:
                    result_lines.append(line)
                prev_empty = True
            else:
                result_lines.append(line)
                prev_empty = False
        
        return '\n'.join(result_lines)
    else:
        # 줄바꿈을 공백으로 변환하고 연속 공백 정리
        return ' '.join(cleaned.strip().split())

def sanitize_prayer_content(content: str) -> str:
    """기도제목 내용 전용 정제 함수 (줄바꿈 보존)"""
    return sanitize_text(content, preserve_line_breaks=True)

def sanitize_name(name: str) -> str:
    """이름 전용 정제 함수 (줄바꿈 제거)"""
    return sanitize_text(name, preserve_line_breaks=False)

class PipelineError(Exception):
    """파이프라인 전용 예외 클래스"""
    pass

class DataValidationError(PipelineError):
    """데이터 검증 실패 예외"""
    pass

class APIConnectionError(PipelineError):
    """API 연결 실패 예외"""
    pass 