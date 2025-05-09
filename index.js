const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const { WebhookClient } = require('dialogflow-fulfillment');

const app = express().use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('Hello from ABC Mutual Fund Bot!');
});

app.post('/webhook', (req, res) => {
  const agent = new WebhookClient({ request: req, response: res });

  // ──────────────── INTENT HANDLERS ────────────────

  function welcome(agent) {
    agent.add("Hi, welcome to ABC Mutual Fund Services. What service would you like to use?");
    agent.add("Quick Suggestions:\n- Portfolio Valuation\n- Explore Funds\n- Transaction History");
  }

  function getMobileNumber(agent) {
    const mobile = agent.parameters['mobile'];
    agent.context.set({ name: 'got_mobile', lifespan: 5, parameters: { mobile } });
  
    const askContext = agent.context.get('ask_mobile');
    const intentToResume = askContext?.parameters?.resume_intent;
    const datePeriod = askContext?.parameters?.['date-period'];
  
    if (intentToResume === 'TransactionHistory' && datePeriod?.startDate) {
      agent.parameters['date-period'] = datePeriod;
      return transactionHistory(agent);
    }
  
    if (intentToResume === 'PortfolioValuation') {
      return portfolioValuation(agent);
    }
  
    if (intentToResume === 'ExploreFunds') {
      agent.parameters['fund-category'] = askContext?.parameters?.fund_category;
      return exploreFunds(agent);
    }
  
    if (intentToResume === 'InvestInFund') {
      agent.parameters['fund-name'] = askContext?.parameters?.['fund-name'];
      agent.parameters['amount'] = askContext?.parameters?.['amount'];
      return investInFund(agent);
    }
  
    agent.add(`Thanks! I've saved your number: ${mobile}. How can I help you next?`);
  }
  
  
  function transactionHistory(agent) {
    const datePeriod = agent.parameters['date-period'];
    const userMobile = agent.context.get('got_mobile')?.parameters?.mobile?.replace(/\D/g, '');
  
    if (!userMobile) {
      agent.context.set({
        name: 'ask_mobile',
        lifespan: 2,
        parameters: {
          resume_intent: 'TransactionHistory',
          'date-period': datePeriod
        }
      });
      agent.add("Could you please share your mobile number to continue?");
      return;
    }
  
    if (!datePeriod?.startDate || !datePeriod?.endDate) {
      agent.add("Please provide the date range for the transactions.");
      return;
    }
  
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'transactionhistorysample.json')));
    const userData = data.find(u => u.mobile === userMobile);
  
    if (!userData) {
      agent.add("No account found for this mobile number.");
      return;
    }
  
    const startDate = new Date(datePeriod.startDate);
    const endDate = new Date(datePeriod.endDate);
    const filtered = userData.transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate >= startDate && txDate <= endDate;
    });
  
    if (filtered.length === 0) {
      agent.add("No transactions found in the given date range.");
    } else {
      let response = `Here are your transactions:\n`;
      filtered.forEach(tx => {
        response += `• ${tx.date}: ₹${tx.amount} - ${tx.fund_name}\n`;
      });
      agent.add(response);
      agent.add("Would you like to invest more in one of these, explore other funds, or exit?");
    }
  }
  

  function portfolioValuation(agent) {
    const userMobile = agent.context.get('got_mobile')?.parameters?.mobile?.replace(/\D/g, '');
  
    if (!userMobile) {
      agent.context.set({
        name: 'ask_mobile',
        lifespan: 2,
        parameters: { resume_intent: 'PortfolioValuation' }
      });
      agent.add("Please share your mobile number to get your portfolio details.");
      return;
    }
  
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'transactionhistorysample.json')));
    const userData = data.find(u => u.mobile === userMobile);
  
    if (!userData) {
      agent.add("No account found for your mobile number.");
      return;
    }
  
    const total = userData.transactions.reduce((sum, tx) => sum + tx.amount, 0);
    agent.add(`💼 Your total portfolio valuation is ₹${total}.`);
    agent.add(`Would you like to explore more funds, check your transaction history, or exit?`);
  }
  

  function exploreFunds(agent) {
    const type = agent.parameters['fund-category']?.toLowerCase();
    const userMobile = agent.context.get('got_mobile')?.parameters?.mobile?.replace(/\D/g, '');
  
    if (!userMobile) {
      agent.context.set({
        name: 'ask_mobile',
        lifespan: 2,
        parameters: {
          resume_intent: 'ExploreFunds',
          fund_category: type
        }
      });
      agent.add("Please share your mobile number before we explore funds.");
      return;
    }
  
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'fund&categorysample.json')));
    const match = data.find(f => f.category.toLowerCase() === type);
  
    if (!match) {
        agent.add(`Sorry, I couldn’t find details for "${fundName}". You can try another name or explore available funds first.`);
      return;
    }
  
    let response = `Here are some ${type} funds:\n`;
    match.funds.forEach(f => {
      response += `• ${f.fund_name} (ID: ${f.fund_id})\n`;
    });
  
    agent.add(response);
    agent.add("Would you like details on any of these, or would you like to invest?");
  }
  

  function getFundDetails(agent) {
    const fundName = agent.parameters['fund-name'];
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'fund_details.json')));
    const fund = data.find(f => f.fund_name.toLowerCase() === fundName?.toLowerCase());

    if (!fund) {
      agent.add(`No details found for fund: ${fundName}`);
      return;
    }

    let response = `📊 *${fund.fund_name}* Breakdown:\n`;
    for (const [k, v] of Object.entries(fund.breakdown)) {
      response += `• ${k}: ${v}%\n`;
    }
    response += `\n🔗 More info: ${fund.details_link}`;
    agent.add(response);
  }

  function investInFund(agent) {
    const userMobile = agent.context.get('got_mobile')?.parameters?.mobile?.replace(/\D/g, '');
  
    const amount = agent.parameters['amount'];
    const fundRaw = agent.parameters['fund-name'];
    const fundName = Array.isArray(fundRaw) ? fundRaw[0] : fundRaw;
    const normalizedFund = fundName?.trim()?.toLowerCase();
  
    if (!userMobile) {
      agent.context.set({
        name: 'ask_mobile',
        lifespan: 2,
        parameters: {
          resume_intent: 'InvestInFund',
          'fund-name': fundName,
          'amount': amount
        }
      });
      agent.add("Before we proceed with the investment, please provide your mobile number.");
      return;
    }
  
    if (!normalizedFund || !amount) {
      agent.add("Please mention both the fund name and the amount you'd like to invest.");
      return;
    }
  
    if (amount > 50000) {
      agent.add("For demo, investments above ₹50,000 require verification. Contact support.");
      return;
    }
  
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'fund_details.json')));
    const matched = data.find(f => f.fund_name.toLowerCase() === normalizedFund);
  
    if (!matched) {
      agent.add(`Sorry, no fund found with name "${fundName}".`);
      return;
    }
  
    agent.add(`✅ Successfully simulated an investment of ₹${amount} in ${matched.fund_name}.`);
    agent.add("Investment successful! Would you like to check your portfolio or explore more funds?");
    agent.add("Is there anything else you'd like to do? You can say 'portfolio', 'transactions', or 'no' to exit.");
  }
  

  function changeMobileNumber(agent) {
    agent.context.set({ name: 'got_mobile', lifespan: 0 });
    agent.context.set({ name: 'ask_mobile', lifespan: 2 });
    agent.add("Sure, please provide your new mobile number.");
  }

  // ──────────────── INTENT MAP ────────────────

  const intentMap = new Map();
  intentMap.set('WelcomeIntent', welcome);
  intentMap.set('GetMobileNumber', getMobileNumber);
  intentMap.set('TransactionHistory', transactionHistory);
  intentMap.set('PortfolioValuation', portfolioValuation);
  intentMap.set('ExploreFunds', exploreFunds);
  intentMap.set('GetFundDetails', getFundDetails);
  intentMap.set('InvestInFund', investInFund);
  intentMap.set('ChangeMobileNumber', changeMobileNumber);

  agent.handleRequest(intentMap);
});

app.listen(3000, () => console.log("🚀 Server is running on port 3000"));