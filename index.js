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
  
    // Save it into the got_mobile context
    agent.context.set({
      name: 'got_mobile',
      lifespan: 5,
      parameters: { mobile: mobile }
    });
  
    // Try to extract any previously provided date-period
    const datePeriod = agent.context.get('ask_mobile')?.parameters?.['date-period'];
  
    if (datePeriod && datePeriod.startDate && datePeriod.endDate) {
      // Re-run the transactionHistory logic with both values
      agent.parameters['date-period'] = datePeriod;
      return transactionHistory(agent);
    } else {
      agent.add(`Thanks! I've saved your number: ${mobile}. You can now ask for your transactions.`);
    }
  }
   
  function transactionHistory(agent) {
    try {
      const datePeriod = agent.parameters['date-period'];
  
      if (!datePeriod || !datePeriod.startDate || !datePeriod.endDate) {
        agent.add('For which date range would you like to view your transactions?');
        return;
      }
  
      const startDate = new Date(datePeriod.startDate);
      const endDate = new Date(datePeriod.endDate);
  
      const userMobile = agent.context.get('got_mobile')?.parameters?.mobile?.replace(/\D/g, '');
  
      if (!userMobile) {
        agent.add('Could you please share your mobile number to proceed?');
      
        // Save the date-period in context so we can use it after
        agent.context.set({
          name: 'ask_mobile',
          lifespan: 2,
          parameters: { 'date-period': datePeriod }
        });
      
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

  function exploreFunds(agent) {
    console.log('All parameters:', agent.parameters);
    const rawFundType = agent.parameters['fund-category'];
    console.log('RAW fund-type:', rawFundType);
  
    const fundType = rawFundType?.toLowerCase?.() || '';
    const filePath = path.join(__dirname, 'fund&categorysample.json');
    const data = JSON.parse(fs.readFileSync(filePath));
  
    const matchingCategory = data.find(
      category => category.category.toLowerCase() === fundType
    );
  
    if (!matchingCategory || !matchingCategory.funds || matchingCategory.funds.length === 0) {
      agent.add(`Sorry, I couldn't find any "${fundType}" funds at the moment.`);
    } else {
      let response = `Here are some ${fundType} funds:\n`;
      matchingCategory.funds.forEach(fund => {
        response += `• ${fund.fund_name} (ID: ${fund.fund_id})\n`;
      });
      agent.add(response);
    }
  }  

  function getLastTransaction(agent) {
    try {
      const userMobile = agent.context.get('got_mobile')?.parameters?.mobile?.replace(/\D/g, '');
  
      if (!userMobile) {
        agent.add('Could you please provide your mobile number first?');
        agent.context.set({ name: 'ask_mobile', lifespan: 1 });
        return;
      }
  
      const filePath = path.join(__dirname, 'transactionhistorysample.json');
      const data = JSON.parse(fs.readFileSync(filePath));
      const userData = data.find(entry => entry.mobile === userMobile);
  
      if (!userData || !userData.transactions || userData.transactions.length === 0) {
        agent.add('No transactions found for your account.');
        return;
      }
  
      const sorted = userData.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
      const latest = sorted[0];
  
      agent.add(`Your latest transaction was on ${latest.date}: ₹${latest.amount} in ${latest.fund_name}.`);
    } catch (error) {
      console.error('Error in getLastTransaction:', error);
      agent.add('Something went wrong while fetching your last transaction.');
    }
  }

  function portfolioValuation(agent) {
    try {
      const userMobile = agent.context.get('got_mobile')?.parameters?.mobile?.replace(/\D/g, '');
  
      if (!userMobile) {
        agent.add('Could you please provide your mobile number first?');
        agent.context.set({ name: 'ask_mobile', lifespan: 1 });
        return;
      }
  
      const filePath = path.join(__dirname, 'transactionhistorysample.json');
      const data = JSON.parse(fs.readFileSync(filePath));
      const userData = data.find(entry => entry.mobile === userMobile);
  
      if (!userData || !userData.transactions || userData.transactions.length === 0) {
        agent.add('No transactions found for your account.');
        return;
      }
  
      const totalValue = userData.transactions.reduce((sum, tx) => sum + tx.amount, 0);
  
      agent.add(`Your current portfolio valuation is ₹${totalValue}.`);
    } catch (error) {
      console.error('Error in portfolioValuation:', error);
      agent.add('Sorry, something went wrong while calculating your portfolio value.');
    }
  }

  function changeMobileNumber(agent) {
    // Clear existing context
    agent.context.set({ name: 'got_mobile', lifespan: 0 });
  
    // Prompt for new mobile number
    agent.add('Sure, please provide your new mobile number.');
    
    // Set up context to expect number
    agent.context.set({ name: 'ask_mobile', lifespan: 1 });
  }  

  function getFundDetails(agent) {
    const fundName = agent.parameters['fund-name'];
  
    if (!fundName) {
      agent.add(`Please specify the fund name you'd like more details about.`);
      return;
    }
  
    const filePath = path.join(__dirname, 'fund_details.json');
    const data = JSON.parse(fs.readFileSync(filePath));
  
    const fund = data.find(f => f.fund_name.toLowerCase() === fundName.toLowerCase());
  
    if (!fund) {
      agent.add(`Sorry, I couldn't find details for "${fundName}". Please check the name and try again.`);
      return;
    }
  
    let response = `📊 *${fund.fund_name}* Details:\n`;
    for (const [key, value] of Object.entries(fund.breakdown)) {
      response += `• ${key}: ${value}%\n`;
    }
    response += `\nMore info: ${fund.details_link}`;
  
    agent.add(response);
  }   

  function investInFund(agent) {
    const amount = agent.parameters['amount'];
    const fundName = agent.parameters['fund-name'];
  
    if (!amount || isNaN(amount)) {
      agent.add(`Please enter a valid numeric amount.`);
      return;
    }
  
    if (amount > 50000) {
      agent.add(`For this demo, investment is limited to ₹50,000. Please enter a smaller amount.`);
      return;
    }
  
    agent.add(`✅ You've successfully invested ₹${amount} in ${fundName}!\nThis is a demo — no real money was used.`);
  }
  
  

  let intentMap = new Map();
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('TransactionHistory', transactionHistory);
  intentMap.set('GetMobileNumber', getMobileNumber);
  intentMap.set('ExploreFunds', exploreFunds);
  intentMap.set('GetLastTransaction', getLastTransaction);
  intentMap.set('PortfolioValuation', portfolioValuation);
  intentMap.set('ChangeMobileNumber', changeMobileNumber);
  intentMap.set('GetFundDetails', getFundDetails);
  intentMap.set('InvestInFund', investInFund);
  agent.handleRequest(intentMap);
});

app.listen(3000, () => console.log('Server is running on port 3000'));