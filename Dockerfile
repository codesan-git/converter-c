# Build
FROM oven/bun:latest AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# Serve
FROM oven/bun:latest AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist

# Default serve port
CMD ["bun", "x", "serve", "-l", "3000", "dist"]
