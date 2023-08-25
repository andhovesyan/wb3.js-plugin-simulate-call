import {
  Web3PluginBase,
  Contract as Contract,
  InvalidMethodParamsError,
} from "web3";

import type { Web3ContextObject } from "web3-core";

import type {
  Transaction,
  TransactionHash,
  Address,
  ContractAbi,
  AbiFunctionFragment,
  ContractMethod,
  FilterAbis,
  NonPayableCallOptions,
  PayableCallOptions,
  ContractInitOptions,
  BlockNumberOrTag,
  Numbers,
  Bytes,
} from "web3-types";

import type {
  NonPayableMethodObject,
  PayableMethodObject,
} from "web3-eth-contract";

import { isNullish } from "web3-utils";

export declare type PluginConfig = {
  tracer?: string | TraceConfig;
  block?: string;
};

export declare type TraceConfig = {
  tracer?: string;
  onlyTopCall?: boolean;
  disableStorage?: boolean;
  disableStack?: boolean;
  enableMemory?: boolean;
  enableReturnData?: boolean;
  stateOverrides?: object;
  blockoverrides?: object;
};

export type TracerOptions = TraceConfig | string;

export type DebugRpcApi = {
  debug_traceCall: (
    transaction: Transaction,
    block: string,
    tracer: TraceConfig,
  ) => string;
};

// TODO: Add more tracers
export interface CallTracerOutput<N = Numbers, A = Address, B = Bytes> {
  from: A;
  to: A;
  gas: N;
  gasUsed: N;
  input: B;
  output: B;
  value: N;
  type: string;
  calls?: CallTracerOutput[];
}

type DebugableMethodObject<CallOptions> = {
  traceCall(options?: CallOptions): Promise<CallTracerOutput>;
};

export type DebugPayableMethodObject<
  Inputs = unknown[],
  Outputs = unknown[],
> = PayableMethodObject<Inputs, Outputs> &
  DebugableMethodObject<PayableCallOptions>;

export type DebugNonPayableMethodObject<
  Inputs = unknown[],
  Outputs = unknown[],
> = NonPayableMethodObject<Inputs, Outputs> &
  DebugableMethodObject<NonPayableCallOptions>;

export type DebugableContractBoundMethod<
  Abi extends AbiFunctionFragment,
  Method extends ContractMethod<Abi> = ContractMethod<Abi>,
> = (
  ...args: Method["Inputs"]
) => Method["Abi"]["stateMutability"] extends "payable" | "pure"
  ? DebugPayableMethodObject<Method["Inputs"], Method["Outputs"]>
  : DebugNonPayableMethodObject<Method["Inputs"], Method["Outputs"]>;

export type DebugableContractMethodsInterface<Abi extends ContractAbi> = {
  [MethodAbi in FilterAbis<
    Abi,
    AbiFunctionFragment & { type: "function" }
  > as MethodAbi["name"]]: DebugableContractBoundMethod<MethodAbi>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} & { [key: string]: DebugableContractBoundMethod<any> };

function configureTracer(tracer: string | TraceConfig): TraceConfig {
  if (typeof tracer === "string") {
    return { tracer };
  } else if (!tracer.tracer) {
    return { ...tracer, tracer: "callTracer" };
  }
  return tracer;
}

export class DebugContract<Abi extends ContractAbi> extends Contract<Abi> {
  protected _debugableMethods = {} as DebugableContractMethodsInterface<Abi>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public constructor(jsonInterface: Abi, ...args: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    super(jsonInterface, ...args);
  }

  public get methods(): DebugableContractMethodsInterface<Abi> {
    return super.methods as DebugableContractMethodsInterface<Abi>;
  }
}

export class DebugPlugin extends Web3PluginBase<DebugRpcApi> {
  public pluginNamespace = "debug";

  public Contract: typeof DebugContract;

  private defaults: PluginConfig = {
    tracer: "callTracer",
    block: "latest",
  };

  public constructor(defaults: PluginConfig = {}) {
    super();
    this.defaults = { ...this.defaults, ...defaults };

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    this.Contract = class<Abi extends ContractAbi> extends DebugContract<Abi> {
      public constructor(jsonInterface: Abi);
      public constructor(jsonInterface: Abi, address: Address);
      public constructor(jsonInterface: Abi, options: ContractInitOptions);
      public constructor(
        jsonInterface: Abi,
        address: Address,
        options: ContractInitOptions,
      );
      public constructor(
        jsonInterface: Abi,
        addressOrOptions?: Address | ContractInitOptions,
        options?: ContractInitOptions,
      ) {
        if (
          typeof addressOrOptions === "object" &&
          typeof options === "object"
        ) {
          throw new InvalidMethodParamsError(
            "Should not provide options at both 2nd and 3rd parameters",
          );
        }
        if (isNullish(addressOrOptions)) {
          super(
            jsonInterface,
            options,
            self.getContextObject() as Web3ContextObject,
          );
        } else if (typeof addressOrOptions === "object") {
          super(
            jsonInterface,
            addressOrOptions,
            self.getContextObject() as Web3ContextObject,
          );
        } else if (typeof addressOrOptions === "string") {
          super(
            jsonInterface,
            addressOrOptions,
            options ?? {},
            self.getContextObject() as Web3ContextObject,
          );
        } else {
          throw new InvalidMethodParamsError();
        }

        super.subscribeToContextEvents(self);

        this._debugableMethods = Object.fromEntries(
          Object.entries(super.methods).map(([k, t]) => {
            return [
              k,
              ((...args) => {
                const res = t(...args);
                return {
                  ...res,
                  traceCall: (
                    options?: PayableCallOptions | NonPayableCallOptions,
                    block: BlockNumberOrTag = self.defaults.block!,
                    tracer: TracerOptions = self.defaults.tracer!,
                  ) => {
                    return self.traceCall(
                      {
                        ...options,
                        input: res.encodeABI(),
                        to: this.options.address,
                      },
                      block,
                      tracer,
                    );
                  },
                };
              }) as typeof t,
            ];
          }),
        ) as DebugableContractMethodsInterface<Abi>;
      }

      public get methods(): DebugableContractMethodsInterface<Abi> {
        return this._debugableMethods;
      }
    };
  }

  public traceCall(
    transaction: Transaction,
    block: BlockNumberOrTag = this.defaults.block!,
    tracer: string | TraceConfig = this.defaults.tracer!,
  ): Promise<CallTracerOutput> {
    tracer = configureTracer(tracer);
    return this.requestManager.send({
      method: "debug_traceCall",
      params: [transaction, block, tracer],
    });
  }

  public traceTransaction(
    hash: TransactionHash,
    tracer: string | TraceConfig = this.defaults.tracer!,
  ): Promise<CallTracerOutput> {
    tracer = configureTracer(tracer);
    return this.requestManager.send({
      method: "debug_traceTransaction",
      params: [hash, tracer],
    });
  }
}

// Module Augmentation
declare module "web3" {
  interface Web3Context {
    debug: DebugPlugin;
  }
}
