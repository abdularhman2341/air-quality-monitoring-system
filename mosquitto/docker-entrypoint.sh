#!/bin/sh
set -eu

CONFIG_DIR="${CONFIG_DIR:-/mosquitto/config}"
CONF="$CONFIG_DIR/railway.conf"
PASSWD="$CONFIG_DIR/passwd"
ACL="$CONFIG_DIR/acl"
CERTS="$CONFIG_DIR/certs"

: "${MQTT_BACKEND_PASSWORD:?MQTT_BACKEND_PASSWORD is required}"
: "${MQTT_DEVICE_USERS:?MQTT_DEVICE_USERS is required (MAC=password,MAC=password)}"

mkdir -p "$CONFIG_DIR"
: > "$PASSWD"
chmod 0700 "$PASSWD"

mosquitto_passwd -b "$PASSWD" aqms-backend "$MQTT_BACKEND_PASSWORD"

cat > "$ACL" <<ACL_EOF
user aqms-backend
topic read aqms/devices/+/#
ACL_EOF

OLD_IFS=$IFS
IFS=','
for entry in $MQTT_DEVICE_USERS; do
  mac=$(echo "${entry%%=*}" | tr -d ' :-' | tr 'a-f' 'A-F')
  pass="${entry#*=}"
  if ! echo "$mac" | grep -Eq '^[0-9A-F]{12}$'; then
    echo "Invalid MAC in MQTT_DEVICE_USERS: $mac" >&2
    exit 1
  fi
  mosquitto_passwd -b "$PASSWD" "aqms-$mac" "$pass"
  printf '\nuser aqms-%s\ntopic write aqms/devices/%s/#\n' "$mac" "$mac" >> "$ACL"
  echo "Device user aqms-$mac added"
done
IFS=$OLD_IFS
chmod 0700 "$ACL"

cat > "$CONF" <<CONF_EOF
per_listener_settings false
allow_anonymous false
password_file $PASSWD
acl_file $ACL
persistence false
log_dest stdout
log_type error
log_type warning
log_type notice
log_type information

listener 1883
CONF_EOF

if [ -n "${TLS_CA_CERT:-}" ] && [ -n "${TLS_SERVER_CERT:-}" ] && [ -n "${TLS_SERVER_KEY:-}" ]; then
  mkdir -p "$CERTS"
  echo "$TLS_CA_CERT" | base64 -d > "$CERTS/ca.crt"
  echo "$TLS_SERVER_CERT" | base64 -d > "$CERTS/server.crt"
  echo "$TLS_SERVER_KEY" | base64 -d > "$CERTS/server.key"
  chmod 0600 "$CERTS/server.key"
  cat >> "$CONF" <<TLS_EOF

listener 8883
cafile $CERTS/ca.crt
certfile $CERTS/server.crt
keyfile $CERTS/server.key
tls_version tlsv1.2
TLS_EOF
  echo "TLS listener enabled on 8883"
else
  echo "TLS variables not set: only port 1883 is enabled"
fi

chown -R mosquitto:mosquitto "$CONFIG_DIR" 2>/dev/null || true

exec mosquitto -c "$CONF"