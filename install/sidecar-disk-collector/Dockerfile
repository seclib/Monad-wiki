FROM alpine:3.20
RUN apk add --no-cache util-linux bash
WORKDIR /app
COPY collect-disk-info.sh bin/collect-disk-info.sh
RUN chmod +x bin/collect-disk-info.sh && mkdir -p storage cache
ENV MONAD_STORAGE_PATH=storage
ENV MONAD_CACHE_PATH=cache
CMD ["bin/collect-disk-info.sh"]
