FROM alpine:latest

RUN apk add --no-cache curl busybox-suid dcron

COPY crontab /etc/crontabs/root
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]