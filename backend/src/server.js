require('dotenv').config({ quiet: true });
const http = require('http');
const app = require('./app');
const mqttSubscriber = require('./services/MqttSubscriberService');
const realtimeGateway = require('./services/RealtimeGateway');
const mailService = require('./services/MailService');

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Express and Socket.IO share one HTTP server and one port.
realtimeGateway.init(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Mail driver: ${mailService.driver}`);
  mqttSubscriber.connect();
});
