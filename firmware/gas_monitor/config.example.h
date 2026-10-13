// config.example.h
// Template for the device's private settings. Used from S1-07 (Wi-Fi + MQTT).
//
// How to use:
//   1. Copy this file to config.h in the same folder.
//   2. Fill in config.h with the real values.
//   3. Never commit config.h: it is listed in .gitignore.
//      Commit only this template, with placeholder values.

#pragma once

// ---------------------------------------------------------------------------
// Wi-Fi
// ---------------------------------------------------------------------------
#define WIFI_SSID       "your-wifi-name"
#define WIFI_PASSWORD   "your-wifi-password"

// ---------------------------------------------------------------------------
// MQTT broker (Mosquitto on Railway, TCP proxy with TLS)
// Host and port come from the Railway TCP proxy settings.
// ---------------------------------------------------------------------------
#define MQTT_HOST       "your-proxy-host.proxy.rlwy.net"
#define MQTT_PORT       8883

// Per-device credentials, as added to MQTT_EXTRA_USERS on Railway.
// Username = "aqms-" + this device's MAC, e.g. aqms-A4CF123B9E01.
#define MQTT_USERNAME   "aqms-XXXXXXXXXXXX"
#define MQTT_PASSWORD   "device-password"

// CA certificate downloaded from https://<broker-domain>/ca.crt
// Paste the full file content between the markers, keeping every line.
static const char MQTT_CA_CERT[] = R"EOF(
-----BEGIN CERTIFICATE-----
PASTE-THE-CA-CERTIFICATE-HERE
-----END CERTIFICATE-----
)EOF";

// ---------------------------------------------------------------------------
// Time (NTP). Readings are not published until the clock is synced.
// ---------------------------------------------------------------------------
#define NTP_SERVER      "pool.ntp.org"

// ---------------------------------------------------------------------------
// Device pairing code, entered by the user on the Add Sensor screen.
// Choose a different code for each device.
// ---------------------------------------------------------------------------
#define PAIRING_CODE    "000000"
