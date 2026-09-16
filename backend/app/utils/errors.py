"""跨应用通用业务异常，消息与错误码统一来自 constants/errors.py。"""

from app.constants.errors import ERROR_MESSAGES


class BusinessError(Exception):
    def __init__(self, code: str, http_status: int = 400):
        self.code = code
        self.http_status = http_status
        super().__init__(ERROR_MESSAGES.get(code, code))
