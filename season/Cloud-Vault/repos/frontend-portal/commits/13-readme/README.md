# TechVault Portal

Internal employee portal frontend built with Next.js.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: Amazon Cognito
- **Hosting**: AWS S3 + CloudFront through GitHub Actions

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/techvault-ctf/frontend-portal.git
cd frontend-portal

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

Copy `.env.example` to `.env` for local development only. Deployment credentials are stored in GitHub Actions secrets.

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API endpoint URL |
| `AWS_REGION` | AWS region (default: ap-northeast-1) |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | Cognito User Pool ID |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | Cognito App Client ID |
| `S3_BUCKET_NAME` | Static asset bucket |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution to invalidate |

## Deployment Note

Older deployment commits used a local `.env` file during the first S3 rollout. That file was removed from `main`; do not reintroduce deploy keys into the repository.

## Project Structure

```
src/
├── app/
│   ├── chat/          # AI chat interface
│   ├── dashboard/     # Challenge dashboard
│   ├── login/         # Authentication page
│   ├── globals.css    # Global styles
│   ├── layout.tsx     # Root layout
│   ├── loading.tsx    # Loading state
│   └── page.tsx       # Landing page
├── components/
│   ├── ui/            # Shared UI components
│   ├── ChatWindow.tsx # Chat interface component
│   ├── ErrorBoundary.tsx
│   ├── Footer.tsx
│   └── Header.tsx
└── lib/
    ├── api.ts         # API client
    └── auth.ts        # Authentication service
```

## Deployment

The application is automatically deployed to S3/CloudFront via GitHub Actions on push to `main`.

### Manual Deployment

```bash
npm run build
aws s3 sync out/ s3://your-bucket-name --delete
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint
```

## Team

- **Suzuki Yuki** - Lead Developer
- **Yamamoto Rina** - Frontend Developer
- **Tanaka Taro** - DevOps

## License

Private - TechVault Inc.
