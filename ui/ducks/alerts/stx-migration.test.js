import { AlertTypes } from '../../../shared/constants/alerts';
import * as actionConstants from '../../store/actionConstants';
import { setAlertEnabledness } from '../../store/actions';
import reducer, {
  showSTXMigrationAlert,
  dismissSTXMigrationAlert,
  dismissAndDisableAlert,
  stxAlertIsOpen,
} from './stx-migration';
import { ALERT_STATE } from './enums';

jest.mock('../../store/actions', () => ({
  setAlertEnabledness: jest.fn().mockResolvedValue(),
}));

describe('STX Migration Alert', () => {
  const mockState = {
    [AlertTypes.stxMigration]: {
      state: ALERT_STATE.OPEN,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with CLOSED state', () => {
    const result = reducer(undefined, {});
    expect(result.state).toStrictEqual(ALERT_STATE.CLOSED);
  });

  it('should handle showSTXMigrationAlert', () => {
    const result = reducer(
      { state: ALERT_STATE.CLOSED },
      showSTXMigrationAlert(),
    );
    expect(result.state).toStrictEqual(ALERT_STATE.OPEN);
  });

  it('should handle dismissSTXMigrationAlert', () => {
    const result = reducer(
      { state: ALERT_STATE.OPEN },
      dismissSTXMigrationAlert(),
    );
    expect(result.state).toStrictEqual(ALERT_STATE.CLOSED);
  });

  it('opens alert when smartTransactionsOptInStatus becomes true', () => {
    const result = reducer(
      { state: ALERT_STATE.CLOSED },
      {
        type: actionConstants.UPDATE_METAMASK_STATE,
        value: {
          preferences: {
            smartTransactionsOptInStatus: true,
          },
        },
      },
    );
    expect(result.state).toStrictEqual(ALERT_STATE.OPEN);
  });

  describe('stxAlertIsOpen selector', () => {
    it('should return true when alert is open', () => {
      expect(stxAlertIsOpen(mockState)).toBe(true);
    });

    it('should return false when alert is closed', () => {
      const closedState = {
        [AlertTypes.stxMigration]: {
          state: ALERT_STATE.CLOSED,
        },
      };
      expect(stxAlertIsOpen(closedState)).toBe(false);
    });
  });

  describe('dismissAndDisableAlert', () => {
    it('should handle disable alert flow', async () => {
      const mockDispatch = jest.fn();
      await dismissAndDisableAlert()(mockDispatch);

      expect(setAlertEnabledness).toHaveBeenCalledWith(
        AlertTypes.stxMigration,
        false,
      );
      expect(mockDispatch).toHaveBeenNthCalledWith(1, {
        type: `${AlertTypes.stxMigration}/disableAlertRequested`,
      });
    });

    it('should handle errors', async () => {
      const mockDispatch = jest.fn();
      setAlertEnabledness.mockRejectedValueOnce(new Error());
      await dismissAndDisableAlert()(mockDispatch);

      expect(mockDispatch).toHaveBeenNthCalledWith(2, {
        type: `${AlertTypes.stxMigration}/disableAlertFailed`,
      });
    });
  });
});
