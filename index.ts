import Web3, { HttpProvider } from "web3";
import type { Transaction } from "web3";
import { DebugPlugin } from "./src/debug-plugin";

const NODE_URL: string =
  "https://sleek-wiser-pool.quiknode.pro/a85cbcccb267d82f279f62ec0a37aab2f51de129/";

const tx: Transaction = {
  from: "0x035C9c507149Fa30b17F9735BF97B4642C73464f",
  to: "0x0000000000a39bb272e79075ade125fd351887ac",
  gas: "0x1E9EF",
  gasPrice: "0x0",
  data: "0xd0e30db0",
};

const ABI = [
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

async function start(): Promise<unknown> {
  const web3: Web3 = new Web3(new HttpProvider(NODE_URL));
  web3.registerPlugin(
    new DebugPlugin({
      tracer: "callTracer",
    }),
  );
  const res = await web3.debug.traceCall(tx);

  const weth1 = new web3.debug.Contract(
    ABI,
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  );

  console.log(await weth1.methods.allowance(tx.from!, tx.to!).traceCall());
  return res;
}

start()
  .then(() => console.log("done"))
  .catch((e) => console.error(e));
