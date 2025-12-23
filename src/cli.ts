import 'ethers';
import { ethers } from 'ethers';
const newWallet = ethers.Wallet.createRandom();
console.log('New wallet address:', newWallet.address);
console.log('New wallet private key:', newWallet.privateKey);
