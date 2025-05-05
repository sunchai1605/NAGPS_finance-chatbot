const fs = require('fs');
const transactionsData = JSON.parse(
  fs.readFileSync('transactionhistorysample.json', 'utf8')
);
const express = require('express');
const bodyParser = require('body-parser');
const { WebhookClient } = require('dialogflow-fulfillment');

const app = express().use(bodyParser.json());

app.get('/', (req, res) => {
    res.send('Hello from NAGPS Finance Chatbot Server!');
  });
  
app.post('/webhook', (req, res) => {

    console.log('─── New Webhook Request ───');
    console.log('Raw body:', JSON.stringify(req.body, null, 2));
    console.log('Intent displayName:', req.body.queryResult.intent.displayName);
    console.log('Parameters:', JSON.stringify(req.body.queryResult.parameters));

  const agent = new WebhookClient({ request: req, response: res });

  function welcome(agent) {
    agent.add(`Welcome to the finance bot!`);
  }
  function transactionHistory(agent) {
    // Get parameters from Dialogflow
    const mobile = agent.parameters['phone-number'];      // make sure your intent has this entity
    const datePeriod = agent.parameters['date-period'];   // e.g., “2025-04-01/2025-04-30”
  
    // Find user record
    const userRecord = transactionsData.find(rec => rec.mobile === mobile);
    if (!userRecord) {
      agent.add(`I couldn't find any transactions for ${mobile}.`);
      return;
    }
  
    // Optionally parse datePeriod into start/end dates
    let filtered = userRecord.transactions;
    if (datePeriod && datePeriod.startDate && datePeriod.endDate) {
      const start = new Date(datePeriod.startDate);
      const end = new Date(datePeriod.endDate);
      filtered = filtered.filter(tx => {
        const d = new Date(tx.date);
        return d >= start && d <= end;
      });
    }
  
    if (filtered.length === 0) {
      agent.add(`No transactions found for ${mobile} in that period.`);
      return;
    }
  
    // Take the last 3 transactions
    const lastThree = filtered.slice(-3).reverse();
    let reply = 'Here are your last transactions:\n';
    lastThree.forEach(tx => {
      reply += `• ${tx.date}: ₹${tx.amount} in ${tx.fund_name}\n`;
    });
    agent.add(reply);
  }  

  let intentMap = new Map();
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('TransactionHistory', transactionHistory);
  agent.handleRequest(intentMap);
});

app.listen(3000, () => console.log('Server is running on port 3000'));