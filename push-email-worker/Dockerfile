FROM node:22-slim

WORKDIR /app

# Install pnpm via npm (reliable on official node images)
# pnpm@9 supports Node 22; pnpm@latest (v11) requires node>=22.13
RUN npm install -g pnpm@9

# Install dependencies first (better layer caching)
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --no-frozen-lockfile

# Copy source code
COPY . .

CMD ["pnpm", "start"]
