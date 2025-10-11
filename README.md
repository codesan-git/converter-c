# Running the project

#### 1. Build image:
  - Using docker build
    ```shell
    docker build --rm -t converter-c:latest .
    ```
  - Using docker build kit
    ```shell
    DOCKER_BUILDKIT=1 docker build -t converter-c:latest .
    ```

    You change `converter-c:latest` with this format `<image_name>:<version>` but make sure you also modify the image name inside `docker-compose.yaml`

#### 2. Create `.env` file and add `PORT` variable. You can rever to [.env.example](https://github.com/codesan-git/converter-c/blob/main/Dockerfile):
```
PORT=5173
```

#### 3. Run docker compose:
```shell
docker compose up -d
```

#### 4. Open the program in web browser:
```shell
http://localhost:5173
```
---

# Configuration

#### 1. Modify internal port
- You can change your port by modify your `.env` file:
  ```env
  PORT=3000
  ```

  change `"3000"` to your preferred internal port *(e.g. `"5173"`)*

#### 2. Setup for production ready
- Create internal network.
  Change the network name as you prefer. I this example i use `application_network`:
  ```shell
  docker network create application_network
  ```

- Rewrite your `docker-compose.yaml` to this:
  Make sure your reverse proxy like `Nginx` or `Caddy` is in the same network:
  ```yaml
  services:
    personal-website:
      image: converter-c:latest
      container_name: converter-c
      restart: unless-stopped
      command: bun x serve -l ${PORT} dist
      expose:
        - "${PORT}"
      networks:
        - application_network

  networks:
    application_network:
      external: true
  ```

---
