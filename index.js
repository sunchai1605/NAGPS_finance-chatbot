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

  function getMobileNumber(agent) {
    const mobile = agent.parameters['mobile'];
    
    // Set the context manually
    agent.context.set({
      name: 'got_mobile',
      lifespan: 5,
      parameters: { mobile: mobile }
    });
  
    agent.add(`Thanks! I've saved your number: ${mobile}`);
  
    // Call transactionHistory directly
    return transactionHistory(agent);
  }
  
  function transactionHistory(agent) {
    try {
      const datePeriod = agent.parameters['date-period'];
      const startDate = new Date(datePeriod.startDate);
      const endDate = new Date(datePeriod.endDate);
  
      const userMobile = agent.context.get('got_mobile')?.parameters?.mobile?.replace(/\D/g, '');
  
      if (!userMobile) {
        agent.add('Could you please share your mobile number to proceed?');
        return;
      }
  
      const filePath = path.join(__dirname, 'transactionhistorysample.json');
      const data = JSON.parse(fs.readFileSync(filePath));
  
      const userData = data.find(entry => entry.mobile === userMobile);
  
      if (!userData || !userData.transactions) {
        agent.add(`No transaction data found for your account.`);
        return;
      }
  
      const filtered = userData.transactions.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate >= startDate && txDate <= endDate;
      });
  
      if (filtered.length === 0) {
        agent.add(`No transactions found between ${startDate.toDateString()} and ${endDate.toDateString()}.`);
      } else {
        let response = `Here are your transactions from ${startDate.toDateString()} to ${endDate.toDateString()}:\n`;
        filtered.forEach(tx => {
          response += `• ${tx.date}: ₹${tx.amount} - ${tx.fund_name}\n`;
        });
        agent.add(response);
      }
    } catch (error) {
      console.error('Error in transactionHistory:', error);
      agent.add('An error occurred while retrieving your transaction history.');
    }
  }
  
  

  let intentMap = new Map();
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('TransactionHistory', transactionHistory);
  intentMap.set('GetMobileNumber', getMobileNumber);
  agent.handleRequest(intentMap);
});

app.listen(3000, () => console.log('Server is running on port 3000'));