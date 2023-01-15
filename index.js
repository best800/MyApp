const http = require("http")
const express = require('express')
const fetch = require('node-fetch')
const axios = require('axios')

const fs = require('fs')
var port = process.env.PORT || 5500;
const cors = require('cors');
const { response } = require("express");
const { stringify } = require("querystring");

const app = express();
const router = express.Router();

app.use(cors())

var headers = {
  "accept-language": "en-US,en;q=0.9",
 // "path": "/api/option-chain-indices?symbol=NIFTY",
  //"accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
  // "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
  //"cookie":"ED7433295473216E162417A49DA27BE9~000000000000000000000000000000~YAAQMyEPF0433KCFAQAAVMq+sRK6qNxW7dRZK/fYyAbYmawsxdtu603EagfrOlXa74wKBb4NeNRO2uPmUc30QEIrV3Zhz1Gl2qT31EUoAMeb75B60cG0ZGJywgc/5ibHsDzbNT9GrXkD4mqxqs7jBrDtcUs+XCbbkWYlLo33q70YfZmm5Tmh2CHBVbjxNBE97fw0Zojf7Fk6+2AcGfo7i0zylIAozDC8eLVrPBVBwPtgziodMrMT10+PhmPatPqdz9U3EMO+xkKqvEEXlAsszk7aEXI9n7qLndJLO8cdT6U7bFLvLIDW2vP48ZqhBR8EnUl8mfd2JVdDBHcOsMbqZ+K0uB+Jpk/TeAUqRuCw/Ee6iIpId3qcj/E8bFKGSVRR"
}


http.createServer(async function (req, res) {

 // res.writeHead(200, { "content-Type": 'text/plain' })

  if (req.url == '/') {
    let data = fs.readFileSync("index.html", "utf-8")
    res.writeHead(200, {'Content-Type': 'text/html'})
    res.write(data)
    res.end();
  }

  else if (req.url == '/nifty') {
    try{
    let response = await axios.get('https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY',
    {
      headers:{"Accept":"text/html"}
    });

    let data = await response.data;
        res.writeHead(200, { "content-Type": 'application/json'})
       // console.log(data)
        let info = getInfo(data);
        res.write(JSON.stringify(info))
        res.end();
       return;
    }catch{
      res.writeHead(200, 'Content-Type: application/json')
      res.end();
    }
  }

  else if(req.url == '/niftyMarket'){
    axios.get('https://www.nseindia.com/api/marketStatus')
    .then(response=>response.data).then((data)=>{
      res.writeHead(200, 'Content-Type: application/json')
      res.write(JSON.stringify(data))
      res.end()
    }).catch(e=>{})

  }
  else if(req.url == '/niftyBankMarket'){
    axios.get('https://www.nseindia.com/api/marketStatus')
    .then(response=>response.data).then((data)=>{
      res.writeHead(200, 'Content-Type: application/json')
      res.write(JSON.stringify(data.filtered.data))
      res.end()
    }).catch(e=>{})

  }
 
}).listen(port, 'localhost');

function getInfo(data){
  let filteredRecords = data.filtered.data;

               
  let currentMarketIndex = filteredRecords.findIndex(x => x.strikePrice > x.CE.underlyingValue);

  let currentMarketPrice = filteredRecords[currentMarketIndex]
  let rest = filteredRecords.length - currentMarketIndex;

  let putCallsList = filteredRecords.map((value, idx, arr) => {

      return { calls: value.CE, puts: value.PE }
  })

  let spotPrice = putCallsList[0].calls.underlyingValue
 
  let upMarketList = putCallsList.slice(0, currentMarketIndex + 1)
  let downMarketList = putCallsList.slice((currentMarketIndex + 1))
  let Top5putCalls = { totalCall: 0, totalPut: 0 }

  upMarketList.slice(-5).reduce((prev, curr, i, arr) => {
      if (prev) {
          Top5putCalls["totalCall"] += curr.calls.changeinOpenInterest 
          Top5putCalls["totalPut"] += curr.puts.changeinOpenInterest 
          return
      }
      Top5putCalls["totalCall"] += curr.calls.changeinOpenInterest
      Top5putCalls["totalPut"] += curr.puts.changeinOpenInterest
  })

  let bottom5putCalls = { totalCall: 0, totalPut: 0 }
  downMarketList.slice(0, 5).reduce((prev, curr, i, arr) => {
      if (prev) {
          bottom5putCalls["totalCall"] += curr.calls.changeinOpenInterest + prev.calls.changeinOpenInterest
          bottom5putCalls["totalPut"] += curr.puts.changeinOpenInterest + prev.puts.changeinOpenInterest
          return
      }
      bottom5putCalls["totalCall"] += curr.calls.changeinOpenInterest
      bottom5putCalls["totalPut"] += curr.puts.changeinOpenInterest

  })

  let total_mid_calls = Top5putCalls.totalCall + bottom5putCalls.totalCall;
  let total_mid_puts = Top5putCalls.totalPut + bottom5putCalls.totalPut;

  let midPcr = total_mid_puts / total_mid_calls;
  let acc ={totalPut:0,totalCall:0}
  filteredRecords.reduce((prev, curr) => {
      acc['totalPut'] += curr.PE.changeinOpenInterest
      acc['totalCall'] += curr.CE.changeinOpenInterest

  })

  let total_pcr = acc.totalPut / acc.totalCall
  let obj ={
    spotPrice:spotPrice,
    totalPcr:total_pcr,
    putMid: total_mid_puts,
    callsMid:total_mid_calls,
    strikePrice:currentMarketPrice.strikePrice,
    midPcr:midPcr
  };

  return obj
}

app.use('/', router)
