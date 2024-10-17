import { StateMetadata } from '@metamask/base-controller';
import { StaticIntervalPollingController } from '@metamask/polling-controller';
import {
  BRIDGE_STATUS_CONTROLLER_NAME,
  DEFAULT_BRIDGE_STATUS_CONTROLLER_STATE,
} from './constants';
import {
  BridgeStatusControllerState,
  BridgeStatusControllerMessenger,
  StatusRequest,
} from './types';
import { fetchBridgeTxStatus } from './utils';

const metadata: StateMetadata<{
  bridgeStatusState: BridgeStatusControllerState;
}> = {
  bridgeStatusState: {
    persist: false,
    anonymous: false,
  },
};

export default class BridgeStatusController extends StaticIntervalPollingController<
  typeof BRIDGE_STATUS_CONTROLLER_NAME,
  { bridgeStatusState: BridgeStatusControllerState },
  BridgeStatusControllerMessenger
> {
  constructor({ messenger }: { messenger: BridgeStatusControllerMessenger }) {
    super({
      name: BRIDGE_STATUS_CONTROLLER_NAME,
      metadata,
      messenger,
      state: { bridgeStatusState: DEFAULT_BRIDGE_STATUS_CONTROLLER_STATE },
    });

    // Register action handlers
    this.messagingSystem.registerActionHandler(
      `${BRIDGE_STATUS_CONTROLLER_NAME}:startPollingForBridgeTxStatus`,
      this.startPollingForBridgeTxStatus.bind(this),
    );
  }

  resetState = () => {
    this.update((_state) => {
      _state.bridgeStatusState = {
        ...DEFAULT_BRIDGE_STATUS_CONTROLLER_STATE,
      };
    });
  };

  startPollingForBridgeTxStatus = async (statusRequest: StatusRequest) => {
    // Need to subscribe since if we try to fetch status too fast, API will fail with 500 error
    // So fetch on tx confirmed
    this.messagingSystem.subscribe(
      'TransactionController:transactionConfirmed',
      async (txMeta) => {
        if (txMeta.hash === statusRequest.srcTxHash) {
          this.#fetchBridgeTxStatus(statusRequest);
        }
      },
    );
  };

  #fetchBridgeTxStatus = async (statusRequest: StatusRequest) => {
    const { bridgeStatusState } = this.state;
    const bridgeTxStatus = await fetchBridgeTxStatus(statusRequest);
    this.update((_state) => {
      _state.bridgeStatusState = {
        ...bridgeStatusState,
        txStatuses: {
          ...bridgeStatusState.txStatuses,
          [statusRequest.srcTxHash]: bridgeTxStatus,
        },
      };
    });
  };
}
