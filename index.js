const express = require('express');
const bodyParser = require('body-parser');
const { WebhookClient } = require('dialogflow-fulfillment');

const app = express().use(bodyParser.json());

app.post('/webhook', (req, res) => {
  const agent = new WebhookClient({ request: req, response: res });

  function welcome(agent) {
    agent.add(`Welcome to the finance bot!`);
  }

  let intentMap = new Map();
  intentMap.set('Default Welcome Intent', welcome);

  agent.handleRequest(intentMap);
});

app.listen(3000, () => console.log('Server is running on port 3000'));