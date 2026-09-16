#!/bin/sh
# 后端容器入口：先应用数据库迁移，再启动 Gunicorn。
set -e

python manage.py migrate --noinput

exec gunicorn app.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers 3 \
  --timeout 60 \
  "$@"
