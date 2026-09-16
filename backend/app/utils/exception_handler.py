from rest_framework.response import Response
from rest_framework.views import exception_handler

from app.utils.errors import BusinessError


def standard_exception_handler(exc, context):
    # 业务规则异常：统一标准响应 {success, code, data, error}
    if isinstance(exc, BusinessError):
        return Response(
            {
                'success': False,
                'code': exc.code,
                'data': None,
                'error': {'message': str(exc)},
            },
            status=exc.http_status,
        )

    response = exception_handler(exc, context)
    if response is None:
        return response
    response.data = {'success': False, 'code': response.status_code, 'data': None, 'error': response.data}
    return response
