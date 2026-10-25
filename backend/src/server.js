require('dotenv').config({ quiet: true });
const app = require('./app');
const mqttSubscriber = require('./services/MqttSubscriberService');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  mqttSubscriber.connect();
});