# Wrapper around the upstream MediaMTX binary (D2-ADR-02): the official image is FROM scratch, which has no shell for
# healthchecks or hook commands. WITH_FFMPEG=false skips the compositor (clients then render tiles themselves).
FROM bluenviron/mediamtx:1.9.1 AS mtx

FROM node:22-alpine
ARG WITH_FFMPEG=true
RUN if [ "$WITH_FFMPEG" = "true" ]; then apk add --no-cache ffmpeg; fi
COPY --from=mtx /mediamtx /mediamtx
COPY mediamtx.yml /mediamtx.yml
COPY hook.sh compose.sh /
RUN chmod +x /hook.sh /compose.sh && mkdir -p /recordings
EXPOSE 1935 8888 8889 9997
ENTRYPOINT ["/mediamtx", "/mediamtx.yml"]
