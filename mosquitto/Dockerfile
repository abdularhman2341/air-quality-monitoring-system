FROM eclipse-mosquitto:2

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 1883 8883

ENTRYPOINT ["/docker-entrypoint.sh"]