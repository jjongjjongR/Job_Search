# AWS EC2 Minimal Deploy

## 목적

졸업작품 발표용 최소비용 배포는 EC2 1대에서 Docker Compose로 전체 서비스를 실행한다. RDS, ECS, ALB, ElastiCache, EFS, NAT Gateway, S3는 이번 발표용 배포 범위에서 제외한다.

## 구성

- Nginx: 외부 80/443 요청 수신
- Frontend: Next.js, host `127.0.0.1:3000`
- Backend: NestJS, host `127.0.0.1:3001`
- AI Server: FastAPI, Docker 내부 네트워크 전용
- DB: PostgreSQL, Docker 내부 네트워크 전용
- Temp state: Redis, Docker 내부 네트워크 전용
- 파일 저장: Docker volume `backend-storage`

## AWS 콘솔에서 할 것

1. EC2 인스턴스 1대를 생성한다.
2. 보안 그룹 inbound를 최소화한다.
3. Elastic IP는 발표 중 IP 변경을 피하고 싶을 때만 사용한다.
4. RDS, ECS, ALB, ElastiCache, EFS, NAT Gateway, S3는 만들지 않는다.

## EC2 보안 그룹

- 80: 전체 공개
- 443: HTTPS 적용 시 전체 공개
- 22: 본인 IP만 허용
- 3000, 3001, 8000, 5432, 6379: 열지 않음

## 서버 최초 세팅

Ubuntu 기준 예시:

```bash
sudo apt update
sudo apt install -y git nginx ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo tee /etc/apt/keyrings/docker.asc > /dev/null
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
```

재접속 후:

```bash
sudo mkdir -p /opt/world-jobsearch
sudo chown -R "$USER":"$USER" /opt/world-jobsearch
cd /opt/world-jobsearch
git clone <YOUR_REPO_URL> source
cd source
cp .env.production.example .env.production
```

## .env.production 생성

`.env.production`에서 반드시 바꿀 값:

- `FRONTEND_URL`
- `NEXTAUTH_URL`
- `JWT_SECRET`
- `DB_PASSWORD`
- `AI_INTERNAL_SHARED_SECRET`
- `NEXTAUTH_SECRET`
- `OPENAI_API_KEY`는 실제 AI 모델 호출이 필요할 때만 입력

`JWT_SECRET`, `AI_INTERNAL_SHARED_SECRET`, `NEXTAUTH_SECRET`은 레포에 커밋하지 않는다.

## Nginx 설정 적용

```bash
sudo cp nginx/world-jobsearch.conf /etc/nginx/sites-available/world-jobsearch.conf
sudo ln -sf /etc/nginx/sites-available/world-jobsearch.conf /etc/nginx/sites-enabled/world-jobsearch.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 수동 배포

```bash
cd /opt/world-jobsearch/source
docker compose -f docker-compose.prod.yml --env-file .env.production up --build -d
docker compose -f docker-compose.prod.yml --env-file .env.production ps
curl -i http://127.0.0.1:3001/health
curl -I http://127.0.0.1:3000/
```

외부 확인:

```bash
curl -I http://EC2_PUBLIC_IP/
curl -i http://EC2_PUBLIC_IP/api/health
```

## GitHub Actions 자동 배포

Repository Secrets:

- `EC2_HOST`
- `EC2_USER`
- `EC2_SSH_KEY`
- `EC2_APP_DIR`

`EC2_APP_DIR` 예시:

```text
/opt/world-jobsearch/source
```

`master` branch에 push하면 `.github/workflows/deploy-ec2.yml`이 EC2에 SSH 접속해서 `git pull` 후 compose를 재기동한다.

## 업로드 파일 관리

`backend/uploads`와 `backend/storage`는 Git에 올리지 않는다.

- `backend/uploads`는 과거 로컬 업로드 잔여 경로이며 배포 소스가 아니다.
- 발표용 EC2 배포에서는 업로드 파일을 Docker volume `backend-storage`에 저장한다.
- 업로드 파일을 Git으로 관리하면 긴 한글 파일명 때문에 EC2의 `git pull` 또는 checkout이 실패할 수 있다.
- DB와 업로드 파일을 보존해야 할 때는 Git이 아니라 Docker volume 백업으로 관리한다.

기존 EC2 working tree에 과거 `backend/uploads` 파일이 남아 있어 `git pull`이 실패하면 서버에서 1회만 정리한다.

```bash
cd /opt/world-jobsearch/source
rm -rf backend/uploads
git pull --ff-only
```

## 비용 최소화 주의사항

- EC2 1대만 사용한다.
- RDS, ECS, ALB, ElastiCache, EFS, NAT Gateway, S3를 만들지 않는다.
- 사용하지 않을 때 인스턴스를 중지하면 비용을 줄일 수 있다.
- Docker volume에 DB와 업로드 파일이 있으므로 삭제 전 백업 여부를 확인한다.
- 보안 그룹에서 3000, 3001, 8000, 5432, 6379를 열지 않는다.
