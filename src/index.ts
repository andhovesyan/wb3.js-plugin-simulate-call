import Web3, { HttpProvider } from "web3";
import type { Transaction } from "web3";
import { DebugPlugin } from "./debug-plugin";
import FEE_CONVERTER_ABI from "./artifact/Converter";

const FROM = "0xcaB31C2914390D92f630aB8118661EEE95cd26f8";

const FEES = {
  maxFeePerGas: "0x" + Number(61265556303).toString(16),
  maxPriorityFeePerGas: "0x" + Number(31265556303).toString(16),
  gas: "0x" + Number(8e6).toString(16),
};

const NODE_URL: string =
  "https://ethereum.blockpi.network/v1/rpc/2df67605dbf192fa622bbdf453dd42e55334ee4c/";

const tx: Transaction = {
  from: FROM,
  to: "0x0000000000a39bb272e79075ade125fd351887ac",
  data: "0xd0e30db0",
  ...FEES,
};

async function start(): Promise<unknown> {
  const web3: Web3 = new Web3(new HttpProvider(NODE_URL));
  web3.registerPlugin(
    new DebugPlugin({
      tracer: {
        tracer: "callTracer",
        stateOverrides: {
          [FROM]: {
            balance: "0x56bc75e2d63100000",
          },
        },
      },
    }),
  );

  const res = await web3.debug.traceCall(tx);

  const converter = new web3.debug.Contract(
    FEE_CONVERTER_ABI,
    "0xE11fc0B43ab98Eb91e9836129d1ee7c3Bc95df50",
  );

  console.log(
    await converter.methods
      .convert(
        "0x77777FeDdddFfC19Ff86DB637967013e6C6A116C",
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      )
      .traceCall({
        from: FROM,
        ...FEES,
      }),
  );
  return res;
}

start()
  .then(() => console.log("done"))
  .catch((e) => console.error(e));
