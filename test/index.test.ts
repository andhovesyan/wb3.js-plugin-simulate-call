import Web3, { HttpProvider } from "web3";
import type { Transaction } from "web3-types";
import { DebugPlugin } from "../src/debug-plugin";

const NODE_URL: string =
  "https://ethereum.blockpi.network/v1/rpc/2df67605dbf192fa622bbdf453dd42e55334ee4c";

const tx: Transaction = {
  from: "0x035C9c507149Fa30b17F9735BF97B4642C73464f",
  to: "0x0000000000a39bb272e79075ade125fd351887ac",
  gas: "0x1E9EF",
  gasPrice: "0x0",
  data: "0xd0e30db0",
};

describe("DebugPlugin Tests", () => {
  it("should register DebugPlugin plugin on web3 instance", () => {
    const web3: Web3 = new Web3(new HttpProvider(NODE_URL));
    web3.registerPlugin(new DebugPlugin());
    expect(web3.debug).toBeDefined();
  });

  describe("DebugPlugin method calls", () => {
    let requestManagerSendSpy: jest.SpyInstance;

    let web3: Web3;

    beforeAll(() => {
      web3 = new Web3(new HttpProvider(NODE_URL));
      web3.registerPlugin(new DebugPlugin());

      requestManagerSendSpy = jest.spyOn(web3.debug.requestManager, "send");
    });

    afterAll(() => requestManagerSendSpy.mockRestore());

    it("should call DebugPlugin traceCall method with default params", async () => {
      const r = await web3.debug.traceCall(tx);

      expect(requestManagerSendSpy).toHaveBeenLastCalledWith({
        method: "debug_traceCall",
        params: [tx, "latest", { tracer: "callTracer" }],
      });

      expect(r).toBeDefined();
      expect(r).toHaveProperty("from");
      expect(r).toHaveProperty("to");
      expect(r).toHaveProperty("type");
      expect(r).toHaveProperty("value");
      expect(r).toHaveProperty("input");
      expect(r).toHaveProperty("gas");
      expect(r).toHaveProperty("gasUsed");
      expect(r).toHaveProperty("calls");
    });

    it("should call DebugPlugin traceCall method with expected param", async () => {
      const r = await web3.debug.traceCall(tx, "latest", "prestateTracer");

      expect(r).toBeDefined();

      expect(requestManagerSendSpy).toHaveBeenLastCalledWith({
        method: "debug_traceCall",
        params: [tx, "latest", { tracer: "prestateTracer" }],
      });
    });

    it("should call DebugPlugin traceCall method with expected param", () => {
      web3.debug
        .traceCall(tx, "pending", { onlyTopCall: true })
        .catch(() => {});

      expect(requestManagerSendSpy).toHaveBeenLastCalledWith({
        method: "debug_traceCall",
        params: [tx, "pending", { tracer: "callTracer", onlyTopCall: true }],
      });
    });
  });
});
