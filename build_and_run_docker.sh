
docker build -t ofh-terrain .

docker stop ofh-terrain || true

docker rm ofh-terrain || true

docker run --restart unless-stopped -p 6007:6007 --add-host host.docker.internal:host-gateway --name ofh-terrain -d ofh-terrain
