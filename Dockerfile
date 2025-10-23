# Build
FROM oven/bun:latest AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun pm cache rm
RUN bun install --no-cache
COPY . .
RUN bun run build

# Serve
FROM oven/bun:latest AS runner
WORKDIR /app
RUN bun install -g sirv
COPY --from=builder /app/dist ./dist
CMD ["sirv", "dist", "--single", "--port", "3600"]

## change 3600 to your internal port
