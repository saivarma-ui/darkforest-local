import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

task('wallet:new', 'generate a new wallet mnemonic').setAction(walletNew);

async function walletNew({}, hre: HardhatRuntimeEnvironment) {
  const mnemonic = await hre.ethers.utils.entropyToMnemonic(hre.ethers.utils.randomBytes(16));
  const wallet = hre.ethers.Wallet.fromMnemonic(mnemonic);
  console.log('mnemonic:', mnemonic);
  console.log('address:', wallet.address);
  console.log('privateKey: ', wallet.privateKey);
}

task('wallet:info', 'show deployer wallet public address and balance').setAction(walletInfo);

async function walletInfo({}, hre: HardhatRuntimeEnvironment) {
  const [deployer] = await hre.ethers.getSigners();

  console.log('address:', deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log('balance:', hre.ethers.utils.formatEther(balance));
}

task('wallet:send', 'send the native currency of this chain (ETH on mainnet, ALT on ALT chain)')
  .addParam('fromPrivateKey', 'sender private key', "", types.string)
  .addParam('from', 'sender address', "", types.string)
  .addParam('to', 'receiver address', undefined, types.string)
  .addParam('value', 'value to send (in units of ETH/ALT)', undefined, types.float)
  .addParam('nonce', 'nonce to be set', -1, types.int)
  .addParam(
    'dry',
    "dry run only (doesn't carry out transaction, just verifies that it's valid). default: true",
    true,
    types.boolean
  )
  .addParam('gaspricegwei', 'gas price in gwei', 1, types.float)
  .addParam('confirmations', 'confirmations to wait', 1, types.int)
  .setAction(sendValue);

async function sendValue(
  args: {
    fromPrivateKey: string;
    from: string;
    to: string;
    value: number;
    dry: boolean;
    nonce: number;
    gaspricegwei: number;
    confirmations: number;
  },
  hre: HardhatRuntimeEnvironment
) {
  const toIsAddress = hre.ethers.utils.isAddress(args.to);
  if (!toIsAddress) {
    throw new Error(`TO address ${args.to} is NOT a valid address.`);
  }

  if (!args.fromPrivateKey && !args.from || args.fromPrivateKey && args.from) {
    throw new Error(
      'Need to specify either from or fromPrivateKey argument, but cannot be both at the same time.'
    );
  }

  if (args.from) {
    const fromIsAddress = hre.ethers.utils.isAddress(args.from);
    if (!fromIsAddress) {
      throw new Error(`FROM address ${args.from} is NOT a valid address.`);
    }
  }

  const accounts = await hre.ethers.getSigners();
  const sender = args.fromPrivateKey
    ? new hre.ethers.Wallet(args.fromPrivateKey, hre.ethers.provider)
    : accounts.filter((acct) => acct.address.toLowerCase() === args.from.toLowerCase())[0];

  if (!sender) {
    throw new Error(
      `FROM address ${args.from} not found in local wallet or cannot initialize from private key.`
    );
  }

  const parsedValue = hre.ethers.utils.parseEther(args.value.toString());
  const balance = await sender.getBalance();

  if (balance.lt(parsedValue)) {
    throw new Error(
      `${sender.address} trying to send ~$${hre.ethers.utils.formatEther(
        parsedValue
      )} but has ${hre.ethers.utils.formatEther(balance)}. top up and rerun`
    );
  }

  const gasPrice = hre.ethers.utils.parseUnits(args.gaspricegwei.toString(), 'gwei');
  if (gasPrice.gt(hre.ethers.utils.parseUnits('1', 'gwei').mul(1000))) {
    throw new Error(`GAS PRICE TOO HIGH: ${args.gaspricegwei}gwei`);
  }

  console.log(
    `[${hre.network.name}] Sending ${args.value} from ${sender.address} to ${args.to} with gas price ${args.gaspricegwei}gwei\n`
  );

  if (!args.dry) {
    // send the tx
    const { nonce } = args
    const txResponse = await sender.sendTransaction({
      to: args.to,
      value: parsedValue,
      gasPrice,
      ...(nonce >= 0 ? { nonce } : undefined)
    });
    console.log(`Tx submitted with hash: ${txResponse.hash}\n`);

    // await `confirmations` confirmations
    // for some reason if confirmations is 0 then sometimes txReceipt is null
    const txReceipt = await txResponse.wait(args.confirmations);

    // log when confirmed
    console.log(
      `Tx confirmed at block ${txReceipt?.blockNumber} (${args.confirmations} confirmations).\n`
    );
  } else {
    console.log(
      'Dry run successful; exiting without performing transaction. Run with "--dry false" to execute tx'
    );
  }
}
