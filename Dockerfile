# Build
FROM oven/bun:latest AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun pm cache rm && bun install --no-cache
COPY . .
RUN bun run build

# Serve
FROM oven/bun:latest AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist

# Default serve port
CMD ["bun", "x", "serve", "-l", "0.0.0.0:3000", "dist"]
