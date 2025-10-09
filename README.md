# Running the project

#### 1. Build image:
  - Using old method
    ```shell
    docker build --rm -t converter-c:latest .
    ```
  - Using build kit
    ```shell
    DOCKER_BUILDKIT=1 docker build -t converter-c:latest .
    ```
    
    You change `converter-c:latest` with this format `<image_name>:<version>` but make sure you also modify the image name inside `docker-compose.yaml`

#### 2. Runing docker compose:
```shell
docker compose up -d
```

#### 3. Open it inside your web browser:
```shell
http://localhost:5173
```
--- 

# Configuration

#### 1. Modify internal port
- You can change your internal port inside `Dockerfile` by modify this line:
  ```yaml
  CMD ["bun", "x", "serve", "-l", "3000", "dist"]
  ```

  change `"3000"` to your preferred internal port *(e.g. `"5173"`)*

#### 2. Setup for production ready
- Create internal network.
  Change the network name as you prefer. I this example i use `application_network`:
  ```shell
  docker network create application_network
  ```

- Replace your `docker-compose.yaml` with this format. 
  Make sure your reverse proxy like `Nginx` or `Caddy` is in the same network:
  ```yaml
  services:
    personal-website:
      image: converter-c:latest
      container_name: converter-c
      restart: unless-stopped
      expose:
        - "3000" # This port should be indentical with internal port inside your Dockerfile
      networks:
        - application_network

  networks:
    application_network:
      external: true
  ```

---