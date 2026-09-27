FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

# 初期設定スクリプトに必要なシークレットをコピー
COPY secret.txt .
COPY setup.py .

# シークレットを読み込んで初期設定を実行
RUN python setup.py --init

# アプリケーションコードを配置
COPY app/ .

# シークレットファイルを削除（セキュリティ対応）
RUN rm secret.txt

CMD ["python", "main.py"]
