# Serve
FROM oven/bun:latest
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --no-cache
COPY . .
EXPOSE 3600
CMD ["bun", "run", "preview"]
