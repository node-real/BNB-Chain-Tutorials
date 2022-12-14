# Start developing explorer with NodeReal Enhanced API (Part 1)

## Overview
Designed for anyone wanting to learn development on the BNB Smart Chain, this tutorial provides a step-by-step guide on how to develop a block explorer that uses the Nodereal enhanced API to fetch details from the BNB Smart Chain blockchain for the given transaction hash. The technology stack used in this tutorial includes OpenRPC client, Nodereal MegaNode, and http-server. 

## What You Will Learn
Through this tutorial, you will learn 
- How to use the OpenRPC client to call NodeReal Enhanced API;
- How to use Nodereal’s Enhanced API;
- How to deploy static pages onto localhost using http-server

## Target audience
This tutorial aims to provide adequate information to anyone who wants to learn web3 development on BNB Smart Chain.

## Prerequisites
  - node --version
    - v16.13.0
  - npm --version 
    - 8.1.0
  - http-server --version
    - v14.1.1

## Setup

1. **Clone the repository** ```gh repo clone node-real/BNB-Chain-Tutorials ```

2. **Include Nodereal Meganode API Key** make sure to include the API URL for the Nodereal Meganode API in the ```index.html``` as shown in the figure below. 

   ```html5
   <script>
         async function txDetails(tHash){
           var address = tHash
           const {  RequestManager, HTTPTransport, Client } = window.OpenRpcClient;
           const transport = new HTTPTransport("https://bsc-mainnet.nodereal.io/v1/{YOUR-API-KEY}");
           const client = new Client(new RequestManager([transport]));
           const result = await client.request({method: "nr_getTokenMeta", params: [address]});
           console.log(result);
           $('tbody').append("<tr><td>" + result.name + "</td><td>" + result.symbol + "</td><td>" + result.tokenType + "</td><td>" + result.decimals);
         }
   </script>
   ```

3. **Install htpp-server** ```npm install -g http-server```

4. **Run the application** ```http-server```

## Available Scripts
```sh
  $ http-server
```

## Structure
```shell
.
├── LICENSE
├── README.md
├── img
│   ├── favicon.ico
│   ├── logo.png
│   ├── screenshot.png
│   ├── screenshot2.png
│   └── screenshot3.png
├── index.html
├── js
│   ├── open-rpc-client.js
│   └── web3.min.js
├── list.txt
├── package-lock.json

```

## How it Works
### Checklist
- Make sure you have installed all the dependences using the ```npm install``` command.
- Make sure you have installed http-server using the ```npm install -g http-server``` command.
- Before running the application, make sure that you have included the HTTP link for the Nodereal Meganode API in the ```index.html``` as shown in the figure below.

![img](img/screenshot2.png)

- For this project we have used the public API key for BSC Testnet. For a complete list of Nodereal Meganode Public API keys, refer [here](https://docs.nodereal.io/nodereal/meganode/meganode-api-overview/public-api-key). 

### How to Use
- Run the application using the command ```http-server``` from the root directory of the project.

- Open browser and navigate to any of the URLs specified by running the above step, for e.g., ```localhost:8080```.

- Paste address of a token into the input field in our block explorer. You can open the portal of [BSCScan](https://bscscan.com/), and find a token address.

- Click on the _**Fetch Details**_ button to fetch details of the transaction.

  ![40B7C16C-9C32-4F94-A1A7-B9C7DB1890CF](./img/screenshot3.jpeg)



## Contact
For more inquiries and conversations, feel free to contact us at our [Discord Channel](https://discord.com/invite/nodereal)
