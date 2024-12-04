import { hasProperty, isObject } from '@metamask/utils';
import { cloneDeep } from 'lodash';
import type { SmartTransaction } from '@metamask/smart-transactions-controller/dist/types';

export type VersionedData = {
  meta: {
    version: number;
  };
  data: {
    PreferencesController?: {
      preferences?: {
        smartTransactionsOptInStatus?: boolean | null;
      };
      smartTransactionsOptInStatus?: boolean | null;
    };
    SmartTransactionsController?: {
      smartTransactionsState: {
        smartTransactions: Record<string, SmartTransaction[]>;
      };
    };
  };
};

export const version = 135;

function transformState(state: VersionedData['data']) {
  console.debug('Migration 135 state:', JSON.stringify(state, null, 2));
  console.debug('Migration 135, Transform state input:', state);
  if (
    !hasProperty(state, 'PreferencesController') ||
    !isObject(state.PreferencesController)
  ) {
    global.sentry?.captureException?.(
      new Error(
        `Invalid PreferencesController state: ${typeof state.PreferencesController}`,
      ),
    );
    console.debug('Migration 135 - Invalid PreferencesController');
    return state;
  }

  const { PreferencesController } = state;
  const currentOptInStatus =
    PreferencesController?.smartTransactionsOptInStatus;
    console.debug('Migration 135 - Current STX Status:', currentOptInStatus);

  if (currentOptInStatus === undefined || currentOptInStatus === null) {
    console.debug('Migration 135 - Setting null/undefined status to true');
    PreferencesController.smartTransactionsOptInStatus = true;
  } else if (
    currentOptInStatus === false &&
    !hasExistingSmartTransactions(state)
  ) {
    console.debug('Migration 135 - Setting false status to true (no existing transactions)');
    PreferencesController.smartTransactionsOptInStatus = true;
  }
  console.debug('Migration 135 - Final State:', JSON.stringify(state, null, 2));
  if (!state.PreferencesController.preferences) {
    state.PreferencesController.preferences = {};
  }

  const { preferences } = state.PreferencesController;
  preferences.smartTransactionsOptInStatus = true;

  return state;
}

function hasExistingSmartTransactions(state: VersionedData['data']): boolean {
  if (
    !hasProperty(state, 'SmartTransactionsController') ||
    !isObject(
      state.SmartTransactionsController?.smartTransactionsState
        ?.smartTransactions,
    )
  ) {
    return false;
  }

  const { smartTransactions } =
    state.SmartTransactionsController.smartTransactionsState;

  return Object.values(smartTransactions).some(
    (chainSmartTransactions: SmartTransaction[]) =>
      chainSmartTransactions.length > 0,
  );
}

export async function migrate(
  originalVersionedData: VersionedData,
): Promise<VersionedData> {
  console.debug('=== MIGRATION 135 START ===');
  console.debug('Original version:', originalVersionedData.meta.version);
  console.debug('Original data:', JSON.stringify(originalVersionedData.data, null, 2));
  const versionedData = cloneDeep(originalVersionedData);
  console.debug('STX status before:', versionedData.data?.PreferencesController?.smartTransactionsOptInStatus);
  versionedData.meta.version = version;
  transformState(versionedData.data);
  console.debug('STX status after:', versionedData.data?.PreferencesController?.smartTransactionsOptInStatus);
  console.debug('=== MIGRATION 135 END ===');
  return versionedData;
}
