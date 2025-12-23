let detectedAddresses = [];

if (typeof ethers === 'undefined') {
  const script = document.createElement('script');
  script.src =
    'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.15.0/ethers.umd.min.js';
  script.onload = setupDecoder;
  document.head.appendChild(script);
} else {
  setupDecoder();
}

const FACTORY_ADDRESS = '0xb5553aEbFbE883903705Ee332Bf2E6B672d6762a';
const ALCHEMY_API_KEY = 'G8uDr9bgqVaqdpPXoTD1N';
const network = 'mainnet';
const ALCHEMY_URL = `https://eth-${network}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

function setupDecoder() {
  console.clear();
  console.log('🚀 GivFun Token Address Predictor Agent Started');
  const deployTokenABI = [
    {
      inputs: [
        {
          components: [
            {
              components: [
                { internalType: 'string', name: 'name', type: 'string' },
                { internalType: 'string', name: 'symbol', type: 'string' },
                { internalType: 'bytes32', name: 'salt', type: 'bytes32' },
                { internalType: 'string', name: 'image', type: 'string' },
                { internalType: 'string', name: 'metadata', type: 'string' },
                { internalType: 'string', name: 'context', type: 'string' },
                {
                  internalType: 'uint256',
                  name: 'originatingChainId',
                  type: 'uint256',
                },
              ],
              internalType: 'struct IGivFun.TokenConfig',
              name: 'tokenConfig',
              type: 'tuple',
            },
            {
              components: [
                {
                  internalType: 'uint8',
                  name: 'vaultPercentage',
                  type: 'uint8',
                },
                {
                  internalType: 'uint256',
                  name: 'vaultDuration',
                  type: 'uint256',
                },
              ],
              internalType: 'struct IGivFun.VaultConfig',
              name: 'vaultConfig',
              type: 'tuple',
            },
            {
              components: [
                {
                  internalType: 'address',
                  name: 'pairedToken',
                  type: 'address',
                },
                {
                  internalType: 'int24',
                  name: 'tickIfToken0IsNewToken',
                  type: 'int24',
                },
              ],
              internalType: 'struct IGivFun.PoolConfig',
              name: 'poolConfig',
              type: 'tuple',
            },
            {
              components: [
                {
                  internalType: 'uint24',
                  name: 'pairedTokenPoolFee',
                  type: 'uint24',
                },
                {
                  internalType: 'uint256',
                  name: 'pairedTokenSwapAmountOutMinimum',
                  type: 'uint256',
                },
              ],
              internalType: 'struct IGivFun.InitialBuyConfig',
              name: 'initialBuyConfig',
              type: 'tuple',
            },
            {
              components: [
                {
                  internalType: 'uint256',
                  name: 'creatorReward',
                  type: 'uint256',
                },
                {
                  internalType: 'address',
                  name: 'creatorAdmin',
                  type: 'address',
                },
                {
                  internalType: 'address',
                  name: 'creatorRewardRecipient',
                  type: 'address',
                },
                {
                  internalType: 'address',
                  name: 'interfaceAdmin',
                  type: 'address',
                },
                {
                  internalType: 'address',
                  name: 'interfaceRewardRecipient',
                  type: 'address',
                },
              ],
              internalType: 'struct IGivFun.RewardsConfig',
              name: 'rewardsConfig',
              type: 'tuple',
            },
          ],
          internalType: 'struct IGivFun.DeploymentConfig',
          name: 'deploymentConfig',
          type: 'tuple',
        },
      ],
      name: 'deployToken',
      outputs: [
        { internalType: 'address', name: 'tokenAddress', type: 'address' },
        { internalType: 'uint256', name: 'positionId', type: 'uint256' },
      ],
      stateMutability: 'payable',
      type: 'function',
    },
  ];

  const iface = new ethers.Interface(deployTokenABI);

  const originalFetch = window.fetch;

  window.fetch = async function (url, options = {}) {
    if (
      url.includes(`${network}.rpc.privy.systems`) &&
      options.method === 'POST' &&
      options.body
    ) {
      try {
        const bodyData = JSON.parse(options.body);
        if (bodyData.method === 'eth_sendRawTransaction' && bodyData.params) {
          const rawTx = bodyData.params[0];
          const tx = ethers.Transaction.from(rawTx);

          if (tx.data.startsWith(iface.getFunction('deployToken').selector)) {
            console.log('🔍 Detecteding...');
            await simulateTokenDeployment(tx);
          }
        }
      } catch (e) {
        console.error('❌ Error processing transaction:', e);
      }
    }

    return originalFetch.apply(this, arguments);
  };

  async function simulateTokenDeployment(tx) {
    try {
      const simulationTx = {
        from: tx.from,
        to: FACTORY_ADDRESS,
        value: tx.value ? '0x' + tx.value.toString(16) : '0x0',
        data: tx.data,
        gas: tx.gasLimit ? '0x' + tx.gasLimit.toString(16) : '0x1000000',
      };

      const simulationResponse = await originalFetch(ALCHEMY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: 1,
          jsonrpc: '2.0',
          method: 'alchemy_simulateExecution',
          params: [simulationTx],
        }),
      });

      const simulationResult = await simulationResponse.json();

      if (simulationResult.result) {
        const tokenAddress = extractTokenAddressFromSimulation(
          simulationResult.result,
        );

        if (tokenAddress) {
          if (!detectedAddresses.includes(tokenAddress)) {
            console.log(`✅ Contract Address: ${tokenAddress}`);
            detectedAddresses.push(tokenAddress);
            await new Promise((resolve) => setTimeout(resolve, 15000));
          }
        } else {
          console.log('⚠️ Could not detect');
        }
      } else {
        console.error('❌ Simulation failed:', simulationResult.error);
        await simulateWithAssetChanges(simulationTx);
      }
    } catch (error) {
      console.error('❌ Error during simulation:', error);
    }
  }

  async function simulateWithAssetChanges(simulationTx) {
    try {
      const response = await originalFetch(ALCHEMY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: 1,
          jsonrpc: '2.0',
          method: 'alchemy_simulateAssetChanges',
          params: [simulationTx],
        }),
      });

      const result = await response.json();

      if (result.result) {
        console.log('📊 Asset changes simulation result:', result.result);
        if (result.result.changes) {
          for (const change of result.result.changes) {
            if (change.contractAddress && change.changeType === 'CREATION') {
              console.log(
                `🎯 Token Contract Created: ${change.contractAddress}`,
              );
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Asset changes simulation failed:', error);
    }
  }

  function extractTokenAddressFromSimulation(simulationResult) {
    try {
      if (simulationResult.returnValue) {
        try {
          const returnData = iface.decodeFunctionResult(
            'deployToken',
            simulationResult.returnValue,
          );
          if (returnData && returnData.length > 0) {
            console.log(
              `🎯 Found token address in return value: ${returnData[0]}`,
            );
            return returnData[0];
          }
        } catch (decodeError) {
          console.log('Could not decode return value:', decodeError.message);
        }
      }

      if (simulationResult.logs) {
        for (const log of simulationResult.logs) {
          if (log.topics && log.topics.length >= 2) {
            const eventSignature = log.topics[0];
            if (
              eventSignature ===
              '0x6b04d68ca5c822b9c981d731c83ecb1356b96c8596c7659d397d234856a4537b'
            ) {
              const tokenAddress = log.topics[1];
              return tokenAddress;
            }
          }
        }
      }

      if (simulationResult.calls) {
        for (const call of simulationResult.calls) {
          if (call.type === 'CREATE' || call.type === 'CREATE2') {
            return call.to;
          }
        }
      }

      if (simulationResult.trace) {
        for (const trace of simulationResult.trace) {
          if (
            trace.action &&
            trace.action.init &&
            trace.result &&
            trace.result.address
          ) {
            console.log(
              `🏭 Contract creation in trace: ${trace.result.address}`,
            );
            return trace.result.address;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Error extracting token address:', error);
      return null;
    }
  }
  console.log('✅ Agent ready! Monitoring for deployToken transactions...');
}
