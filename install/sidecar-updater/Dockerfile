FROM alpine:3.20

# Install Docker CLI for compose operations
RUN apk add --no-cache docker-cli docker-cli-compose bash jq

# Copy the update watcher script
WORKDIR /workspace
COPY update-watcher.sh bin/update-watcher.sh
RUN chmod +x bin/update-watcher.sh

# Create shared communication directory
RUN mkdir -p shared

WORKDIR /workspace/shared

CMD ["../bin/update-watcher.sh"]
