import os
from pathlib import Path
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'dev-secret')
DEBUG = os.getenv('DJANGO_DEBUG', 'true') == 'true'
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'rest_framework',
    'app.apps.users',
    'app.apps.properties',
    'app.apps.booking',
    'app.apps.contract',
    'app.apps.repair',
]

MIDDLEWARE = ['django.middleware.common.CommonMiddleware', 'app.middleware.request_log.RequestLogMiddleware']
ROOT_URLCONF = 'app.urls'
DATABASES = {'default': dj_database_url.config(default=os.getenv('DATABASE_URL', 'sqlite:///db.sqlite3'))}
if DATABASES['default'].get('ENGINE') == 'django.db.backends.sqlite3':
    # 本地 SQLite：IMMEDIATE 事务让写操作在 BEGIN 时即取保留锁，
    # 后到请求等待（busy timeout）后再做条件更新，避免并发写立刻报 database is locked。
    # 生产使用 PostgreSQL，行锁 + 条件更新保证同样的串行语义。
    options = DATABASES['default'].setdefault('OPTIONS', {})
    options.setdefault('timeout', 20)
    options.setdefault('transaction_mode', 'IMMEDIATE')
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
MEDIA_ROOT = BASE_DIR / 'media'
MEDIA_URL = '/media/'
REST_FRAMEWORK = {'EXCEPTION_HANDLER': 'app.utils.exception_handler.standard_exception_handler'}
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': 'INFO'},
}
