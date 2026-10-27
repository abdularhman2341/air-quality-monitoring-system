#!/bin/sh
set -eu

CONFIG_DIR="${CONFIG_DIR:-/mosquitto/config}"
CONF="$CONFIG_DIR/railway.conf"
PASSWD="$CONFIG_DIR/passwd"
ACL="$CONFIG_DIR/acl"
CERTS="$CONFIG_DIR/certs"

: "${MQTT_BACKEND_PASSWORD:?MQTT_BACKEND_PASSWORD is required}"
: "${MQTT_DEVICE_USERS:?MQTT_DEVICE_USERS is required (MAC=password,MAC=password)}"

trim() {
  printf '%s' "$1" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//'
}

BACKEND_PASSWORD=$(trim "$MQTT_BACKEND_PASSWORD")
if [ -z "$BACKEND_PASSWORD" ]; then
  echo "MQTT_BACKEND_PASSWORD is empty" >&2
  exit 1
fi
DEVICE_USERS=$(printf '%s' "$MQTT_DEVICE_USERS" | tr '\r\n' ',,')

mkdir -p "$CONFIG_DIR"
: > "$PASSWD"
chmod 0700 "$PASSWD"

mosquitto_passwd -b "$PASSWD" aqms-backend "$BACKEND_PASSWORD"

cat > "$ACL" <<ACL_EOF
user aqms-backend
topic read aqms/devices/+/#
ACL_EOF

OLD_IFS=$IFS
IFS=','
DEVICE_COUNT=0
for entry in $DEVICE_USERS; do
  entry=$(trim "$entry")
  [ -z "$entry" ] && continue
  case "$entry" in
    *=*) ;;
    *)
      echo "Missing '=' in MQTT_DEVICE_USERS entry" >&2
      exit 1
      ;;
  esac
  mac=$(printf '%s' "${entry%%=*}" | tr -d '[:space:]:-' | tr 'a-f' 'A-F')
  pass=$(trim "${entry#*=}")
  if ! printf '%s' "$mac" | grep -Eq '^[0-9A-F]{12}$'; then
    echo "Invalid MAC in MQTT_DEVICE_USERS: $mac" >&2
    exit 1
  fi
  if [ -z "$pass" ]; then
    echo "Empty password for device $mac" >&2
    exit 1
  fi
  mosquitto_passwd -b "$PASSWD" "aqms-$mac" "$pass"
  printf '\nuser aqms-%s\ntopic write aqms/devices/%s/#\n' "$mac" "$mac" >> "$ACL"
  echo "Device user aqms-$mac added"
  DEVICE_COUNT=$((DEVICE_COUNT + 1))
done
IFS=$OLD_IFS

if [ "$DEVICE_COUNT" -eq 0 ]; then
  echo "MQTT_DEVICE_USERS has no devices" >&2
  exit 1
fi

chmod 0700 "$ACL"

cat > "$CONF" <<CONF_EOF
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