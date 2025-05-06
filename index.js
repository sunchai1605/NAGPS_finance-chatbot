const fs = require('fs');
const path = require('path');
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
    try {
      const datePeriod = agent.parameters['date-period'];
      const startDate = new Date(datePeriod.startDate);
      const endDate = new Date(datePeriod.endDate);
  
      const filePath = path.join(__dirname, 'transactionhistorysample.json');
      const data = JSON.parse(fs.readFileSync(filePath));
  
      const allTransactions = data.flatMap(entry => entry.transactions);
  
      const filtered = allTransactions.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate >= startDate && txDate <= endDate;
      });
  
      if (filtered.length === 0) {
        agent.add({ text: `No transactions found between ${startDate.toDateString()} and ${endDate.toDateString()}.` });
      } else {
        let response = `Here are your transactions from ${startDate.toDateString()} to ${endDate.toDateString()}:\n`;
        filtered.forEach(tx => {
          response += `• ${tx.date}: ₹${tx.amount} - ${tx.fund_name}\n`;
        });
        agent.add({ text: response });
      }
    } catch (error) {
      console.error('Error in transactionHistory:', error);
      agent.add({ text: 'An error occurred while retrieving your transaction history.' });
    }
  }  

  let intentMap = new Map();
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('TransactionHistory', transactionHistory);
  agent.handleRequest(intentMap);
});

app.listen(3000, () => console.log('Server is running on port 3000'));